// validation/loop.ts — the validation loop: tests code against the epic's success metrics.
//
// Teaching note: This is the final loop in the pipeline, and it closes the circle.
// The epic was written in Discovery. The Epic Refinement Loop scored and improved it.
// The Build stage wrote code from it. The Code Quality Loop (using Autoresearch pattern) cleaned up the code.
// The Validation Loop (using Autoresearch pattern) asks the final question: "Does the code pass the epic's own metrics?"
//
// The score here is NOT a quality score — it's a PASS RATE.
// passCount / totalMetrics * 10 = final score.
// A 10/10 means every success metric from the epic is satisfied.
// That's what "done" means.
//
// LEARN MORE: docs/HOW_IT_WORKS.md → "The Validation Loop"

import * as fs from "fs";
import * as path from "path";
import { validateAgainstEpic } from "./evaluator.js";
import { improveCode } from "../code-quality/generator.js";
import { settings } from "../shared/config.js";
import type { ValidationResult, ValidationIterationLog } from "../shared/types/index.js";

// ─── Callbacks ────────────────────────────────────────────────────────────────

export interface ValidationCallbacks {
  /** Called at the start of each iteration, before any API calls. */
  onIterationStart: (i: number, total: number) => void;
  /** Called after validation. isBest=true if this pass rate is the highest so far. */
  onValidated: (result: ValidationResult, isBest: boolean) => void;
  /** Called once at the end, with the best result and the final code file. */
  onComplete: (bestResult: ValidationResult, targetFile: string) => void;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * WHAT: Saves one validation iteration to disk as a JSON log file.
 * WHY:  Same experiment log pattern as Layers 2 and 4.
 *       You can open iteration_0.json and see which metrics failed,
 *       then open iteration_2.json and see if they were fixed.
 */
function saveIterationLog(artifactsDir: string, log: ValidationIterationLog): void {
  fs.mkdirSync(artifactsDir, { recursive: true });
  const logPath = path.join(artifactsDir, `iteration_${log.iteration}.json`);
  fs.writeFileSync(logPath, JSON.stringify(log, null, 2));
}

// ─── Main Loop Function ───────────────────────────────────────────────────────

/**
 * WHAT: Runs the validation loop for N iterations.
 * WHY:  Same generate → evaluate → select cycle as all other loops.
 *       When a metric fails, the failure hint is fed to the code quality generator
 *       (Layer 4's improveCode) to produce better code. Then we re-validate.
 *       This loop ends when all metrics pass OR when we run out of iterations.
 * LEARN MORE: docs/HOW_IT_WORKS.md → "The Validation Loop"
 */
export async function runValidation(
  targetFile: string,   // the code file to validate (output of code quality loop)
  epicPath: string,     // the *-epic.md file (contains success_metrics)
  ideaId: string,       // used for artifact directory naming
  iterations: number,
  callbacks: ValidationCallbacks
): Promise<{ bestResult: ValidationResult; log: ValidationIterationLog[] }> {
  if (!fs.existsSync(targetFile)) {
    throw new Error(`Target file not found: ${targetFile}. Run the code quality loop first.`);
  }

  const artifactsDir = path.join(settings.artifactsRoot, "validation", ideaId);

  let currentCode = fs.readFileSync(targetFile, "utf-8");
  let bestScore = -1;
  let bestResult: ValidationResult | null = null;
  let currentHints: string[] | null = null;
  const iterationLog: ValidationIterationLog[] = [];

  // We need the epic outcome for the code improver
  const epicContent = fs.existsSync(epicPath) ? fs.readFileSync(epicPath, "utf-8") : "";
  const outcomeMatch = epicContent.match(/##\s+Outcome\s*\n([\s\S]*?)(?=\n##|\n---|\s*$)/i);
  const epicOutcome = outcomeMatch ? outcomeMatch[1].trim() : "Implement the feature described in the epic.";

  for (let i = 0; i < iterations; i++) {
    callbacks.onIterationStart(i, iterations);

    // Step 1: Validate current code against the epic's success metrics
    const result = await validateAgainstEpic(currentCode, epicPath, i);
    const isBest = result.totalScore > bestScore;
    callbacks.onValidated(result, isBest);

    // Step 2: Save iteration log
    const logEntry: ValidationIterationLog = { iteration: i, result, isBest };
    iterationLog.push(logEntry);
    saveIterationLog(artifactsDir, logEntry);

    // Step 3: Keep or improve
    if (isBest) {
      bestScore = result.totalScore;
      bestResult = result;
      // If all metrics pass, we're done — no point running more iterations
      if (result.passCount === result.tests.length && result.tests.length > 0) {
        break;
      }
    }

    // Step 4: If there are still failing metrics and we have iterations left,
    // use the code quality generator (Layer 4) to improve the code based on
    // the validation failure hints.
    if (i < iterations - 1 && result.improvementHints.length > 0) {
      const hints = currentHints
        ? [...result.improvementHints, ...currentHints]
        : result.improvementHints;
      currentCode = await improveCode(currentCode, epicOutcome, hints, i);
      currentHints = result.improvementHints;
      // Write the improved code back to the target file so the next validation
      // reads the latest version. This is the "single modifiable file" pattern.
      fs.writeFileSync(targetFile, currentCode, "utf-8");
    }
  }

  callbacks.onComplete(bestResult!, targetFile);
  return { bestResult: bestResult!, log: iterationLog };
}
