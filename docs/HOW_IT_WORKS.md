# How It Works

This document explains the core ideas behind this project — not just what the code does, but *why* it was built this way, and what it's trying to teach.

Start here first. Then go deeper with the links below.

> **Reading guide:** This file covers the core concepts — the "why". For features (RAG, explore mode, per-stage models, etc.) see [FEATURES.md](FEATURES.md). For developer deep-dives (evals, MCP tool design, code annotations) see [FOR_DEVELOPERS.md](FOR_DEVELOPERS.md).

---

## Go Deeper

| I want to... | Go to |
| ------------ | ----- |
| Run the demo step by step | [GETTING_STARTED.md](GETTING_STARTED.md) |
| Understand features (explore mode, RAG, model routing) | [FEATURES.md](FEATURES.md) |
| Build or extend this project | [FOR_DEVELOPERS.md](FOR_DEVELOPERS.md) |
| Learn what words like "token" and "git" mean | [CONCEPTS.md](CONCEPTS.md) |
| Fix something that's broken | [TROUBLESHOOTING.md](TROUBLESHOOTING.md) |

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

## The Governance Model

Before getting into the six properties, it helps to understand *why* they exist. The Karpathy autoresearch pattern is not a feature list — it is a **governance model for autonomous iteration**.

Four principles hold it together:

| Principle | What it prevents |
| --------- | ---------------- |
| **Constrain WHERE change happens** (one mutable surface) | Agent drift — the agent pursuing hidden side objectives |
| **Fix HOW success is measured** (read-only eval, held-out criteria) | Signal manipulation — the agent "winning" by relaxing the bar |
| **Timebox iteration** (fixed budget per experiment) | Incomparable runs — you can't compare a 3-iteration run to a 50-iteration run |
| **Store learning in system memory** (git as the agent's memory) | Repeated failures — the agent retrying approaches that have already been shown not to work |

The six properties below are how each principle is implemented. They are not equal features — the governance model is the load-bearing frame. Without it, the properties are just implementation choices. With it, they form a coherent system for trustworthy autonomous iteration.

---

## The Karpathy Pattern (Six Properties)

The Karpathy autoresearch pattern is named after Andrej Karpathy, a well-known AI researcher who described using AI agents to run hundreds of improvement experiments overnight — automatically, without human supervision between attempts. The pattern has six required properties.

### Analogy: The Chef Perfecting a Recipe

Imagine a chef trying to perfect a recipe — but instead of one trial per night, they run dozens automatically:

1. The chef works from **one recipe card** — edits it each round, never starts from scratch (**single modifiable file**)
2. A food critic scores each batch **out of 10** with specific notes: "too salty, needs acid" (**numerical score**)
3. Better batch? **Keep the updated recipe card.** Worse batch? **Throw it out and go back to the previous version** — but photograph the bad batch so you know what was tried (**git-based revert**)
4. The chef runs trials **overnight while you sleep** — you come back to results in the morning (**runs autonomously**)
5. Every version tried — kept and discarded — is saved as a **photo album of attempts** (**experiment log**)
6. The critic's scoring rubric **never changes mid-session** — the chef can't win by convincing the critic to lower the bar (**read-only evaluator**)

That's the pattern. In this project, the "recipe card" is a product plan (an epic), and Claude plays both roles — chef (improves it) and critic (scores it) — but the scoring criteria are locked and can't be modified from inside the loop.

### The Six Properties

**1. Single modifiable file**
One file is edited each round. Not a variable in memory — a real file on disk. This makes every change inspectable. You can open it, read it, compare two versions.

*Like the chef:* one recipe card, edited each trial — not a new card from scratch every time.

In this project: `candidate.json` — updated after every improvement attempt.

**2. Git-based revert**
If a new version scores worse than the current best, undo it. But don't silently discard it — record that you tried it. Git's `revert` command creates a new commit that undoes the previous one, so the failed attempt is still visible in the log.

*Like the chef:* bad batch? Go back to the previous recipe card — but photograph the bad one so you know what was tried.

In this project: enabled with `--git-mode`. Every attempt, kept or discarded, is in the git log.

**3. Read-only evaluator**
The scoring rules cannot be changed by the agent doing the improving. If the agent could edit its own scoring criteria, it could "win" by lowering the bar — not by actually improving.

*Like the chef:* the critic's rubric is fixed. The chef can't convince the critic to stop caring about saltiness.

In this project: the 5 criteria and their rules are hardcoded and never touched by the loop.

**4. Runs autonomously**
The loop runs to completion without human input. You start it, walk away, come back to results.

*Like the chef:* trials run overnight. You come back in the morning to see what worked.

In this project: `--iterations N` runs all N iterations unattended. The default is 3 (fast, cheap). Real runs use 10–100. The loop stops early if a perfect score (10/10) is reached — no further improvement is possible.

**5. Numerical score**
The scoring is objective — a number, not a vague judgment. "Score: 7/10" is meaningful. "Pretty good" is not.

*Like the chef:* the critic gives a number, not vibes. You can compare two batches and know which is better.

In this project: 0–10 score after every iteration. Each of 5 criteria contributes 0–2 points.

**6. Experiment log as strategic asset**
The log of every attempt — including the ones that were reverted — is more valuable than the final result alone. It tells you what was tried, what worked, and what the dead ends looked like.

*Like the chef:* the full photo album of every tested batch is more valuable than just the final recipe. The failures tell you as much as the successes.

In this project: `artifacts/epics/{id}/iteration_N.json` files. In git mode: `git log --oneline` shows every commit and revert.

---

## Property Status Table

| Property | Status in this project | Where |
| -------- | ---------------------- | ----- |
| Single modifiable file | YES | `candidate.json` updated each round |
| Git-based revert | YES (with `--git-mode`) | Every attempt recorded in git |
| Read-only evaluator | YES | Scoring rules are fixed — the loop can't change them |
| Runs autonomously | YES | Loop runs all iterations without user input |
| Numerical score | YES | 0–10 score after every iteration |
| Experiment log | YES | `iteration_N.json` files + git log in git mode |

> **Note:** The maximum achievable score is 10/10. In practice, scores above 8 are rare because the LLM scorer is explicitly instructed to be conservative, and `actionability` — the hardest criterion — requires both 3+ concrete deliverables (rule check) and engineer-ready detail (LLM check).

---

## Three Failure Modes (What Breaks When PMs Copy This)

Most "autoresearch for PMs" adaptations fail in one of three ways. Each one breaks a different governance principle.

### Failure Mode 1: No Real Eval — Optimizing Noise

**What it looks like:** The system asks "how good is this? rate it 1-10" — or uses vague proxies like "does this feel complete?"

**Why it fails:** Vague questions produce scores that reflect surface polish, not actual quality. The loop optimizes toward better-sounding language while the underlying structural problems stay exactly the same. The score goes up; the plan doesn't get more useful.

**The mechanism:** A proxy is a measurement of something correlated with what you care about, not what you actually care about. "Sounds complete" is correlated with "is complete" but is not the same thing. Optimize a proxy long enough and you get a document that sounds excellent but fails in production.

**What this project does instead:** The evaluator uses rule-based checks (deterministic, grounded in structure — does the epic have 2+ in-scope items? does it have numeric targets?) combined with LLM checks anchored to specific, externally-derivable criteria. The scoring criteria are written before the loop runs — not generated by the agent from its own output.

**The PM test:** If you can't explain the scoring criteria to a stakeholder before running the loop, you don't have a real eval. You have vibes with a number attached.

---

### Failure Mode 2: Too Many Editable Surfaces — The Agent Cheats

**What it looks like:** The agent can modify the epic AND adjust the scoring weights, OR the agent proposes new success criteria mid-run, OR the "eval" asks the agent to judge its own output.

**Why it fails:** The agent finds the shortest path to a high score. If that path involves relaxing the constraints rather than improving the plan, it will take it. Every time. This is not a bug in the agent — it is a rational optimization given the incentives.

**The mechanism:** Signal integrity requires that the measurement system is independent of the thing being measured. If the agent can influence both, you get correlation, not signal. The scores look good; the output isn't actually better.

**What this project does instead:** Only `candidate.json` is writable by the loop. The 5 criteria in `evaluator.ts` are hardcoded constants — the loop has no code path that could modify them. The scoring function is fixed before the loop starts and the loop cannot touch it.

**The PM test:** Could the agent score 10/10 without actually improving the plan? If yes, you have multiple editable surfaces. If the only way to score 10/10 is to produce a genuinely better plan, the surfaces are correctly constrained.

---

### Failure Mode 3: No Timebox — Incomparable Experiments

**What it looks like:** One run uses 3 iterations, the next uses 20, another runs until it "seems done." Results are compared across these runs.

**Why it fails:** A 20-iteration run will almost always outscore a 3-iteration run — not because the starting point was better or the direction was right, but because it had more search budget. Comparing results across different budgets produces noise, not signal.

**The mechanism:** Experiments are only comparable if they are the same kind of experiment. "Same kind" means same budget (iterations), same stopping rule (early exit at 10/10 or run N), same eval. Change any of these and you're comparing apples to oranges.

**What this project does instead:** `--iterations N` is the budget. It is fixed before the run, not adjusted mid-run. The `--yes` flag runs unattended to completion so the run is never cut short by impatience. Early exit at 10/10 is the only valid stopping rule besides reaching N.

**The PM test:** If someone asked you "which of these three runs produced the best result?", could you fairly compare them? If the runs had different iteration counts, the answer is no.

---

## Where This Project Diverges From the Original Pattern

The Karpathy pattern was originally described in an article about using AI agents to autonomously improve code overnight. This project applies that same pattern to product planning instead of code — and makes a few intentional changes to make it easier to learn from.

| Article | This project | Why |
| ------- | ------------ | --- |
| Agent edits code files | Agent edits Epic JSON | Epics are a better teaching artifact for PMs |
| Git on project root | Git scoped to `artifacts/git-runs/` | Safer — avoids conflicts with the project's own git |
| 100+ iterations overnight | Default: 3 iterations | Cost and time limits for a teaching demo |
| Evaluation via test suite | Evaluation via rubric + LLM | No existing test suite for an epic — rubric is explicit |
| Self-modifying agent | Loop calls Claude as a tool | Simpler architecture, easier to understand |
| Agent reads git history to decide next moves | Agent threads single-iteration hints (`previousHints`) | Simpler for teaching; for short runs (3-10 iterations) single-step hints work well; for production runs (50-100), wiring the full history into the generator prompt is the correct implementation |

None of these are limitations — they're intentional design choices for a teaching context. The full overnight 100-iteration pattern is achievable with this codebase: just use `--iterations 100 --yes` and wait.
