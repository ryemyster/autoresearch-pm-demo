// Shared types across all three layers: MCP discovery, autoresearch loop, build skill.
// Plain TypeScript interfaces only — Zod validation is in autoresearch/epicSchema.ts.

// ─── MCP Layer: Idea Artifact ─────────────────────────────────────────────────
// The idea artifact is the persistent state managed by the MCP discovery tools.
// Lives in artifacts/ideas/{idea_id}.json

export interface IdeaArtifact {
  idea_id: string;
  created_at: string;
  updated_at: string;
  problem_statement: string;
  validated_problem?: ValidatedProblem;
  priorities?: PriorityMatrix;
  raw_epic?: Epic; // written by define_epic — seeds the autoresearch loop
}

// Output of validate_problem tool
export interface ValidatedProblem {
  refined_statement: string;
  problem_type: string; // "workflow", "access", "trust", "performance", etc.
  severity: number; // 1-10
  worth_solving: boolean;
  validation_gaps: string[];
  recommended_next: string; // what to investigate next
}

// Output of prioritize_opportunities tool
export interface PriorityMatrix {
  top_opportunity: string;
  rationale: string;
  ice_scores: Array<{
    opportunity: string;
    impact: number; // 1-10
    confidence: number; // 1-10
    effort: number; // 1-10 (lower = better)
    total: number; // (impact * confidence) / effort
  }>;
}

// ─── Preflight / Session (two-call pattern) ────────────────────────────────────
// All MCP tools use preflight → full analysis pattern.
// Preflight state is saved to artifacts/sessions/{idea_id}-{tool}.json.

export interface PreflightResult {
  what_i_have: string[]; // existing data the tool found
  critical_gaps: string[]; // missing information
  questions: string[]; // 3 focused questions for the founder
  confidence: "high" | "medium" | "low";
  proceed_when: string; // instruction for when to call with proceed=true
}

export interface StageSession {
  idea_id: string;
  tool_name: string;
  phase: "preflight" | "ready_to_proceed";
  preflight: PreflightResult;
  raw_input: Record<string, unknown>;
  started_at: string;
  updated_at: string;
}

export type ToolRunMode = "preflight" | "full";

// ─── Autoresearch Layer: Epic Artifact ────────────────────────────────────────
// The Epic is the single artifact type refined by the autoresearch loop.
// Input: raw_epic from define_epic MCP tool.
// Output: best.json + injected markdown file in target project.

export interface Epic {
  title: string;
  outcome: string; // names a specific user segment + measurable change
  scope: {
    in: string[]; // 3-5 concrete deliverables
    out: string[]; // 2-4 explicit non-features
  };
  success_metrics: Array<{
    metric: string;
    target: string; // specific numeric target
    measurement: string; // tool or method
  }>;
  dependencies: string[]; // named: team, service, or decision
  risks: string[]; // concrete failure modes
}

export interface CriterionScore {
  name: string;
  ruleScore: 0 | 1;
  llmScore: 0 | 1;
  total: 0 | 1 | 2;
  ruleRationale: string;
  llmRationale: string;
}

export interface EvaluationResult {
  criteria: CriterionScore[]; // exactly 5
  total: number; // 0-10
  improvementHints: string[]; // one per criterion that scored < 2
}

export interface IterationLog {
  iteration: number;
  epic: Epic;
  result: EvaluationResult;
  isBest: boolean;
}

export interface RunManifest {
  runId: string;
  ideaId: string;
  task: string; // epic title used as task description
  iterations: number;
  finalScore: number;
  initialScore: number;
  improvementDelta: number;
  injectedPath: string; // absolute path of the file written to target project
  timestamp: string;
  model: string;
  mockMode: boolean;
  // New fields for the upgraded Karpathy pattern:
  gitMode: boolean; // was --git-mode enabled for this run?
  exploreMode: boolean; // was --explore enabled? (3-variation pre-decision exploration)
  candidatePath?: string; // path to candidate.json — the "single modifiable file"
  variationCount?: number; // how many framings were explored (explore mode only)
}

// ─── Explore Mode: Pre-Decision Exploration ───────────────────────────────────
// Explore mode runs the optimization loop with 3 different "framings" of the same
// problem, then lets the PM pick the best one. This is the core PM insight:
// "pre-decision exploration under constraints" — not just improving one document.
//
// LEARN MORE: docs/HOW_IT_WORKS.md → "Explore Mode: Pre-Decision Exploration"

/**
 * The result of one optimization run for a single framing variation.
 * Explore mode produces 3 of these, one per framing.
 */
export interface VariationResult {
  variationIndex: number; // 0, 1, or 2
  framingLabel: string; // e.g., "outcome-focused"
  seedDescription: string; // one sentence: what made this framing different
  best: Epic; // the highest-scoring epic from this variation's loop
  bestScore: number; // 0-10
  iterationLog: IterationLog[]; // full log of all iterations for this variation
}

/**
 * The final comparison report produced by explore mode.
 * Contains all 3 variations so the PM can compare and choose.
 */
export interface ExploreReport {
  ideaId: string;
  timestamp: string;
  variations: VariationResult[]; // always length 3
  recommendedIndex: number; // index (0-2) of the highest-scoring variation
}

// ─── Code Quality Loop ────────────────────────────────────────────────────────
// The Code Quality Loop applies the same autoresearch pattern to CODE instead of plans.
// After the Build stage writes code, this loop improves it — scoring quality,
// security, readability, and whether it actually does what the epic asked for.
//
// LEARN MORE: docs/HOW_IT_WORKS.md → "The Code Quality Loop"

/**
 * The result of evaluating one version of a code file.
 * Same structure as EvaluationResult, but for code instead of epics.
 * 5 criteria × 0-2 each = 0-10 total.
 */
export interface CodeQualityResult {
  criteria: CodeCriterionScore[]; // exactly 5
  total: number; // 0-10
  improvementHints: string[]; // one hint per criterion that scored < 2
  targetFile: string; // which file was evaluated
}

/**
 * Score for one code quality criterion.
 * Rule check = deterministic (no API call).
 * LLM check = semantic (one Claude call for all 5 criteria).
 */
export interface CodeCriterionScore {
  name: string; // e.g., "no_lint_errors"
  ruleScore: 0 | 1; // deterministic check
  llmScore: 0 | 1; // LLM semantic check
  total: 0 | 1 | 2; // ruleScore + llmScore
  ruleRationale: string; // why rule passed or failed
  llmRationale: string; // why LLM passed or failed
}

/**
 * One entry in the Layer 4 experiment log.
 * Records what code was tried, how it scored, and whether it was the best so far.
 */
export interface CodeIterationLog {
  iteration: number;
  code: string; // the full code string that was generated
  result: CodeQualityResult;
  isBest: boolean;
}

// Shape returned by the batched LLM scoring call in layer4/evaluator.ts
export interface LLMCodeScoringResponse {
  no_lint_errors: { score: 0 | 1; rationale: string };
  no_security_issues: { score: 0 | 1; rationale: string };
  readability: { score: 0 | 1; rationale: string };
  test_coverage_intent: { score: 0 | 1; rationale: string };
  epic_alignment: { score: 0 | 1; rationale: string };
}

// ─── Layer 5: Validation Loop ─────────────────────────────────────────────────
// Layer 5 closes the loop: it reads the epic's success_metrics as test specs,
// checks whether the code satisfies each one, and scores by pass rate.
// This is "done" defined by the plan, not by the programmer.
//
// LEARN MORE: docs/HOW_IT_WORKS.md → "Layer 5: The Validation Loop"

/**
 * The result of validating code against an epic's success_metrics.
 * Score = passCount / totalTests * 10.
 */
export interface ValidationResult {
  tests: TestResult[]; // one per success_metric in the epic
  passCount: number;
  failCount: number;
  totalScore: number; // 0-10
  improvementHints: string[]; // one hint per failed test
}

/**
 * Result of checking one success_metric from the epic.
 * "passed" = the code demonstrably satisfies this metric.
 */
export interface TestResult {
  metric: string; // copied from epic.success_metrics[n].metric
  description: string; // what was checked
  passed: boolean;
  rationale: string; // why it passed or failed
}

/**
 * One entry in the Layer 5 experiment log.
 */
export interface ValidationIterationLog {
  iteration: number;
  result: ValidationResult;
  isBest: boolean;
}

// ─── Epic Refinement Loop LLM scoring (kept here for proximity) ───────────────

// Shape returned by the batched LLM scoring call in evaluator.ts
export interface LLMScoringResponse {
  outcome_clarity: { score: 0 | 1; rationale: string };
  bounded_scope: { score: 0 | 1; rationale: string };
  measurable_success: { score: 0 | 1; rationale: string };
  dependency_clarity: { score: 0 | 1; rationale: string };
  actionability: { score: 0 | 1; rationale: string };
}
