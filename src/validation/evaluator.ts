// validation/evaluator.ts — validates code against the epic's success_metrics.
//
// Teaching note: This is the "closes the loop" stage.
// The Epic Refinement Loop created a plan with success_metrics.
// The Build stage wrote code to implement the plan.
// The Code Quality Loop (using Autoresearch pattern) cleaned up the code.
// NOW the Validation Loop (using Autoresearch pattern) asks: "Does the code actually satisfy the metrics?"
//
// How it works:
//   1. Read the epic markdown and extract each success_metric
//   2. For each metric, ask Claude: "Does this code satisfy this metric?"
//   3. Score = passCount / totalMetrics * 10
//   4. Failed metrics become improvement hints for the next iteration
//
// WHY this is powerful: "done" is defined by the PLAN, not the programmer.
// The criteria come from the epic the PM wrote — not arbitrary code standards.
//
// LEARN MORE: docs/HOW_IT_WORKS.md → "The Validation Loop"

import * as fs from "fs";
import { callClaudeJson } from "../shared/claude.js";
import { settings } from "../shared/config.js";
import type { ValidationResult, TestResult } from "../shared/types/index.js";

// ─── Epic Parser ──────────────────────────────────────────────────────────────

/**
 * WHAT: Parses the success_metrics table out of an epic markdown file.
 * WHY:  The epic markdown was written by the Epic Refinement Loop. We extract
 *       the metrics to use them as test specifications in the Validation Loop.
 *       The plan defines "done" — we just read it.
 */
function parseSuccessMetrics(
  epicMarkdownPath: string
): Array<{ metric: string; target: string; measurement: string }> {
  if (!fs.existsSync(epicMarkdownPath)) return [];

  const content = fs.readFileSync(epicMarkdownPath, "utf-8");

  // Extract the success metrics table section
  const section = content.match(/##\s+Success Metrics\s*\n([\s\S]*?)(?=\n##|\n---|\s*$)/i);
  if (!section) return [];

  const metrics: Array<{ metric: string; target: string; measurement: string }> = [];

  // Parse markdown table rows: | Metric | Target | Measurement |
  const rows = section[1].split("\n").filter((line) => line.includes("|"));
  for (const row of rows) {
    const cells = row.split("|").map((c) => c.trim()).filter(Boolean);
    // Skip header row and separator row
    if (cells.length >= 3 && !cells[0].match(/^[-:]+$/) && cells[0].toLowerCase() !== "metric") {
      metrics.push({ metric: cells[0], target: cells[1], measurement: cells[2] });
    }
  }

  return metrics;
}

// ─── Mock Fixtures ────────────────────────────────────────────────────────────

function getMockValidationResult(iterationIndex: number): ValidationResult {
  // Three fixtures: 2/5 pass → 4/5 → 5/5
  const fixtures: ValidationResult[] = [
    {
      tests: [
        { metric: "Onboarding drop-off rate", description: "Check code reduces drop-off", passed: false, rationale: "mock: no analytics tracking found in code" },
        { metric: "Time to first action", description: "Check time-to-action is measured", passed: false, rationale: "mock: no timing logic found" },
        { metric: "Feature discovery rate", description: "Check feature discovery is tracked", passed: false, rationale: "mock: no feature flag or discovery tracking found" },
        { metric: "User satisfaction score", description: "Check satisfaction measurement exists", passed: true, rationale: "mock: survey trigger found in code" },
        { metric: "Support ticket volume", description: "Check error handling reduces tickets", passed: true, rationale: "mock: error handling present" },
      ],
      passCount: 2, failCount: 3, totalScore: 4,
      improvementHints: [
        "Add analytics events to track onboarding drop-off at each step.",
        "Add timing measurement for first user action after sign-up.",
        "Implement feature discovery tracking when users first interact with new features.",
      ],
    },
    {
      tests: [
        { metric: "Onboarding drop-off rate", description: "Check code reduces drop-off", passed: true, rationale: "mock: analytics events found at each onboarding step" },
        { metric: "Time to first action", description: "Check time-to-action is measured", passed: true, rationale: "mock: performance.now() timing added" },
        { metric: "Feature discovery rate", description: "Check feature discovery is tracked", passed: false, rationale: "mock: tracking exists but not linked to metrics" },
        { metric: "User satisfaction score", description: "Check satisfaction measurement exists", passed: true, rationale: "mock: NPS survey trigger implemented" },
        { metric: "Support ticket volume", description: "Check error handling reduces tickets", passed: true, rationale: "mock: comprehensive error handling with user-friendly messages" },
      ],
      passCount: 4, failCount: 1, totalScore: 8,
      improvementHints: [
        "Link feature discovery events to the success metric dashboard so the target is measurable.",
      ],
    },
    {
      tests: [
        { metric: "Onboarding drop-off rate", description: "Check code reduces drop-off", passed: true, rationale: "mock: full analytics coverage at all funnel steps" },
        { metric: "Time to first action", description: "Check time-to-action is measured", passed: true, rationale: "mock: timing logged and sent to analytics" },
        { metric: "Feature discovery rate", description: "Check feature discovery is tracked", passed: true, rationale: "mock: discovery events now linked to metrics" },
        { metric: "User satisfaction score", description: "Check satisfaction measurement exists", passed: true, rationale: "mock: NPS and CSAT both implemented" },
        { metric: "Support ticket volume", description: "Check error handling reduces tickets", passed: true, rationale: "mock: all error paths handled with helpful messages" },
      ],
      passCount: 5, failCount: 0, totalScore: 10,
      improvementHints: [],
    },
  ];
  return fixtures[Math.min(iterationIndex, fixtures.length - 1)];
}

// ─── LLM Validation ──────────────────────────────────────────────────────────

const VALIDATION_SYSTEM = `You are a senior QA engineer validating whether code satisfies a product epic's success metrics.
For each metric, answer: does the code contain the implementation needed to achieve this metric?
Be specific — look for the actual logic, not just comments or placeholders.
Return JSON with a "tests" array, one entry per metric.`;

/**
 * WHAT: Asks Claude to check whether the code satisfies each success metric.
 * WHY:  This is the "evaluator" in the validation loop. It reads the metrics
 *       from the epic (what the PM defined as "done") and checks the code.
 *       This is more meaningful than arbitrary code quality rules — it asks
 *       "does the code do what was planned?"
 */
async function llmValidate(
  code: string,
  metrics: Array<{ metric: string; target: string; measurement: string }>,
  iterationIndex: number
): Promise<ValidationResult> {
  if (settings.mockMode) {
    return getMockValidationResult(iterationIndex);
  }

  const metricsText = metrics
    .map((m, i) => `${i + 1}. Metric: "${m.metric}" | Target: "${m.target}" | Measured via: "${m.measurement}"`)
    .join("\n");

  const response = await callClaudeJson<{ tests: Array<{ metric: string; description: string; passed: boolean; rationale: string }> }>({
    system: VALIDATION_SYSTEM,
    userMessage: `CODE TO VALIDATE:\n\`\`\`\n${code}\n\`\`\`\n\nSUCCESS METRICS FROM EPIC:\n${metricsText}\n\nFor each metric, return whether the code satisfies it. Return JSON: { "tests": [...] }`,
    maxTokens: 1000,
    stageKey: "validation",
  });

  const tests: TestResult[] = response.tests.map((t) => ({
    metric: t.metric,
    description: t.description,
    passed: t.passed,
    rationale: t.rationale,
  }));

  const passCount = tests.filter((t) => t.passed).length;
  const failCount = tests.length - passCount;
  const totalScore = tests.length > 0 ? Math.round((passCount / tests.length) * 10) : 0;
  const improvementHints = tests
    .filter((t) => !t.passed)
    .map((t) => `Implement code to satisfy metric "${t.metric}": ${t.rationale}`);

  return { tests, passCount, failCount, totalScore, improvementHints };
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * WHAT: Validates code against the success metrics in the epic markdown.
 * WHY:  This is the read-only evaluator for the validation loop. It can't be
 *       changed by the agent, so the pass/fail criteria stay fixed.
 *       "Done" is defined by the plan — not by the programmer.
 * LEARN MORE: docs/HOW_IT_WORKS.md → "The Validation Loop"
 */
export async function validateAgainstEpic(
  code: string,
  epicMarkdownPath: string,
  iterationIndex: number = 0
): Promise<ValidationResult> {
  const metrics = parseSuccessMetrics(epicMarkdownPath);

  // If no metrics found in the epic, we can't validate — return a clear error result
  if (metrics.length === 0 && !settings.mockMode) {
    return {
      tests: [],
      passCount: 0,
      failCount: 0,
      totalScore: 0,
      improvementHints: ["No success metrics found in the epic markdown. Add a '## Success Metrics' table to the epic."],
    };
  }

  return llmValidate(code, metrics, iterationIndex);
}
