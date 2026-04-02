// discover.ts — The four Discovery commands that run from the terminal.
//
// What this file does:
//   --discover    → Step 1: Ask Claude "is this problem real and worth solving?"
//   --prioritize  → Step 2: Ask Claude "what are the best ways to solve it?" (ICE scores)
//   --define-epic → Step 3: Ask Claude "write me a first draft plan" (the "epic")
//   --inject      → Step 4: Copy the draft plan into the target project (no Claude call)
//
// Each step saves its results to the artifacts/ folder so the next step can read them.
// Run them in order — each one builds on the last.
//
// Under the hood: these call the same functions used by the MCP tools, but skip
// the "ask questions first" step. The MCP tools use a two-round pattern
// (round 1 = ask questions, round 2 = do the work) because a chat agent needs
// to gather information before it can act. On the command line, we skip round 1
// and go straight to the work — the analysis runs immediately.

import chalk from "chalk";
import { validateProblem } from "../mcp/tools/discover.js";
import { prioritizeOpportunities } from "../mcp/tools/design.js";
import { defineEpic } from "../mcp/tools/develop.js";
import { loadRawEpic, injectArtifact } from "../mcp/artifacts/store.js";
import { formatEpicAsMarkdown } from "./loop.js";

// ─── --discover ───────────────────────────────────────────────────────────────
// Step 1 of 4. Sends your idea to Claude and asks: "Is this problem real?
// Is it specific enough? Is it worth building something for?"
// Saves the result into the idea's artifact file so --prioritize can read it.

export async function runDiscover(ideaId: string): Promise<void> {
  console.log("");
  console.log(chalk.bold("Validate Problem") + chalk.dim(` — ${ideaId}`));
  console.log("");

  try {
    process.stdout.write(chalk.dim("  Analyzing with Claude..."));
    const result = await validateProblem({ idea_id: ideaId, proceed: true });
    process.stdout.write("\n");

    const vp = result.validated_problem;
    if (!vp) {
      console.error(chalk.red("  No validated_problem in result. Was the idea created first?"));
      process.exit(1);
    }

    console.log("");
    console.log(chalk.dim("  Refined statement: ") + vp.refined_statement);
    console.log(chalk.dim("  Problem type:      ") + vp.problem_type);
    console.log(chalk.dim("  Severity:          ") + vp.severity + "/10");
    console.log(chalk.dim("  Worth solving:     ") + (vp.worth_solving ? chalk.green("yes") : chalk.yellow("no")));
    if (vp.validation_gaps.length > 0) {
      console.log(chalk.dim("  Validation gaps:   ") + vp.validation_gaps.join(" | "));
    }
    console.log(chalk.dim("  Recommended next:  ") + vp.recommended_next);
    console.log("");
    console.log(chalk.dim("  Artifact saved to: ") + chalk.cyan(`artifacts/ideas/${ideaId}.json`));
    console.log("");
    console.log(chalk.dim("  Next →"), chalk.bold(`npx tsx src/autoresearch/main.ts --prioritize --idea-id ${ideaId}`));
    console.log("");
  } catch (err) {
    process.stdout.write("\n");
    console.error(chalk.red(`  Error: ${(err as Error).message}`));
    process.exit(1);
  }
}

// ─── --prioritize ─────────────────────────────────────────────────────────────
// Step 2 of 4. Reads the validated problem from Step 1 and asks Claude:
// "What are the different ways to solve this, and which is the best bet?"
// Uses ICE scoring: Impact (how much it helps), Confidence (how sure we are),
// Effort (how hard to build). Higher total = better bet.

export async function runPrioritize(ideaId: string): Promise<void> {
  console.log("");
  console.log(chalk.bold("Prioritize Opportunities") + chalk.dim(` — ${ideaId}`));
  console.log("");

  try {
    process.stdout.write(chalk.dim("  Analyzing with Claude..."));
    const result = await prioritizeOpportunities({ idea_id: ideaId, proceed: true });
    process.stdout.write("\n");

    const pm = result.priorities;
    if (!pm) {
      console.error(chalk.red("  No priorities in result. Run --discover first."));
      process.exit(1);
    }

    console.log("");
    console.log(chalk.dim("  Top opportunity: ") + pm.top_opportunity);
    console.log(chalk.dim("  Rationale:       ") + pm.rationale);

    if (pm.ice_scores.length > 0) {
      console.log("");
      console.log(chalk.dim("  ICE Scores:"));
      console.log(chalk.dim("    Opportunity                               I    C    E    Total"));
      console.log(chalk.dim("    ─────────────────────────────────────────────────────────────"));
      for (const s of pm.ice_scores) {
        const opp = s.opportunity.slice(0, 40).padEnd(40);
        const i = String(s.impact).padStart(4);
        const c = String(s.confidence).padStart(4);
        const e = String(s.effort).padStart(4);
        const t = s.total.toFixed(1).padStart(7);
        console.log(`    ${chalk.dim(opp)}  ${i}  ${c}  ${e}  ${t}`);
      }
    }

    console.log("");
    console.log(chalk.dim("  Artifact saved to: ") + chalk.cyan(`artifacts/ideas/${ideaId}.json`));
    console.log("");
    console.log(chalk.dim("  Next →"), chalk.bold(`npx tsx src/autoresearch/main.ts --define-epic --idea-id ${ideaId}`));
    console.log("");
  } catch (err) {
    process.stdout.write("\n");
    console.error(chalk.red(`  Error: ${(err as Error).message}`));
    process.exit(1);
  }
}

// ─── --define-epic ────────────────────────────────────────────────────────────
// Step 3 of 4. Takes everything from Steps 1 and 2 and asks Claude to write
// the first draft of the feature plan (called an "epic"). An epic is a one-page
// spec: what problem it solves, what to build, and how to measure success.
// Saves the result as raw.json — the starting point for the Epic Refinement Loop.

export async function runDefineEpic(ideaId: string): Promise<void> {
  console.log("");
  console.log(chalk.bold("Define Epic") + chalk.dim(` — ${ideaId}`));
  console.log("");

  try {
    process.stdout.write(chalk.dim("  Synthesizing with Claude..."));
    const result = await defineEpic({ idea_id: ideaId, proceed: true });
    process.stdout.write("\n");

    const epic = result.epic;
    if (!epic) {
      console.error(chalk.red("  No epic in result. Run --discover and --prioritize first."));
      process.exit(1);
    }

    console.log("");
    console.log(chalk.dim("  Title:   ") + chalk.bold(`"${epic.title}"`));
    console.log(chalk.dim("  Outcome: ") + epic.outcome);
    const scopeStr = epic.scope.in.slice(0, 2).join(" | ") + (epic.scope.in.length > 2 ? ` +${epic.scope.in.length - 2} more` : "");
    console.log(chalk.dim("  Scope:   ") + scopeStr);
    console.log("");
    console.log(chalk.dim("  Raw epic saved to: ") + chalk.cyan(result.epic_path ?? `artifacts/epics/${ideaId}/raw.json`));
    console.log("");
    // next_step is already a formatted multi-line instruction from defineEpic()
    if (result.next_step) {
      console.log(result.next_step);
    }
    console.log("");
  } catch (err) {
    process.stdout.write("\n");
    console.error(chalk.red(`  Error: ${(err as Error).message}`));
    process.exit(1);
  }
}

// ─── --inject ─────────────────────────────────────────────────────────────────
// Step 4 of 4. Copies the raw epic (saved in Step 3) into your target project
// as a readable markdown file. This is a simple file copy — no Claude call,
// no API key needed, always free.
//
// Why is this a separate step? Because the Epic Refinement Loop reads from a
// file in your target project's docs folder. This step puts the plan there.
// Score = 0 means "this is the raw first draft, before any loop improvements."

export async function runInject(ideaId: string, targetDir: string): Promise<void> {
  console.log("");
  console.log(chalk.bold("Inject Artifact"));
  console.log(chalk.dim(`  idea-id:    ${ideaId}`));
  console.log(chalk.dim(`  target-dir: ${targetDir}`));
  console.log("");

  try {
    const epic = loadRawEpic(ideaId);
    if (!epic) {
      console.error(chalk.red(`  No raw epic found for "${ideaId}".`));
      console.error(chalk.dim("  Run --define-epic first to generate artifacts/epics/<idea-id>/raw.json."));
      process.exit(1);
    }

    console.log(chalk.dim(`  Loaded raw epic: "${epic.title}"`));

    // score=0 indicates this is the raw, pre-refinement epic (no autoresearch loop run yet)
    const markdown = formatEpicAsMarkdown(epic, 0, ideaId);
    const filename = `${ideaId}-epic.md`;
    const injectedPath = injectArtifact(targetDir, filename, markdown);

    console.log("");
    console.log(chalk.dim("  Injected to: ") + chalk.cyan(injectedPath));
    console.log("");
    console.log(chalk.dim("  Build → In your target project, run:"), chalk.bold("/build-from-epic"));
    console.log("");
  } catch (err) {
    console.error(chalk.red(`  Error: ${(err as Error).message}`));
    process.exit(1);
  }
}
