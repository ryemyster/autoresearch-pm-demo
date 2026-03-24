// MCP server — registers all 3 discovery tools.
// Registers 3 discovery tools + inject_artifact utility.
//
// Tools:
//   validate_problem       (Discover: stress-test the problem hypothesis)
//   prioritize_opportunities (Design: ICE score and pick top opportunity)
//   define_epic            (Develop: synthesize Epic from prior context → seeds autoresearch)
//   inject_artifact        (Utility: push any content to a target project directory)

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { validateProblem } from "./tools/discover.js";
import { prioritizeOpportunities } from "./tools/design.js";
import { defineEpic, injectArtifactTool } from "./tools/develop.js";

function toolResponse(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

export function createServer(): McpServer {
  const server = new McpServer({
    name: "autoresearch-pm-demo",
    version: "0.2.0",
  });

  // ── validate_problem ──────────────────────────────────────────────────────
  server.tool(
    "validate_problem",
    "DISCOVERY — DISCOVER: Stress-test your problem hypothesis before defining any solution. " +
    "Use twice: first without proceed (get questions), then with proceed=true + session_notes (full analysis).",
    {
      problem_statement: z.string().optional().describe("The problem you think exists. Required on first call unless idea_id is provided."),
      context: z.string().optional().describe("Additional context: customer evidence, market research, or observations."),
      idea_id: z.string().optional().describe("Existing idea ID to continue. Omit to create a new idea."),
      proceed: z.boolean().optional().describe("Omit for preflight questions. true = run full analysis (include session_notes)."),
      session_notes: z.string().optional().describe("Your answers to the preflight questions. Required when proceed=true."),
    },
    async (input) => toolResponse(await validateProblem(input))
  );

  // ── prioritize_opportunities ───────────────────────────────────────────────
  server.tool(
    "prioritize_opportunities",
    "DISCOVERY — DESIGN: ICE score opportunities and identify the highest-value one to pursue. " +
    "Reads validated_problem automatically. Use twice: preflight then proceed=true.",
    {
      idea_id: z.string().optional().describe("Idea ID from validate_problem output."),
      opportunities: z.string().optional().describe("Optional list of opportunity descriptions to score."),
      proceed: z.boolean().optional().describe("Omit for preflight questions. true = run full analysis."),
      session_notes: z.string().optional().describe("Your answers to the preflight questions."),
    },
    async (input) => toolResponse(await prioritizeOpportunities(input))
  );

  // ── define_epic ────────────────────────────────────────────────────────────
  server.tool(
    "define_epic",
    "DISCOVERY — DEVELOP: Synthesize validated research into a structured Epic. " +
    "BRIDGE to Epic Refinement Loop: saves raw.json and returns next_step CLI command for autoresearch. " +
    "Use twice: preflight then proceed=true.",
    {
      idea_id: z.string().optional().describe("Idea ID from earlier tools."),
      additional_context: z.string().optional().describe("Any extra context not captured in prior steps."),
      proceed: z.boolean().optional().describe("Omit for preflight questions. true = generate epic."),
      session_notes: z.string().optional().describe("Your answers to the preflight questions."),
    },
    async (input) => toolResponse(await defineEpic(input))
  );

  // ── inject_artifact ────────────────────────────────────────────────────────
  server.tool(
    "inject_artifact",
    "UTILITY: Push any file content to a target project directory. " +
    "Use to manually inject a PRD, spec, or epic into an external project's docs/ folder. " +
    "The autoresearch loop calls this automatically — use this tool for manual injections only.",
    {
      target_dir: z.string().describe(
        "Absolute path to the target directory (e.g., /path/to/my-project/docs)."
      ),
      filename: z.string().describe("Filename to write (e.g., my-idea-epic.md)."),
      content: z.string().describe("Content to write to the file."),
    },
    (input) => toolResponse(injectArtifactTool(input))
  );

  return server;
}
