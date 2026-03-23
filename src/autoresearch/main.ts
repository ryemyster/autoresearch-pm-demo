// Autoresearch CLI — Layer 2 entry point.
//
// Usage:
//   npx tsx src/autoresearch/main.ts \
//     --idea-id <id> \
//     --target-dir /absolute/path/to/project/docs \
//     --iterations 3 \
//     [--mock]
//
// Reads artifacts/epics/{ideaId}/raw.json (written by define_epic MCP tool).
// Runs N iterations of generate → evaluate → iterate → select.
// Injects best epic as {ideaId}-epic.md into target-dir.
//
// Teaching note: Set MOCK_LLM=true BEFORE importing config (config reads env at module load).

// ── env must be set before any imports that read it ────────────────────────────
const args = process.argv.slice(2);
if (args.includes("--mock")) {
  process.env.MOCK_LLM = "true";
}

import chalk from "chalk";
import { optimize } from "./loop.js";
import { assertApiKey } from "../shared/config.js";
import type { Epic, EvaluationResult } from "../shared/types/index.js";

// ─── Arg parsing ──────────────────────────────────────────────────────────────

function getArg(flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : undefined;
}

const ideaId = getArg("--idea-id");
const targetDir = getArg("--target-dir");
const iterationsStr = getArg("--iterations");
const mockMode = args.includes("--mock");

if (!ideaId || !targetDir) {
  console.error(chalk.red("Error: --idea-id and --target-dir are required."));
  console.error("");
  console.error("Usage:");
  console.error("  npx tsx src/autoresearch/main.ts \\");
  console.error("    --idea-id <id> \\");
  console.error("    --target-dir /absolute/path/to/project/docs \\");
  console.error("    --iterations 3 \\");
  console.error("    [--mock]");
  process.exit(1);
}

const iterations = iterationsStr ? parseInt(iterationsStr, 10) : 3;

if (!mockMode) assertApiKey();

// ─── Display Helpers ──────────────────────────────────────────────────────────

const CRITERION_LABELS: Record<string, string> = {
  outcome_clarity:    "Outcome Clarity   ",
  bounded_scope:      "Bounded Scope     ",
  measurable_success: "Measurable Success",
  dependency_clarity: "Dependency Clarity",
  actionability:      "Actionability     ",
};

function scoreColor(n: number): string {
  if (n === 2) return chalk.green(String(n));
  if (n === 1) return chalk.yellow(String(n));
  return chalk.red(String(n));
}

function printScoreTable(result: EvaluationResult): void {
  console.log("");
  console.log(chalk.dim("  Criterion            Rule  LLM  Total  Note"));
  console.log(chalk.dim("  ─────────────────────────────────────────────────────────────────"));
  for (const c of result.criteria) {
    const label = CRITERION_LABELS[c.name] ?? c.name.padEnd(18);
    const rule = c.ruleScore === 0 && c.name === "actionability" ? chalk.dim(" –") : scoreColor(c.ruleScore);
    const llm = scoreColor(c.llmScore);
    const total = scoreColor(c.total);
    const note = c.total < 2 ? chalk.dim(c.llmRationale.slice(0, 55)) : chalk.dim("✓");
    console.log(`  ${label}  ${rule}     ${llm}    ${total}    ${note}`);
  }
  console.log(chalk.dim("  ─────────────────────────────────────────────────────────────────"));
}

function printEpicSummary(epic: Epic, score: number): void {
  console.log("");
  console.log(chalk.bold(`  "${epic.title}"`));
  console.log(chalk.dim("  outcome: ") + epic.outcome.slice(0, 100) + (epic.outcome.length > 100 ? "…" : ""));
  console.log(chalk.dim("  scope.in: ") + epic.scope.in.slice(0, 2).join(" | ") + (epic.scope.in.length > 2 ? ` +${epic.scope.in.length - 2}` : ""));
  console.log(chalk.dim("  metrics: ") + epic.success_metrics.map((m) => `${m.metric} (${m.target})`).join(" | "));
  console.log(chalk.dim("  score: ") + chalk.bold(`${score}/10`));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log("");
console.log(chalk.bold("Autoresearch PM Demo") + chalk.dim(" — Layer 2: Optimization Loop"));
console.log(chalk.dim(`  idea: ${ideaId}`));
console.log(chalk.dim(`  target: ${targetDir}`));
console.log(chalk.dim(`  iterations: ${iterations}${mockMode ? " (mock mode)" : ""}`));

await optimize(ideaId, targetDir, iterations, {
  onIterationStart(i, total) {
    console.log("");
    console.log(chalk.cyan(`Iteration ${i}/${total}`) + chalk.dim(" ────────────────────────────────────────────────"));
    process.stdout.write(chalk.dim("  Generating epic..."));
  },
  onGenerated(_epic) {
    process.stdout.write(chalk.dim(" Evaluating...\n"));
  },
  onEvaluated(result, isBest, bestScore) {
    printScoreTable(result);
    const totalStr = `  Score: ${result.total}/10`;
    const bestStr = `  Best so far: ${bestScore}/10`;
    const newBestStr = isBest ? chalk.green("  ✓ New best!") : "";
    console.log(chalk.bold(totalStr) + "   " + chalk.dim(bestStr) + (isBest ? "  " + newBestStr : ""));

    if (result.improvementHints.length > 0) {
      console.log("");
      console.log(chalk.dim("  Hints for next iteration:"));
      for (const hint of result.improvementHints) {
        console.log(chalk.yellow("  → ") + chalk.dim(hint.slice(0, 100) + (hint.length > 100 ? "…" : "")));
      }
    }
  },
  onComplete(best, bestResult, runDir, injectedPath) {
    console.log("");
    console.log(chalk.bold.green("RESULT") + chalk.dim(" ─────────────────────────────────────────────────────────────"));
    printEpicSummary(best, bestResult.total);
    console.log("");
    console.log(chalk.dim("  Artifacts saved to:"), chalk.cyan(runDir));
    console.log(chalk.dim("  ├── manifest.json"));
    for (let i = 0; i < iterations; i++) {
      console.log(chalk.dim(`  ├── iteration_${i}.json`));
    }
    console.log(chalk.dim("  └── best.json"));
    console.log("");
    console.log(chalk.bold.green("  Epic injected to:"), chalk.cyan(injectedPath));
    console.log("");
    console.log(chalk.dim("  Layer 3 → In your target project, run:"), chalk.bold("/build-from-epic"));
    console.log("");
  },
});
