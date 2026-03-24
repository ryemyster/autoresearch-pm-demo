// Evaluator: scores an Epic against 5 explicit criteria (0-2 each = 0-10 total).
//
// Teaching note: This is the hardest part to get right.
// Each criterion has two checks:
//   1. Rule check (deterministic — no API call)
//   2. LLM check (one batched Claude call for all 5 semantic checks)
//
// The improvement hints are hardcoded strings — not LLM-generated.
// Specific hints → specific improvements. Vague hints → vague improvements.

import { callClaudeJson } from "../shared/claude.js";
import { settings } from "../shared/config.js";
import type { Epic, CriterionScore, EvaluationResult, LLMScoringResponse } from "../shared/types/index.js";

const CRITERIA = [
  "outcome_clarity",
  "bounded_scope",
  "measurable_success",
  "dependency_clarity",
  "actionability",
] as const;

type CriterionName = (typeof CRITERIA)[number];

// ─── Rule Checks (deterministic) ─────────────────────────────────────────────

const MEASURABLE_WORDS = ["increase", "decrease", "reduce", "enable", "prevent", "replace", "from", "to", "%", "by", "within"];

function ruleOutcomeClarity(epic: Epic): [0 | 1, string] {
  const outcome = epic.outcome.toLowerCase();
  const longEnough = epic.outcome.length >= 30;
  const hasMeasurable = MEASURABLE_WORDS.some((w) => outcome.includes(w));
  if (longEnough && hasMeasurable) return [1, "Outcome is >= 30 chars and contains a measurable term."];
  if (!longEnough) return [0, `Outcome is too short (${epic.outcome.length} chars, need >= 30).`];
  return [0, "Outcome lacks measurable terms (e.g. 'reduce', 'from X to Y', '%')."];
}

function ruleBoundedScope(epic: Epic): [0 | 1, string] {
  const hasIn = epic.scope.in.length >= 2;
  const hasOut = epic.scope.out.length >= 1;
  if (hasIn && hasOut) return [1, `scope.in has ${epic.scope.in.length} items; scope.out has ${epic.scope.out.length} items.`];
  if (!hasIn) return [0, `scope.in has only ${epic.scope.in.length} items (need >= 2).`];
  return [0, "scope.out is empty — no explicit non-features defined."];
}

function ruleMeasurableSuccess(epic: Epic): [0 | 1, string] {
  if (epic.success_metrics.length === 0) return [0, "No success_metrics defined."];
  const allHaveTargets = epic.success_metrics.every((m) => m.target.trim().length > 0);
  if (!allHaveTargets) return [0, "One or more metrics are missing a target value."];
  return [1, `${epic.success_metrics.length} metric(s) defined, all have targets.`];
}

function ruleDependencyClarity(epic: Epic): [0 | 1, string] {
  if (epic.dependencies.length >= 1) return [1, `${epic.dependencies.length} dependency/dependencies listed.`];
  return [0, "No dependencies listed."];
}

function ruleActionability(epic: Epic): [0 | 1, string] {
  // WHAT: Checks two deterministic signals that an epic is engineer-ready.
  // WHY:  "actionability" can't be fully checked without reading the text,
  //       but we can rule out epics that lack concrete deliverables or risks
  //       without any API call. Rule check = free signal before the LLM call.
  const enoughDeliverables = epic.scope.in.length >= 3;
  const hasRisks = epic.risks.length >= 1;
  if (enoughDeliverables && hasRisks) {
    return [1, `scope.in has ${epic.scope.in.length} item(s); ${epic.risks.length} risk(s) listed.`];
  }
  if (!enoughDeliverables) {
    return [0, `scope.in has only ${epic.scope.in.length} deliverable(s) — need >= 3 for an engineer to estimate.`];
  }
  return [0, "No risks listed — an engineer can't estimate without knowing failure modes."];
}

// ─── LLM Scoring (one batched call) ──────────────────────────────────────────

const LLM_SCORING_SYSTEM = `You are a strict PM epic quality reviewer. Score each criterion 0 or 1.
0 = clearly fails. 1 = clearly meets. Be conservative.

SCORING GUIDE:
- outcome_clarity: Does it name a SPECIFIC user segment (not "users") AND describe a meaningful, measurable change?
- bounded_scope: Is scope realistic for one team/quarter? Are out items genuine constraints (not filler)?
- measurable_success: Do ALL metrics have specific numeric targets (not "improve")? Is the measurement tool named?
- dependency_clarity: Are all dependencies named as specific teams/services/decisions — not vague phrases?
- actionability: Would an engineer understand what to build and how to test it done without asking follow-up Qs?`;

const MOCK_LLM_SCORES: LLMScoringResponse[] = [
  {
    outcome_clarity:    { score: 0, rationale: "mock: outcome doesn't name a user segment or measurable change" },
    bounded_scope:      { score: 0, rationale: "mock: no out-of-scope items; scope is unbounded" },
    measurable_success: { score: 0, rationale: "mock: 'better' is not a numeric target" },
    dependency_clarity: { score: 0, rationale: "mock: no dependencies listed" },
    actionability:      { score: 0, rationale: "mock: 'make it easier' doesn't tell an engineer what to build" },
  },
  {
    outcome_clarity:    { score: 0, rationale: "mock: 'mobile users' is not specific; no numeric target in outcome" },
    bounded_scope:      { score: 1, rationale: "mock: out list exists and excludes desktop — genuine constraint" },
    measurable_success: { score: 0, rationale: "mock: 'increase' is not a numeric target" },
    dependency_clarity: { score: 1, rationale: "mock: design team dependency is named" },
    actionability:      { score: 1, rationale: "mock: deliverables are specific enough to estimate" },
  },
  {
    outcome_clarity:    { score: 1, rationale: "mock: names iOS+Android users, 30-day cohort, specific drop-off target" },
    bounded_scope:      { score: 1, rationale: "mock: 3 clear out-of-scope items each with a reason" },
    measurable_success: { score: 1, rationale: "mock: all metrics have numeric targets and named measurement tools" },
    dependency_clarity: { score: 1, rationale: "mock: three named dependencies with teams and timing" },
    actionability:      { score: 1, rationale: "mock: any senior engineer could scope this without a meeting" },
  },
];

async function llmScoreAll(epic: Epic, iterationIndex: number): Promise<LLMScoringResponse> {
  if (settings.mockMode) {
    return MOCK_LLM_SCORES[Math.min(iterationIndex, MOCK_LLM_SCORES.length - 1)];
  }

  return callClaudeJson<LLMScoringResponse>({
    system: LLM_SCORING_SYSTEM,
    userMessage: `EPIC TO EVALUATE:\n${JSON.stringify(epic, null, 2)}\n\nScore each criterion and return the JSON object.`,
    maxTokens: 600,
  });
}

// ─── Improvement Hints (hardcoded — not LLM-generated) ───────────────────────

const HINTS: Record<CriterionName, string> = {
  outcome_clarity:
    "Rewrite the outcome to name a specific user segment (e.g., 'mobile users who registered in the last 30 days') and include a measurable change using words like 'reduce', 'increase', or 'from X% to Y%'.",
  bounded_scope:
    "Add an explicit 'out' list with at least 2 items that clearly define what is NOT included. Each item should explain why it's deferred (e.g., 'desktop version — separate epic').",
  measurable_success:
    "Replace vague targets ('improve', 'increase', 'fast') with specific numbers (e.g., '< 200ms', '> 70%', '< 2%'). Name the tool or method used to measure each metric.",
  dependency_clarity:
    "Name each dependency specifically — team name, service name, or decision (e.g., 'Design team: mockups by sprint 1'). Remove vague phrases like 'needs input'.",
  actionability:
    "Add enough detail that an engineer could estimate without a meeting. Specify which screens/endpoints are affected, what acceptance criteria look like, and how you'll know when it's done.",
};

// ─── Main Evaluate Function ───────────────────────────────────────────────────

export async function evaluate(epic: Epic, iterationIndex: number = 0): Promise<EvaluationResult> {
  const ruleResults: Record<CriterionName, [0 | 1, string]> = {
    outcome_clarity:    ruleOutcomeClarity(epic),
    bounded_scope:      ruleBoundedScope(epic),
    measurable_success: ruleMeasurableSuccess(epic),
    dependency_clarity: ruleDependencyClarity(epic),
    actionability:      ruleActionability(epic),
  };

  const llmResults = await llmScoreAll(epic, iterationIndex);

  const criteria: CriterionScore[] = CRITERIA.map((name) => {
    const [ruleScore, ruleRationale] = ruleResults[name];
    const { score: llmScore, rationale: llmRationale } = llmResults[name];
    const total = (ruleScore + llmScore) as 0 | 1 | 2;
    return { name, ruleScore, llmScore, total, ruleRationale, llmRationale };
  });

  const total = criteria.reduce((sum, c) => sum + c.total, 0);
  const improvementHints = criteria
    .filter((c) => c.total < 2)
    .map((c) => HINTS[c.name as CriterionName]);

  return { criteria, total, improvementHints };
}
