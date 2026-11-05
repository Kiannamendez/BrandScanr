// pagespeed.js
// Adds a "Speed & Accessibility" category using Google PageSpeed Insights:
// Google loads the page on a simulated phone and grades it. When Google has
// enough real Chrome visitors to the site, the same response also includes
// real-world speed data (the Chrome UX Report).
//
// Needs GOOGLE_API_KEY (free, from Google Cloud with the PageSpeed Insights
// API enabled). Without it, this category is skipped and the rest of the
// report is unaffected.
//
// This runs separately from the main scan because Google takes ~10-30 seconds.

import { normalizeUrl, isPublicHttpUrl } from "./fetchUtils.js";

const PSI_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const CATEGORIES = ["performance", "accessibility", "best-practices"];

// Plain-English names for Google's most common recommendations.
// Anything not listed here falls back to Google's own title.
const PLAIN_TITLES = {
  "render-blocking-resources": "Load key content before extra code and styles",
  "render-blocking-insight": "Load key content before extra code and styles",
  "unused-javascript": "Remove code the page downloads but doesn't use",
  "unused-css-rules": "Remove unused styling code",
  "uses-optimized-images": "Compress your images",
  "modern-image-formats": "Use lighter, modern image formats",
  "uses-responsive-images": "Serve smaller images to phones",
  "image-delivery-insight": "Compress and resize your images",
  "offscreen-images": "Wait to load images until visitors scroll to them",
  "uses-text-compression": "Turn on compression on your web server",
  "server-response-time": "Speed up how fast your server first responds",
  "document-latency-insight": "Speed up how fast your server first responds",
  "redirects": "Avoid extra redirects before the page loads",
  "total-byte-weight": "Make the page lighter to download",
  "uses-long-cache-ttl": "Let browsers remember files between visits",
  "cache-insight": "Let browsers remember files between visits",
  "third-party-summary": "Cut back on third-party add-ons and trackers",
  "third-parties-insight": "Cut back on third-party add-ons and trackers",
  "largest-contentful-paint-element": "Make the biggest thing on screen load sooner",
  "lcp-discovery-insight": "Make the biggest thing on screen load sooner",
  "layout-shift-elements": "Stop content from jumping around while loading",
  "cls-culprits-insight": "Stop content from jumping around while loading",
  "font-display": "Show text while custom fonts load",
  "font-display-insight": "Show text while custom fonts load",
  "color-contrast": "Make text easier to read against its background",
  "image-alt": "Describe your images for screen readers",
  "link-name": "Give every link readable text",
  "button-name": "Give every button a readable label",
  "label": "Label your form fields",
  "heading-order": "Put headings in a logical order",
  "html-has-lang": "Tell browsers what language your page is in",
  "target-size": "Make buttons and links big enough to tap",
  "meta-viewport": "Let visitors zoom on phones",
};

function scoreOf(lhr, id) {
  const s = lhr?.categories?.[id]?.score;
  return typeof s === "number" ? Math.round(s * 100) : null;
}

function band(score) {
  if (score >= 90) return "good";
  if (score >= 50) return "needs work";
  return "poor";
}

// Top fixes for speed: Google's "opportunity" audits that are failing,
// biggest estimated time saving first.
function speedFixes(lhr) {
  const refs = lhr?.categories?.performance?.auditRefs || [];
  return refs
    .map((ref) => lhr.audits?.[ref.id])
    .filter((a) => a && typeof a.score === "number" && a.score < 0.9)
    .map((a) => ({
      id: a.id,
      savingsMs:
        a.details?.overallSavingsMs ??
        a.metricSavings?.LCP ??
        a.metricSavings?.FCP ??
        0,
    }))
    .filter((a) => a.savingsMs > 100)
    .sort((a, b) => b.savingsMs - a.savingsMs)
    .slice(0, 3)
    .map((a) => ({
      title: PLAIN_TITLES[a.id] || stripLinks(lhr.audits[a.id].title),
      detail: `Google estimates this could make your page load about ${(a.savingsMs / 1000).toFixed(1)}s faster.`,
      area: "Speed",
    }));
}

// Top fixes for accessibility: failing checks, ordered by Google's weighting.
function accessibilityFixes(lhr) {
  const refs = lhr?.categories?.accessibility?.auditRefs || [];
  return refs
    .filter((ref) => ref.weight > 0)
    .map((ref) => ({ ref, audit: lhr.audits?.[ref.id] }))
    .filter(({ audit }) => audit && audit.score === 0)
    .sort((a, b) => b.ref.weight - a.ref.weight)
    .slice(0, 3)
    .map(({ audit }) => {
      const count = audit.details?.items?.length;
      return {
        title: PLAIN_TITLES[audit.id] || stripLinks(audit.title),
        detail: count
          ? `Google found ${count === 1 ? "1 place" : `${count} places`} on your homepage that ${count === 1 ? "needs" : "need"} this.`
          : "Google flagged this on your homepage.",
        area: "Accessibility",
      };
    });
}

function stripLinks(text) {
  // Google's text contains markdown links like [Learn more](https://...)
  return String(text || "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/`/g, "");
}

// Real-visitor data from Chrome users (only exists for sites with enough traffic).
function realUserCheck(data) {
  const page = data.loadingExperience;
  const origin = data.originLoadingExperience;
  const exp = page?.metrics && Object.keys(page.metrics).length ? page : origin;
  if (!exp?.metrics || !Object.keys(exp.metrics).length || !exp.overall_category) return null;

  const passed = exp.overall_category === "FAST";
  const lcp = exp.metrics.LARGEST_CONTENTFUL_PAINT_MS?.percentile;
  const lcpText = lcp ? ` For most visitors, the main content appears in about ${(lcp / 1000).toFixed(1)}s.` : "";
  return {
    id: "psi_real_users",
    label: "Real visitor experience",
    category: "speed_accessibility",
    impact: "high",
    action: "Speed up your site for real visitors",
    passed,
    detail: passed
      ? `Google's data from real Chrome visitors over the last 28 days says your site loads quickly and feels stable.${lcpText}`
      : `Google's data from real Chrome visitors over the last 28 days says your site feels slow or jumpy for a noticeable share of people. Google uses this when ranking search results.${lcpText}`,
  };
}

export async function runPageSpeed(rawUrl) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) return { available: false, reason: "not_configured" };

  const url = normalizeUrl(rawUrl);
  if (!isPublicHttpUrl(url)) return { available: false, reason: "invalid_url" };

  const params = new URLSearchParams({ url, strategy: "mobile", key: apiKey });
  CATEGORIES.forEach((c) => params.append("category", c));

  let data;
  try {
    const res = await fetch(`${PSI_ENDPOINT}?${params}`, { signal: AbortSignal.timeout(70000) });
    data = await res.json();
    if (!res.ok) {
      console.warn(`PageSpeed error ${res.status}: ${data?.error?.message || "unknown"}`);
      return { available: false, reason: res.status === 429 ? "quota" : "google_error" };
    }
  } catch (err) {
    console.warn("PageSpeed request failed:", err?.message || err);
    return { available: false, reason: "timeout" };
  }

  const lhr = data.lighthouseResult;
  const perf = scoreOf(lhr, "performance");
  const a11y = scoreOf(lhr, "accessibility");
  const bp = scoreOf(lhr, "best-practices");

  const checks = [];
  if (perf !== null) {
    checks.push({
      id: "psi_performance",
      label: "Mobile page speed",
      category: "speed_accessibility",
      impact: "high",
      action: "Make your homepage load faster on phones",
      passed: perf >= 50,
      detail: `Google scored your homepage ${perf}/100 for speed on a phone (${band(perf)}). ${
        perf >= 90
          ? "Visitors on mobile get a fast first impression."
          : "Slow pages lose visitors before they see what you offer, and speed is part of how Google ranks sites."
      }`,
    });
  }
  const realUsers = realUserCheck(data);
  if (realUsers) checks.push(realUsers);
  if (a11y !== null) {
    checks.push({
      id: "psi_accessibility",
      label: "Accessibility",
      category: "speed_accessibility",
      impact: "medium",
      action: "Make your site easier for everyone to use",
      passed: a11y >= 90,
      detail: `Google scored your homepage ${a11y}/100 for accessibility (${band(a11y)}). ${
        a11y >= 90
          ? "Visitors with low vision or who use screen readers can use your site well."
          : "Some visitors, including people with low vision or who use screen readers, may struggle to read or use parts of your site."
      }`,
    });
  }
  if (bp !== null) {
    checks.push({
      id: "psi_best_practices",
      label: "Technical health",
      category: "speed_accessibility",
      impact: "low",
      action: "Fix technical warnings Google found",
      passed: bp >= 90,
      detail: `Google scored your homepage ${bp}/100 for modern web best practices (${band(bp)}). ${
        bp >= 90
          ? "No significant technical warnings."
          : "Google found technical issues, like browser errors or outdated code, that can make a site feel less polished or less safe."
      }`,
    });
  }

  if (!checks.length) return { available: false, reason: "no_data" };

  const scores = [perf, a11y, bp].filter((s) => s !== null);
  const categoryScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

  return {
    available: true,
    category: {
      id: "speed_accessibility",
      label: "Speed & Accessibility",
      score: categoryScore,
      verdict:
        categoryScore >= 75
          ? "Google rates your homepage as fast and easy to use."
          : "Google found speed or usability issues that may cost you visitors.",
      source: "Google PageSpeed Insights",
    },
    scores: { performance: perf, accessibility: a11y, bestPractices: bp },
    hasRealUserData: Boolean(realUsers),
    checks,
    fixes: [...speedFixes(lhr), ...accessibilityFixes(lhr)],
  };
}
