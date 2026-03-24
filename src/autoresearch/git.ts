// git.ts — all git operations for the autoresearch loop.
//
// Teaching note: This module is the "git revert pattern" from the Karpathy article.
// Every time the loop generates a new epic, it commits it. If the new epic scores
// WORSE than the previous best, it reverts — undoing that commit. The git log
// becomes a permanent record of every attempt: what was tried, what scored, what
// was kept vs. thrown away.
//
// IMPORTANT: All operations are scoped to a gitRoot directory you pass in.
// The git repo lives inside artifacts/git-runs/{runId}/ — NOT the project root.
// This keeps each experiment's history self-contained and deletable.
//
// LEARN MORE: docs/HOW_IT_WORKS.md → "The Git Revert Pattern"

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

// ─── Private helper ───────────────────────────────────────────────────────────

/**
 * WHAT: Runs a single git command inside the given directory and returns its output.
 * WHY:  All public functions use this so error handling and the cwd option are
 *       written once. If a git command fails, the error message surfaces as a
 *       normal JavaScript error — no silent failures.
 */
function runGit(args: string[], gitRoot: string): string {
  return execSync(`git ${args.join(" ")}`, {
    cwd: gitRoot,
    // "pipe" means: capture stdout AND stderr instead of letting them print
    // to the terminal. Errors become JS exceptions we can handle.
    stdio: ["pipe", "pipe", "pipe"],
  })
    .toString()
    .trim();
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * WHAT: Checks if a directory already has a git repository inside it.
 * WHY:  Guards against calling gitInit twice on the same directory, which
 *       would cause an error.
 */
export function isGitRepo(gitRoot: string): boolean {
  return fs.existsSync(path.join(gitRoot, ".git"));
}

/**
 * WHAT: Creates a fresh git repository inside gitRoot and sets a local
 *       user identity so commits work even on machines with no global git config.
 * WHY:  Git refuses to make commits without a name and email. Many first-time
 *       users have never set these up. We set them locally (only inside this
 *       experiment's .git folder) so we don't change anything on their machine.
 *       The identity "Autoresearch Demo" is clearly a tool, not a person.
 * LEARN MORE: docs/HOW_IT_WORKS.md → "Git Scope: Why Not the Project Root?"
 */
export function gitInit(gitRoot: string): void {
  // Create the directory if it doesn't exist yet
  fs.mkdirSync(gitRoot, { recursive: true });

  // Initialize the git repo
  runGit(["init"], gitRoot);

  // Set local identity — scoped only to this repo, doesn't touch global git config
  runGit(["config", "user.email", "autoresearch@demo"], gitRoot);
  runGit(["config", "user.name", "Autoresearch Demo"], gitRoot);
}

/**
 * WHAT: Stages candidate.json and saves a commit with the given message.
 * WHY:  Each iteration produces one commit. The message records the score, so
 *       `git log` reads as a score history — you can see every attempt at a glance.
 *       Think of each commit as a snapshot photo of the epic at that moment.
 * LEARN MORE: docs/HOW_IT_WORKS.md → "The Experiment Log"
 */
export function gitCommit(gitRoot: string, message: string): void {
  // Stage only candidate.json — the single modifiable file. Nothing else.
  runGit(["add", "candidate.json"], gitRoot);

  // Check if there is anything staged before trying to commit.
  // "nothing to commit" happens when the mock fixtures return identical epics
  // across iterations — the file content didn't change, so git has nothing new.
  // In that case, skip the commit silently rather than crashing.
  const status = runGit(["status", "--porcelain"], gitRoot);
  if (!status) return; // empty status = nothing staged = skip commit

  // The -m flag passes the message directly. We wrap in single quotes and
  // escape any single quotes in the message itself to be safe.
  const safeMessage = message.replace(/'/g, "'\\''");
  runGit(["commit", "-m", `'${safeMessage}'`], gitRoot);
}

/**
 * WHAT: Undoes the most recent commit by creating a new "revert commit".
 *       This restores candidate.json to what it was before that commit.
 * WHY:  When a new iteration scores LOWER than the best, we don't keep it.
 *       git revert makes the discard VISIBLE — you can see it in the log as
 *       "Revert: iteration N scored X/10 — kept previous best".
 *       Without git, the discard is invisible. With git, it's part of the record.
 *
 *       Why not git reset --hard instead of git revert?
 *       Reset rewrites history (dangerous, loses the record).
 *       Revert adds a new commit that undoes the previous one (safe, keeps the record).
 * LEARN MORE: docs/HOW_IT_WORKS.md → "The Git Revert Pattern"
 */
export function gitRevert(gitRoot: string): void {
  // --no-edit skips the text editor that normally opens for revert messages.
  // We want this to run automatically without waiting for human input.
  runGit(["revert", "HEAD", "--no-edit"], gitRoot);
}

/**
 * WHAT: Returns the full git log as an array of one-line strings, newest first.
 * WHY:  The log IS the experiment record. Every iteration's score, every revert,
 *       every improvement — all visible in order. This is what the article calls
 *       "the experiment log as strategic asset": what was tried matters as much
 *       as what was kept.
 * LEARN MORE: docs/HOW_IT_WORKS.md → "The Experiment Log as Strategic Asset"
 */
export function gitLog(gitRoot: string): string[] {
  try {
    const output = runGit(["log", "--oneline"], gitRoot);
    // Split on newlines, filter out any blank lines
    return output.split("\n").filter(Boolean);
  } catch {
    // If there are no commits yet, git log fails — return empty array
    return [];
  }
}
