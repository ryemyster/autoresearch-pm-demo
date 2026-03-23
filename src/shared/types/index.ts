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
}

// Shape returned by the batched LLM scoring call in evaluator.ts
export interface LLMScoringResponse {
  outcome_clarity: { score: 0 | 1; rationale: string };
  bounded_scope: { score: 0 | 1; rationale: string };
  measurable_success: { score: 0 | 1; rationale: string };
  dependency_clarity: { score: 0 | 1; rationale: string };
  actionability: { score: 0 | 1; rationale: string };
}
