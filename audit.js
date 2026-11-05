// audit.js
// Fetches a website and runs a set of marketing/SEO health checks against it.
// Each check returns: { id, label, category, impact, action, passed, weight, detail }

import * as cheerio from "cheerio";
import { normalizeUrl, safeFetch, isPublicHttpUrl } from "./fetchUtils.js";
import { getImageSize } from "./imageSize.js";

const CHECK_WEIGHT = 1; // every check counts equally for the MVP score

// Categories power the "Brand Health Score" breakdown on the dashboard.
export const CATEGORIES = {
  search_visibility: "Search Visibility",
  website_experience: "Website Experience",
  brand_trust: "Brand Trust",
  social_sharing: "Social Sharing",
};

// Pulls out the human-readable parts of the homepage (what the business says
// about itself) so Claude can write advice specific to *this* business.
// None of this is scored; it's context for the AI report.
function extractPageContext($, { title, metaDesc }) {
  const clean = (t) => (t || "").replace(/\s+/g, " ").trim();
  const uniq = (arr, max) => [...new Set(arr.map(clean).filter(Boolean))].slice(0, max);

  // Business types the site declares about itself in its structured data
  // (e.g. "Restaurant", "Dentist", "LocalBusiness", "Product").
  const schemaTypes = [];
  let schemaName = "";
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).contents().text());
      const items = (Array.isArray(data) ? data : [data]).flatMap((d) => d?.["@graph"] || [d]);
      for (const item of items) {
        const t = item?.["@type"];
        if (t) schemaTypes.push(...(Array.isArray(t) ? t : [t]));
        // Take the name from the first item that describes the business itself,
        // not the web page, breadcrumbs, images, etc.
        if (!schemaName && typeof item?.name === "string" && t && !/WebSite|WebPage|Breadcrumb|ImageObject|SiteNavigation|SearchAction|Article|BlogPosting|FAQ|Question|VideoObject/i.test(String(t))) {
          schemaName = item.name;
        }
      }
    } catch {
      // Malformed structured data: ignore it, it's only context.
    }
  });

  const h1 = clean($("h1").first().text());
  const subheadings = uniq($("h2, h3").map((_, el) => $(el).text()).get(), 8);
  const navLinks = uniq($("nav a, header a").map((_, el) => $(el).text()).get(), 12);
  const buttons = uniq(
    $("button, a.btn, a.button, a[class*='btn'], a[class*='button'], input[type='submit']")
      .map((_, el) => $(el).text() || $(el).attr("value"))
      .get(),
    8
  );

  // Visible page text, minus code and hidden bits, trimmed to a short excerpt.
  const body = $("body").clone();
  body.find("script, style, noscript, svg, iframe, template").remove();
  body.find("*").append(" "); // keep words from separate elements apart
  const textExcerpt = clean(body.find("main").text() || body.text()).slice(0, 2000);

  return {
    siteName: clean($('meta[property="og:site_name"]').attr("content")) || schemaName,
    title,
    description: metaDesc,
    headline: h1,
    subheadings,
    navLinks,
    buttons,
    schemaTypes: uniq(schemaTypes.map(String), 6),
    hasPhoneLink: $('a[href^="tel:"]').length > 0,
    hasEmailLink: $('a[href^="mailto:"]').length > 0,
    language: $("html").attr("lang") || "",
    textExcerpt,
  };
}

// Checks the image a site shows when its link is shared on Facebook,
// Instagram DMs, LinkedIn, iMessage, etc. We load it the way those apps would
// and check it exists, is an image, and is big enough to show as a large card.
const MIN_SHARE_W = 600;
const MIN_SHARE_H = 315;
const MAX_SHARE_BYTES = 8 * 1024 * 1024; // Facebook's limit

async function inspectShareImage(imageUrl) {
  const res = await safeFetch(imageUrl, { timeoutMs: 8000 });
  if (!res || !res.ok) return { loads: false };
  const type = res.headers.get("content-type") || "";
  if (!type.startsWith("image/")) return { loads: false, notImage: true };

  // Read just enough bytes to find the dimensions (and stop on huge files).
  const reader = res.body.getReader();
  const chunks = [];
  let total = 0;
  let size = null;
  while (total < MAX_SHARE_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
    size = getImageSize(Buffer.concat(chunks));
    if (size) break; // we have the dimensions, no need to download the rest
  }
  reader.cancel().catch(() => {});
  const declaredBytes = Number(res.headers.get("content-length")) || null;
  return { loads: true, type, ...size, bytes: declaredBytes };
}

export async function runAudit(rawInput) {
  const url = normalizeUrl(rawInput);
  if (!isPublicHttpUrl(url)) {
    return { url, error: "Please enter a public website address, like yourbusiness.com." };
  }
  const origin = new URL(url).origin;

  const homepageRes = await safeFetch(url);
  if (!homepageRes || !homepageRes.ok) {
    return {
      url,
      error: `We couldn't reach ${url}. Check the spelling, or make sure the site is publicly accessible.`,
    };
  }

  const html = await homepageRes.text();
  const $ = cheerio.load(html);
  const checks = [];

  // --- Title tag ---
  const title = $("title").first().text().trim();
  checks.push({
    id: "title",
    label: "Search result headline",
    category: "search_visibility",
    impact: "high",
    action: "Add a clear search result headline",
    passed: title.length > 0 && title.length <= 60,
    weight: CHECK_WEIGHT,
    detail: !title
      ? "Google doesn't have a headline to show for your homepage in search results. This is one of the first things a customer sees before they click — without it, your listing looks unfinished next to competitors."
      : title.length > 60
      ? `Your search result headline is ${title.length} characters, longer than the ~60 Google usually shows in full. It may get cut off mid-sentence in search results.`
      : `Google has a clear headline ("${title}") to show for your homepage.`,
  });

  // --- Meta description ---
  const metaDesc = $('meta[name="description"]').attr("content")?.trim() || "";
  checks.push({
    id: "meta_description",
    label: "Search result description",
    category: "search_visibility",
    impact: "high",
    action: "Add a homepage description for Google",
    passed: metaDesc.length > 0,
    weight: CHECK_WEIGHT,
    detail: !metaDesc
      ? "Google doesn't have a description for your homepage. Add a short summary of your business so customers know what you offer before clicking your search result."
      : `Google has a description ready to show for your homepage (${metaDesc.length} characters).`,
  });

  // --- H1 heading ---
  const h1s = $("h1");
  checks.push({
    id: "h1",
    label: "Homepage headline",
    category: "website_experience",
    impact: "medium",
    action: "Add a clear main headline",
    passed: h1s.length === 1,
    weight: CHECK_WEIGHT,
    detail:
      h1s.length === 0
        ? "Your homepage doesn't have a clear main headline. Visitors often decide in seconds whether they're in the right place — a strong headline helps them instantly understand what you offer."
        : h1s.length > 1
        ? `Your homepage has ${h1s.length} competing main headlines, which can confuse visitors and search engines about your primary message.`
        : "Your homepage has one clear main headline.",
  });

  // --- Image alt text ---
  const images = $("img");
  const missingAlt = images.filter((_, el) => !$(el).attr("alt")?.trim()).length;
  checks.push({
    id: "image_alt",
    label: "Image optimization",
    category: "website_experience",
    impact: "medium",
    action: "Add descriptions to your images",
    passed: images.length === 0 || missingAlt === 0,
    weight: CHECK_WEIGHT,
    detail:
      images.length === 0
        ? "No images were found on the homepage."
        : missingAlt === 0
        ? `All ${images.length} images on your homepage are optimized for search and accessibility.`
        : `${missingAlt} of ${images.length} images aren't optimized for search. Adding descriptions helps Google understand your website and helps visitors using screen readers.`,
  });

  // --- Open Graph tags ---
  const ogTitle = $('meta[property="og:title"]').attr("content");
  const ogDesc = $('meta[property="og:description"]').attr("content");
  const ogImage = $('meta[property="og:image"]').attr("content");
  const ogComplete = Boolean(ogTitle && ogDesc && ogImage);
  checks.push({
    id: "open_graph",
    label: "Social media previews",
    category: "social_sharing",
    impact: "medium",
    action: "Fix how your site looks when shared on Facebook or LinkedIn",
    passed: ogComplete,
    weight: CHECK_WEIGHT,
    detail: ogComplete
      ? "Your website shows a clean, branded preview when a link to it is shared on Facebook, LinkedIn, or iMessage."
      : "When someone shares a link to your website on Facebook or LinkedIn, the preview may look broken, blank, or generic — which makes people less likely to click.",
  });

  // --- Share image (link preview) ---
  // Resolve relative image paths ("/img/share.png") against the page address.
  let shareImageUrl = null;
  try {
    shareImageUrl = ogImage ? new URL(ogImage, homepageRes.url || url).href : null;
  } catch {
    shareImageUrl = null;
  }
  const shareImage = shareImageUrl ? await inspectShareImage(shareImageUrl) : null;
  const declaredW = Number($('meta[property="og:image:width"]').attr("content")) || null;
  const declaredH = Number($('meta[property="og:image:height"]').attr("content")) || null;
  const shareW = shareImage?.width || declaredW;
  const shareH = shareImage?.height || declaredH;
  const bigEnough = shareW && shareH ? shareW >= MIN_SHARE_W && shareH >= MIN_SHARE_H : true;
  const shareImagePassed = Boolean(shareImage?.loads && bigEnough);
  checks.push({
    id: "share_image",
    label: "Share image",
    category: "social_sharing",
    impact: "medium",
    action: "Add a share image that shows up when your link is posted",
    passed: shareImagePassed,
    weight: CHECK_WEIGHT,
    detail: !shareImageUrl
      ? "Your website doesn't name an image to show when someone shares your link on Facebook, Instagram messages, LinkedIn, or iMessage, so the preview shows no picture or a random one. Add a 1200×630 image, like your logo or storefront."
      : !shareImage?.loads
      ? "Your website names a share image, but we couldn't load it. When your link is shared, the preview will likely show no picture. Check the image address still works."
      : !bigEnough
      ? `Your share image is ${shareW}×${shareH} pixels. Facebook and LinkedIn show a small thumbnail instead of a big preview card for images under ${MIN_SHARE_W}×${MIN_SHARE_H}. 1200×630 works best.`
      : `Your share image loads and is a good size${shareW ? ` (${shareW}×${shareH})` : ""} for a large preview card on Facebook, LinkedIn, and iMessage.`,
  });

  // What a shared link would look like, for the mock preview card.
  const linkPreview = {
    title: ogTitle || title || "",
    description: ogDesc || metaDesc || "",
    image: shareImage?.loads ? shareImageUrl : null,
    domain: new URL(homepageRes.url || url).hostname.replace(/^www\./, ""),
    usesFallbackText: !ogTitle || !ogDesc,
  };

  // --- Schema / structured data ---
  const schemaBlocks = $('script[type="application/ld+json"]');
  checks.push({
    id: "schema",
    label: "Rich search results",
    category: "search_visibility",
    impact: "medium",
    action: "Add rich details for search results",
    passed: schemaBlocks.length > 0,
    weight: CHECK_WEIGHT,
    detail:
      schemaBlocks.length > 0
        ? "Your website includes information that can help Google show richer details — like your hours, ratings, or location — directly in search results."
        : "Your website is missing information that would let Google show richer details, like your hours or ratings, directly in search results next to your listing.",
  });

  // --- Favicon ---
  const favicon =
    $('link[rel="icon"]').attr("href") || $('link[rel="shortcut icon"]').attr("href");
  checks.push({
    id: "favicon",
    label: "Browser tab icon",
    category: "brand_trust",
    impact: "low",
    action: "Add a browser tab icon",
    passed: Boolean(favicon),
    weight: CHECK_WEIGHT,
    detail: favicon
      ? "Your website has a professional icon that shows in browser tabs and bookmarks."
      : "Your website doesn't have a small icon that shows in browser tabs and bookmarks. It's a small detail, but its absence can make a site feel unfinished.",
  });

  // --- SSL ---
  const isHttps = url.startsWith("https://");
  checks.push({
    id: "ssl",
    label: "Secure connection",
    category: "brand_trust",
    impact: "high",
    action: "Secure your website with HTTPS",
    passed: isHttps,
    weight: CHECK_WEIGHT,
    detail: isHttps
      ? "Your website loads securely, so visitors won't see any security warnings."
      : "Your website doesn't load securely. Browsers will warn visitors that your site is 'Not Secure' — one of the fastest ways to lose a customer's trust before they even see your content.",
  });

  // --- robots.txt ---
  const robotsRes = await safeFetch(origin + "/robots.txt");
  const hasRobots = Boolean(robotsRes && robotsRes.ok);
  checks.push({
    id: "robots",
    label: "Search engine instructions",
    category: "search_visibility",
    impact: "low",
    action: "Add instructions for search engines",
    passed: hasRobots,
    weight: CHECK_WEIGHT,
    detail: hasRobots
      ? "Your website gives search engines clear instructions for how to explore it."
      : "Your website doesn't tell search engines how to explore it — a small, easy improvement for search visibility.",
  });

  // --- sitemap.xml ---
  const sitemapRes = await safeFetch(origin + "/sitemap.xml");
  const hasSitemap = Boolean(sitemapRes && sitemapRes.ok);
  checks.push({
    id: "sitemap",
    label: "Site map for search engines",
    category: "search_visibility",
    impact: "medium",
    action: "Add a sitemap for search engines",
    passed: hasSitemap,
    weight: CHECK_WEIGHT,
    detail: hasSitemap
      ? "Search engines have a map of your website's pages, helping them find and index everything you offer."
      : "Search engines don't have a map of your website's pages, which can make it harder for them to find and index everything you offer.",
  });

  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0);
  const earnedWeight = checks.reduce((sum, c) => sum + (c.passed ? c.weight : 0), 0);
  const score = Math.round((earnedWeight / totalWeight) * 100);

  const categories = Object.entries(CATEGORIES).map(([id, label]) => {
    const inCategory = checks.filter((c) => c.category === id);
    const passedCount = inCategory.filter((c) => c.passed).length;
    const pct = inCategory.length
      ? Math.round((passedCount / inCategory.length) * 100)
      : 100;
    return { id, label, score: pct, verdict: categoryVerdict(id, pct) };
  });

  return {
    url,
    score,
    categories,
    checks,
    linkPreview,
    pageContext: extractPageContext($, { title, metaDesc }),
    scannedAt: new Date().toISOString(),
  };
}

function categoryVerdict(categoryId, pct) {
  const strong = {
    search_visibility: "Search engines have what they need to show you clearly.",
    website_experience: "Customers can easily understand and navigate your site.",
    brand_trust: "Your website includes the signals that build customer trust.",
    social_sharing: "Your links look sharp when customers share them.",
  };
  const weak = {
    search_visibility: "Search engines are missing information that limits your visibility.",
    website_experience: "Some opportunities exist to help customers navigate more easily.",
    brand_trust: "A few trust signals are missing that customers look for.",
    social_sharing: "Shared links may not represent your brand well right now.",
  };
  return pct >= 75 ? strong[categoryId] : weak[categoryId];
}
