# Getting Started

This guide walks you through the entire demo from zero — installing tools, running the AI loop, and watching a plan get built into code.

**Estimated time:** 30 minutes (less if you skip the full pipeline and use mock mode).

---

> **New to terminals, AI, or MCP?** Read [CONCEPTS.md](CONCEPTS.md) first — it explains everything in plain English.

---

## Before you begin — checklist

- [ ] I have a Mac, Windows, or Linux computer
- [ ] I have an internet connection
- [ ] I have VS Code installed (or will install it in Step 1)

That's it. Everything else gets installed in the steps below.

---

## Step 1: Install Node.js

Node.js lets your computer run this project.

1. Go to [nodejs.org](https://nodejs.org)
2. Click the big green **LTS** button (LTS = Long Term Support = the stable version)
3. Run the installer and follow the prompts — click Next/Continue through everything

**Check it worked.** Open a terminal and type:

```bash
node --version
```

**Expected output:**

```text
v20.x.x   (any number 18 or higher is fine)
```

> **What's a terminal?** See [CONCEPTS.md → What is a terminal?](CONCEPTS.md#what-is-a-terminal)

If you see a version number, Node.js is installed. If you see an error, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md#node-command-not-found).

---

## Step 2: Install Claude Code in VS Code

Claude Code is the AI assistant that lives inside your code editor.

1. Open **VS Code**
2. Click the **Extensions** icon on the left sidebar (it looks like four squares)
3. Search for **Claude Code**
4. Click **Install**

Once installed, you'll see a Claude icon in the sidebar. You can sign in with your Anthropic account or use it without signing in for basic features.

---

## Step 3: Get an Anthropic API key

> **Skip this step if you just want to try mock mode** (no API key needed). You can come back to this later.

1. Go to [console.anthropic.com](https://console.anthropic.com) and create a free account
2. In the dashboard, click **API Keys** in the left menu
3. Click **Create Key**, give it a name like `autoresearch-demo`
4. Copy the key — it starts with `sk-ant-...`

**Keep this key private.** Don't share it or commit it to git.

---

## Step 4: Download this project

If you have git installed:

```bash
git clone https://github.com/your-username/autoresearch-pm-demo.git
cd autoresearch-pm-demo
```

Or download the ZIP from GitHub (click **Code → Download ZIP**), then unzip it and open the folder.

Open the folder in VS Code: **File → Open Folder** → select `autoresearch-pm-demo`.

---

## Step 5: Open a terminal inside VS Code

In VS Code, go to **Terminal → New Terminal** (or press Ctrl+` on Windows/Linux, Cmd+` on Mac).

A terminal panel will open at the bottom of the screen. Make sure you're in the project folder — you should see something like:

```text
~/autoresearch-pm-demo $
```

---

## Step 6: Install dependencies

This downloads all the code libraries the project needs.

```bash
npm install
```

**Expected output:** A long list of packages downloading. It ends with something like:

```text
added 123 packages in 5s
```

> **What is npm?** See [CONCEPTS.md → What is npm?](CONCEPTS.md#what-is-npm)

---

## Step 7: Build the project

This compiles the TypeScript source code into JavaScript that Node.js can run.

```bash
npm run build
```

**Expected output:**

```text
(no output = success)
```

If you see errors, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md#cannot-find-module).

> **What does "building" mean?** TypeScript is like a stricter version of JavaScript. Before running it, you "compile" it — translate it into plain JavaScript. The result goes into a `dist/` folder.

---

## Step 8: Try mock mode first (no API key needed)

Before connecting real AI, run the optimization loop with fake data. This is a great way to see how the system works without spending any money on API calls.

```bash
npx tsx src/autoresearch/main.ts \
  --idea-id test-idea \
  --target-dir /tmp/demo-target \
  --iterations 3 \
  --mock
```

**Expected output:**

```text
Autoresearch PM Demo — Layer 2: Optimization Loop
  idea: test-idea
  iterations: 3
  mode: mock

Iteration 1/3 ──────────────────────────────────────
  Score: 2/10

Iteration 2/3 ──────────────────────────────────────
  Score: 7/10  ✓ New best!

Iteration 3/3 ──────────────────────────────────────
  Score: 9/10  ✓ New best!

RESULT ──────────────────────────────────────────────
  score: 9/10
  Epic injected to: /tmp/demo-target/test-idea-epic.md
```

The scores go up because mock mode uses scripted fixtures that improve each iteration. In real mode, the AI actually rewrites and improves the plan.

**Look at what was created:**

```bash
cat /tmp/demo-target/test-idea-epic.md
```

That's the finished plan file — the output of Layer 2. It's readable text that a human or AI can understand.

---

## Step 9: Set up your API key (for real mode)

Copy the example environment file:

```bash
cp .env.example .env
```

Open `.env` in VS Code and replace `sk-ant-...` with your actual API key:

```text
ANTHROPIC_API_KEY=sk-ant-YOUR_ACTUAL_KEY_HERE
```

Save the file. The `.env` file is in `.gitignore` — it will never be committed to git.

---

## Step 10: Register the MCP server with Claude Code

This adds the three discovery tools to Claude Code so you can use them in Step 11.

In your terminal, run:

```bash
claude mcp add autoresearch-demo \
  -e ANTHROPIC_API_KEY=$(grep ANTHROPIC_API_KEY .env | cut -d= -f2) \
  -s user \
  -- node "$(pwd)/dist/mcp/index.js"
```

Then verify it registered:

```bash
claude mcp list
```

**Expected output:**

```text
autoresearch-demo   connected
```

> **What is MCP?** See [CONCEPTS.md → What is MCP?](CONCEPTS.md#what-is-mcp)

If you see `disconnected`, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md#mcp-server-disconnected).

---

## Step 11: Layer 1 — Talk to the AI tools

Open Claude Code in VS Code (click the Claude icon in the sidebar, or open a chat panel).

You'll use three tools in order. Each one builds on the last.

---

### Tool 1: `validate_problem`

This tool stress-tests your idea. First, call it without `proceed` to get questions:

```
Use validate_problem with problem_statement: "Developers can't tell which features in their app are actually being used"
```

Claude will ask you 3 focused questions. Answer them in the chat. Then call it again with your answers:

```
Use validate_problem with:
  idea_id: <the id from the first response>
  proceed: true
  session_notes: "We have analytics showing 60% of features have almost no usage.
                  Developers check logs manually which takes hours.
                  The main workaround is quarterly review meetings."
```

**What to look for in the response:**
- `severity` — how serious is the problem?
- `worth_solving` — does the AI think it's worth building something?
- `gaps` — what's still unknown?

---

### Tool 2: `prioritize_opportunities`

This tool scores different ways to solve the problem. Same two-step pattern:

```
Use prioritize_opportunities with:
  idea_id: <same id>
  proceed: false
```

Answer the questions, then:

```
Use prioritize_opportunities with:
  idea_id: <same id>
  proceed: true
  session_notes: "Top ideas: (1) a usage dashboard, (2) weekly email digest, (3) inline code hints"
```

**What to look for:**
- `top_opportunity` — the one recommended approach
- ICE scores for each option (Impact, Confidence, Effort)

---

### Tool 3: `define_epic`

This writes the first draft of the plan. It bridges Layer 1 and Layer 2.

```
Use define_epic with:
  idea_id: <same id>
  proceed: false
```

Answer questions, then:

```
Use define_epic with:
  idea_id: <same id>
  proceed: true
  session_notes: "Focus on the usage dashboard. Team: 2 engineers, 1 designer. Timeline: one quarter."
```

**The response includes a `next_step` field** — a terminal command to run Layer 2. Copy it.

You can also inspect the raw plan that was saved:

```bash
cat artifacts/epics/<your-idea-id>/raw.json
```

---

## Step 12: Layer 2 — Run the optimization loop

> **What does this cost?** Before the loop starts making API calls, it prints a cost estimate. For 3 iterations with the default model (claude-haiku), expect less than $0.01. You'll be asked to confirm before anything is charged. You can always use `--mock` to test the full flow for free.

Paste the `next_step` command from Step 11 into your terminal. It looks like:

```bash
npx tsx src/autoresearch/main.ts \
  --idea-id <your-idea-id> \
  --target-dir /path/to/your-project/docs \
  --iterations 3
```

Replace `--target-dir` with a real folder path where you want the final plan file saved.

The loop will print a cost estimate, ask you to confirm, then run 3 iterations with scores after each one. The best version gets injected into your target folder as `<idea-id>-epic.md`.

---

## Step 12a: Try git mode (optional — shows the full Karpathy pattern)

Add `--git-mode` to see every iteration committed to git, with reverts when the score drops.

```bash
npx tsx src/autoresearch/main.ts \
  --idea-id test-idea \
  --target-dir /tmp/demo-target \
  --iterations 3 \
  --mock \
  --git-mode
```

At the end of the run, you'll see the experiment log:

```text
Experiment log (git):
  abc1234  iteration 3: score 9/10 ✓ improvement: 7 → 9
  def5678  Revert "iteration 2: ..."  (score 5/10 — discarded)
  ghi9012  iteration 2: score 7/10 ✓ improvement: 2 → 7
  jkl3456  iteration 1: score 2/10 (baseline)
```

**What this shows:** Every attempt is recorded — even the ones that were thrown away. The revert entries show where the loop tried something, it didn't help, and it went back to the previous best version. This is the "experiment log as strategic asset": what failed tells you as much as what worked.

The git repo lives inside `artifacts/runs/`. You can explore it:

```bash
cd artifacts/runs/<run-id>
git log --oneline
```

> **New to git?** See [CONCEPTS.md → What is a git commit?](CONCEPTS.md#what-is-a-git-commit)
> **Want the full explanation?** See [HOW_IT_WORKS.md → The Git Revert Pattern](HOW_IT_WORKS.md#the-git-revert-pattern)

---

## Step 12b: Try explore mode (optional — 3 framings, you pick the best)

Add `--explore` to run three different strategic framings of the same problem side by side.

```bash
npx tsx src/autoresearch/main.ts \
  --idea-id test-idea \
  --target-dir /tmp/demo-target \
  --iterations 3 \
  --mock \
  --explore
```

After all three variations run, you'll see a comparison table:

```text
Variation comparison:
  #   Framing              Score   Title
  1   outcome-focused      9/10    Reduce Onboarding Drop-off...
  2   risk-focused         7/10    Streamline Onboarding with...
  3   metric-focused       8/10    Measurable Onboarding Improvement...

  Recommended: #1 (outcome-focused) scored highest.
  Which variation to inject? [1-3, Enter = 1]:
```

Press Enter to use the recommended variation, or type a number to pick a different one.

**This is the core PM insight:** The system explored three genuinely different approaches and scored them all before you had to decide. You didn't write any of them — you just picked. That's "pre-decision exploration under constraints."

> **Want to understand the three framings?** See [HOW_IT_WORKS.md → Explore Mode](HOW_IT_WORKS.md#explore-mode-pre-decision-exploration)

---

## Step 13: Layer 3 — Build from the plan

Open the target project (the folder you pointed `--target-dir` at) in VS Code with Claude Code active.

In the Claude Code chat, run:

```
/build-from-epic
```

Claude will:
1. Find the `*-epic.md` file in the `docs/` folder
2. Read the plan and summarize it
3. Create a task list
4. Start writing code

**What makes this work:** The plan file is structured with specific sections — outcome, scope, success metrics, dependencies. Claude uses those fields to understand *exactly* what to build and *when it's done*.

---

---

## Step 14: Code Quality Loop — improve the code

After Layer 3 writes code, the code quality loop applies the same autoresearch pattern to the code itself: score it, improve it, repeat.

In Claude Code, run:

```
/run-code-quality
```

Or run it directly in your terminal (replace paths):

```bash
npx tsx src/autoresearch/main.ts \
  --idea-id <your-idea-id> \
  --target-dir /path/to/your-project/docs \
  --target-file /path/to/your-project/src/your-feature.ts \
  --iterations 3 \
  --code-quality \
  --mock
```

**Expected output:**

```text
Autoresearch PM Demo — code-quality loop
  idea:       your-idea-id
  iterations: 3 (mock)

Iteration 0/3 ──────────────────────────────────────
  Criterion              Rule  LLM  Total  Note
  ────────────────────────────────────────────────────────────
  No Lint Errors           0     0    0    multiple 'any' types and TODO comments
  No Security Issues       0     0    0    uses eval() and innerHTML
  Readability              1     0    1    deeply nested logic
  Test Coverage Intent     0     0    0    no test patterns found
  Epic Alignment           –     1    1    code implements the feature
  ────────────────────────────────────────────────────────────
  Score: 2/10   Best: -1/10

Iteration 2/3 ──────────────────────────────────────
  Score: 9/10  ✓ New best!

CODE QUALITY RESULT ─────────────────────────────────────
  Final score: 9/10
  File updated: /path/to/your-feature.ts
```

The code file is updated in place with the best version found.

---

## Step 15: Validation Loop — check the code against the epic

The validation loop closes the pipeline. It reads the success metrics from your epic and checks whether the code actually satisfies each one.

In Claude Code, run:

```
/run-validation
```

Or run it directly (the `--validate` flag runs the code quality loop first, then validation):

```bash
npx tsx src/autoresearch/main.ts \
  --idea-id <your-idea-id> \
  --target-dir /path/to/your-project/docs \
  --target-file /path/to/your-project/src/your-feature.ts \
  --iterations 3 \
  --validate \
  --mock
```

**Expected output:**

```text
Step 1/2: Code Quality Loop ──────────────────────────────────────────
  ... (code quality iterations) ...
  Code quality complete: 9/10

Step 2/2: Validation Loop ────────────────────────────────────────────

  Validation iteration 0/3 ──────────────────────────────────────────

  Metric                                   Pass?  Note
  ─────────────────────────────────────────────────────────────────────
  Onboarding drop-off rate                 ✗ No   no analytics tracking found
  Time to first action                     ✗ No   no timing measurement found
  Feature discovery rate                   ✗ No   no tracking events
  User satisfaction score                  ✓ Yes  survey trigger found
  Support ticket volume                    ✓ Yes  error handling present
  ─────────────────────────────────────────────────────────────────────
  2/5 metrics passing   Score: 4/10

  Validation iteration 2/3 ──────────────────────────────────────────
  5/5 metrics passing   Score: 10/10  ✓ New best!

VALIDATION RESULT ─────────────────────────────────────────────────────
  All metrics pass! This code satisfies the epic.
```

**What this means:** Every success metric from the epic you wrote in Step 11 is now satisfied by the code. "Done" was defined by the plan — the validation loop confirmed it.

---

## What just happened?

Here's the whole pipeline in one sentence per stage:

| Stage | What happened |
| ----- | ------------- |
| Layer 1 | You described a problem, an AI asked clarifying questions, and together you produced a rough plan |
| Layer 2 | A program ran a loop: it rewrote the plan, scored it, and kept improving it until the score was high |
| Layer 3 | An AI read the finished plan and started writing real code |
| Code Quality | The same loop pattern improved the code: no security issues, clean types, tests present |
| Validation | The code was checked against the epic's success metrics — all passed |

Every step saved a file. You can open `artifacts/` to see every version of every plan and every code iteration. Nothing is hidden.

---

## Offline demo (no API key at all)

If you just want to explore the system without any account or API key, you already did this in Step 8. Mock mode runs the full Layer 2 loop with scripted responses — scores go 2 → 7 → 9 across three iterations.

You can also skip Layer 1 entirely and create a fake seed file:

```bash
mkdir -p artifacts/epics/my-test/
cp artifacts/epics/test-idea/raw.json artifacts/epics/my-test/raw.json
```

Then run:

```bash
npx tsx src/autoresearch/main.ts \
  --idea-id my-test \
  --target-dir /tmp/output \
  --iterations 3 \
  --mock
```

---

## Next steps

- Read the source code in `src/autoresearch/evaluator.ts` to see exactly how plans are scored
- Try changing `--iterations` to 5 or 10 and watch the scores plateau
- Try writing your own problem statement and running the full pipeline
- See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) if anything went wrong
