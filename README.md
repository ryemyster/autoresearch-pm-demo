# autoresearch-pm-demo

A local TypeScript demo of the **full PM-to-build pipeline** in one repo:

```
Layer 1: MCP Discovery     →    Layer 2: Autoresearch    →    Layer 3: Build
(define the problem/epic)       (generate→evaluate→select)    (implement from epic)
   MCP tools in Claude Code        CLI optimization loop         /build-from-epic skill
```

This is a teaching project. Every handoff between layers is visible, logged, and inspectable. It mirrors patterns from [ascendvent-product-management](../ascendvent-product-management/) so the two codebases are immediately connectable.

---

## The Three-Layer Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  LAYER 1: MCP Discovery (src/mcp/)                                          │
│                                                                              │
│  validate_problem → prioritize_opportunities → define_epic                  │
│                                                                              │
│  Human-in-the-loop. Two-call preflight/proceed pattern.                     │
│  Output: artifacts/epics/{id}/raw.json  ← seeds Layer 2                    │
└───────────────────────────────┬────────────────────────────────────────────┘
                                │  raw.json (structured Epic)
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  LAYER 2: Autoresearch Loop (src/autoresearch/)                             │
│                                                                              │
│  for N iterations:                                                           │
│    generate(seed, hints) → evaluate(epic) → thread hints forward            │
│  select best → inject as {ideaId}-epic.md into target project               │
│                                                                              │
│  Automated. Explicit scoring (rule + LLM). Full iteration logs.             │
│  Output: /path/to/project/docs/{id}-epic.md  ← consumed by Layer 3         │
└───────────────────────────────┬────────────────────────────────────────────┘
                                │  {ideaId}-epic.md (markdown)
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  LAYER 3: Build Skill (.claude/commands/build-from-epic.md)                 │
│                                                                              │
│  /build-from-epic                                                            │
│  → reads injected epic → creates task list → begins implementation          │
│                                                                              │
│  Claude Code slash command. IDE-native. No API calls of its own.            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Setup

```bash
cd autoresearch-pm-demo
npm install
npm run build          # compiles MCP server to dist/
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
```

### Register the MCP server with Claude Code

```bash
claude mcp add autoresearch-demo \
  -e ANTHROPIC_API_KEY=$(grep ANTHROPIC_API_KEY .env | cut -d= -f2) \
  -s user \
  -- node /Users/rmcdonald/Repos/Brainstorming/autoresearch/autoresearch-pm-demo/dist/mcp/index.js

claude mcp list   # autoresearch-demo should appear as connected
```

---

## Quick Start (Mock Mode — no API key needed)

```bash
# Layer 2 only: run the autoresearch loop with mock fixtures
npx tsx src/autoresearch/main.ts \
  --idea-id test-idea \
  --target-dir /tmp/demo-target \
  --iterations 3 \
  --mock

# Expected output:
#   Iteration 1: score 2/10 (poor epic)
#   Iteration 2: score 7/10 (improved)
#   Iteration 3: score 9/10 (✓ New best!)
#   Epic injected to: /tmp/demo-target/test-idea-epic.md
```

---

## Full Pipeline (Live Mode)

```bash
# Step 1: Layer 1 — Discovery via MCP tools (in Claude Code)
# Use tools: validate_problem → prioritize_opportunities → define_epic
# define_epic returns a next_step command like:
#   npx tsx src/autoresearch/main.ts --idea-id my-idea-abc123 --target-dir ...

# Step 2: Layer 2 — Run autoresearch
npx tsx src/autoresearch/main.ts \
  --idea-id my-idea-abc123 \
  --target-dir /path/to/your-project/docs \
  --iterations 3

# Step 3: Layer 3 — Build from epic (in target project's Claude Code session)
/build-from-epic
```

---

## Artifact Structure

```
artifacts/
├── ideas/
│   └── {idea_id}.json          # IdeaArtifact: problem + validated_problem + priorities + raw_epic
├── sessions/
│   └── {idea_id}-{tool}.json   # Preflight state (cleared after full analysis)
├── epics/
│   └── {idea_id}/
│       ├── raw.json             # Layer 1 output → Layer 2 seed
│       ├── iteration_0.json     # Epic + scores + hints
│       ├── iteration_N.json
│       ├── best.json            # Selected epic + evaluation
│       └── manifest.json        # Run summary: scores, delta, injectedPath
└── working/
    └── {nn}-*.md               # Templates in progress (auto-discovered by tools)
```

---

## How the Handoffs Work

### Layer 1 → Layer 2: `raw.json`

The `define_epic` MCP tool:
1. Reads `validated_problem` + `priorities` from the idea artifact
2. Generates a structured `Epic` via Claude (preflight/proceed pattern)
3. Saves it to `artifacts/epics/{ideaId}/raw.json`
4. Returns `next_step`: the exact CLI command to run Layer 2

The autoresearch loop reads `raw.json` as its **seed**. Because the seed already has structure from the PM's discovery work (outcome, scope, metrics), iteration 0 starts ahead of where a blank-slate generator would begin.

### Layer 2 → Layer 3: Injected markdown

The loop's final action is:
```typescript
injectArtifact(targetDir, `${ideaId}-epic.md`, formatEpicAsMarkdown(bestEpic))
```

This writes a readable markdown file to the target project. The `/build-from-epic` skill reads it and begins implementation. The same `injectArtifact` function is used by both the MCP layer (for PRD-style injections) and the autoresearch loop — showing the pattern is reusable across layers.

---

## Scoring Criteria (Layer 2)

| # | Criterion | Rule Check | LLM Check |
|---|-----------|-----------|-----------|
| 1 | `outcome_clarity` | length >= 30 + measurable word | Names user segment + meaningful change |
| 2 | `bounded_scope` | scope.in >= 2 AND scope.out >= 1 | Realistic scope, genuine constraints |
| 3 | `measurable_success` | metrics.length >= 1, all targets non-empty | Numeric targets + named measurement tool |
| 4 | `dependency_clarity` | dependencies.length >= 1 | Named team/service/decision |
| 5 | `actionability` | always 0 (no rule) | Engineer understands what to build |

**Each criterion scores 0–2 (rule + LLM). Total: 0–10.**

Improvement hints are hardcoded specific strings — not LLM-generated. This is intentional: vague hints → vague improvements. See `src/autoresearch/evaluator.ts`.

---

## Connecting to Founder OS

This demo is intentionally minimal. The real `ascendvent-product-management` MCP server has 13 tools covering the full discovery pipeline. To connect them:

1. Run the full Founder OS pipeline to generate a PRD
2. Use `inject_artifact` to push the PRD to this project's `artifacts/working/`
3. Run `define_epic` here using the PRD as context
4. Run the autoresearch loop on the resulting raw.json

Or: add the `optimize()` function from `src/autoresearch/loop.ts` as a tool in `ascendvent-product-management/src/server.ts` — the interface is already clean.

---

## Where the System Fails

- **Vague tasks**: underspecified input → every iteration is plausible but wrong
- **Criteria gaming**: after many iterations, Claude satisfies the letter of scoring criteria without the spirit (e.g., adding "from X to Y" without grounding it in data) — watch for this around iteration 4-5
- **Mock vs live divergence**: mock scores improve deterministically; live LLM scores have variance — a live "worse" score isn't always a regression

---

## Next Steps

1. **Add a second artifact type**: create a User Story scorer alongside the Epic scorer — each artifact type needs its own schema, scoring criteria, and hint strings
2. **Human feedback between iterations**: after `onEvaluated`, prompt for a free-text note and append it to `improvementHints` before the next generation
3. **Promote the loop to an MCP tool**: `optimize()` in `loop.ts` has a clean interface — wrap it as a `server.tool()` in Founder OS to make the autoresearch loop a first-class discovery phase
