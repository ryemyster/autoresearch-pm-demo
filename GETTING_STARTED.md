# Getting Started

A complete walkthrough of one run through all three layers.

---

## Prerequisites

- Node.js >= 18
- An Anthropic API key (or use `--mock` for offline demo)
- Claude Code CLI (`claude`) with the MCP server registered

---

## 1. Install and Build

```bash
cd /Users/rmcdonald/Repos/Brainstorming/autoresearch/autoresearch-pm-demo
npm install
npm run build
```

The build outputs `dist/mcp/index.js` — this is the MCP server binary.

---

## 2. Register the MCP Server

```bash
claude mcp add autoresearch-demo \
  -e ANTHROPIC_API_KEY=sk-ant-YOUR_KEY \
  -s user \
  -- node /Users/rmcdonald/Repos/Brainstorming/autoresearch/autoresearch-pm-demo/dist/mcp/index.js

claude mcp list
# autoresearch-demo  connected
```

Verify in VS Code: Command Palette → `MCP: List Servers` → `autoresearch-demo` should show **Running**.

---

## 3. Layer 1 — Discovery (MCP Tools)

Open Claude Code and use the three discovery tools in order.

### Tool 1: `validate_problem`

Call without `proceed` to get preflight questions:

```
validate_problem(
  problem_statement: "Enterprise PMs can't tell which features are actually driving retention vs. just being used"
)
```

You'll get back 3 focused questions. Answer them in conversation, then:

```
validate_problem(
  idea_id: "<id from first call>",
  proceed: true,
  session_notes: "We have data showing 40% of features have <5 weekly active users.
                  PMs currently use Mixpanel but only 30% actually check it weekly.
                  Main workaround is quarterly eng reviews which take 2 days."
)
```

**What to observe:**
- The preflight identifies what's missing before analysis runs — no wasted LLM calls
- `validated_problem.severity` and `worth_solving` are explicit — not hidden inside a wall of text
- `next_template` path is written to `artifacts/working/` automatically

---

### Tool 2: `prioritize_opportunities`

Pick up where validate_problem left off:

```
prioritize_opportunities(
  idea_id: "<same id>",
  proceed: false
)
```

Get questions, answer them, then:

```
prioritize_opportunities(
  idea_id: "<same id>",
  proceed: true,
  session_notes: "Top opportunities we see: (1) better feature flag visibility,
                  (2) automated retention correlation report, (3) Slack digest."
)
```

**What to observe:**
- ICE scores are explicit — you can see why one opportunity beats another
- `top_opportunity` is a single, specific string — not a list

---

### Tool 3: `define_epic`

This is the bridge to Layer 2:

```
define_epic(
  idea_id: "<same id>",
  proceed: false
)
```

Then with answers:

```
define_epic(
  idea_id: "<same id>",
  proceed: true,
  session_notes: "Focus on the automated retention correlation report.
                  Team size: 2 engineers + 1 designer. Quarter timeline."
)
```

**What you get back:**

```json
{
  "epic": { "title": "...", "outcome": "...", "scope": {...}, ... },
  "epic_path": "artifacts/epics/enterprise-pm-retention-abc123/raw.json",
  "next_step": "Layer 1 complete. Raw epic saved to: ...\n\nNext → Run the autoresearch loop:\n  npx tsx src/autoresearch/main.ts --idea-id enterprise-pm-retention-abc123 ..."
}
```

**The `next_step` field is the handoff.** Copy the command and run it.

**Inspect the raw epic before running Layer 2:**

```bash
cat artifacts/epics/enterprise-pm-retention-abc123/raw.json
```

This is what the autoresearch loop starts from. It already has structure because the MCP tools built it from validated research — not from scratch.

---

## 4. Layer 2 — Autoresearch Loop

Run the CLI with the idea ID from Layer 1:

```bash
npx tsx src/autoresearch/main.ts \
  --idea-id enterprise-pm-retention-abc123 \
  --target-dir /path/to/your-project/docs \
  --iterations 3
```

**What you see:**

```
Autoresearch PM Demo — Layer 2: Optimization Loop
  idea: enterprise-pm-retention-abc123
  iterations: 3

Iteration 1/3 ─────────────────────────────────────────────────────
  Generating epic... Evaluating...

  Criterion              Rule  LLM  Total  Note
  ─────────────────────────────────────────────────────────────────
  Outcome Clarity          1    0    1    "outcome doesn't name a user segment"
  Bounded Scope            0    0    0    "no out-of-scope items"
  Measurable Success       1    0    1    "targets exist but are vague"
  Dependency Clarity       1    1    2    ✓
  Actionability            –    0    0    "unclear what 'correlation' means technically"
  ─────────────────────────────────────────────────────────────────
  Score: 4/10   Best so far: 4/10

  Hints for next iteration:
  → Rewrite outcome to name a specific user segment...
  → Add an explicit 'out' list...
  → Replace vague targets with specific numbers...

Iteration 2/3 ─────────────────────────────────────────────────────
  ...
  Score: 7/10   Best so far: 7/10  ✓ New best!

Iteration 3/3 ─────────────────────────────────────────────────────
  ...
  Score: 9/10   ✓ New best!

RESULT ─────────────────────────────────────────────────────────────
  "Automated Retention Correlation Report for Enterprise PMs"
  outcome: Reduce time for enterprise PMs to identify retention-driving features...
  score: 9/10

  Artifacts saved to: artifacts/epics/enterprise-pm-retention-abc123/
  Epic injected to: /path/to/your-project/docs/enterprise-pm-retention-abc123-epic.md

  Layer 3 → In your target project, run: /build-from-epic
```

---

## 5. Inspect the Iteration Files

```bash
# What did the loop change between iterations?
cat artifacts/epics/enterprise-pm-retention-abc123/iteration_0.json | python3 -m json.tool | head -40
cat artifacts/epics/enterprise-pm-retention-abc123/iteration_2.json | python3 -m json.tool | head -40
```

Each `iteration_N.json` contains:
- `epic` — the full Epic struct
- `result.criteria` — per-criterion rule/LLM scores with rationales
- `result.improvementHints` — the exact strings passed to the next iteration
- `isBest` — whether this was the best score seen so far

The hints in `iteration_0.result.improvementHints` should appear addressed in `iteration_1.epic`.
That's the loop working.

```bash
# Summary of the run
cat artifacts/epics/enterprise-pm-retention-abc123/manifest.json
# { "finalScore": 9, "initialScore": 4, "improvementDelta": 5, "injectedPath": "..." }
```

---

## 6. Check the Injected File

```bash
cat /path/to/your-project/docs/enterprise-pm-retention-abc123-epic.md
```

This is a structured markdown file with all fields from the best Epic. It's readable by a human and by Claude Code's `/build-from-epic` skill.

---

## 7. Layer 3 — Build from Epic

In your target project (not this demo project), open Claude Code and run:

```
/build-from-epic
```

Claude Code will:
1. Find the injected `*-epic.md` file in `docs/`
2. Summarize the epic (title, outcome, top scope items)
3. Identify the first buildable unit from `success_metrics[0]`
4. Create a task list
5. Begin implementing

**What to observe:**
- The build skill reads a structured artifact — not a free-text description
- The `success_metrics` field tells Claude how to know when it's done
- The `out` scope items prevent it from building things that are explicitly deferred

---

## 8. End-to-End Reflection

| Layer | Who drives it | Input | Output | Handoff mechanism |
|-------|---------------|-------|--------|-------------------|
| 1: MCP | Human (preflight/proceed) | Problem statement | `raw.json` Epic seed | `next_step` CLI command |
| 2: Autoresearch | Automated (N iterations) | `raw.json` | `{id}-epic.md` in target project | `inject_artifact()` |
| 3: Build | Claude Code (skill) | `{id}-epic.md` | Implementation | `/build-from-epic` |

Each layer has a clear input, output, and boundary. The handoff is always a file — inspectable, diffable, and independent of session state.

---

## Offline Demo (No API Key)

```bash
# Layer 2 only — mock fixtures, no API calls
npx tsx src/autoresearch/main.ts \
  --idea-id test-idea \
  --target-dir /tmp/demo-target \
  --iterations 3 \
  --mock

# Verify the injected file
cat /tmp/demo-target/test-idea-epic.md
```

Mock mode uses deterministic fixtures that score 2→7→9 across 3 iterations. Useful for demos and understanding the loop structure without API costs.
