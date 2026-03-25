# autoresearch-pm-demo

This demo shows how AI can help turn a vague idea into a written plan — and then into real code — automatically.

You describe a problem. An AI asks you questions. Then a program runs in a loop, writing and improving a plan until it's good enough. Then another AI reads that plan and starts building.

**No coding experience required to follow along.**

---

## What you'll learn

- How to talk to an AI using tools (called **MCP tools** — think of them like apps that give Claude new abilities) from inside a code editor
- How an automated loop can improve a document by scoring it and rewriting it over and over
- How a structured plan can be handed off to an AI to start building real software

---

## What you need

- A computer (Mac, Windows, or Linux)
- About 30 minutes
- An internet connection
- (Optional) A free Anthropic account for a real API key — but you can try the demo without one

---

## Start here

> **New to all of this? Read [docs/CONCEPTS.md](docs/CONCEPTS.md) first** — it explains AI, Claude, MCP, and terminals in plain English.

Ready to run it? Go to [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md) for the step-by-step walkthrough.

Something broken? See [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).

---

## How it works (the big picture)

The pipeline has 5 stages. Three of them are **loops** — they run automatically, score their output, and improve it until the score is good enough. The other two are one-time steps driven by you or Claude.

```text
  YOU
   │
   │  describe a problem
   ▼
┌─────────────────────────────────────────────────────────────────┐
│  DISCOVERY                                                       │
│                                                                  │
│  validate_problem → prioritize_opportunities → define_epic       │
│                                                                  │
│  You answer questions. Claude validates your idea and writes     │
│  a first draft plan (called an "epic" — a written spec for       │
│  a feature: the problem, what to build, how to measure success). │
└───────────────────────────┬─────────────────────────────────────┘
                            │  saves: raw.json (draft plan)
                            │
            ┌───────────────┘
            │  (if the draft is too vague, go back to Discovery)
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│  EPIC REFINEMENT LOOP          (Autoresearch pattern)            │
│                                                                  │
│    ┌─────────────────────────────────────────┐                  │
│    │  generate improved plan                  │                  │
│    │       ↓                                  │                  │
│    │  score it  (0–10)                        │                  │
│    │       ↓                                  │                  │
│    │  better than before? → keep it           │                  │
│    │  worse than before?  → revert, try again │                  │
│    │       ↓                                  │                  │
│    │  repeat N times  ──────────────────────→ ┘                 │
│    └─────────────────────────────────────────┘                  │
│                                                                  │
│  Options: [--git-mode] records every attempt in git             │
│           [--explore]  runs 3 different framings, you pick one  │
└───────────────────────────┬─────────────────────────────────────┘
                            │  saves: {id}-epic.md (polished plan)
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  BUILD                                                           │
│                                                                  │
│  /build-from-epic                                                │
│                                                                  │
│  Claude reads the plan and writes code.                          │
│  One-time step — no automatic loop.                              │
└───────────────────────────┬─────────────────────────────────────┘
                            │  saves: code files in your project
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  CODE QUALITY LOOP         (Autoresearch pattern)                │
│                                                                  │
│    ┌─────────────────────────────────────────┐                  │
│    │  improve code                            │                  │
│    │       ↓                                  │                  │
│    │  score it: lint? security? readable?     │                  │
│    │            tests? matches the epic?      │                  │
│    │       ↓                                  │                  │
│    │  better? keep · worse? revert            │                  │
│    │       ↓                                  │                  │
│    │  repeat N times  ──────────────────────→ ┘                 │
│    └─────────────────────────────────────────┘                  │
└───────────────────────────┬─────────────────────────────────────┘
                            │  saves: improved code file
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  VALIDATION LOOP           (Autoresearch pattern)                │
│                                                                  │
│    ┌─────────────────────────────────────────┐                  │
│    │  check each success metric from the epic │                  │
│    │       ↓                                  │                  │
│    │  pass? ✓  fail? → improve code + retry  │◄─┐               │
│    │       ↓                                  │  │ feedback      │
│    │  score = metrics passing / total         │  │ loop          │
│    │       ↓                                  │  │               │
│    │  repeat until all pass or N attempts  ───┘  │               │
│    └──────────────────────────────────────────────┘              │
│                                                                  │
│  "Done" = all metrics pass — defined by the plan you wrote,     │
│  not by whoever wrote the code.                                  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
                    ✓  ALL METRICS PASS
```

**Key things to notice:**

- The three loops each have an **internal cycle** — they don't just run once, they iterate and improve.
- The Validation Loop has an extra **feedback path**: when a metric fails, it improves the code and re-checks — all automatically.
- Going back to an earlier stage (e.g. back to Discovery because the plan was wrong) is a **manual decision** — the system doesn't loop back automatically between stages.
- Every handoff is a **file** you can open and read. Nothing is hidden.

> **New to these terms?** An **epic** is a written plan for a feature: what problem it solves, what to build, and how to measure success. **Success metrics** are the measurable targets in that plan (e.g. "drop-off rate under 15%"). The validation loop uses those to know when the code is actually done.

---

## Reading guide

**Where you start depends on who you are.**

### If you're a Product Manager (or not a developer)

Follow this path — in order:

| Step | Document | What you'll get |
| ---- | -------- | --------------- |
| 1 | [docs/CONCEPTS.md](docs/CONCEPTS.md) | Plain-English explanations of every term used in this project — AI, tokens, MCP, git, terminals. Read this first if anything sounds unfamiliar. |
| 2 | [The PM example below ↓](#a-real-example-for-product-managers) | A worked scenario showing exactly how a PM would use this tool on a real problem, step by step. |
| 3 | [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md) | Install, run the demo, and see the loop in action. Takes about 30 minutes. |
| 3a | [docs/MCP_SETUP.md](docs/MCP_SETUP.md) | Connect the AI tools to your editor or Claude Desktop (VS Code, Mac, Windows). Step-by-step with screenshots-level detail. |
| 4 | [docs/HOW_IT_WORKS.md](docs/HOW_IT_WORKS.md) | The core ideas — why loops beat one-shot generation, what the "governance model" means for PMs, how this changes your role. |
| 5 | [docs/FEATURES.md](docs/FEATURES.md) | Every feature explained: explore mode, git mode, RAG, model routing, token costs. Bookmark this for when you want to try something new. |

### If you're a developer

| Document | What's in it |
| -------- | ----------- |
| [docs/HOW_IT_WORKS.md](docs/HOW_IT_WORKS.md) | Core concepts — the Karpathy pattern, governance model, why loops beat one-shot |
| [docs/FEATURES.md](docs/FEATURES.md) | Feature reference — RAG, explore mode, per-stage model routing, git mode, token costs |
| [docs/FOR_DEVELOPERS.md](docs/FOR_DEVELOPERS.md) | Deep dives — eval design, MCP tool patterns, code annotations map |
| [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md) | Setup and first run |
| [docs/MCP_SETUP.md](docs/MCP_SETUP.md) | Connect MCP tools to VS Code, Claude Desktop (Mac + Windows) |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Common errors and fixes |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) | Fork, branch, PR flow |

### Key external resources

| Resource | What it is |
| -------- | ---------- |
| [arcade.dev/patterns](https://www.arcade.dev/patterns) | **For developers:** The definitive catalog of MCP tool design patterns — 44 patterns across 10 categories. The Discovery tools in this project implement 5 of them. |

---

## A real example for Product Managers

Here's what using this tool actually looks like — from a real PM problem to a finished plan.

### The scenario

You're a Product Manager at a company that makes an app for tracking personal fitness goals. Your team has noticed that a lot of new users sign up but never come back after the first week. Your manager asks you: **"Can you figure out what to build to fix retention?"**

In the old world, you'd spend days writing a document, getting feedback, rewriting it, scheduling meetings. By the time everyone agreed, a month had passed.

With this tool, you spend 20 minutes describing the problem — and the AI does the drafting loop for you.

---

### Step 1: Describe your problem (in Claude Code)

Open your terminal (the black screen where you type commands). Start Claude Code. Then type something like this to the AI:

```text
I'm a PM at a fitness app company. New users sign up but don't come back after week 1.
I think we need to improve onboarding. Can you help me define this as a feature?
```

Claude will say "let me help you validate this" and call the `validate_problem` tool. It will ask you 3 questions — things like:

- "Who exactly is affected? First-time users only, or returning users too?"
- "What does 'not coming back' mean in numbers? What's the current drop-off rate?"
- "Have you tried anything before? What happened?"

You answer these. Be specific. The more specific you are, the better the output.

> **Why does it ask questions?** Because "improve retention" is too vague to build anything. The AI is pushing you to be specific *before* it writes anything — just like a good engineer would.

---

### Step 2: Get a first draft plan

After you answer the questions, Claude calls `define_epic`. This creates a first draft of your feature plan (called an "epic"). It will look something like this:

```text
Problem: 62% of new users don't return after day 7.
Root cause: Users don't experience a "first win" in session 1.

What to build:
  - A 3-step onboarding flow that guides users to log one goal and one workout
  - A 7-day streak feature with a push notification on day 3 if no activity
  - A progress summary email on day 7

Success metrics:
  | Metric              | Target  |
  | ------------------- | ------- |
  | Day-7 retention     | > 45%   | (currently 38%)
  | First workout logged | > 70%  | (within 24hrs of signup)
```

This is a rough draft. It might be vague in places. That's okay — the next step fixes that.

---

### Step 3: Run the refinement loop

Claude gives you a command to run. It looks like this:

```bash
npx tsx src/autoresearch/main.ts --idea-id fitness-retention --target-dir ./docs --iterations 5
```

You paste that into your terminal and press Enter.

Watch what happens:

```text
Iteration 1 — Score: 6/10
  Hints: "Success metrics lack measurement method. Onboarding steps need
          tech detail for engineers. No risk analysis."

Iteration 2 — Score: 8/10
  Hints: "Day-7 retention target needs a baseline. Push notification
          frequency not specified."

Iteration 3 — Score: 9/10
  ✓  Score did not improve further. Keeping best.

Best score: 9/10  (started at 6/10, improved by 3 points)
```

Each iteration, the AI:

1. Reads the current plan
2. Rewrites it to fix the weakest parts
3. Scores it against 5 criteria (0-10)
4. Keeps the better version, throws away the worse one

You just watched the AI improve a draft plan 3 times in about 90 seconds.

---

### Step 4: Read your finished plan

The final plan is saved as a file: `docs/fitness-retention-epic.md`.

Open it. It will be much more specific than your starting description:

- The onboarding flow now has specific screens listed
- Each success metric has a measurement method ("tracked via Mixpanel funnel report")
- There's a risk section ("push notifications require iOS/Android permission — add permission prompt to onboarding flow")

This is a plan you could hand to an engineer today.

---

### Step 5 (optional): Compare 3 different angles

Not sure which way to frame the problem? Run explore mode:

```bash
npx tsx src/autoresearch/main.ts --idea-id fitness-retention --target-dir ./docs --iterations 3 --explore
```

This runs the loop 3 times with different starting lenses:

| # | Framing | What it emphasizes |
| - | ------- | ------------------ |
| 1 | outcome-focused | Who's affected, by how much, by when |
| 2 | risk-focused | What could go wrong, what to build around it |
| 3 | metric-focused | Every deliverable tied to a measurable number |

You get a comparison table at the end. Pick the framing that fits what your stakeholders care about most right now.

---

### What changed for you as a PM?

**Before this tool:** You write the plan → someone reviews it → you rewrite it → repeat for 2 weeks.

**With this tool:** You describe the problem and answer 3 questions → the AI runs 5-10 iterations → you read the best plan and decide if it's good enough.

Your job shifted from *writing* to *deciding*. You spend your time on the things only you can do: understanding the business, knowing what stakeholders care about, and choosing between options the AI surfaced for you.

The criteria that determine "good enough" — those are yours. You set them once (in the evaluator). Then the system explores the space for you.

---

## Why this matters

**For anyone:** This demo shows you what AI can actually do — not a chatbot answering questions, but a program that runs a loop, scores its own work, and improves it automatically. You'll watch that happen step by step.

**For product managers and career-changers:** The hardest part of moving into AI PM roles isn't content or certifications — it's demonstrable experience. Hiring managers want to see that you've actually shipped something with AI, not just read about it.

By the end of the demo you will have:

- **Used MCP tools** inside a real code editor to run a structured discovery process
- **Watched an AI loop** run autonomously, score its own output, and improve it
- **Seen a plan turn into code** — a full pipeline from idea to implementation

The deeper skill this teaches: **defining what "good" looks like so a system can explore options for you.** That's the shift from traditional work (write the plan yourself) to AI-native work (define the criteria, let the system generate candidates, you choose the best one).

Want to go further? Try running the loop on a real problem you're working on. Use your own `--target-dir`. The output is a real plan file you could hand to a developer tomorrow.

---

## For developers

The source lives in `src/` with folders mirroring the pipeline stages:

```text
src/
├── mcp/          # Discovery: MCP server (Claude Code tools)
├── autoresearch/ # Epic Refinement Loop: autoresearch CLI
├── code-quality/ # Code Quality Loop: code improvement loop
├── validation/   # Validation Loop: metric validation loop
└── shared/       # Types, config, Claude SDK wrapper
```

Scoring criteria, improvement hints, and the two-call preflight pattern are all documented inline in the source. See `src/autoresearch/evaluator.ts` for the 5-criterion scoring system (0–10 scale).

### Useful commands

| Command | What it does |
| ------- | ------------ |
| `npm run demo` | **Quick start** — runs the Epic Refinement Loop in mock mode (no API key, no cost). Good first command after `npm install && npm run build`. |
| `npm run build` | Compile TypeScript → `dist/` (run once after install, or after code changes) |
| `npm run clean` | Delete `dist/` (compiled code) and `artifacts/` (demo output) — resets everything; follow with `npm run build` |
| `npm run dev` | Watch mode — recompiles automatically as you edit files |
