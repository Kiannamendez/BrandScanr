// ── Nav scroll + mobile menu ─────────────────────────────────
const nav = document.getElementById("nav");
const navToggle = document.getElementById("nav-toggle");
const navMobile = document.getElementById("nav-mobile");

window.addEventListener("scroll", () => {
  nav.classList.toggle("scrolled", window.scrollY > 32);
});

navToggle.addEventListener("click", () => {
  const isOpen = navMobile.classList.toggle("open");
  navMobile.hidden = !isOpen;
});
navMobile.querySelectorAll("a, button").forEach((el) => {
  el.addEventListener("click", () => {
    navMobile.classList.remove("open");
    navMobile.hidden = true;
  });
});

// ── Scroll-to-scan helpers (nav CTA + bottom CTA) ──
function focusScanInput() {
  document.getElementById("hero").scrollIntoView({ behavior: "smooth", block: "start" });
  setTimeout(() => document.getElementById("url-input").focus(), 400);
}
document.getElementById("nav-cta-btn").addEventListener("click", focusScanInput);
document.getElementById("nav-cta-btn-mobile").addEventListener("click", focusScanInput);
document.getElementById("cta-repeat-btn").addEventListener("click", focusScanInput);

// ── Real audit pillars (matches audit.js exactly) ────────────
const PILLARS = [
  {
    id: "search_visibility",
    label: "Search Visibility",
    color: "#0a7d4c",
    description: "Whether search engines have what they need to show your homepage clearly — headline, description, and structured details.",
    checks: [
      "Search result headline",
      "Search result description",
      "Rich search results",
      "Search engine instructions",
      "Site map for search engines",
    ],
  },
  {
    id: "website_experience",
    label: "Website Experience",
    color: "#c27a12",
    description: "Whether visitors can quickly understand what you offer and whether your images are optimized.",
    checks: ["Homepage headline", "Image optimization"],
  },
  {
    id: "brand_trust",
    label: "Brand Trust",
    color: "#7c5cd6",
    description: "The small signals that tell a visitor your site is legitimate and safe to use.",
    checks: ["Secure connection", "Browser tab icon"],
  },
  {
    id: "social_sharing",
    label: "Social Sharing",
    color: "#4f46e5",
    description: "How your website looks when a link to it gets shared on Facebook, Instagram messages, LinkedIn, or iMessage.",
    checks: ["Social media previews", "Share image"],
  },
  {
    id: "speed_accessibility",
    label: "Speed & Accessibility",
    color: "#0e7490",
    description: "Google PageSpeed Insights tests your homepage on a phone and grades its speed, accessibility, and technical health, plus real-visitor speed when Google has enough data.",
    checks: ["Mobile page speed", "Real visitor experience", "Accessibility", "Technical health"],
  },
];

const pillarsTabs = document.getElementById("pillars-tabs");
const pillarsDetail = document.getElementById("pillars-detail");
let activePillar = 0;

function renderPillars() {
  pillarsTabs.innerHTML = PILLARS.map(
    (p, i) => `
    <button class="pillar-tab ${i === activePillar ? "active" : ""}" data-index="${i}">
      <span class="pillar-num">0${i + 1}</span>
      <span>${p.label}</span>
    </button>`
  ).join("");

  const p = PILLARS[activePillar];
  pillarsDetail.innerHTML = `
    <div class="pillar-detail-eyebrow" style="color:${p.color}">Category</div>
    <h3 class="pillar-detail-title">${p.label}</h3>
    <p style="color:var(--muted-foreground);font-size:0.9rem;line-height:1.6;margin:0 0 1.5rem;">${p.description}</p>
    <div class="pillar-checks">
      ${p.checks
        .map(
          (c) => `
        <div class="pillar-check">
          <span class="check-dot" style="background:${p.color}20;color:${p.color}">✓</span>
          <span>${c}</span>
        </div>`
        )
        .join("")}
    </div>
  `;

  pillarsTabs.querySelectorAll(".pillar-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      activePillar = Number(btn.dataset.index);
      renderPillars();
    });
  });
}
renderPillars();

// ── Real scan tool ────────────────────────────────────────────
const form = document.getElementById("scan-form");
const input = document.getElementById("url-input");
const button = document.getElementById("scan-button");
const btnLabel = button.querySelector(".btn-label");
const errorEl = document.getElementById("form-error");
const results = document.getElementById("results");

const gaugeWrap = document.querySelector(".gauge-wrap");
const gaugeFill = document.getElementById("gauge-fill");
const scoreNumber = document.getElementById("score-number");
const scoreUrl = document.getElementById("score-url");
const scoreVerdict = document.getElementById("score-verdict");
const categoriesGrid = document.getElementById("categories-grid");
const opportunitiesList = document.getElementById("opportunities-list");
const checksList = document.getElementById("checks-list");
const summaryPanel = document.getElementById("summary-panel");
const summaryText = document.getElementById("summary-text");
const businessChips = document.getElementById("business-chips");
const previewPanel = document.getElementById("preview-panel");
const speedPanel = document.getElementById("speed-panel");
const speedLoading = document.getElementById("speed-loading");
const speedBody = document.getElementById("speed-body");
const speedScores = document.getElementById("speed-scores");
const speedFixesWrap = document.getElementById("speed-fixes-wrap");
const speedFixes = document.getElementById("speed-fixes");
const speedError = document.getElementById("speed-error");

// Each scan gets a number, so a slow Google result from an earlier scan
// can't land on top of a newer report.
let currentScanId = 0;

const CIRCUMFERENCE = 2 * Math.PI * 86;

function verdictFor(score) {
  if (score >= 85) return "Strong presence. A few refinements will sharpen it further.";
  if (score >= 65) return "Solid foundation, with clear opportunities to improve.";
  if (score >= 40) return "Several gaps are likely costing you visibility and customers.";
  return "Significant gaps found — these are worth addressing soon.";
}
function scoreColor(score) {
  if (score >= 85) return "#0a7d4c";
  if (score >= 65) return "#1f9d63";
  if (score >= 40) return "#c27a12";
  return "#d4183d";
}
function setLoading(isLoading) {
  button.disabled = isLoading;
  btnLabel.textContent = isLoading ? "Scanning…" : "Run free audit →";
  gaugeWrap.classList.toggle("scanning", isLoading);
}

function renderResults(data) {
  results.hidden = false;
  scoreUrl.textContent = data.url;
  scoreVerdict.textContent = verdictFor(data.score);

  renderSummary(data);

  categoriesGrid.innerHTML = "";
  (data.categories || []).forEach((cat) => addCategoryCard(cat));

  opportunitiesList.innerHTML = "";
  const opportunities = data.opportunities || [];
  if (opportunities.length === 0) {
    const p = document.createElement("p");
    p.className = "no-opportunities";
    p.textContent = "Every check on this scan passed — nice work. Re-run BrandScanr periodically to catch anything that changes.";
    opportunitiesList.appendChild(p);
  } else {
    opportunities.forEach((op, i) => {
      const card = document.createElement("div");
      card.className = "opportunity-card";
      card.innerHTML = `
        <div class="opportunity-top">
          <span class="opportunity-rank">${i + 1}</span>
          <span class="opportunity-title"></span>
          <span class="opportunity-impact impact-${op.impact}">${op.impact} impact</span>
        </div>
        <p class="opportunity-why"></p>
        <p class="opportunity-how" hidden><span class="how-label">First step</span><span class="how-text"></span></p>
      `;
      card.querySelector(".opportunity-title").textContent = op.title;
      card.querySelector(".opportunity-why").textContent = op.why;
      if (op.how) {
        card.querySelector(".opportunity-how").hidden = false;
        card.querySelector(".how-text").textContent = op.how;
      }
      opportunitiesList.appendChild(card);
    });
  }

  scoreNumber.textContent = "0";
  const target = data.score;
  const start = performance.now();
  const duration = 900;
  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    scoreNumber.textContent = Math.round(progress * target);
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  const offset = CIRCUMFERENCE * (1 - target / 100);
  gaugeFill.style.stroke = target >= 65 ? "#5fe3a6" : scoreColor(target);
  gaugeFill.style.transition = "none";
  gaugeFill.style.strokeDashoffset = String(CIRCUMFERENCE);
  requestAnimationFrame(() => {
    gaugeFill.style.transition = "";
    gaugeFill.style.strokeDashoffset = String(offset);
  });

  renderLinkPreview(data.linkPreview);

  checksList.innerHTML = "";
  data.checks.forEach((check) => checksList.appendChild(checkItem(check)));

  results.scrollIntoView({ behavior: "smooth", block: "start" });
}

function addCategoryCard(cat) {
  const card = document.createElement("div");
  card.className = "category-card";
  card.innerHTML = `
    <div class="category-top">
      <span class="category-label"></span>
      <span class="category-score" style="color:${scoreColor(cat.score)}">${cat.score}%</span>
    </div>
    <p class="category-verdict"></p>
    ${cat.source ? '<p class="category-source"></p>' : ""}
  `;
  card.querySelector(".category-label").textContent = cat.label;
  card.querySelector(".category-verdict").textContent = cat.verdict;
  if (cat.source) card.querySelector(".category-source").textContent = `Source: ${cat.source}`;
  categoriesGrid.appendChild(card);
}

function checkItem(check) {
  const li = document.createElement("li");
  li.className = "check-item";
  li.innerHTML = `
    <span class="check-status ${check.passed ? "pass" : "fail"}">${check.passed ? "✓" : "!"}</span>
    <div class="check-body">
      <p class="check-label"></p>
      <p class="check-detail"></p>
    </div>
  `;
  li.querySelector(".check-label").textContent = check.label;
  li.querySelector(".check-detail").textContent = check.detail;
  return li;
}

function renderSummary(data) {
  businessChips.innerHTML = "";
  const b = data.business;
  [b?.type, b?.offering && `Offers: ${b.offering}`, b?.audience && `For: ${b.audience}`]
    .filter(Boolean)
    .forEach((text) => {
      const chip = document.createElement("span");
      chip.className = "business-chip";
      chip.textContent = text;
      businessChips.appendChild(chip);
    });
  businessChips.hidden = businessChips.children.length === 0;
  summaryText.textContent = data.summary || "";
  summaryPanel.hidden = !data.summary;
}

function renderLinkPreview(preview) {
  if (!preview) {
    previewPanel.hidden = true;
    return;
  }
  previewPanel.hidden = false;
  const imageBox = document.getElementById("link-card-image");
  imageBox.innerHTML = "";
  imageBox.classList.toggle("empty", !preview.image);
  if (preview.image) {
    const img = document.createElement("img");
    img.src = preview.image;
    img.alt = "";
    img.loading = "lazy";
    img.referrerPolicy = "no-referrer";
    img.onerror = () => {
      imageBox.innerHTML = "<span>Image didn't load</span>";
      imageBox.classList.add("empty");
    };
    imageBox.appendChild(img);
  } else {
    imageBox.innerHTML = "<span>No share image</span>";
  }
  document.getElementById("link-card-domain").textContent = preview.domain;
  document.getElementById("link-card-title").textContent = preview.title || preview.domain;
  document.getElementById("link-card-desc").textContent = preview.description || "";
  const note = document.getElementById("link-card-note");
  note.hidden = !preview.usesFallbackText;
  note.textContent =
    "Your site doesn't set dedicated share text, so apps fall back to your page title and description. That may differ from this preview.";
}

async function loadPageSpeed(url, scanId) {
  speedPanel.hidden = false;
  speedLoading.hidden = false;
  speedBody.hidden = true;
  speedError.hidden = true;

  let data;
  try {
    const res = await fetch("/api/pagespeed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    data = await res.json();
    if (!res.ok) data = { available: false, message: data.error };
  } catch {
    data = { available: false };
  }
  if (scanId !== currentScanId) return; // a newer scan started meanwhile

  speedLoading.hidden = true;
  if (!data.available) {
    speedError.hidden = false;
    speedError.textContent =
      data.message ||
      (data.reason === "quota"
        ? "Google's speed test is busy right now. Try scanning again in a few minutes."
        : "Google couldn't test this page right now, so speed results aren't included in this report.");
    return;
  }

  addCategoryCard(data.category);

  speedScores.innerHTML = "";
  [
    ["Speed", data.scores.performance],
    ["Accessibility", data.scores.accessibility],
    ["Technical health", data.scores.bestPractices],
  ]
    .filter(([, v]) => v !== null)
    .forEach(([label, value]) => {
      const tile = document.createElement("div");
      tile.className = "speed-tile";
      tile.innerHTML = `<span class="speed-tile-value" style="color:${scoreColor(value)}">${value}</span><span class="speed-tile-label"></span>`;
      tile.querySelector(".speed-tile-label").textContent = label;
      speedScores.appendChild(tile);
    });

  speedFixes.innerHTML = "";
  (data.fixes || []).forEach((fix) => {
    const row = document.createElement("div");
    row.className = "speed-fix";
    row.innerHTML = `<span class="speed-fix-area"></span><div><p class="speed-fix-title"></p><p class="speed-fix-detail"></p></div>`;
    row.querySelector(".speed-fix-area").textContent = fix.area;
    row.querySelector(".speed-fix-title").textContent = fix.title;
    row.querySelector(".speed-fix-detail").textContent = fix.detail;
    speedFixes.appendChild(row);
  });
  speedFixesWrap.hidden = !data.fixes?.length;
  speedBody.hidden = false;

  data.checks.forEach((check) => checksList.appendChild(checkItem(check)));
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorEl.hidden = true;
  const url = input.value.trim();
  if (!url) return;

  const scanId = ++currentScanId;
  setLoading(true);
  try {
    const res = await fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();

    if (!res.ok) {
      errorEl.textContent = data.error || "Something went wrong. Please try again.";
      errorEl.hidden = false;
      return;
    }

    renderResults(data);
    if (data.pageSpeedEnabled) {
      loadPageSpeed(url, scanId);
    } else {
      speedPanel.hidden = true;
    }
  } catch (err) {
    errorEl.textContent = "Something went wrong reaching the server. Please try again.";
    errorEl.hidden = false;
  } finally {
    setLoading(false);
  }
});
