// aiSummary.js
// Turns a list of raw check results into a short, prioritized, human-friendly
// action plan. Uses the Anthropic API if ANTHROPIC_API_KEY is set; otherwise
// falls back to a simple rule-based summary so the app still works out of the box.

const MODEL = "claude-sonnet-4-6";

function fallbackSummary(audit) {
  const failed = audit.checks.filter((c) => !c.passed);
  if (failed.length === 0) {
    return "Nice work — every check on this scan passed. Consider re-running BrandScanr periodically to catch anything that changes.";
  }
  const top = failed.slice(0, 5);
  const lines = top.map(
    (c, i) => `${i + 1}. **${c.label}** — ${c.detail}`
  );
  return `Here are the top things to fix first:\n\n${lines.join("\n\n")}`;
}

export async function generateSummary(audit) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return { text: fallbackSummary(audit), source: "fallback" };
  }

  const findings = audit.checks
    .map((c) => `- [${c.passed ? "PASS" : "FAIL"}] ${c.label}: ${c.detail}`)
    .join("\n");

  const prompt = `You are a senior digital marketing consultant reviewing an automated website audit for a small business at ${audit.url}.

Here are the raw findings:
${findings}

Write a short, encouraging, plain-English summary (150-250 words) for a busy small business owner who is not technical. Focus on the failed checks. Rank the top issues by likely business impact, explain briefly why each matters, and end with the single most important next step. Do not use marketing jargon.`;

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
        max_tokens: 600,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      return { text: fallbackSummary(audit), source: "fallback" };
    }

    const data = await res.json();
    const text = data.content
      ?.map((block) => (block.type === "text" ? block.text : ""))
      .join("\n")
      .trim();

    if (!text) {
      return { text: fallbackSummary(audit), source: "fallback" };
    }

    return { text, source: "ai" };
  } catch (err) {
    return { text: fallbackSummary(audit), source: "fallback" };
  }
}
