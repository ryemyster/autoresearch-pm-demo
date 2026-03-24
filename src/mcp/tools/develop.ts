// define_epic — Discovery MCP tool (Develop stage) + inject_artifact utility
//
// define_epic is the BRIDGE between the Discovery stage (MCP tools) and the Epic Refinement Loop.
// It synthesizes validated_problem + priorities into a structured Epic, saves it to
// artifacts/epics/{ideaId}/raw.json, and returns a next_step command string showing
// exactly how to invoke the autoresearch CLI.
//
// This makes the stage boundary a visible, teachable moment:
//   MCP tool output → "next_step: npx tsx src/autoresearch/main.ts --idea-id ..."
//
// Arcade MCP Design Patterns demonstrated in this file:
//   Context Injection — Automatically loads validated_problem + priorities from prior steps.
//                       The agent passes only idea_id; the tool assembles the full context.
//                       See: https://www.arcade.dev/patterns#context-injection
//   Tool Chain        — define_epic explicitly defines the next step in the sequence by
//                       returning a `next_step` CLI command string. The handoff between
//                       MCP tools and the autoresearch CLI is a visible, copy-pasteable
//                       instruction — not hidden logic.
//                       See: https://www.arcade.dev/patterns#tool-chain
//   Resource Reference — The tool saves artifacts to disk and returns file paths
//                       (epic_path, next_step). The agent gets a reference to the result,
//                       not the full artifact embedded in the response.
//                       See: https://www.arcade.dev/patterns#resource-reference

import { callClaudeJson } from "../../shared/claude.js";
import {
  loadIdea, saveIdea,
  saveSession, loadSession, clearSession,
  saveRawEpic, injectArtifact,
  discoverWorkingTemplate, extractIdeaId,
} from "../artifacts/store.js";
import { DEFINE_EPIC_PREFLIGHT_PROMPT, DEFINE_EPIC_PROMPT } from "../prompts/templates.js";
import { parseEpic } from "../../autoresearch/epicSchema.js";
import type {
  IdeaArtifact, Epic, PreflightResult, StageSession, ToolRunMode,
} from "../../shared/types/index.js";

const TOOL_NAME = "define_epic";
const TEMPLATE_NUM = 3;

// ─── define_epic ──────────────────────────────────────────────────────────────

export interface DefineEpicInput {
  idea_id?: string;
  additional_context?: string;
  proceed?: boolean;
  session_notes?: string;
}

export interface DefineEpicOutput {
  idea_id: string;
  mode: ToolRunMode;
  preflight?: PreflightResult;
  session_saved?: string;
  epic?: Epic;
  epic_path?: string; // artifacts/epics/{ideaId}/raw.json
  next_step?: string; // copy-pasteable autoresearch CLI command
}

export async function defineEpic(input: DefineEpicInput): Promise<DefineEpicOutput> {
  const workingTemplate = discoverWorkingTemplate(TEMPLATE_NUM);
  const templateIdeaId = workingTemplate ? extractIdeaId(workingTemplate.content) : null;
  const resolvedId = templateIdeaId ?? input.idea_id;

  if (!resolvedId) throw new Error("No idea_id found. Run validate_problem and prioritize_opportunities first, or pass idea_id.");
  const idea = loadIdea(resolvedId);
  if (!idea) throw new Error(`Idea "${resolvedId}" not found.`);

  const context = [
    idea.validated_problem
      ? `VALIDATED PROBLEM: "${idea.validated_problem.refined_statement}" (severity ${idea.validated_problem.severity}/10, worth_solving: ${idea.validated_problem.worth_solving})`
      : `PROBLEM: "${idea.problem_statement}"`,
    idea.priorities
      ? `TOP OPPORTUNITY: "${idea.priorities.top_opportunity}"\nRATIONALE: ${idea.priorities.rationale}`
      : "",
    input.additional_context ? `ADDITIONAL CONTEXT:\n${input.additional_context}` : "",
    workingTemplate ? `TEMPLATE NOTES:\n${workingTemplate.content}` : "",
  ].filter(Boolean).join("\n\n");

  // ── PREFLIGHT ───────────────────────────────────────────────────────────────
  if (!input.proceed) {
    const preflight = await callClaudeJson<PreflightResult>({
      system: DEFINE_EPIC_PREFLIGHT_PROMPT,
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

  // ── FULL ANALYSIS ───────────────────────────────────────────────────────────
  const priorSession = loadSession(idea.idea_id, TOOL_NAME);
  const sessionContext = priorSession
    ? [
        `PREFLIGHT GAPS: ${priorSession.preflight.critical_gaps.join("; ")}`,
        input.session_notes ? `FOUNDER'S ANSWERS:\n${input.session_notes}` : "",
      ].filter(Boolean).join("\n\n")
    : input.session_notes ?? "";

  const raw = await callClaudeJson<unknown>({
    system: DEFINE_EPIC_PROMPT,
    userMessage: `${context}\n\n${sessionContext}\n\nGenerate the Epic Definition. Return JSON only.`,
    maxTokens: 2000,
  });

  const epic = parseEpic(raw);

  // Save to idea artifact and write raw.json for autoresearch
  idea.raw_epic = epic;
  saveIdea(idea);
  clearSession(idea.idea_id, TOOL_NAME);

  const epicPath = saveRawEpic(idea.idea_id, epic);

  // The next_step message is the teachable moment — it shows exactly how to hand off to autoresearch
  const nextStep = [
    `Discovery complete. Raw epic saved to: ${epicPath}`,
    ``,
    `Next → Run the autoresearch loop to refine and score the epic:`,
    `  npx tsx src/autoresearch/main.ts \\`,
    `    --idea-id ${idea.idea_id} \\`,
    `    --target-dir /path/to/your-project/docs \\`,
    `    --iterations 3`,
    ``,
    `Add --mock to run without an API key (uses deterministic fixtures).`,
  ].join("\n");

  return {
    idea_id: idea.idea_id,
    mode: "full",
    epic,
    epic_path: epicPath,
    next_step: nextStep,
  };
}

// ─── inject_artifact (re-exported utility) ────────────────────────────────────
// Wraps store.injectArtifact — available as an MCP tool for manually pushing
// any file content to an external project directory.

export interface InjectArtifactInput {
  target_dir: string; // must be absolute path
  filename: string;
  content: string;
}

export interface InjectArtifactOutput {
  injected_path: string;
  summary: string;
}

export function injectArtifactTool(input: InjectArtifactInput): InjectArtifactOutput {
  const injectedPath = injectArtifact(input.target_dir, input.filename, input.content);
  return {
    injected_path: injectedPath,
    summary: `Injected ${input.filename} to ${input.target_dir} (${input.content.length} chars)`,
  };
}
