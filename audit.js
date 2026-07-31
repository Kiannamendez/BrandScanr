// audit.js
// Fetches a website and runs a set of marketing/SEO health checks against it.
// Each check returns: { id, label, passed, weight, detail }

import * as cheerio from "cheerio";

const CHECK_WEIGHT = 1; // every check counts equally for the MVP score

// Categories power the "Brand Health Score" breakdown on the dashboard.
export const CATEGORIES = {
  search_visibility: "Search Visibility",
  website_experience: "Website Experience",
  brand_trust: "Brand Trust",
  social_sharing: "Social Sharing",
};

function normalizeUrl(input) {
  let url = input.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = "https://" + url;
  }
  return url;
}

async function safeFetch(url, options = {}) {
  try {
    const res = await fetch(url, { redirect: "follow", ...options });
    return res;
  } catch (err) {
    return null;
  }
}

export async function runAudit(rawInput) {
  const url = normalizeUrl(rawInput);
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
