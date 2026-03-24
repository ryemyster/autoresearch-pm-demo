// Autoresearch CLI — entry point for all loops (Layers 2, Code Quality, Validation).
//
// Usage:
//   npx tsx src/autoresearch/main.ts \
//     --idea-id <id> \
//     --target-dir /absolute/path/to/project/docs \
//     --iterations 3 \
//     [--git-mode]      ← enable git commit/revert cycle (the full Karpathy pattern)
//     [--explore]       ← run 3 framings side-by-side, then pick the best
//     [--code-quality]  ← run the code quality improvement loop (requires --target-file)
//     [--validate]      ← run the validation loop against epic metrics (requires --target-file)
//     [--target-file]   ← path to the code file to improve (required for --code-quality/--validate)
//     [--yes]           ← skip the cost-confirmation prompt
//     [--mock]          ← no API key needed, uses scripted fixtures
//
// Teaching note: ALL env vars MUST be set before any imports, because config.ts
// reads them lazily at access time. Module-level code in imported files runs
// as soon as they are imported, so flags must come FIRST.

// ── Set env vars BEFORE any imports ───────────────────────────────────────────
const args = process.argv.slice(2);
if (args.includes("--mock"))         process.env.MOCK_LLM = "true";
if (args.includes("--git-mode"))     process.env.GIT_MODE = "true";
if (args.includes("--explore"))      process.env.EXPLORE_MODE = "true";
if (args.includes("--code-quality")) process.env.CODE_QUALITY_MODE = "true";
if (args.includes("--validate"))     process.env.VALIDATION_MODE = "true";

import * as readline from "readline";
import chalk from "chalk";
import { optimize, explore, injectVariation } from "./loop.js";
import { runCodeQuality } from "../code-quality/loop.js";
import { runValidation } from "../validation/loop.js";
import { assertApiKey, settings } from "../shared/config.js";
import type { Epic, EvaluationResult, ExploreReport, CodeQualityResult, ValidationResult } from "../shared/types/index.js";

// ─── Arg parsing ──────────────────────────────────────────────────────────────

function getArg(flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : undefined;
}

const ideaId       = getArg("--idea-id");
const targetDir    = getArg("--target-dir");
const targetFile   = getArg("--target-file");  // required for --code-quality / --validate
const iterationsStr = getArg("--iterations");
const mockMode      = args.includes("--mock");
const gitMode       = args.includes("--git-mode");
const exploreMode   = args.includes("--explore");
const codeQualityMode = args.includes("--code-quality");
const validationMode  = args.includes("--validate");
const skipConfirm   = args.includes("--yes");

if (!ideaId || !targetDir) {
  console.error(chalk.red("Error: --idea-id and --target-dir are required."));
  console.error("");
  console.error("Usage:");
  console.error("  npx tsx src/autoresearch/main.ts \\");
  console.error("    --idea-id <id> \\");
  console.error("    --target-dir /absolute/path/to/project/docs \\");
  console.error("    --iterations 3 \\");
  console.error("    [--git-mode]                enable git commit/revert cycle (Layer 2)");
  console.error("    [--explore]                 run 3 framings, pick the best (Layer 2)");
  console.error("    [--code-quality]            run code quality loop (requires --target-file)");
  console.error("    [--validate]                run validation loop   (requires --target-file)");
  console.error("    [--target-file /path/to/file.ts]  code file to improve");
  console.error("    [--yes]                     skip cost confirmation prompt");
  console.error("    [--mock]                    no API key needed (uses scripted fixtures)");
  process.exit(1);
}

if ((codeQualityMode || validationMode) && !targetFile) {
  console.error(chalk.red("Error: --target-file is required when using --code-quality or --validate."));
  console.error(chalk.dim("  Example: --target-file /path/to/your-feature.ts"));
  process.exit(1);
}

const iterations = iterationsStr ? parseInt(iterationsStr, 10) : 3;

if (!mockMode) assertApiKey();

// ─── Cost Estimate ────────────────────────────────────────────────────────────

/**
 * WHAT: Prints an estimate of how many tokens this run will use and what it costs.
 * WHY:  LLM API calls cost real money. Showing the estimate before any calls are
 *       made gives the student a chance to abort if the number looks surprising.
 *       It also teaches that every AI call has a cost — "tokens" are the unit of
 *       work that the API charges for.
 * LEARN MORE: docs/HOW_IT_WORKS.md → "Token Costs and Iteration Limits"
 */
function printCostEstimate(n: number, isExplore: boolean): void {
  const variations = isExplore ? 3 : 1;
  // Rough estimates per iteration:
  //   Generator call: ~1500 output + ~500 input = ~2000 tokens
  //   Evaluator call: ~300 output + ~300 input  = ~600 tokens
  //   Total per iteration: ~2600 tokens
  const tokensPerIteration = 2600;
  // Explore mode has one extra "framing" call per variation (~2000 tokens each)
  const framingTokens = isExplore ? 3 * 2000 : 0;
  const totalTokens = n * tokensPerIteration * variations + framingTokens;
  // Conservative blended cost: $0.001 per 1000 tokens (rounds up from haiku pricing)
  const costDollars = (totalTokens / 1000) * 0.001;
  const costCents = costDollars * 100;

  console.log(chalk.dim("  Cost estimate (before any API calls are made):"));
  if (isExplore) {
    console.log(chalk.dim(`    3 framings × ${n} iterations × ~${tokensPerIteration} tokens + framing calls`));
  } else {
    console.log(chalk.dim(`    ${n} iteration(s) × ~${tokensPerIteration} tokens/iteration`));
  }
  console.log(chalk.dim(`    Total: ~${totalTokens.toLocaleString()} tokens`));
  if (costCents < 1) {
    console.log(chalk.dim(`    Estimated cost: < $0.01 (less than one cent)`));
  } else {
    console.log(chalk.dim(`    Estimated cost: ~$${costDollars.toFixed(3)} USD`));
  }
}

/**
 * WHAT: Asks "Continue? [y/N]" in the terminal and waits for the user to type.
 * WHY:  A simple confirmation before spending money on API calls. The --yes flag
 *       skips this for users who already know what they're doing.
 */
async function promptConfirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${message} [y/N] `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}

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

/**
 * WHAT: Prints a side-by-side comparison table of all 3 explore mode variations.
 * WHY:  The PM needs to see all options at once to make an informed choice.
 *       This is the "PM chooses from strong candidates" step in the workflow.
 */
function printExploreTable(report: ExploreReport): void {
  console.log("");
  console.log(chalk.bold("Variation comparison:"));
  console.log(chalk.dim("  #   Framing              Score   Title"));
  console.log(chalk.dim("  ─────────────────────────────────────────────────────────────────────────"));
  for (const v of report.variations) {
    const num = chalk.bold(String(v.variationIndex + 1));
    const label = v.framingLabel.padEnd(20);
    const score = `${v.bestScore}/10`.padEnd(7);
    const scoreStr = v.bestScore >= 8 ? chalk.green(score) : v.bestScore >= 5 ? chalk.yellow(score) : chalk.red(score);
    const title = v.best.title.slice(0, 45) + (v.best.title.length > 45 ? "…" : "");
    console.log(`  ${num}   ${chalk.dim(label)}  ${scoreStr}  ${title}`);
  }
  console.log(chalk.dim("  ─────────────────────────────────────────────────────────────────────────"));
  console.log(chalk.dim(`  Recommended: #${report.recommendedIndex + 1} (${report.variations[report.recommendedIndex].framingLabel}) scored highest.`));
}

// ─── Code Quality Display Helpers ─────────────────────────────────────────────

const CODE_CRITERION_LABELS: Record<string, string> = {
  no_lint_errors:       "No Lint Errors      ",
  no_security_issues:   "No Security Issues  ",
  readability:          "Readability         ",
  test_coverage_intent: "Test Coverage Intent",
  epic_alignment:       "Epic Alignment      ",
};

function printCodeQualityTable(result: CodeQualityResult): void {
  console.log("");
  console.log(chalk.dim("  Criterion              Rule  LLM  Total  Note"));
  console.log(chalk.dim("  ────────────────────────────────────────────────────────────────────"));
  for (const c of result.criteria) {
    const label = CODE_CRITERION_LABELS[c.name] ?? c.name.padEnd(20);
    const rule = c.ruleScore === 0 && c.name === "epic_alignment" ? chalk.dim(" –") : scoreColor(c.ruleScore);
    const llm = scoreColor(c.llmScore);
    const total = scoreColor(c.total);
    const note = c.total < 2 ? chalk.dim(c.llmRationale.slice(0, 50)) : chalk.dim("✓");
    console.log(`  ${label}  ${rule}     ${llm}    ${total}    ${note}`);
  }
  console.log(chalk.dim("  ────────────────────────────────────────────────────────────────────"));
}

function printValidationTable(result: ValidationResult): void {
  console.log("");
  console.log(chalk.dim("  Metric                                   Pass?  Note"));
  console.log(chalk.dim("  ─────────────────────────────────────────────────────────────────────────"));
  for (const t of result.tests) {
    const metric = t.metric.slice(0, 40).padEnd(40);
    const pass = t.passed ? chalk.green("✓ Yes") : chalk.red("✗ No ");
    const note = chalk.dim(t.rationale.slice(0, 45));
    console.log(`  ${metric}  ${pass}  ${note}`);
  }
  console.log(chalk.dim("  ─────────────────────────────────────────────────────────────────────────"));
  const passStr = `${result.passCount}/${result.tests.length} metrics passing`;
  const scoreStr = `${result.totalScore}/10`;
  console.log(`  ${result.passCount === result.tests.length ? chalk.green(passStr) : chalk.yellow(passStr)}   Score: ${chalk.bold(scoreStr)}`);
}

/**
 * WHAT: Prompts the user to pick a number (1, 2, or 3) from the explore table.
 * WHY:  The PM is the decision-maker — the system surfaces options with scores,
 *       but the human picks. Pressing Enter accepts the recommended option.
 */
async function promptVariationChoice(count: number, recommendedIndex: number): Promise<number> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(
      chalk.bold(`  Which variation to inject? [1-${count}, Enter = ${recommendedIndex + 1}]: `),
      (answer) => {
        rl.close();
        const trimmed = answer.trim();
        if (!trimmed) {
          resolve(recommendedIndex);
          return;
        }
        const parsed = parseInt(trimmed, 10);
        if (parsed >= 1 && parsed <= count) {
          resolve(parsed - 1); // convert to 0-based index
        } else {
          console.log(chalk.yellow(`  Invalid choice — using recommended #${recommendedIndex + 1}`));
          resolve(recommendedIndex);
        }
      }
    );
  });
}

// ─── Shared Callbacks ─────────────────────────────────────────────────────────
// These callbacks are used by BOTH optimize() and explore() mode.

const sharedCallbacks = {
  onIterationStart(i: number, total: number) {
    console.log("");
    console.log(chalk.cyan(`Iteration ${i}/${total}`) + chalk.dim(" ────────────────────────────────────────────────"));
    process.stdout.write(chalk.dim("  Generating epic..."));
  },
  onGenerated(_epic: Epic) {
    process.stdout.write(chalk.dim(" Evaluating...\n"));
  },
  onEvaluated(result: EvaluationResult, isBest: boolean, bestScore: number) {
    printScoreTable(result);
    const totalStr = `  Score: ${result.total}/10`;
    const bestStr = `  Best so far: ${bestScore}/10`;
    console.log(chalk.bold(totalStr) + "   " + chalk.dim(bestStr) + (isBest ? "  " + chalk.green("  ✓ New best!") : ""));

    if (result.improvementHints.length > 0) {
      console.log("");
      console.log(chalk.dim("  Hints for next iteration:"));
      for (const hint of result.improvementHints) {
        console.log(chalk.yellow("  → ") + chalk.dim(hint.slice(0, 100) + (hint.length > 100 ? "…" : "")));
      }
    }
  },
  onComplete(best: Epic, bestResult: EvaluationResult, runDir: string, injectedPath: string) {
    console.log("");
    console.log(chalk.bold.green("RESULT") + chalk.dim(" ─────────────────────────────────────────────────────────────"));
    printEpicSummary(best, bestResult.total);
    console.log("");
    console.log(chalk.dim("  Artifacts saved to:"), chalk.cyan(runDir));
    console.log(chalk.dim("  Epic injected to:"), chalk.cyan(injectedPath));
    console.log("");
    console.log(chalk.dim("  Layer 3 → In your target project, run:"), chalk.bold("/build-from-epic"));
    console.log("");
  },
  // Git mode callbacks
  onGitCommit(iteration: number, score: number, message: string) {
    console.log(chalk.dim(`  git commit: "${message}"`));
  },
  onGitRevert(iteration: number, previousBest: number, newScore: number) {
    console.log(chalk.yellow(`  git revert: score ${newScore}/10 < best ${previousBest}/10 — discarding this iteration`));
  },
  onGitLog(entries: string[]) {
    console.log("");
    console.log(chalk.bold("Experiment log (git):"));
    console.log(chalk.dim("  Every attempt is recorded here — including the ones that were discarded."));
    console.log(chalk.dim("  This is the experiment record. More valuable than just the final result."));
    console.log("");
    for (const entry of entries) {
      console.log(chalk.dim("  " + entry));
    }
    console.log("");
    console.log(chalk.dim("  LEARN MORE: docs/HOW_IT_WORKS.md → 'The Experiment Log as Strategic Asset'"));
  },
  // Explore mode callbacks
  onExploreVariationStart(variationIndex: number, framingLabel: string) {
    console.log("");
    console.log(
      chalk.bold.cyan(`Variation ${variationIndex + 1}/3: "${framingLabel}"`) +
      chalk.dim(" ─────────────────────────────────────────────────────────")
    );
  },
};

// ─── Main ─────────────────────────────────────────────────────────────────────

// Determine which mode we're running
const activeMode = validationMode ? "validate" : codeQualityMode ? "code-quality" : exploreMode ? "explore" : gitMode ? "optimize+git" : "optimize";

console.log("");
console.log(chalk.bold("Autoresearch PM Demo") + chalk.dim(` — ${activeMode} loop`));
console.log(chalk.dim(`  idea:       ${ideaId}`));
console.log(chalk.dim(`  target:     ${targetDir}`));
if (targetFile) console.log(chalk.dim(`  file:       ${targetFile}`));
console.log(chalk.dim(`  iterations: ${iterations}${exploreMode ? " × 3 variations" : ""}${mockMode ? " (mock)" : ""}${gitMode ? " (git mode)" : ""}`));

// Show cost estimate and confirm before making any API calls
if (!mockMode) {
  printCostEstimate(iterations, exploreMode);
  console.log("");
  if (!skipConfirm) {
    const ok = await promptConfirm(chalk.bold("  Proceed?"));
    if (!ok) {
      console.log(chalk.dim("  Aborted. Use --mock to try for free, or --yes to skip this prompt."));
      process.exit(0);
    }
  }
}

// Determine the epic path for code quality and validation modes
// The epic is in targetDir as {ideaId}-epic.md (injected by Layer 2)
const epicPath = targetDir ? `${targetDir}/${ideaId}-epic.md` : "";

if (validationMode) {
  // ── Validation mode: validate code against epic's success metrics ────────
  // If --validate is set, run code quality first, then validation
  if (targetFile) {
    console.log("");
    console.log(chalk.bold.cyan("Step 1/2: Code Quality Loop") + chalk.dim(" ──────────────────────────────────────────"));
    await runCodeQuality(targetFile, epicPath, ideaId, iterations, {
      onIterationStart(i, total) {
        console.log("");
        console.log(chalk.cyan(`  Code quality iteration ${i}/${total}`) + chalk.dim(" ────────────────────────────────────────"));
        process.stdout.write(chalk.dim("  Improving code..."));
      },
      onImproved(_code, file) {
        process.stdout.write(chalk.dim(` Evaluating...\n`));
      },
      onEvaluated(result: CodeQualityResult, isBest, bestScore) {
        printCodeQualityTable(result);
        console.log(chalk.bold(`  Score: ${result.total}/10`) + "   " + chalk.dim(`Best: ${bestScore}/10`) + (isBest ? "  " + chalk.green("✓ New best!") : ""));
      },
      onComplete(_code, result, file) {
        console.log("");
        console.log(chalk.green(`  Code quality complete: ${result.total}/10`));
        console.log(chalk.dim(`  File updated: ${file}`));
      },
    });

    console.log("");
    console.log(chalk.bold.cyan("Step 2/2: Validation Loop") + chalk.dim(" ────────────────────────────────────────────"));
    await runValidation(targetFile, epicPath, ideaId, iterations, {
      onIterationStart(i, total) {
        console.log("");
        console.log(chalk.cyan(`  Validation iteration ${i}/${total}`) + chalk.dim(" ──────────────────────────────────────────"));
        process.stdout.write(chalk.dim("  Validating against epic metrics..."));
      },
      onValidated(result: ValidationResult, isBest) {
        process.stdout.write("\n");
        printValidationTable(result);
        if (isBest) console.log(chalk.green("  ✓ New best pass rate!"));
      },
      onComplete(result, file) {
        console.log("");
        console.log(chalk.bold.green("VALIDATION RESULT") + chalk.dim(" ─────────────────────────────────────────────────"));
        printValidationTable(result);
        console.log("");
        console.log(chalk.dim("  File:"), chalk.cyan(file));
        if (result.passCount === result.tests.length && result.tests.length > 0) {
          console.log(chalk.green("  All metrics pass! This code satisfies the epic."));
        } else {
          console.log(chalk.yellow(`  ${result.failCount} metric(s) still failing. Run more iterations or review manually.`));
        }
        console.log("");
      },
    });
  }

} else if (codeQualityMode) {
  // ── Code quality mode: improve code quality ────────────────────────────────
  if (targetFile) {
    await runCodeQuality(targetFile, epicPath, ideaId, iterations, {
      onIterationStart(i, total) {
        console.log("");
        console.log(chalk.cyan(`Iteration ${i}/${total}`) + chalk.dim(" ────────────────────────────────────────────────"));
        process.stdout.write(chalk.dim("  Improving code..."));
      },
      onImproved(_code, file) {
        process.stdout.write(chalk.dim(` Evaluating...\n`));
      },
      onEvaluated(result: CodeQualityResult, isBest, bestScore) {
        printCodeQualityTable(result);
        console.log(chalk.bold(`  Score: ${result.total}/10`) + "   " + chalk.dim(`Best: ${bestScore}/10`) + (isBest ? "  " + chalk.green("✓ New best!") : ""));
        if (result.improvementHints.length > 0) {
          console.log("");
          console.log(chalk.dim("  Hints for next iteration:"));
          for (const hint of result.improvementHints) {
            console.log(chalk.yellow("  → ") + chalk.dim(hint.slice(0, 100) + (hint.length > 100 ? "…" : "")));
          }
        }
      },
      onComplete(bestCode, result, file) {
        console.log("");
        console.log(chalk.bold.green("CODE QUALITY RESULT") + chalk.dim(" ─────────────────────────────────────────────────"));
        console.log(chalk.dim("  Final score: ") + chalk.bold(`${result.total}/10`));
        console.log(chalk.dim("  File updated: ") + chalk.cyan(file));
        console.log("");
        console.log(chalk.dim("  Next → run validation:"), chalk.bold(`--validate --target-file ${file}`));
        console.log("");
      },
    });
  }

} else if (exploreMode) {
  // ── Explore mode: 3 framings, side-by-side comparison ─────────────────────
  const report = await explore(ideaId, targetDir, iterations, {
    ...sharedCallbacks,
    onExploreComplete(report) {
      printExploreTable(report);
    },
  });

  const chosenIndex = await promptVariationChoice(report.variations.length, report.recommendedIndex);
  const chosen = report.variations[chosenIndex];

  console.log("");
  console.log(chalk.bold.green(`  Injecting variation #${chosenIndex + 1} (${chosen.framingLabel})...`));
  const injectedPath = injectVariation(report, chosenIndex, targetDir);

  console.log(chalk.dim("  Epic injected to:"), chalk.cyan(injectedPath));
  console.log("");
  console.log(chalk.dim("  Layer 3 → In your target project, run:"), chalk.bold("/build-from-epic"));
  console.log("");

} else {
  // ── Normal mode (and git mode): optimize the epic ─────────────────────────
  await optimize(ideaId, targetDir, iterations, sharedCallbacks);
}
