# For Developers

This file is for people who want to understand how this project is built, extend it, or build something like it.

> **Reading guide:** If you're new to the project, start with [HOW_IT_WORKS.md](HOW_IT_WORKS.md) first. Come back here when you want to go deeper.

---

## In this file

| Topic | Jump to |
| ----- | ------- |
| Writing and maintaining evals | [→ below](#writing-and-maintaining-evals) |
| Git scope — why not the project root? | [→ below](#git-scope-why-not-the-project-root) |
| MCP tool design patterns | [→ below](#mcp-tool-design-patterns) |
| Code annotations — which file implements what | [→ below](#code-annotations-which-file-implements-which-concept) |

---

## Writing and Maintaining Evals

The evaluator is the most important file in the project. Everything else exists to feed it.

### The two-check pattern

Every criterion uses two checks:

1. **Rule check** — deterministic, no API call. Examples: "does this array have 2+ items?", "does this string contain a number?" These are fast, free, and consistent.

2. **LLM check** — semantic, one batched Claude call for all 5 criteria at once. Examples: "is the outcome statement specific enough to name a user segment AND a measurable change?" This catches things a rule can't express.

The two scores are added: `ruleScore (0 or 1) + llmScore (0 or 1) = total (0, 1, or 2)`. 5 criteria × 2 points each = 10 total.

**Why two checks?** Rule checks are fast but shallow. LLM checks are deep but variable. Combining them gives you a score that's anchored in objective structure AND semantic quality — and it makes the score harder to game. A plan that sounds great but has no numeric targets fails the rule check. A plan that has three numbers but none tied to a user outcome fails the LLM check.

### The batched LLM call

Rather than making one API call per criterion (5 calls per iteration), the evaluator makes **one call** and returns all 5 scores as a structured JSON object. See `src/autoresearch/evaluator.ts`.

The LLM scoring prompt is the single most important text in the project. If the prompt is vague, scores become vague. Before changing it, read the full prompt and understand what each criterion is actually checking.

### How to add a new criterion

The evaluator is intentionally hardcoded — the loop can't touch it. To add a new criterion:

1. Add it to the `CRITERIA` array in `src/autoresearch/evaluator.ts`
2. Add a rule check function
3. Add the criterion key to `LLMScoringResponse` in `src/shared/types/index.ts`
4. Update the LLM prompt to include the new criterion
5. Update the max score references (currently 10) wherever they appear

Criteria should be:
- **Externally derivable** — could a stakeholder verify this without reading the code? If yes, it's a good criterion.
- **Specific** — "is actionable" is not a criterion. "Has 3+ concrete deliverables AND engineer-ready detail" is.
- **Written before the loop** — never generate criteria from inside the loop. That's failure mode #2 from [HOW_IT_WORKS.md](HOW_IT_WORKS.md).

### Why scores above 8 are rare

The LLM scorer is explicitly instructed to be conservative. A score of 8/10 means "genuinely good." A score of 10/10 means "this epic is ready to hand to an engineering team." The `actionability` criterion is the hardest — it requires both 3+ concrete deliverables (rule check) and engineer-ready detail (LLM check). Most generated epics are too abstract to pass both.

---

## Git Scope: Why Not the Project Root?

When you enable `--git-mode`, a git repository is created inside `artifacts/git-runs/{run-id}/` — **not in the project root folder.**

Why?

1. **The project might already be a git repo.** If it is, creating a nested git repo inside it causes problems — git gets confused about which repo owns which files.

2. **Each experiment's history should be self-contained.** If you delete `artifacts/git-runs/my-run-123/`, the git history for that run goes with it. Clean, contained, disposable.

3. **Only `candidate.json` is tracked.** The git repo inside the run folder only ever contains `candidate.json`. The iteration log files, manifests, and everything else are in `artifacts/epics/{id}/` — outside git's scope. This mirrors the pattern exactly: one file tracked, everything else untracked.

The implementation is in `src/autoresearch/git.ts`. The loop passes the `runDir` path and git operations are scoped to it.

---

## MCP Tool Design Patterns

The Discovery stage uses three MCP tools (`validate_problem`, `prioritize_opportunities`, `define_epic`). How you design tools determines how reliably an AI agent uses them.

The best reference for MCP tool design is **[arcade.dev/patterns](https://www.arcade.dev/patterns)**. Their guiding principle:

> *"Your agents are only as good as your tools."*

Well-designed tools keep orchestration simple. Poorly designed tools force the agent to guess — which it does inconsistently. This project demonstrates five patterns from the Arcade catalog.

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

## Code Annotations: Which File Implements Which Concept

This is a reference table mapping concepts to their source files.

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
| Claude API wrapper + per-stage routing | `src/shared/claude.ts` |
| Per-stage model config + resolvers | `src/models/config.ts` |
| RAG retriever + backends | `src/rag/retriever.ts`, `src/rag/backends/` |
| RAG config (lazy singleton, Zod schema) | `src/rag/config.ts` |
| Data shapes for all concepts | `src/shared/types/index.ts` |
| Discovery MCP tools | `src/mcp/tools/` |
| Build skill | `.claude/commands/build-from-epic.md` |
| Code quality skill | `.claude/commands/run-code-quality.md` |
| Validation skill | `.claude/commands/run-validation.md` |
