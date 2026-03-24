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
│  LAYER 1: You talk to AI tools                                        │
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
│  LAYER 2: A program improves the plan in a loop                       │
│                                                                       │
│  generate → score → improve → repeat (3 times)                       │
│                                                                       │
│  No human involved. Each version gets a score out of 10.             │
│  The best version is saved as a readable document.                   │
│  Output: a polished plan file in your project folder                 │
└──────────────────────────┬───────────────────────────────────────────┘
                           │  polished plan ({id}-epic.md)
                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│  LAYER 3: AI reads the plan and starts coding                         │
│                                                                       │
│  /build-from-epic                                                     │
│                                                                       │
│  Claude Code reads the plan file, makes a task list, and begins      │
│  implementing the feature.                                            │
└──────────────────────────────────────────────────────────────────────┘
```

Each handoff between layers is a **file** — something you can open, read, and inspect. Nothing is hidden inside a black box.

---

## Docs

| Document | What's in it |
| -------- | ----------- |
| [docs/CONCEPTS.md](docs/CONCEPTS.md) | Plain-English explanations of AI, Claude, MCP, terminals, and Node.js |
| [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md) | Full step-by-step tutorial from zero to running the demo |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Common errors and how to fix them |

---

## For developers

The source lives in `src/` with three folders mirroring the three layers:

```text
src/
├── mcp/          # Layer 1: MCP server (Claude Code tools)
├── autoresearch/ # Layer 2: optimization loop CLI
└── shared/       # Types, config, Claude SDK wrapper
```

Scoring criteria, improvement hints, and the two-call preflight pattern are all documented inline in the source. See `src/autoresearch/evaluator.ts` for the 5-criterion scoring system (0–10 scale).
