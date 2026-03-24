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

// Shape returned by the batched LLM scoring call in evaluator.ts
export interface LLMScoringResponse {
  outcome_clarity: { score: 0 | 1; rationale: string };
  bounded_scope: { score: 0 | 1; rationale: string };
  measurable_success: { score: 0 | 1; rationale: string };
  dependency_clarity: { score: 0 | 1; rationale: string };
  actionability: { score: 0 | 1; rationale: string };
}
