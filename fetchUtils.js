// fetchUtils.js
// Shared helpers for fetching other people's websites safely.
//
// BrandScanr fetches whatever URL a visitor types in (and, now, the share image
// that page points to). Two guard rails live here:
//   1. A timeout, so one slow website can't hang a scan forever.
//   2. A block on private/internal addresses (localhost, 10.x.x.x, etc.), so
//      nobody can use BrandScanr to poke at the server it runs on.

import net from "net";

const DEFAULT_TIMEOUT_MS = 12000;

export function normalizeUrl(input) {
  let url = String(input || "").trim();
  if (!/^https?:\/\//i.test(url)) {
    url = "https://" + url;
  }
  return url;
}

function isPrivateIp(host) {
  if (net.isIPv4(host)) {
    const [a, b] = host.split(".").map(Number);
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  if (net.isIPv6(host)) {
    const h = host.toLowerCase();
    return h === "::1" || h === "::" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80") || h.startsWith("::ffff:");
  }
  return false;
}

// True when a URL is a normal public http(s) website address.
export function isPublicHttpUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  const host = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host || !host.includes(".") && !net.isIP(host)) return false; // "localhost", "intranet"
  if (host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".localhost")) return false;
  if (isPrivateIp(host)) return false;
  return true;
}

export async function safeFetch(url, options = {}) {
  if (!isPublicHttpUrl(url)) return null;
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...rest } = options;
  try {
    return await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "user-agent": "BrandScanr/1.0 (+https://brandscanr.onrender.com)" },
      ...rest,
    });
  } catch {
    return null;
  }
}
