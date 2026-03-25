# Features

This file covers every major feature of the autoresearch-pm-demo — what it does, why it exists, and how to use it.

> **Reading guide:** This is the feature reference. For the core concepts (governance model, Karpathy pattern) see [HOW_IT_WORKS.md](HOW_IT_WORKS.md). For developer deep-dives (evals, MCP tool design, code annotations) see [FOR_DEVELOPERS.md](FOR_DEVELOPERS.md).

---

## In this file

| Feature | Jump to |
| ------- | ------- |
| Single File Pattern | [→ below](#the-single-file-pattern) |
| Git Revert Pattern | [→ below](#the-git-revert-pattern) |
| Explore Mode | [→ below](#explore-mode-pre-decision-exploration) |
| Token Costs and Iteration Limits | [→ below](#token-costs-and-iteration-limits) |
| The Code Quality Loop | [→ below](#the-code-quality-loop) |
| The Validation Loop | [→ below](#the-validation-loop) |
| RAG Integration | [→ below](#rag-integration) |
| Per-Stage Model Routing | [→ below](#per-stage-model-routing) |

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

| Epic Refinement Loop | Code Quality Loop |
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

---

## RAG Integration

RAG stands for **Retrieval-Augmented Generation**. It is a way to give the AI access to your own documents — past epics, meeting notes, product specs, retrospectives — so it can use them when generating and scoring new epics.

Think of it like having a really smart assistant who has read every document your team has ever written. Instead of starting from scratch every time, it can say: "Hey, I remember we tried something like this last quarter — here's what worked and what didn't."

### Why RAG helps

Without RAG, the AI generates epics based only on what you tell it in the current session. With RAG:
- It can pull in your company's past epics as examples
- It can reference team decisions or constraints from previous docs
- It can avoid repeating mistakes from past projects

The result is epics that are grounded in your actual history — not generic best-practice templates.

### How RAG works (simply)

1. **Index your documents** — you run a one-time step that reads your docs and stores them in a vector store (a special database for text)
2. **Each iteration, retrieve** — before generating or scoring, the loop searches the vector store for the most relevant chunks (pieces of your docs)
3. **Inject into context** — those chunks are added to the prompt: "here is relevant background from your past work"
4. **Generate with context** — the AI generates a better epic because it has more information to work with

> **What is a vector store?** When you store text in a regular database, you can only search by exact words. A vector store converts text into numbers (called "embeddings") that capture the *meaning* of the text. So searching for "user onboarding" can also find "new user setup flow" even if those exact words don't appear. Two sentences that mean the same thing will have similar numbers — and the vector store finds them as matches.

### Supported backends

| Backend | What it is | Best for |
| ------- | ---------- | -------- |
| `chroma` | Local, runs on your machine | Development, privacy-sensitive projects |
| `pinecone` | Cloud-hosted, managed service | Teams, production use |

### How to set it up

1. **Add your documents** — drop `.md`, `.txt`, or `.json` files into `artifacts/rag-source/`
2. **Index them** — run `npx tsx src/rag/index-docs.ts`
3. **Run with RAG** — add `--rag` to your autoresearch command:

```bash
npx tsx src/autoresearch/main.ts \
  --idea-id my-idea \
  --target-dir ./docs \
  --iterations 3 \
  --rag
```

The manifest (`manifest.json`) records `ragEnabled`, `ragBackend`, and `ragChunksRetrieved` so you can compare RAG vs non-RAG runs.

### What gets retrieved

On each iteration, the retriever finds the 5 most semantically similar chunks to the current epic. These are injected into both the generator prompt (to improve the epic) and the evaluator prompt (to score it with context).

You can tune the number of chunks retrieved with the `RAG_TOP_K` environment variable.

---

## Per-Stage Model Routing

### The big idea: different roles, different hires

Think of a movie. The director doesn't use the same actor for every role. The lead actor gets paid the most because their performance carries the film. The background extras are fine being fast and cheap — they just need to look right.

This pipeline has two kinds of roles:

- **Generators** (lead actors): They write the actual output — improved epics, improved code. Quality matters. A better model writes a better plan.
- **Evaluators** (background extras): They score the output against fixed criteria. They just need to be consistent and fast — they don't need to be creative.

Per-stage routing lets you assign a **different model to each role**. Use a frontier model for generators. Use a fast, cheap model (or your own custom SLM) for evaluators. Same results, lower cost.

### Why this matters

**Cost savings:** Evaluators run on every single iteration. If you do 100 iterations with all-Sonnet, you're paying for Sonnet on 100 scoring calls. With routing, those calls use Haiku — or your own local model that costs nothing per call.

| Setup | Generator | Evaluator | Est. cost/100 iterations |
| ----- | --------- | --------- | ------------------------- |
| All-Haiku (default) | Haiku | Haiku | ~$0.10 |
| Hybrid LLM | Sonnet | Haiku | ~$0.55 |
| All-Sonnet | Sonnet | Sonnet | ~$1.00 |
| LLM + local SLM | Sonnet | local SLM | ~$0.50 + $0 |
| All-local SLM | local SLM | local SLM | $0 |

**Custom SLM tuning:** If your company has a model fine-tuned on your own epics, your product language, your team's conventions — that model will write better epics than a general-purpose cloud model. It knows your domain. Point `epic_generator` at it and every generated epic reflects your specific context.

**Privacy / compliance:** Some teams can't send internal product plans to a cloud API. A local SLM (running on your own server) solves this. With per-stage routing, you can run sensitive stages locally and non-sensitive stages in the cloud — or run everything locally.

**Experimentation:** Swap one stage to a new model, run 10 iterations, compare the `modelMap` in the manifest. You know exactly what changed.

### The 6 stages

| Stage key | What it does | Recommended: quality runs | Recommended: budget runs |
| --------- | ------------ | ------------------------- | ------------------------- |
| `epic_generator` | Writes improved epics | Sonnet or Opus | Haiku or custom SLM |
| `epic_evaluator` | Scores epics 0-10 | Haiku | Haiku or local SLM |
| `code_generator` | Writes improved code | Sonnet or Opus | Haiku or custom SLM |
| `code_evaluator` | Scores code 0-10 | Haiku | local SLM |
| `validation` | Checks success metrics | Haiku | local SLM |
| `mcp_discovery` | MCP Discovery tools | Haiku | Haiku |

### The 4 usage patterns

**Pattern 1: All-cloud, single model (the default)**

Zero config. Ships out of the box. Great for getting started.

```json
{
  "default": "claude-haiku-4-5-20251001",
  "stages": {}
}
```

**Pattern 2: Hybrid LLM — better generators, cheap evaluators**

Pays for quality where it matters, saves on scoring calls. 40–60% cheaper than all-Sonnet with no quality loss on evaluation.

```json
{
  "default": "claude-haiku-4-5-20251001",
  "stages": {
    "epic_generator": { "model": "claude-sonnet-4-6" },
    "code_generator": { "model": "claude-sonnet-4-6" }
  }
}
```

**Pattern 3: Cloud generators + local SLM evaluators**

Best of both worlds: frontier model for writing, your own fine-tuned model for scoring. Evaluator calls become free after the SLM is set up. The `baseUrl` points to any OpenAI-compatible endpoint (Ollama, vLLM, a company inference server, etc.).

```json
{
  "default": "claude-haiku-4-5-20251001",
  "stages": {
    "epic_generator":  { "model": "claude-sonnet-4-6" },
    "epic_evaluator":  { "model": "my-eval-slm", "baseUrl": "http://localhost:11434/v1", "apiKey": "none" },
    "code_generator":  { "model": "claude-sonnet-4-6" },
    "code_evaluator":  { "model": "my-eval-slm", "baseUrl": "http://localhost:11434/v1", "apiKey": "none" },
    "validation":      { "model": "my-eval-slm", "baseUrl": "http://localhost:11434/v1", "apiKey": "none" }
  }
}
```

**Pattern 4: Fully air-gapped — all stages on a local SLM**

Nothing leaves your network. Useful when internal IP or compliance rules prohibit cloud APIs. Set `defaultBaseUrl` once and all stages use it.

```json
{
  "default": "my-pm-tuned-llama",
  "defaultBaseUrl": "http://localhost:11434/v1",
  "defaultApiKey": "none",
  "stages": {}
}
```

### How to set it up (3 steps)

1. **Copy the example file:**
   ```bash
   cp models.config.json.example models.config.json
   ```

2. **Edit `models.config.json`** — pick the pattern that fits your situation. The example file has comments for each pattern.

3. **Run with `--models`:**
   ```bash
   npx tsx src/autoresearch/main.ts \
     --idea-id my-idea \
     --target-dir ./docs \
     --iterations 3 \
     --models
   ```

Without `--models`, the routing config is ignored — the demo behaves exactly as before.

### Reading the manifest

After a `--models` run, open `artifacts/epics/{id}/manifest.json`. You'll see:

```json
{
  "modelsEnabled": true,
  "modelMap": {
    "epic_generator": "claude-sonnet-4-6",
    "epic_evaluator": "claude-haiku-4-5-20251001",
    "code_generator": "claude-sonnet-4-6",
    "code_evaluator": "claude-haiku-4-5-20251001",
    "validation": "claude-haiku-4-5-20251001",
    "mcp_discovery": "claude-haiku-4-5-20251001"
  }
}
```

This is a permanent record of exactly which model ran each stage. Compare manifests across runs to know what changed.

### Overriding with environment variables

You can override any stage without touching `models.config.json`:

```bash
MODEL_EPIC_GENERATOR=claude-opus-4-6 npx tsx src/autoresearch/main.ts --models ...
```

Env vars always win over config file values. Useful for CI or one-off experiments.

| Env var | What it overrides |
| ------- | ----------------- |
| `MODEL_EPIC_GENERATOR` | epic_generator model |
| `MODEL_EPIC_EVALUATOR` | epic_evaluator model |
| `MODEL_CODE_GENERATOR` | code_generator model |
| `MODEL_CODE_EVALUATOR` | code_evaluator model |
| `MODEL_VALIDATION` | validation model |
| `MODEL_MCP_DISCOVERY` | mcp_discovery model |
| `BASE_URL_EPIC_GENERATOR` | epic_generator endpoint |
| `MODEL_DEFAULT` | default model (all stages without explicit config) |
| `DEFAULT_BASE_URL` | default endpoint |

> **[For developers]** Resolution priority, highest to lowest: stage env var → stage config in `models.config.json` → `defaultBaseUrl`/`defaultApiKey` → global `MODEL` / `ANTHROPIC_API_BASE` env vars → hardcoded Haiku. Client caching: one `Anthropic` client is created per unique `baseUrl|apiKey` combination and cached — stages sharing the same endpoint share a client object. Implementation: `src/models/config.ts` (resolvers) and `src/shared/claude.ts` (dispatch).
