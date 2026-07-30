// server.js
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

import { runAudit } from "./audit.js";
import { generateSummary } from "./aiSummary.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/scan", async (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== "string" || !url.trim()) {
    return res.status(400).json({ error: "Please enter a business website URL." });
  }

  const audit = await runAudit(url);
  if (audit.error) {
    return res.status(422).json({ error: audit.error });
  }

  const summary = await generateSummary(audit);

  res.json({ ...audit, summary: summary.text, summarySource: summary.source });
});

app.listen(PORT, () => {
  console.log(`BrandScanr is running: http://localhost:${PORT}`);
});
