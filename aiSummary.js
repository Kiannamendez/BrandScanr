// aiSummary.js
// Turns raw check results into a short, ranked list of "Growth Opportunities" —
// the consultant-style recommendations shown on the dashboard.
// Uses the Anthropic API if ANTHROPIC_API_KEY is set; otherwise falls back to a
// rule-based ranking so the app still works out of the box.

const MODEL = "claude-sonnet-4-6";
const IMPACT_RANK = { high: 0, medium: 1, low: 2 };

// Claude sometimes writes markdown (**bold**, ## headers, - bullets) even when
// asked not to. Since the frontend displays this as plain text, strip any
// markdown characters so they never show up as literal symbols on the page.
function stripMarkdown(text) {
  if (!text) return text;
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/^[-*+]\s+/gm, "")
    .trim();
}

function fallbackOpportunities(audit) {
  const failed = audit.checks.filter((c) => !c.passed);
  const sorted = [...failed].sort(
    (a, b) => (IMPACT_RANK[a.impact] ?? 3) - (IMPACT_RANK[b.impact] ?? 3)
  );
  return sorted.slice(0, 5).map((c) => ({
    title: c.action || c.label,
    impact: c.impact || "medium",
    why: c.detail,
  }));
}

export async function generateOpportunities(audit) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const fallback = fallbackOpportunities(audit);

  if (!apiKey || fallback.length === 0) {
    return { opportunities: fallback, source: fallback.length ? "fallback" : "none" };
  }

  const findings = audit.checks
    .map(
      (c) =>
        `- [${c.passed ? "PASS" : "FAIL"}] ${c.label} (impact if fixed: ${c.impact}): ${c.detail}`
    )
    .join("\n");

  const prompt = `You are a friendly digital marketing consultant reviewing an automated website audit for a small business at ${audit.url}.

Raw findings:
${findings}

Pick the top 5 FAILED items most worth fixing, ranked by business impact. For each, write:
- "title": a short action the owner should take (plain English, no jargon, starts with a verb)
- "impact": one of "high", "medium", "low"
- "why": 1-2 plain-English sentences on why it matters to customers or visibility (no technical jargon like "meta tags" or "schema")

Write in plain sentences only. Do not use any markdown formatting — no asterisks, no ## headers, no bullet points, no bold or italics.

Respond with ONLY a JSON array, nothing else, in this exact shape:
[{"title": "...", "impact": "high", "why": "..."}]`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 700,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      return { opportunities: fallback, source: "fallback" };
    }

    const data = await res.json();
    const text = data.content
      ?.map((block) => (block.type === "text" ? block.text : ""))
      .join("\n")
      .trim();

    const cleaned = text?.replace(/^```json\s*|```$/g, "").trim();
    const parsed = JSON.parse(cleaned);

    if (!Array.isArray(parsed) || parsed.length === 0) {
      return { opportunities: fallback, source: "fallback" };
    }

    const cleanedOpportunities = parsed.slice(0, 5).map((op) => ({
      title: stripMarkdown(op.title),
      impact: op.impact,
      why: stripMarkdown(op.why),
    }));

    return { opportunities: cleanedOpportunities, source: "ai" };
  } catch (err) {
    return { opportunities: fallback, source: "fallback" };
  }
}
