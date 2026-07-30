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
const summaryText = document.getElementById("summary-text");
const checksList = document.getElementById("checks-list");

const CIRCUMFERENCE = 2 * Math.PI * 86; // matches r=86 in the SVG

function verdictFor(score) {
  if (score >= 85) return "Strong presence. A few refinements will sharpen it further.";
  if (score >= 65) return "Solid foundation, with clear opportunities to improve.";
  if (score >= 40) return "Several gaps are likely costing you visibility and customers.";
  return "Significant gaps found — these are worth addressing soon.";
}

function scoreColor(score) {
  if (score >= 85) return "#4af2a1";
  if (score >= 65) return "#8ee6b8";
  if (score >= 40) return "#f2b84a";
  return "#f2574a";
}

function setLoading(isLoading) {
  button.disabled = isLoading;
  btnLabel.textContent = isLoading ? "Scanning…" : "Analyze My Business";
  gaugeWrap.classList.toggle("scanning", isLoading);
}

function renderResults(data) {
  results.hidden = false;
  scoreUrl.textContent = data.url;
  scoreVerdict.textContent = verdictFor(data.score);
  summaryText.textContent = data.summary;

  // animate the score number
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
  // reset then set so the CSS transition replays on every scan
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
        <p class="check-label">${check.label}</p>
        <p class="check-detail"></p>
      </div>
    `;
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
