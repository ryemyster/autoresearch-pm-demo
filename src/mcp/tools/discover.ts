// validate_problem — Discovery MCP tool (Discover stage)
//
// Two-call pattern (mirrors founder-os exactly):
//   Call 1 (proceed omitted): preflight gap check → 3 questions → saves session
//   Call 2 (proceed=true + session_notes): full problem validation → saves to idea artifact
//
// On full analysis: writes next phase template to artifacts/working/
// so the user can immediately drop into prioritize_opportunities.
//
// Arcade MCP Design Patterns demonstrated in this file:
//   Operation Mode    — The `proceed` boolean creates two distinct modes from one tool.
//                       Omitting `proceed` runs a lightweight preflight (fast, low-cost).
//                       `proceed=true` runs the full analysis (expensive, conclusive).
//                       This lets the agent gather info before committing to a costly call.
//                       See: https://www.arcade.dev/patterns#operation-mode
//   Smart Defaults    — `proceed` is optional and defaults to preflight behavior.
//                       `context` and `idea_id` are optional — the tool works with just a
//                       problem_statement. Fewer required fields = easier for agents to call.
//                       See: https://www.arcade.dev/patterns#smart-defaults
//   Recovery Guide    — Errors tell the agent exactly what to do:
//                       "Pass a problem_statement to start, or drop a template in artifacts/working/"
//                       See: https://www.arcade.dev/patterns#recovery-guide
//   Dependency Hint   — On success, the tool writes a next-phase template so the agent
//                       knows to call prioritize_opportunities next (no guessing required).
//                       See: https://www.arcade.dev/patterns#dependency-hint

import { callClaudeJson } from "../../shared/claude.js";
import {
  createIdea, loadIdea, saveIdea,
  saveSession, loadSession, clearSession,
  discoverWorkingTemplate, extractIdeaId, writeNextTemplate, WORKFLOW_NEXT,
} from "../artifacts/store.js";
import { VALIDATE_PROBLEM_PREFLIGHT_PROMPT, VALIDATE_PROBLEM_PROMPT } from "../prompts/templates.js";
import type {
  IdeaArtifact, ValidatedProblem, PreflightResult, StageSession, ToolRunMode,
} from "../../shared/types/index.js";

const TOOL_NAME = "validate_problem";
const TEMPLATE_NUM = 1;

// ─── Input / Output types ──────────────────────────────────────────────────────

export interface ValidateProblemInput {
  problem_statement?: string;
  context?: string; // optional extra context
  idea_id?: string; // pass to continue an existing idea
  proceed?: boolean;
  session_notes?: string;
}

export interface ValidateProblemOutput {
  idea_id: string;
  mode: ToolRunMode;
  // Preflight fields
  preflight?: PreflightResult;
  session_saved?: string;
  // Full analysis fields
  analysis?: string;
  validated_problem?: ValidatedProblem;
  next_template?: string;
}

// ─── Tool Implementation ───────────────────────────────────────────────────────

export async function validateProblem(input: ValidateProblemInput): Promise<ValidateProblemOutput> {
  // Discover working template (user may have dropped one in artifacts/working/)
  const workingTemplate = discoverWorkingTemplate(TEMPLATE_NUM);
  const templateIdeaId = workingTemplate ? extractIdeaId(workingTemplate.content) : null;
  const resolvedId = templateIdeaId ?? input.idea_id;

  // Load or create idea
  let idea: IdeaArtifact;
  if (resolvedId) {
    const existing = loadIdea(resolvedId);
    if (!existing) throw new Error(`Idea "${resolvedId}" not found. Pass a problem_statement to create a new idea.`);
    idea = existing;
  } else {
    if (!input.problem_statement) {
      throw new Error("Pass a problem_statement to start, or drop a template in artifacts/working/.");
    }
    idea = createIdea(input.problem_statement);
  }

  const context = [
    `PROBLEM: "${idea.problem_statement}"`,
    input.context ? `ADDITIONAL CONTEXT:\n${input.context}` : "",
    workingTemplate ? `TEMPLATE NOTES:\n${workingTemplate.content}` : "",
  ].filter(Boolean).join("\n\n");

  // ── PREFLIGHT BRANCH ────────────────────────────────────────────────────────
  if (!input.proceed) {
    const preflight = await callClaudeJson<PreflightResult>({
      system: VALIDATE_PROBLEM_PREFLIGHT_PROMPT,
      userMessage: context,
      maxTokens: 1024,
    });

    const session: StageSession = {
      idea_id: idea.idea_id,
      tool_name: TOOL_NAME,
      phase: "preflight",
      preflight,
      raw_input: input as Record<string, unknown>,
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    saveSession(session);

    return {
      idea_id: idea.idea_id,
      mode: "preflight",
      preflight,
      session_saved: `artifacts/sessions/${idea.idea_id}-${TOOL_NAME}.json`,
    };
  }

  // ── FULL ANALYSIS BRANCH ────────────────────────────────────────────────────
  const priorSession = loadSession(idea.idea_id, TOOL_NAME);
  const sessionContext = priorSession
    ? [
        `PREFLIGHT GAPS: ${priorSession.preflight.critical_gaps.join("; ")}`,
        input.session_notes ? `FOUNDER'S ANSWERS:\n${input.session_notes}` : "",
      ].filter(Boolean).join("\n\n")
    : input.session_notes ?? "";

  const result = await callClaudeJson<{ analysis: string; validated_problem: ValidatedProblem }>({
    system: VALIDATE_PROBLEM_PROMPT,
    userMessage: `${context}\n\n${sessionContext}\n\nApply the Problem Validation framework. Return JSON.`,
    maxTokens: 2048,
  });

  idea.validated_problem = result.validated_problem;
  saveIdea(idea);
  clearSession(idea.idea_id, TOOL_NAME);

  // Write next template for prioritize_opportunities
  const nextNum = WORKFLOW_NEXT[TEMPLATE_NUM];
  const priorContextSummary = [
    `Problem: ${result.validated_problem.refined_statement}`,
    `Severity: ${result.validated_problem.severity}/10`,
    `Worth solving: ${result.validated_problem.worth_solving}`,
    `Gaps: ${result.validated_problem.validation_gaps.join("; ")}`,
  ].join("\n");

  const nextTemplate = nextNum
    ? writeNextTemplate(nextNum, idea.idea_id, priorContextSummary)
    : undefined;

  return {
    idea_id: idea.idea_id,
    mode: "full",
    analysis: result.analysis,
    validated_problem: result.validated_problem,
    next_template: nextTemplate,
  };
}
