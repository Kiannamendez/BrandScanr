// audit.js
// Fetches a website and runs a set of marketing/SEO health checks against it.
// Each check returns: { id, label, passed, weight, detail }

import * as cheerio from "cheerio";

const CHECK_WEIGHT = 1; // every check counts equally for the MVP score

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
    label: "Title tag",
    passed: title.length > 0 && title.length <= 60,
    weight: CHECK_WEIGHT,
    detail: !title
      ? "Your homepage is missing a <title> tag entirely. This is one of the strongest ranking and click-through signals in search results."
      : title.length > 60
      ? `Your title tag is ${title.length} characters, which is longer than the ~60 characters Google typically displays. It may get cut off in search results.`
      : `Your title tag ("${title}") is present and a good length.`,
  });

  // --- Meta description ---
  const metaDesc = $('meta[name="description"]').attr("content")?.trim() || "";
  checks.push({
    id: "meta_description",
    label: "Meta description",
    passed: metaDesc.length > 0,
    weight: CHECK_WEIGHT,
    detail: !metaDesc
      ? "Your homepage doesn't have a meta description, which can reduce click-through rates from Google Search. Adding one (roughly 120-155 characters) could improve visibility."
      : `A meta description is present (${metaDesc.length} characters).`,
  });

  // --- H1 heading ---
  const h1s = $("h1");
  checks.push({
    id: "h1",
    label: "Main heading (H1)",
    passed: h1s.length === 1,
    weight: CHECK_WEIGHT,
    detail:
      h1s.length === 0
        ? "No H1 heading was found. A clear main heading helps both visitors and search engines understand what the page is about."
        : h1s.length > 1
        ? `${h1s.length} H1 headings were found. Using more than one can dilute the page's focus for search engines.`
        : "A single, clear H1 heading is present.",
  });

  // --- Image alt text ---
  const images = $("img");
  const missingAlt = images.filter((_, el) => !$(el).attr("alt")?.trim()).length;
  checks.push({
    id: "image_alt",
    label: "Image alt text",
    passed: images.length === 0 || missingAlt === 0,
    weight: CHECK_WEIGHT,
    detail:
      images.length === 0
        ? "No images were found on the homepage."
        : missingAlt === 0
        ? `All ${images.length} images have alt text. Nice work — this helps accessibility and image search.`
        : `${missingAlt} of ${images.length} images are missing alt text. This makes your site harder to use with screen readers and less discoverable in image search.`,
  });

  // --- Open Graph tags ---
  const ogTitle = $('meta[property="og:title"]').attr("content");
  const ogDesc = $('meta[property="og:description"]').attr("content");
  const ogImage = $('meta[property="og:image"]').attr("content");
  const ogComplete = Boolean(ogTitle && ogDesc && ogImage);
  checks.push({
    id: "open_graph",
    label: "Open Graph tags",
    passed: ogComplete,
    weight: CHECK_WEIGHT,
    detail: ogComplete
      ? "Open Graph tags are set up, so links to your site should look good when shared on Facebook, LinkedIn, and iMessage."
      : "Open Graph tags (og:title, og:description, og:image) are missing or incomplete. Without them, links to your site may look broken or generic when shared on social media.",
  });

  // --- Twitter Card ---
  const twitterCard = $('meta[name="twitter:card"]').attr("content");
  checks.push({
    id: "twitter_card",
    label: "Twitter/X card",
    passed: Boolean(twitterCard),
    weight: CHECK_WEIGHT,
    detail: twitterCard
      ? "A Twitter/X card tag is present."
      : "No Twitter/X card tag was found, so shared links may not preview correctly on X.",
  });

  // --- Schema / structured data ---
  const schemaBlocks = $('script[type="application/ld+json"]');
  checks.push({
    id: "schema",
    label: "Structured data (schema.org)",
    passed: schemaBlocks.length > 0,
    weight: CHECK_WEIGHT,
    detail:
      schemaBlocks.length > 0
        ? "Structured data (schema.org) was found, which can help search engines show richer results like star ratings or business hours."
        : "No structured data (schema.org / JSON-LD) was found. Adding LocalBusiness schema can help you show up with richer info in search results.",
  });

  // --- Favicon ---
  const favicon =
    $('link[rel="icon"]').attr("href") || $('link[rel="shortcut icon"]').attr("href");
  checks.push({
    id: "favicon",
    label: "Favicon",
    passed: Boolean(favicon),
    weight: CHECK_WEIGHT,
    detail: favicon
      ? "A favicon is set, which helps your site look legitimate in browser tabs and bookmarks."
      : "No favicon was found. It's a small detail, but its absence can make a site feel unfinished or untrustworthy.",
  });

  // --- SSL ---
  const isHttps = url.startsWith("https://");
  checks.push({
    id: "ssl",
    label: "SSL certificate (HTTPS)",
    passed: isHttps,
    weight: CHECK_WEIGHT,
    detail: isHttps
      ? "Your site loads securely over HTTPS."
      : "Your site does not load over HTTPS. Browsers flag non-HTTPS sites as 'Not Secure', which can scare off visitors.",
  });

  // --- robots.txt ---
  const robotsRes = await safeFetch(origin + "/robots.txt");
  const hasRobots = Boolean(robotsRes && robotsRes.ok);
  checks.push({
    id: "robots",
    label: "robots.txt",
    passed: hasRobots,
    weight: CHECK_WEIGHT,
    detail: hasRobots
      ? "A robots.txt file is present, giving search engines guidance on what to crawl."
      : "No robots.txt file was found at the root of your site.",
  });

  // --- sitemap.xml ---
  const sitemapRes = await safeFetch(origin + "/sitemap.xml");
  const hasSitemap = Boolean(sitemapRes && sitemapRes.ok);
  checks.push({
    id: "sitemap",
    label: "Sitemap",
    passed: hasSitemap,
    weight: CHECK_WEIGHT,
    detail: hasSitemap
      ? "A sitemap.xml file is present, helping search engines find and index your pages."
      : "No sitemap.xml file was found at the root of your site. A sitemap helps search engines discover all of your pages.",
  });

  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0);
  const earnedWeight = checks.reduce((sum, c) => sum + (c.passed ? c.weight : 0), 0);
  const score = Math.round((earnedWeight / totalWeight) * 100);

  return {
    url,
    score,
    checks,
    scannedAt: new Date().toISOString(),
  };
}
