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
    color: "#B03D1A",
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
    color: "#9C7A24",
    description: "Whether visitors can quickly understand what you offer and whether your images are optimized.",
    checks: ["Homepage headline", "Image optimization"],
  },
  {
    id: "brand_trust",
    label: "Brand Trust",
    color: "#8C7EB8",
    description: "The small signals that tell a visitor your site is legitimate and safe to use.",
    checks: ["Secure connection", "Browser tab icon"],
  },
  {
    id: "social_sharing",
    label: "Social Sharing",
    color: "#C4622E",
    description: "How your website looks when a link to it gets shared on Facebook or LinkedIn.",
    checks: ["Social media previews"],
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

const CIRCUMFERENCE = 2 * Math.PI * 86;

function verdictFor(score) {
  if (score >= 85) return "Strong presence. A few refinements will sharpen it further.";
  if (score >= 65) return "Solid foundation, with clear opportunities to improve.";
  if (score >= 40) return "Several gaps are likely costing you visibility and customers.";
  return "Significant gaps found — these are worth addressing soon.";
}
function scoreColor(score) {
  if (score >= 85) return "#B03D1A";
  if (score >= 65) return "#D8703F";
  if (score >= 40) return "#9C7A24";
  return "#B23A56";
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

  categoriesGrid.innerHTML = "";
  (data.categories || []).forEach((cat) => {
    const card = document.createElement("div");
    card.className = "category-card";
    card.innerHTML = `
      <div class="category-top">
        <span class="category-label"></span>
        <span class="category-score" style="color:${scoreColor(cat.score)}">${cat.score}%</span>
      </div>
      <p class="category-verdict"></p>
    `;
    card.querySelector(".category-label").textContent = cat.label;
    card.querySelector(".category-verdict").textContent = cat.verdict;
    categoriesGrid.appendChild(card);
  });

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
      `;
      card.querySelector(".opportunity-title").textContent = op.title;
      card.querySelector(".opportunity-why").textContent = op.why;
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
  gaugeFill.style.stroke = scoreColor(target);
  gaugeFill.style.transition = "none";
  gaugeFill.style.strokeDashoffset = String(CIRCUMFERENCE);
  requestAnimationFrame(() => {
    gaugeFill.style.transition = "";
    gaugeFill.style.strokeDashoffset = String(offset);
  });

  checksList.innerHTML = "";
  data.checks.forEach((check) => {
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
    checksList.appendChild(li);
  });

  results.scrollIntoView({ behavior: "smooth", block: "start" });
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorEl.hidden = true;
  const url = input.value.trim();
  if (!url) return;

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
  } catch (err) {
    errorEl.textContent = "Something went wrong reaching the server. Please try again.";
    errorEl.hidden = false;
  } finally {
    setLoading(false);
  }
});
