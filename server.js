// server.js
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import rateLimit from "express-rate-limit";
import "dotenv/config";

import { runAudit } from "./audit.js";
import { generateReport } from "./aiSummary.js";
import { runPageSpeed } from "./pagespeed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Render sits in front of the app as a proxy; this lets the rate limiter see
// each visitor's real IP address instead of Render's.
app.set("trust proxy", 1);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Each scan costs a Claude call and a Google call, so cap how many scans one
// visitor can run. Adjust with SCAN_LIMIT_PER_HOUR in Render (default 30).
// The two endpoints get separate counters so one scan only counts once each.
const makeLimiter = () =>
  rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: Number(process.env.SCAN_LIMIT_PER_HOUR) || 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "You've run a lot of scans in the last hour. Please wait a bit and try again." },
  });
const scanLimiter = makeLimiter();
const pageSpeedLimiter = makeLimiter();

function readUrl(req, res) {
  const { url } = req.body || {};
  if (!url || typeof url !== "string" || !url.trim()) {
    res.status(400).json({ error: "Please enter a business website URL." });
    return null;
  }
  return url;
}

app.post("/api/scan", scanLimiter, async (req, res) => {
  const url = readUrl(req, res);
  if (!url) return;

  const audit = await runAudit(url);
  if (audit.error) {
    return res.status(422).json({ error: audit.error });
  }

  const report = await generateReport(audit);

  // pageContext is only for the AI; no need to send it to the browser.
  const { pageContext, ...publicAudit } = audit;
  res.json({
    ...publicAudit,
    summary: report.summary,
    business: report.business,
    opportunities: report.opportunities,
    opportunitiesSource: report.source,
    pageSpeedEnabled: Boolean(process.env.GOOGLE_API_KEY),
  });
});

// Google PageSpeed takes 10-30 seconds, so the page asks for it separately
// after the main report is already on screen.
app.post("/api/pagespeed", pageSpeedLimiter, async (req, res) => {
  const url = readUrl(req, res);
  if (!url) return;
  res.json(await runPageSpeed(url));
});

app.listen(PORT, () => {
  console.log(`BrandScanr is running: http://localhost:${PORT}`);
});
