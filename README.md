# autoresearch-pm-demo

This demo shows how AI can help turn a vague idea into a written plan — and then into real code — automatically.

You describe a problem. An AI asks you questions. Then a program runs in a loop, writing and improving a plan until it's good enough. Then another AI reads that plan and starts building.

**No coding experience required to follow along.**

---

## What you'll learn

- How to talk to an AI using tools (called **MCP tools**) from inside a code editor
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

```text
┌──────────────────────────────────────────────────────────────────────┐
│  DISCOVERY: You talk to AI tools                                      │
│                                                                       │
│  validate_problem → prioritize_opportunities → define_epic            │
│                                                                       │
│  You answer questions. AI validates your idea and writes a first      │
│  draft plan (called an "epic").                                       │
│  Output: a plan file saved to your computer                           │
└──────────────────────────┬───────────────────────────────────────────┘
                           │  plan file (raw.json)
                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│  EPIC REFINEMENT LOOP (Autoresearch pattern)    [--git-mode]         │
│                                                 [--explore]          │
│  generate → score → improve → repeat (3 times)                       │
│                                                                       │
│  No human involved. Each version gets a score out of 10.             │
│  The best version is saved as a readable document.                   │
│  Output: a polished plan file in your project folder                 │
└──────────────────────────┬───────────────────────────────────────────┘
                           │  polished plan ({id}-epic.md)
                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│  BUILD: AI reads the plan and starts coding                           │
│                                                                       │
│  /build-from-epic                                                     │
│                                                                       │
│  Claude Code reads the plan file, makes a task list, and begins      │
│  implementing the feature.                                            │
│  Output: code files in your project                                  │
└──────────────────────────┬───────────────────────────────────────────┘
                           │  code files
                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│  CODE QUALITY LOOP (Autoresearch pattern)       [--code-quality]     │
│                                                                       │
│  /run-code-quality                                                    │
│                                                                       │
│  Same Autoresearch pattern, applied to code.                         │
│  Scores: no lint errors, no security issues, readability,            │
│  test coverage, epic alignment. Rewrites code to fix failures.       │
│  Output: improved code file                                          │
└──────────────────────────┬───────────────────────────────────────────┘
                           │  improved code
                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│  VALIDATION LOOP (Autoresearch pattern)         [--validate]         │
│                                                                       │
│  /run-validation                                                      │
│                                                                       │
│  Reads the success_metrics from the epic and checks each one.        │
│  Score = how many metrics pass. Feeds failures back as hints.        │
│  "Done" = all metrics pass — defined by the plan, not the coder.    │
└──────────────────────────────────────────────────────────────────────┘
```

Each handoff between stages is a **file** — something you can open, read, and inspect. Nothing is hidden inside a black box.

---

## Docs

| Document | What's in it |
| -------- | ----------- |
| [docs/CONCEPTS.md](docs/CONCEPTS.md) | Plain-English explanations of AI, Claude, MCP, terminals, and Node.js |
| [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md) | Full step-by-step tutorial from zero to running the demo |
| [docs/HOW_IT_WORKS.md](docs/HOW_IT_WORKS.md) | Deep dive: Karpathy pattern, MCP tool design, all five pipeline stages |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Common errors and how to fix them |

### Key external resources

| Resource | What it is |
| -------- | ---------- |
| [arcade.dev/patterns](https://www.arcade.dev/patterns) | The definitive catalog of MCP tool design patterns — 44 patterns across 10 categories. The Discovery tools in this project implement 5 of them. Start here if you're building your own MCP tools. |

---

## Why this matters for your AI PM career

The hardest part of breaking into AI PM roles isn't content or certifications — it's demonstrable experience. Hiring managers want to see that you've actually shipped something with AI, not just read about it.

This project gives you that. By the end of the demo you will have:

- **Used MCP tools** inside a real code editor to run a structured discovery process
- **Watched an AI optimization loop** run autonomously, score its own output, and improve it
- **Shipped a plan → code handoff** — a full 0-to-1 pipeline, even if it's a demo problem

That's not a course certificate. That's something you built and ran yourself.

The deeper skill this teaches: **defining constraints so a system can explore options for you.** That's the shift from traditional PM work (write the doc) to AI-native PM work (define what "good" looks like, let the system generate candidates, you choose). The article that inspired this project calls it "pre-decision exploration under constraints."

Want to go further? Try running the loop on a real problem you're working on. Use your own `--target-dir`. The output is a real plan file you could hand to an engineer tomorrow.

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
