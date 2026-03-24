# How It Works

This document explains the ideas behind this project — not just what the code does, but *why* it was built this way, and what it's trying to teach.

Start here if you want to understand the system deeply. If you just want to run it, start with [GETTING_STARTED.md](GETTING_STARTED.md).

---

## The Big Idea

Most "AI writing tools" work like this:

> Upload your document → AI improves it → Download better version

That's a **doc enhancer**. It produces better wording with the same structural problems underneath.

This project does something different:

> Define your constraints → System explores options → System filters weak ones → You pick from the strong ones

That's **pre-decision exploration**. You're not polishing one answer. You're generating and evaluating a set of candidates before committing to any of them.

The difference matters because the real problem in product work isn't "my document reads poorly." It's: **"we keep committing to the wrong definition."**

---

## The PM Workflow Shift

| Before | After |
| ------ | ----- |
| PM writes a plan | PM defines what "good" looks like (constraints, criteria) |
| Team debates which version is better | System scores versions against criteria |
| PM commits after discussion | PM picks from already-filtered candidates |
| Effort goes into writing | Effort goes into defining constraints |

The artifact (epic, PRD, strategy doc) is just the surface. The real work is the constraint definition and the exploration that happens before anyone commits.

---

## The Litmus Test

Before you build or use a system like this, ask:

> **"Does this system produce options I wouldn't have considered, and eliminate weak ones before I commit?"**

- If **yes**: you built the right thing
- If **no**: you built a doc enhancer

---

## The Failure Mode to Avoid

The failure mode is:

> "Upload PRD → improve PRD"

This produces:
- Better wording
- Same structural problems
- No real adoption — because you didn't change *what* you're building, only *how it reads*

The pain isn't "my doc reads poorly." The pain is "we keep committing to the wrong definition."

---

## The Karpathy Pattern (Six Properties)

The Karpathy autoresearch pattern is named after Andrej Karpathy, who described using AI agents to run hundreds of improvement experiments overnight. The pattern has six required properties.

### Analogy: The Spelling Bee Trainer

Imagine a spelling bee coach who trains a student automatically:

1. Student practices one word at a time (**single modifiable file**)
2. Gets immediate pass/fail on each word (**numerical score**)
3. Coach records each attempt: correct attempts stay, wrong ones are noted (**git commit/revert**)
4. Trainer runs sessions while the student sleeps (**runs autonomously**)
5. After 100 attempts, you can see every word tried, in order (**experiment log**)
6. The trainer's scoring rules can't be changed mid-session (**read-only evaluator**)

That's the pattern. Applied to product epics instead of spelling words.

### The Six Properties

**1. Single modifiable file**
One file is edited each round. Not a variable in memory — a real file on disk. This makes every change inspectable. You can open it, read it, diff it.

In this project: `candidate.json` — written after every `generate()` call.

**2. Git-based revert**
If a new version scores worse than the current best, undo it. But don't silently discard it — record that you tried it. Git's `revert` command creates a new commit that undoes the previous one, so the failed attempt is still visible in the log.

In this project: enabled with `--git-mode`. See `src/autoresearch/git.ts`.

**3. Read-only evaluator**
The scoring rules cannot be changed by the agent doing the improving. If the agent could edit its own scoring criteria, it could "win" by lowering the bar — not by actually improving.

In this project: `src/autoresearch/evaluator.ts` is never modified by the loop. The 5 criteria and their rules are hardcoded.

**4. Runs autonomously**
The loop runs to completion without human input. You start it, walk away, come back to results.

In this project: `--iterations N` runs all N iterations unattended. The default is 3 (cheap). Overnight runs use higher numbers.

**5. Numerical score**
The scoring is objective — a number, not a vague judgment. "Score: 7/10" is meaningful. "Pretty good" is not.

In this project: `EvaluationResult.total` is 0-10. Each of 5 criteria scores 0-2. Both a rule check (deterministic) and an LLM check (semantic) contribute to each criterion.

**6. Experiment log as strategic asset**
The log of every attempt — including the ones that were reverted — is more valuable than the final result alone. It tells you what was tried, what worked, and what the dead ends looked like.

In this project: `artifacts/epics/{id}/iteration_N.json` files. In git mode: `git log --oneline` shows every commit and revert.

---

## Property Status Table

| Property | Status in this project | Where |
| -------- | ---------------------- | ----- |
| Single modifiable file | YES | `candidate.json` written by `generator.ts` |
| Git-based revert | YES (with `--git-mode`) | `src/autoresearch/git.ts` |
| Read-only evaluator | YES | `src/autoresearch/evaluator.ts` (never modified) |
| Runs autonomously | YES | `loop.ts: optimize()` runs without user input |
| Numerical score | YES | `EvaluationResult.total` (0-10) |
| Experiment log | YES | `iteration_N.json` files + git log in git mode |

---

## The Single File Pattern

### Why a file and not a variable?

The simplest way to track "current best epic" would be a variable in memory:

```typescript
let best = someEpic; // just a variable
```

That works, but it's invisible. Between iterations, you can't open it in a text editor, you can't diff it, and git can't track it.

When we write to `candidate.json` instead:

```typescript
fs.writeFileSync(candidatePath, JSON.stringify(epic, null, 2));
```

You can open the file in VS Code right now and read it. You can run `git diff` and see exactly what changed between iterations.

This is the "single modifiable file" concept: **one real file on disk, edited each round.**

### Where is it?

- Normal mode: `artifacts/epics/{idea-id}/candidate.json`
- Git mode: `artifacts/runs/{run-id}/candidate.json`

### How to inspect it

After running the loop, open the file:

```bash
cat artifacts/epics/my-idea/candidate.json
```

Or compare two iterations:

```bash
diff artifacts/epics/my-idea/iteration_0.json artifacts/epics/my-idea/iteration_2.json
```

The hints the evaluator generated in iteration 0 should be *addressed* in iteration 1. If they are, the loop is working.

---

## The Git Revert Pattern

### What is a git commit?

Think of a commit as a **photograph of your work at one moment in time**.

- Every time you commit, you take a photo
- Git stores all the photos in order
- You can look back at any photo at any time
- You can go back to an older photo if the new one doesn't look right

### What is a git revert?

A revert is like saying: "I don't like this photo. Take a new photo that looks like the one before it."

The important part: **the bad photo is still in the album.** It just has a note next to it: "This one was undone."

This is different from "undo" in a text editor, which erases the bad version. Git revert *adds* a new commit that cancels out the previous one. Both are visible.

### Reading the log

After a `--git-mode` run, you'll see something like:

```text
abc1234  iteration 3: score 9/10 ✓ improvement: 7 → 9
def5678  Revert "iteration 2: ..."  (score 5/10 < best 7 — discarded)
ghi9012  iteration 2: score 7/10 ✓ improvement: 2 → 7
jkl3456  iteration 1: score 2/10 (baseline)
```

Reading from bottom to top:
- Iteration 1: baseline, scored 2/10
- Iteration 2: improved to 7/10 — kept
- Iteration 2's second attempt (the Revert line): scored 5/10 — discarded
- Iteration 3: improved to 9/10 — kept

Every attempt is visible. The dead ends are part of the record.

---

## Git Scope: Why Not the Project Root?

When you enable `--git-mode`, a git repository is created inside `artifacts/runs/{run-id}/` — **not in the project root folder.**

Why? A few reasons:

1. **The project might already be a git repo.** If it is, creating a nested git repo inside it causes problems.

2. **Each experiment's history should be self-contained.** If you delete `artifacts/runs/my-run-123/`, the git history for that run goes with it. Clean and contained.

3. **Only `candidate.json` is tracked.** The git repo inside the run folder only ever contains `candidate.json`. The iteration log files, manifests, and everything else are in `artifacts/epics/{id}/` — outside git's scope. This mirrors the pattern: one file, tracked. Everything else, untracked.

---

## The Experiment Log as Strategic Asset

Here's something that's easy to miss: **what the loop threw away is as valuable as what it kept.**

If iteration 3 tried a specific framing and it scored 4/10, that's useful information:
- That approach doesn't satisfy the scoring criteria
- Don't try that angle again
- The problem might need a different structural approach

The `iteration_N.json` files contain all of this. Each one has:
- The full epic that was generated
- Every criterion's score (rule + LLM) with rationales
- The improvement hints that were passed to the next iteration

This is the experiment record. Open `artifacts/epics/{id}/iteration_0.json` and look at `result.improvementHints`. Then open `iteration_1.json` and look at the `epic`. Did the hints get addressed? If yes, the loop is working. If no, the hints were too vague or the model ignored them.

---

## Explore Mode: Pre-Decision Exploration

### The problem with one starting point

The standard loop picks one framing of the problem and optimizes it. But what if the framing itself is wrong?

If you start with "outcome-focused" and iterate 10 times, you get a very polished outcome-focused epic. But maybe a risk-focused or metric-focused framing would have been more useful for your situation.

### What explore mode does

Explore mode runs the loop three times — one per framing — using the same seed. Each framing applies a different strategic lens:

| # | Framing | What it prioritizes |
| - | ------- | ------------------- |
| 1 | outcome-focused | Sharpens who is affected, by how much, by when |
| 2 | risk-focused | Surfaces risks and constraints first, builds scope around them |
| 3 | metric-focused | Ensures every deliverable traces to a measurable metric |

After all three run, you see a comparison table:

```text
  #   Framing              Score   Title
  1   outcome-focused      9/10    Reduce Onboarding Drop-off...
  2   risk-focused         7/10    Streamline Onboarding with...
  3   metric-focused       8/10    Measurable Onboarding Improvement...
```

You pick the one that best fits your situation. Maybe you're in an early-stage company and risk matters most — pick #2. Maybe you're presenting to stakeholders who care about measurement — pick #3.

### How to read the comparison table

The score tells you how well each framing satisfied the evaluation criteria. But the **title and outcome** tell you what the epic actually says. Read both.

Sometimes a lower-scoring framing is more useful because it surfaced constraints you hadn't thought about. The score is one signal, not the only signal.

### The PM's role in explore mode

The system produces options and scores them. The PM chooses.

This is the workflow shift in action: effort goes into defining what "good" looks like (the 5 criteria), not into writing the epic. The exploration and filtering happen automatically.

---

## Token Costs and Iteration Limits

### What is a token?

Tokens are the unit of work for an LLM API. Roughly:
- 1 token ≈ 4 characters of English text
- 1000 tokens ≈ 750 words

Every call to Claude uses tokens. You're billed per token used.

### Cost table for this demo

| Mode | Iterations | Approx. tokens | Approx. cost |
| ---- | ---------- | -------------- | ------------ |
| Normal | 3 (default) | ~7,800 | < $0.01 |
| Normal | 10 | ~26,000 | ~$0.03 |
| Explore | 3 per variation | ~31,800 | ~$0.03 |
| Explore | 10 per variation | ~84,000 | ~$0.08 |

These are estimates using claude-haiku, the fastest and cheapest model. Costs may vary.

### Why the default is 3, not 100

The demo default is `--iterations 3` because:
1. It's cheap (< $0.01)
2. It's fast (< 30 seconds)
3. It demonstrates the pattern clearly — you can see the score improve

Karpathy's original use ran ~100 iterations overnight. That's the **full pattern**. The demo's 3 iterations show you what the loop looks like; running 10-20 with a real problem shows you what it can actually accomplish.

### Running more iterations

When you're ready to run seriously:

```bash
npx tsx src/autoresearch/main.ts \
  --idea-id my-real-problem \
  --target-dir ./docs \
  --iterations 10 \
  --yes
```

The `--yes` flag skips the confirmation prompt so it can run unattended.

---

## Where This Project Diverges From the Article

This is an honest comparison. The project matches the pattern's spirit but makes different choices for teachability:

| Article | This project | Why |
| ------- | ------------ | --- |
| Agent edits code files | Agent edits Epic JSON | Epics are a better teaching artifact for PMs |
| Git on project root | Git scoped to `artifacts/runs/` | Safer — avoids conflicts with the project's own git |
| 100+ iterations overnight | Default: 3 iterations | Cost and time limits for a teaching demo |
| Evaluation via test suite | Evaluation via rubric + LLM | No existing test suite for an epic — rubric is explicit |
| Self-modifying agent | Loop calls Claude as a tool | Simpler architecture, easier to understand |

None of these are limitations — they're intentional design choices for a teaching context. The full overnight 100-iteration pattern is achievable with this codebase: just use `--iterations 100 --yes` and wait.

---

## Code Annotations: Which File Implements Which Concept

| Concept | File |
| ------- | ---- |
| The git revert pattern | `src/autoresearch/git.ts` |
| The single modifiable file | `src/autoresearch/generator.ts` (writes `candidate.json`) |
| The read-only evaluator | `src/autoresearch/evaluator.ts` |
| The optimization loop | `src/autoresearch/loop.ts` |
| Explore mode (3 framings) | `src/autoresearch/loop.ts` → `explore()` function |
| CLI flags, cost estimate, explore table | `src/autoresearch/main.ts` |
| Settings (gitMode, exploreMode) | `src/shared/config.ts` |
| Data shapes for all concepts | `src/shared/types/index.ts` |
| Layer 1 MCP tools | `src/mcp/tools/` |
| Layer 3 build skill | `.claude/commands/build-from-epic.md` |
