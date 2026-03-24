// code-quality/loop.ts — the code quality improvement loop.
//
// Teaching note: This file mirrors src/autoresearch/loop.ts exactly,
// but the "artifact" being improved is a CODE FILE instead of an Epic.
// The pattern is identical:
//   1. Read the current state of the artifact (code file)
//   2. Generate an improved version
//   3. Score it with the evaluator
//   4. If better: keep it. If worse: revert to the previous best.
//   5. Repeat N times.
//
// This is the Karpathy insight: the same loop works for any scoreable artifact.
//
// LEARN MORE: docs/HOW_IT_WORKS.md → "The Code Quality Loop"

import * as fs from "fs";
import * as path from "path";
import { improveCode } from "./generator.js";
import { evaluateCode } from "./evaluator.js";
import { settings } from "../shared/config.js";
import type { CodeQualityResult, CodeIterationLog } from "../shared/types/index.js";

// ─── Callbacks ────────────────────────────────────────────────────────────────
// Callbacks let main.ts display progress without knowing loop internals.
// All are required so the caller always gets notified of each event.

export interface CodeQualityCallbacks {
  /** Called at the start of each iteration, before any API calls. */
  onIterationStart: (i: number, total: number) => void;
  /** Called after the code is generated/improved (but not yet scored). */
  onImproved: (code: string, targetFile: string) => void;
  /** Called after the code is scored. isBest=true if this is the new top score. */
  onEvaluated: (result: CodeQualityResult, isBest: boolean, bestScore: number) => void;
  /** Called once at the end, with the best code and its evaluation result. */
  onComplete: (bestCode: string, bestResult: CodeQualityResult, targetFile: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * WHAT: Reads the epic markdown file and extracts just the Outcome section text.
 * WHY:  The code quality evaluator needs the epic outcome to check "epic_alignment" —
 *       whether the code actually implements what was planned.
 *       We extract just the outcome text (not the whole epic) to keep the prompt focused.
 */
function parseEpicOutcome(epicMarkdownPath: string): string {
  if (!fs.existsSync(epicMarkdownPath)) {
    return "No epic outcome available — evaluate code quality only.";
  }
  const content = fs.readFileSync(epicMarkdownPath, "utf-8");
  // Extract the text between "## Outcome" and the next "##" heading
  const match = content.match(/##\s+Outcome\s*\n([\s\S]*?)(?=\n##|\n---|\s*$)/i);
  if (match) return match[1].trim();
  return "Epic outcome not found in markdown — evaluate code quality only.";
}

/**
 * WHAT: Saves one iteration's result to disk as a JSON log file.
 * WHY:  Same reason as Layer 2 iteration logs — the experiment record.
 *       You can open iteration_0.json and iteration_2.json and diff the hints
 *       to see whether the loop actually addressed the feedback.
 */
function saveIterationLog(
  artifactsDir: string,
  log: CodeIterationLog
): void {
  fs.mkdirSync(artifactsDir, { recursive: true });
  const logPath = path.join(artifactsDir, `iteration_${log.iteration}.json`);
  fs.writeFileSync(logPath, JSON.stringify(log, null, 2));
}

// ─── Main Loop Function ───────────────────────────────────────────────────────

/**
 * WHAT: Runs the code quality improvement loop for N iterations.
 * WHY:  This is Layer 4's version of optimize() from src/autoresearch/loop.ts.
 *       It runs the same generate → evaluate → select cycle, but on code.
 *       At the end, the best version of the code is written back to targetFile.
 * LEARN MORE: docs/HOW_IT_WORKS.md → "The Code Quality Loop"
 */
export async function runCodeQuality(
  targetFile: string,     // path to the code file to improve (from Layer 3 output)
  epicPath: string,       // path to the *-epic.md file (to check epic alignment)
  ideaId: string,         // used for artifact directory naming
  iterations: number,
  callbacks: CodeQualityCallbacks
): Promise<{ bestCode: string; bestResult: CodeQualityResult; log: CodeIterationLog[] }> {
  // Read the current code from disk — this is iteration 0's starting point
  if (!fs.existsSync(targetFile)) {
    throw new Error(`Target file not found: ${targetFile}. Run Layer 3 (/build-from-epic) first.`);
  }
  const initialCode = fs.readFileSync(targetFile, "utf-8");

  // Parse the epic outcome so we can check epic_alignment criterion
  const epicOutcome = parseEpicOutcome(epicPath);

  // Artifacts directory for iteration logs
  const artifactsDir = path.join(settings.artifactsRoot, "code-quality", ideaId);

  // State: track the best code seen so far
  let bestCode = initialCode;
  let bestScore = -1;
  let bestResult: CodeQualityResult | null = null;
  let currentCode = initialCode;
  let currentHints: string[] | null = null;
  const iterationLog: CodeIterationLog[] = [];

  for (let i = 0; i < iterations; i++) {
    callbacks.onIterationStart(i, iterations);

    // Step 1: Generate improved code
    // Pass candidatePath = undefined here (we write to targetFile directly at the end)
    const improved = await improveCode(currentCode, epicOutcome, currentHints, i);
    callbacks.onImproved(improved, targetFile);

    // Step 2: Score the improved code
    const result = await evaluateCode(improved, targetFile, epicOutcome, i);
    const isBest = result.total > bestScore;
    callbacks.onEvaluated(result, isBest, bestScore);

    // Step 3: Save iteration log
    const logEntry: CodeIterationLog = { iteration: i, code: improved, result, isBest };
    iterationLog.push(logEntry);
    saveIterationLog(artifactsDir, logEntry);

    // Step 4: Keep or discard
    if (isBest) {
      bestCode = improved;
      bestScore = result.total;
      bestResult = result;
      currentCode = improved;       // next iteration builds on the best
      currentHints = null;          // hints from this iteration may not apply to the next
    } else {
      // Score didn't improve — feed hints back so next iteration addresses them
      currentCode = bestCode;       // revert to the best (same as git revert, but in memory)
      currentHints = result.improvementHints;
    }
  }

  // Write the best code back to the target file
  // This is the "single modifiable file" — the loop ends with the best version on disk
  fs.writeFileSync(targetFile, bestCode, "utf-8");

  callbacks.onComplete(bestCode, bestResult!, targetFile);
  return { bestCode, bestResult: bestResult!, log: iterationLog };
}
