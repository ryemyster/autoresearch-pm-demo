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

## Docs

| Document | What's in it |
| -------- | ----------- |
| [docs/CONCEPTS.md](docs/CONCEPTS.md) | Plain-English explanations of AI, Claude, MCP, terminals, and Node.js |
| [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md) | Full step-by-step tutorial from zero to running the demo |
| [docs/HOW_IT_WORKS.md](docs/HOW_IT_WORKS.md) | Deep dive: Karpathy pattern, MCP tool design, all five pipeline stages |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Common errors and how to fix them |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) | How to contribute — fork, branch, PR flow explained for beginners |

### Key external resources

| Resource | What it is |
| -------- | ---------- |
| [arcade.dev/patterns](https://www.arcade.dev/patterns) | **For developers:** The definitive catalog of MCP tool design patterns — 44 patterns across 10 categories. The Discovery tools in this project implement 5 of them. Start here if you're building your own MCP tools. |

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
