// prioritize_opportunities — Discovery MCP tool (Design stage)
//
// Two-call pattern:
//   Call 1 (no proceed): preflight → questions about opportunities
//   Call 2 (proceed=true): ICE scoring → saves PriorityMatrix to idea artifact
//
// Reads validated_problem context from prior step automatically.
// Writes next template for define_epic.
//
// Arcade MCP Design Patterns demonstrated in this file:
//   Context Injection — The tool automatically loads the validated_problem from the prior
//                       step. The agent doesn't need to pass it explicitly — the tool finds
//                       it from the idea_id and injects it into the prompt.
//                       See: https://www.arcade.dev/patterns#context-injection
//   Operation Mode    — Same two-mode pattern as validate_problem: preflight then full analysis.
//                       Consistent patterns across tools reduce the agent's cognitive load.
//                       See: https://www.arcade.dev/patterns#operation-mode
//   Dependency Hint   — Error message "Run validate_problem first" guides the agent to the
//                       correct sequence without external orchestration.
//                       See: https://www.arcade.dev/patterns#dependency-hint

import { callClaudeJson } from "../../shared/claude.js";
import {
  loadIdea, saveIdea,
  saveSession, loadSession, clearSession,
  discoverWorkingTemplate, extractIdeaId, writeNextTemplate, WORKFLOW_NEXT,
} from "../artifacts/store.js";
import { PRIORITIZE_PREFLIGHT_PROMPT, PRIORITIZE_PROMPT } from "../prompts/templates.js";
import type {
  IdeaArtifact, PriorityMatrix, PreflightResult, StageSession, ToolRunMode,
} from "../../shared/types/index.js";

const TOOL_NAME = "prioritize_opportunities";
const TEMPLATE_NUM = 2;

export interface PrioritizeInput {
  idea_id?: string;
  opportunities?: string; // optional: list of opportunity descriptions
  proceed?: boolean;
  session_notes?: string;
}

export interface PrioritizeOutput {
  idea_id: string;
  mode: ToolRunMode;
  preflight?: PreflightResult;
  session_saved?: string;
  priorities?: PriorityMatrix;
  next_template?: string;
}

export async function prioritizeOpportunities(input: PrioritizeInput): Promise<PrioritizeOutput> {
  const workingTemplate = discoverWorkingTemplate(TEMPLATE_NUM);
  const templateIdeaId = workingTemplate ? extractIdeaId(workingTemplate.content) : null;
  const resolvedId = templateIdeaId ?? input.idea_id;

  if (!resolvedId) throw new Error("No idea_id found. Run validate_problem first or pass idea_id.");
  const idea = loadIdea(resolvedId);
  if (!idea) throw new Error(`Idea "${resolvedId}" not found. Run validate_problem first.`);

  const context = [
    idea.validated_problem
      ? `VALIDATED PROBLEM: "${idea.validated_problem.refined_statement}" (severity ${idea.validated_problem.severity}/10)`
      : `PROBLEM: "${idea.problem_statement}"`,
    input.opportunities ? `OPPORTUNITIES TO SCORE:\n${input.opportunities}` : "",
    workingTemplate ? `TEMPLATE NOTES:\n${workingTemplate.content}` : "",
  ].filter(Boolean).join("\n\n");

  // ── PREFLIGHT ───────────────────────────────────────────────────────────────
  if (!input.proceed) {
    const preflight = await callClaudeJson<PreflightResult>({
      system: PRIORITIZE_PREFLIGHT_PROMPT,
      userMessage: context,
      maxTokens: 1024,
      stageKey: "mcp_discovery",
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

  // ── FULL ANALYSIS ───────────────────────────────────────────────────────────
  const priorSession = loadSession(idea.idea_id, TOOL_NAME);
  const sessionContext = priorSession
    ? [
        `PREFLIGHT GAPS: ${priorSession.preflight.critical_gaps.join("; ")}`,
        input.session_notes ? `FOUNDER'S ANSWERS:\n${input.session_notes}` : "",
      ].filter(Boolean).join("\n\n")
    : input.session_notes ?? "";

  const priorities = await callClaudeJson<PriorityMatrix>({
    system: PRIORITIZE_PROMPT,
    userMessage: `${context}\n\n${sessionContext}\n\nICE score the opportunities and identify the top one. Return JSON.`,
    maxTokens: 2048,
    stageKey: "mcp_discovery",
  });

  idea.priorities = priorities;
  saveIdea(idea);
  clearSession(idea.idea_id, TOOL_NAME);

  const nextNum = WORKFLOW_NEXT[TEMPLATE_NUM];
  const priorContextSummary = [
    `Top opportunity: ${priorities.top_opportunity}`,
    `Rationale: ${priorities.rationale}`,
    idea.validated_problem ? `Problem: ${idea.validated_problem.refined_statement}` : "",
  ].filter(Boolean).join("\n");

  const nextTemplate = nextNum
    ? writeNextTemplate(nextNum, idea.idea_id, priorContextSummary)
    : undefined;

  return {
    idea_id: idea.idea_id,
    mode: "full",
    priorities,
    next_template: nextTemplate,
  };
}
