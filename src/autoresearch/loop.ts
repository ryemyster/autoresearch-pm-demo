// loop.ts — Epic Refinement Loop core: the autoresearch optimization loop.
//
// Teaching note: This file owns the full generate → evaluate → select cycle.
// It now supports three modes:
//   1. Normal mode:   one framing, N iterations, keeps best in memory + files
//   2. Git mode:      same as normal, but commits each iteration to a local git
//                     repo and REVERTS if the score gets worse
//   3. Explore mode:  runs 3 different "framings" of the same problem, each for
//                     N iterations, then lets the PM compare and choose
//
// The key insight: the loop is the tool. You define what "good" looks like
// (the evaluator), then let the loop search for it autonomously.
//
// LEARN MORE: docs/HOW_IT_WORKS.md → "The Karpathy Pattern"

import * as fs from "fs";
import * as path from "path";
import { generate, generateWithFraming } from "./generator.js";
import { evaluate } from "./evaluator.js";
import { gitInit, gitCommit, gitRevert, gitLog as getGitLog } from "./git.js";
import { loadRawEpic, injectArtifact } from "../mcp/artifacts/store.js";
import { settings } from "../shared/config.js";
import type {
  Epic,
  EvaluationResult,
  IterationLog,
  RunManifest,
  VariationResult,
  ExploreReport,
} from "../shared/types/index.js";

// ─── Progress Callbacks ───────────────────────────────────────────────────────
// Callbacks let main.ts display progress without knowing loop internals.
// New callbacks are optional so existing code that calls optimize() still works.

export interface LoopCallbacks {
  onIterationStart: (i: number, total: number) => void;
  onGenerated: (epic: Epic) => void;
  onEvaluated: (result: EvaluationResult, isBest: boolean, bestScore: number) => void;
  onComplete: (best: Epic, bestResult: EvaluationResult, runDir: string, injectedPath: string) => void;
  // Git mode callbacks (optional — only wired in main.ts when --git-mode is set)
  onGitCommit?: (iteration: number, score: number, message: string) => void;
  onGitRevert?: (iteration: number, previousBest: number, newScore: number) => void;
  onGitLog?: (entries: string[]) => void;
  // Explore mode callbacks (optional — only wired in main.ts when --explore is set)
  onExploreVariationStart?: (variationIndex: number, framingLabel: string) => void;
  onExploreComplete?: (report: ExploreReport) => void;
}

// ─── Explore Mode Framings ────────────────────────────────────────────────────
// Three strategic lenses applied to the same seed epic.
// Each framing tilts the AI's priorities in a different direction.
// The PM then picks whichever framing produced the most useful result.
//
// LEARN MORE: docs/HOW_IT_WORKS.md → "Explore Mode: Pre-Decision Exploration"

const EXPLORE_FRAMINGS = [
  {
    label: "outcome-focused",
    description: "Sharpens the outcome statement — who is affected, by how much, by when",
    systemAddendum: `FRAMING INSTRUCTION: Your primary job in this version is to make the OUTCOME as specific and measurable as possible. Name the exact user segment, the exact current state (a number), and the exact target state (a number). All other sections should support this sharper outcome. If the current outcome is vague, rewrite it completely.`,
  },
  {
    label: "risk-focused",
    description: "Surfaces risks and hard constraints first, then builds scope around them",
    systemAddendum: `FRAMING INSTRUCTION: Your primary job in this version is to surface every realistic risk and hard dependency before committing to scope. Start from "what could go wrong or block this?" and build scope that would still succeed even if two of the listed risks materialize. Be conservative about what goes in scope.in — only include things that are achievable given the risks.`,
  },
  {
    label: "metric-focused",
    description: "Ensures every deliverable traces to a measurable, time-bound metric",
    systemAddendum: `FRAMING INSTRUCTION: Your primary job in this version is to make every item in scope.in traceable to a specific success metric with a numeric target and a named measurement tool. If a deliverable cannot be measured within 30 days of launch, remove it or replace it with one that can. Prioritize metrics that can be checked automatically, not via manual surveys.`,
  },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function epicsDir(ideaId: string): string {
  return path.join(settings.artifactsRoot, "epics", ideaId);
}

function runsDir(runId: string): string {
  return path.join(settings.artifactsRoot, "runs", runId);
}

function writeJson(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * WHAT: Formats a finished epic as a markdown file ready for the Build stage to read.
 * WHY:  The handoff between stages is always a file — inspectable, readable by
 *       a human or by Claude Code's /build-from-epic skill.
 */
function formatEpicAsMarkdown(epic: Epic, score: number, ideaId: string): string {
  const lines = [
    `# Epic: ${epic.title}`,
    ``,
    `> Autoresearch score: **${score}/10** | Idea: \`${ideaId}\``,
    ``,
    `## Outcome`,
    epic.outcome,
    ``,
    `## Scope`,
    ``,
    `**In scope:**`,
    ...epic.scope.in.map((s) => `- ${s}`),
    ``,
    `**Out of scope:**`,
    ...epic.scope.out.map((s) => `- ${s}`),
    ``,
    `## Success Metrics`,
    ``,
    `| Metric | Target | Measurement |`,
    `|--------|--------|-------------|`,
    ...epic.success_metrics.map((m) => `| ${m.metric} | ${m.target} | ${m.measurement} |`),
    ``,
    `## Dependencies`,
    ...epic.dependencies.map((d) => `- ${d}`),
    ``,
    `## Risks`,
    ...epic.risks.map((r) => `- ${r}`),
    ``,
    `---`,
    `*Generated by autoresearch-pm-demo | ${new Date().toISOString()}*`,
  ];
  return lines.join("\n");
}

// ─── loadSeed() — shared by optimize() and explore() ─────────────────────────

/**
 * WHAT: Loads the raw epic seed from the Discovery stage's output file. Falls back
 *       to a mock fixture if running in mock mode and no file exists.
 * WHY:  The seed is what the loop starts from. A good seed (from define_epic)
 *       means iteration 0 starts well above zero — the Discovery work is already
 *       baked in. Without a seed, the loop starts from scratch.
 */
async function loadSeed(ideaId: string): Promise<Epic> {
  const seed = loadRawEpic(ideaId);
  if (seed) return seed;

  if (settings.mockMode) {
    // No seed file in mock mode — use the first mock fixture as the starting point
    return generate({} as Epic, null);
  }

  throw new Error(
    `No raw epic found at artifacts/epics/${ideaId}/raw.json\n` +
    `Run define_epic MCP tool first, or use --mock for offline demo.`
  );
}

// ─── runIterations() — the inner loop, shared by optimize() and explore() ────

/**
 * WHAT: Runs N iterations of generate → evaluate → select. Used by both
 *       optimize() (single framing) and explore() (called 3 times, once per framing).
 * WHY:  Extracted so explore mode doesn't duplicate the loop logic. Each call
 *       to runIterations() is one independent optimization run.
 *
 * @param seed         - Starting epic for this run
 * @param n            - Number of iterations
 * @param runId        - Unique ID for this run (used for artifact paths in git mode)
 * @param callbacks    - Progress callbacks (only onIterationStart, onGenerated, onEvaluated used here)
 * @param gitRoot      - If set, git commit/revert operations happen in this directory
 * @param candidatePath - If set, each generated epic is written to this file
 */
async function runIterations(
  seed: Epic,
  n: number,
  callbacks: LoopCallbacks,
  gitRoot?: string,
  candidatePath?: string
): Promise<{ best: Epic; bestResult: EvaluationResult; log: IterationLog[]; initialScore: number }> {
  const iterationLog: IterationLog[] = [];
  let current = seed;
  let best: Epic = seed;
  let bestResult: EvaluationResult | null = null;
  let bestScore = -1;
  let initialScore = 0;
  let previousHints: string[] | null = null;

  for (let i = 0; i < n; i++) {
    callbacks.onIterationStart(i + 1, n);

    // GENERATE — produce an improved epic using the previous iteration's hints
    // candidatePath causes the epic to be written to disk (the "single modifiable file")
    const epic = await generate(current, previousHints, candidatePath);
    callbacks.onGenerated(epic);

    // EVALUATE first — we need the score to write a meaningful commit message
    const result = await evaluate(epic, i);

    // SELECT — is this the best score we've seen?
    // Strict > means a tie does NOT update best. Same score = revert.
    // WHY: we only keep a new version if it's strictly better.
    // A tie could mean a different framing at the same quality —
    // we don't want silent drift. The previous best stays authoritative.
    // This is correct Karpathy behavior: keep the candidate, not the attempt.
    const isBest = result.total > bestScore;
    const prevBest = bestScore;

    if (isBest) {
      best = epic;
      bestResult = result;
      bestScore = result.total;
    }

    // GIT: commit or revert AFTER evaluating so the commit message contains the score.
    // This is the core of the Karpathy pattern:
    //   improvement → commit with score → keep
    //   no improvement → commit with score → revert → candidate.json restored to best
    if (gitRoot) {
      if (i === 0) {
        // First iteration is always the baseline — commit it, never revert it
        const msg = `iteration 1: score ${result.total}/10 (baseline)`;
        gitCommit(gitRoot, msg);
        callbacks.onGitCommit?.(1, result.total, msg);
      } else if (isBest) {
        const msg = `iteration ${i + 1}: score ${result.total}/10 ✓ improvement: ${prevBest} → ${result.total}`;
        gitCommit(gitRoot, msg);
        callbacks.onGitCommit?.(i + 1, result.total, msg);
      } else {
        // Score did NOT improve — commit then immediately revert
        // Why commit before reverting? So the failed attempt is visible in the log.
        // git revert creates a new "Revert" commit that undoes the previous one.
        // Both commits are visible — the attempt AND the undo.
        const badMsg = `iteration ${i + 1}: score ${result.total}/10 (no improvement — will revert)`;
        gitCommit(gitRoot, badMsg);
        callbacks.onGitRevert?.(i + 1, prevBest, result.total);
        gitRevert(gitRoot);
        // Restore best epic to candidate.json so in-memory and on-disk stay in sync
        if (candidatePath) {
          fs.mkdirSync(path.dirname(candidatePath), { recursive: true });
          fs.writeFileSync(candidatePath, JSON.stringify(best, null, 2), "utf-8");
        }
      }
    }

    if (i === 0) initialScore = result.total;

    callbacks.onEvaluated(result, isBest, bestScore);

    // PERSIST this iteration's full data
    const log: IterationLog = { iteration: i, epic, result, isBest };
    iterationLog.push(log);

    // Thread hints forward — the next iteration gets told what to improve
    previousHints = result.improvementHints;
    // Feed the best epic (not necessarily this one) into the next iteration
    current = isBest ? epic : best;

    // Early exit: 10/10 means all criteria are maxed out.
    // No further improvement is possible — stop early and save API calls.
    // Teaching note: in practice this almost never triggers because the LLM
    // scorer is explicitly "conservative" and actionability is the hardest
    // criterion to max. See evaluator.ts → LLM_SCORING_SYSTEM.
    if (bestScore === 10) break;
  }

  return { best, bestResult: bestResult!, log: iterationLog, initialScore };
}

// ─── optimize() — main entry point for normal + git mode ─────────────────────

/**
 * WHAT: Runs the full optimization loop for a single framing of the problem.
 *       This is the normal mode: define_epic → optimize → inject.
 * WHY:  Returns the best epic found across N iterations, plus all iteration
 *       logs, the run directory, and (if git mode was active) the git log.
 *       The git log is the experiment record — it shows every attempt.
 * LEARN MORE: docs/HOW_IT_WORKS.md → "The Optimization Loop"
 */
export async function optimize(
  ideaId: string,
  targetDir: string,
  n: number,
  callbacks: LoopCallbacks
): Promise<{
  best: Epic;
  bestResult: EvaluationResult;
  log: IterationLog[];
  runDir: string;
  injectedPath: string;
  gitLog?: string[];
}> {
  const runId = `${ideaId}-${Date.now().toString(36)}`;
  const runDir = epicsDir(ideaId);
  fs.mkdirSync(runDir, { recursive: true });

  const seed = await loadSeed(ideaId);

  // Git mode setup
  let gitRoot: string | undefined;
  let candidatePath: string | undefined;

  if (settings.gitMode) {
    // The git repo lives in artifacts/runs/{runId}/ — NOT the project root
    // This scopes each experiment's git history to its own folder
    gitRoot = runsDir(runId);
    candidatePath = path.join(gitRoot, "candidate.json");
    gitInit(gitRoot);
  } else {
    // Even without git mode, we write candidate.json so students can inspect it
    candidatePath = path.join(runDir, "candidate.json");
  }

  const { best, bestResult, log, initialScore } = await runIterations(
    seed, n, callbacks, gitRoot, candidatePath
  );

  // Persist final outputs
  writeJson(path.join(runDir, "best.json"), { epic: best, result: bestResult });

  // INJECT: push best epic as markdown into target project (Epic Refinement → Build handoff)
  const filename = `${ideaId}-epic.md`;
  const markdown = formatEpicAsMarkdown(best, bestResult.total, ideaId);
  const injectedPath = injectArtifact(targetDir, filename, markdown);

  const manifest: RunManifest = {
    runId,
    ideaId,
    task: best.title,
    iterations: n,
    finalScore: bestResult.total,
    initialScore,
    improvementDelta: bestResult.total - initialScore,
    injectedPath,
    timestamp: new Date().toISOString(),
    model: settings.mockMode ? "mock" : settings.model,
    mockMode: settings.mockMode,
    gitMode: settings.gitMode,
    exploreMode: false,
    candidatePath,
  };
  writeJson(path.join(runDir, "manifest.json"), manifest);

  callbacks.onComplete(best, bestResult, runDir, injectedPath);

  // Git log: collect and surface the experiment record
  let experimentLog: string[] | undefined;
  if (gitRoot) {
    experimentLog = getGitLog(gitRoot);
    callbacks.onGitLog?.(experimentLog);
  }

  return { best, bestResult, log, runDir, injectedPath, gitLog: experimentLog };
}

// ─── explore() — entry point for explore mode (3 framings) ───────────────────

/**
 * WHAT: Runs the optimization loop THREE times — once per framing — and returns
 *       a comparison report. The PM then picks which framing to inject.
 * WHY:  This is "pre-decision exploration under constraints."
 *       Instead of improving one document, we explore three genuinely different
 *       angles on the same problem. Each framing will surface different tradeoffs.
 *       The PM picks AFTER seeing the scores, not BEFORE writing the epic.
 *       This shifts effort from writing → defining constraints.
 * LEARN MORE: docs/HOW_IT_WORKS.md → "Explore Mode: Pre-Decision Exploration"
 */
export async function explore(
  ideaId: string,
  targetDir: string,
  iterationsPerVariation: number,
  callbacks: LoopCallbacks
): Promise<ExploreReport> {
  const seed = await loadSeed(ideaId);
  const timestamp = new Date().toISOString();
  const variations: VariationResult[] = [];

  for (let v = 0; v < EXPLORE_FRAMINGS.length; v++) {
    const framing = EXPLORE_FRAMINGS[v];
    callbacks.onExploreVariationStart?.(v, framing.label);

    // Generate a framing-specific starting point for this variation's loop
    // (applies the framing lens to the seed before the optimization iterations begin)
    const framingRunId = `${ideaId}-v${v}-${Date.now().toString(36)}`;
    const varRunDir = runsDir(framingRunId);
    const candidatePath = path.join(varRunDir, "candidate.json");

    const framingSeed = await generateWithFraming(
      seed,
      framing.systemAddendum,
      candidatePath
    );

    // Run the optimization loop for this framing variation
    const { best, bestResult, log } = await runIterations(
      framingSeed,
      iterationsPerVariation,
      callbacks,
      undefined, // no git mode in explore (would create 3 separate git repos — too complex)
      candidatePath
    );

    // Save this variation's best epic
    writeJson(path.join(varRunDir, "best.json"), { epic: best, result: bestResult });

    variations.push({
      variationIndex: v,
      framingLabel: framing.label,
      seedDescription: framing.description,
      best,
      bestScore: bestResult.total,
      iterationLog: log,
    });
  }

  // Find the highest-scoring variation
  const recommendedIndex = variations.reduce(
    (best, v, i) => (v.bestScore > variations[best].bestScore ? i : best),
    0
  );

  const report: ExploreReport = { ideaId, timestamp, variations, recommendedIndex };
  callbacks.onExploreComplete?.(report);

  // The caller (main.ts) will prompt the user to pick a variation, then call
  // injectArtifact with the chosen variation's best epic.
  // We return the report so main.ts has everything it needs.
  return report;
}

/**
 * WHAT: Takes the chosen variation from an ExploreReport and injects it as
 *       markdown into the target project (same as optimize() does).
 * WHY:  Separated from explore() so the caller can prompt the user for a choice
 *       before injecting. The inject step is the point of no return — once
 *       injected, the Build stage can run on it.
 */
export function injectVariation(
  report: ExploreReport,
  variationIndex: number,
  targetDir: string
): string {
  const variation = report.variations[variationIndex];
  const filename = `${report.ideaId}-epic.md`;
  const markdown = formatEpicAsMarkdown(variation.best, variation.bestScore, report.ideaId);
  return injectArtifact(targetDir, filename, markdown);
}
