# How It Works

This document explains the ideas behind this project — not just what the code does, but *why* it was built this way, and what it's trying to teach.

Start here if you want to understand the system deeply. If you just want to run it, start with [GETTING_STARTED.md](GETTING_STARTED.md).

> **Reading guide:** Most sections are written for everyone. A few sections go deep into code and are marked **[For developers]** — you can skip those safely if you're not a programmer and still understand the full picture.

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
>
> **[For developers]** Source file locations: `candidate.json` ← `generator.ts`, git logic ← `src/autoresearch/git.ts`, evaluator ← `src/autoresearch/evaluator.ts`, loop ← `loop.ts: optimize()`.

---

## The Single File Pattern

### Why a file and not a variable?

The simplest way to track "current best epic" would be to keep it in the program's memory — an invisible number or object the code holds while it runs. That works, but you can't open memory in a text editor, you can't compare two versions, and git can't track changes to it.

Instead, this project writes the current best plan to a real file (`candidate.json`) after every iteration. You can open it in VS Code, read it, and see exactly what changed.

> **[For developers]** In code: `let best = someEpic` (invisible) vs `fs.writeFileSync(candidatePath, JSON.stringify(epic, null, 2))` (a real file you can inspect with `git diff`).

You can open the file in VS Code right now and read it. You can run `git diff` and see exactly what changed between iterations.

This is the "single modifiable file" concept: **one real file on disk, edited each round.**

### Where is it?

- Normal mode: `artifacts/epics/{idea-id}/candidate.json`
- Git mode: `artifacts/git-runs/{run-id}/candidate.json`

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

### Tie-breaking and the baseline

**When scores tie:** If a new iteration matches but doesn't beat the current best score, the loop reverts it. Same quality = keep the previous authoritative version. This prevents silent drift — a different epic at the same score isn't necessarily better.

**The baseline is always kept:** In git mode, iteration 1 (the Discovery output) is always committed and never reverted — it's the starting point, not a candidate. A weak baseline means the loop starts from a low floor. If scores plateau below 5, go back to Discovery and write more specific session notes.

---

## Git Scope: Why Not the Project Root? [For developers]

> **[For developers]** This section explains a technical design choice. You don't need to understand it to use the demo — just know that git mode works safely without affecting any other git repository you have.

When you enable `--git-mode`, a git repository is created inside `artifacts/git-runs/{run-id}/` — **not in the project root folder.**

Why? A few reasons:

1. **The project might already be a git repo.** If it is, creating a nested git repo inside it causes problems.

2. **Each experiment's history should be self-contained.** If you delete `artifacts/git-runs/my-run-123/`, the git history for that run goes with it. Clean and contained.

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

> **This section only applies if you're using real mode with an API key.** Mock mode (`--mock`) is completely free and uses no tokens.

### What is a token?

When you send text to Claude, it's broken into small chunks called **tokens** — roughly one word each. Claude charges based on how many tokens it processes. Roughly:

- 1 token ≈ 4 characters of English text
- 1000 tokens ≈ 750 words

The more tokens, the more it costs — but the costs are very small for this demo.

### Cost table for this demo

| Mode | Iterations | Approx. tokens | Approx. cost |
| ---- | ---------- | -------------- | ------------ |
| Normal | 3 (default) | ~7,800 | < $0.01 |
| Normal | 10 | ~26,000 | ~$0.03 |
| Explore | 3 per variation | ~31,800 | ~$0.03 |
| Explore | 10 per variation | ~84,000 | ~$0.08 |

These are estimates using claude-haiku — the default model for this demo. Claude comes in several versions with different speeds and costs: Haiku is the fastest and cheapest, Sonnet is more capable, Opus is the most powerful. You can change the model in your `.env` file. Costs may vary.

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

## Where This Project Diverges From the Original Pattern

The Karpathy pattern was originally described in an article about using AI agents to autonomously improve code overnight. This project applies that same pattern to product planning instead of code — and makes a few intentional changes to make it easier to learn from.

This is an honest comparison. The project matches the pattern's spirit but makes different choices for teachability:

| Article | This project | Why |
| ------- | ------------ | --- |
| Agent edits code files | Agent edits Epic JSON | Epics are a better teaching artifact for PMs |
| Git on project root | Git scoped to `artifacts/git-runs/` | Safer — avoids conflicts with the project's own git |
| 100+ iterations overnight | Default: 3 iterations | Cost and time limits for a teaching demo |
| Evaluation via test suite | Evaluation via rubric + LLM | No existing test suite for an epic — rubric is explicit |
| Self-modifying agent | Loop calls Claude as a tool | Simpler architecture, easier to understand |

None of these are limitations — they're intentional design choices for a teaching context. The full overnight 100-iteration pattern is achievable with this codebase: just use `--iterations 100 --yes` and wait.

---

---

## The Code Quality Loop

After the Build stage writes code, the next question is: is that code actually good?

"Good" here means four things:

1. **No lint errors** — clean types, no TODOs, reasonable file length
2. **No security issues** — no eval(), no innerHTML, no hardcoded secrets
3. **Readable** — clear names, short functions, no magic numbers
4. **Tests exist** — at least the core path is testable

There's a fifth criterion: **epic alignment** — does the code actually implement what the epic said? This one can only be judged by reading both the code and the epic, so it's evaluated by the LLM only.

### The same pattern, different artifact

The code quality loop is structurally identical to the Epic Refinement Loop (both use the Autoresearch pattern):

| Epic Refinement Loop | Code Quality Loop (Autoresearch pattern) |
| --- | --- |
| Reads current epic from `raw.json` | Reads current code from target file |
| Calls `generate()` → improved epic | Calls `improveCode()` → improved code |
| Calls `evaluate()` → 0-10 score | Calls `evaluateCode()` → 0-10 score |
| Keeps best, discards worse | Writes best back to file |
| Saves iteration logs to `artifacts/epics/` | Saves iteration logs to `artifacts/code-quality/` |

The only difference is the artifact type. Everything else — the loop structure, the callbacks, the scoring pattern — is identical.

### How to run it

```bash
npx tsx src/autoresearch/main.ts \
  --idea-id my-feature \
  --target-dir ./docs \
  --target-file ./src/my-feature.ts \
  --iterations 3 \
  --code-quality \
  --mock
```

Or in Claude Code: `/run-code-quality` after `/build-from-epic`.

### What the scores mean

A score of 9/10 after 3 iterations means the loop found a version of the code that passes 9 out of 10 possible criterion points. The remaining point might be something the LLM couldn't fully verify in mock mode — run with a real API key for deeper analysis.

---

## The Validation Loop

The validation loop closes the entire pipeline. It asks the final question:

> **"Does the code satisfy the metrics the PM wrote in the epic?"**

Not "is the code clean?" (that's the code quality loop). Not "does it look right?" (that's a code review). Specifically: does it implement the outcomes the PM defined at the start?

### "Done" is defined by the plan

Every epic has a `## Success Metrics` section:

```markdown
| Metric | Target | Measurement |
| --- | --- | --- |
| Onboarding drop-off rate | < 15% | Mixpanel funnel report |
| Time to first action | < 60s | Analytics event timing |
```

The validation loop reads these rows and checks, for each one: *does the code contain the implementation needed to achieve this metric?*

This is powerful because **done** is defined by the PM at the start of the pipeline — not by the developer at the end.

### How it scores

```text
passCount / totalMetrics × 10 = score
```

5 metrics, 5 passing = 10/10. 3 metrics passing = 6/10. The score reflects how complete the implementation is against the plan.

### When a metric fails

The failure hint is specific:

```text
Implement code to satisfy metric "Time to first action": no timing
measurement found in the code. Add performance.now() or equivalent.
```

That hint gets passed to the code generator (the same one used in the code quality loop), which produces an improved version. Then we re-validate.

### Running the validation loop

```bash
npx tsx src/autoresearch/main.ts \
  --idea-id my-feature \
  --target-dir ./docs \
  --target-file ./src/my-feature.ts \
  --iterations 3 \
  --validate \
  --mock
```

The `--validate` flag automatically runs the code quality loop first, then validation. You get both in one command.

Or in Claude Code: `/run-validation` after `/run-code-quality`.

### The complete pipeline

```text
  YOU
   │  describe a problem
   ▼
┌──────────────────────────────────────────────────────────────────────┐
│  DISCOVERY                                                            │
│                                                                       │
│  validate_problem → prioritize_opportunities → define_epic            │
│                                                                       │
│  You answer questions. Claude validates your idea and writes a        │
│  first draft plan (an epic: problem, scope, success metrics).         │
└───────────────────────────────┬──────────────────────────────────────┘
                                │  saves: raw.json
                                │
                  (if plan is too vague, go back ↑)
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│  EPIC REFINEMENT LOOP                  (Autoresearch pattern)        │
│                                                                       │
│    ┌──────────────────────────────────────────────┐                  │
│    │  improve plan  →  score (0–10)               │                  │
│    │                        │                      │                  │
│    │          better? → keep new version           │                  │
│    │          worse?  → revert to previous         │                  │
│    │                        │                      │                  │
│    │              repeat N times ─────────────────→┘                 │
│    └──────────────────────────────────────────────┘                  │
│  [--git-mode] records every attempt · [--explore] tries 3 framings   │
└───────────────────────────────┬──────────────────────────────────────┘
                                │  saves: {id}-epic.md
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│  BUILD                                                                │
│                                                                       │
│  /build-from-epic  →  Claude reads the plan and writes code          │
│  (one-time step — no loop)                                            │
└───────────────────────────────┬──────────────────────────────────────┘
                                │  saves: code files
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│  CODE QUALITY LOOP                     (Autoresearch pattern)        │
│                                                                       │
│    ┌──────────────────────────────────────────────┐                  │
│    │  improve code  →  score: lint? security?     │                  │
│    │                   readable? tested? on-epic? │                  │
│    │                        │                      │                  │
│    │          better? → keep · worse? → revert     │                  │
│    │                        │                      │                  │
│    │              repeat N times ─────────────────→┘                 │
│    └──────────────────────────────────────────────┘                  │
└───────────────────────────────┬──────────────────────────────────────┘
                                │  saves: improved code
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│  VALIDATION LOOP                       (Autoresearch pattern)        │
│                                                                       │
│    ┌──────────────────────────────────────────────┐                  │
│    │  check each success metric from the epic     │                  │
│    │                        │                      │                  │
│    │    metric passes? ✓    │    metric fails? ✗   │                  │
│    │                        │         │             │                  │
│    │                        │    improve code  ◄───┘ (feedback loop) │
│    │                        │    re-check metric                      │
│    │                        │                      │                  │
│    │    score = passing metrics / total            │                  │
│    │              repeat N times ─────────────────→┘                 │
│    └──────────────────────────────────────────────┘                  │
│                                                                       │
│  "Done" is defined by the plan you wrote — not by whoever coded it.  │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
                                ▼
                      ✓  ALL METRICS PASS

Every stage saves a file. Every file is readable. Nothing is hidden.
```

**What the arrows show:**

- Each loop has an **internal cycle** — it doesn't run once, it iterates
- The Validation Loop has an extra **feedback path**: failures trigger code improvement, then re-check
- Going back to an earlier stage (e.g. Discovery because the plan was wrong) is a **human decision** — the system never jumps back automatically

---

## MCP Tool Design [For developers and curious learners]

> **Who this section is for:** If you used the tools in GETTING_STARTED.md and want to know *why* they were designed the way they were — or if you want to build your own MCP tools someday — this section is for you. If you just want to run the demo, you can skip it.

The Discovery stage uses three MCP tools. Each tool is a callable unit that Claude invokes directly from the chat interface. How you design those tools determines how reliably the agent uses them.

The best reference for MCP tool design patterns is **[arcade.dev/patterns](https://www.arcade.dev/patterns)**. Their guiding principle:

> *"Your agents are only as good as your tools."*

Well-designed tools keep orchestration simple. Poorly designed tools force the agent to guess — which it does inconsistently.

This project deliberately demonstrates five patterns from the Arcade catalog.

---

### Pattern 1: Operation Mode

**What it is:** One tool, two behaviors, controlled by a single boolean flag.

**Where:** All three Discovery tools use `proceed: boolean`.

| Call | `proceed` value | What happens |
| ---- | --------------- | ------------ |
| First | omitted | Lightweight preflight — surfaces gaps, asks 3 questions |
| Second | `true` + `session_notes` | Full analysis — expensive, conclusive, writes artifact |

**Why:** The agent can ask clarifying questions before spending tokens on a full analysis. The two-call pattern is consistent across all three tools, so the agent learns it once and applies it everywhere.

Reference: [arcade.dev/patterns#operation-mode](https://www.arcade.dev/patterns#operation-mode)

---

### Pattern 2: Context Injection

**What it is:** The tool automatically loads prior-stage output. The agent doesn't have to pass it explicitly.

**Where:** `prioritize_opportunities` loads `validated_problem` from the idea artifact. `define_epic` loads both `validated_problem` and `priorities`.

**Why:** Reduces the burden on the agent. Instead of maintaining and passing a growing context object, the agent just passes `idea_id` — the tool handles the rest.

Reference: [arcade.dev/patterns#context-injection](https://www.arcade.dev/patterns#context-injection)

---

### Pattern 3: Dependency Hint

**What it is:** Error messages and descriptions tell the agent what to call first — without requiring external orchestration.

**Where:** `prioritize_opportunities` throws: *"No idea_id found. Run validate_problem first or pass idea_id."*

**Why:** Agents follow error message guidance. If the error message says "call X first," the agent calls X. This is simpler than encoding the sequence in a separate orchestrator.

Reference: [arcade.dev/patterns#dependency-hint](https://www.arcade.dev/patterns#dependency-hint)

---

### Pattern 4: Tool Chain (visible handoff)

**What it is:** The tool explicitly surfaces the next step by returning a `next_step` field — a copy-pasteable CLI command.

**Where:** `define_epic` returns:

```text
next_step: "npx tsx src/autoresearch/main.ts --idea-id abc123 --target-dir ..."
```

**Why:** The handoff from MCP tools to the autoresearch CLI is the most important transition in the pipeline. Making it a visible string — not hidden logic — means the user can see it, copy it, and understand exactly what happens next.

Reference: [arcade.dev/patterns#tool-chain](https://www.arcade.dev/patterns#tool-chain)

---

### Pattern 5: Recovery Guide

**What it is:** Every error message is actionable. It tells the agent what to do, not just what went wrong.

**Where:** All three tools. Examples:

- `"Pass a problem_statement to start, or drop a template in artifacts/working/."`
- `"Idea 'xyz' not found. Run validate_problem first."`

**Why:** Agents retry based on error messages. "Something went wrong" produces a useless retry. "Pass a problem_statement" produces a correct retry.

Reference: [arcade.dev/patterns#recovery-guide](https://www.arcade.dev/patterns#recovery-guide)

---

### Where to go deeper

The full Arcade pattern catalog covers 44 patterns across 10 categories — tool interface, composition, execution, output, resilience, security, and more. This project demonstrates 5. If you're building MCP tools for production use, [arcade.dev/patterns](https://www.arcade.dev/patterns) is the reference to bookmark.

---

## Code Annotations: Which File Implements Which Concept [For developers]

> **[For developers]** This is a reference table mapping concepts to their source files. If you're not a programmer, you don't need this — everything the demo does is visible through the `artifacts/` folder output.

| Concept | File |
| ------- | ---- |
| The git revert pattern | `src/autoresearch/git.ts` |
| The single modifiable file (epics) | `src/autoresearch/generator.ts` (writes `candidate.json`) |
| The read-only evaluator (epics) | `src/autoresearch/evaluator.ts` |
| The optimization loop | `src/autoresearch/loop.ts` |
| Explore mode (3 framings) | `src/autoresearch/loop.ts` → `explore()` function |
| CLI flags, cost estimate, explore table | `src/autoresearch/main.ts` |
| The code quality evaluator | `src/code-quality/evaluator.ts` |
| The code quality generator | `src/code-quality/generator.ts` |
| The code quality loop | `src/code-quality/loop.ts` |
| The validation evaluator | `src/validation/evaluator.ts` |
| The validation loop | `src/validation/loop.ts` |
| Settings (all mode flags) | `src/shared/config.ts` |
| Data shapes for all concepts | `src/shared/types/index.ts` |
| Discovery MCP tools | `src/mcp/tools/` |
| Build skill | `.claude/commands/build-from-epic.md` |
| Code quality skill | `.claude/commands/run-code-quality.md` |
| Validation skill | `.claude/commands/run-validation.md` |
