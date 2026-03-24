# Getting Started

This guide walks you through the entire demo from zero — installing tools, running the AI loop, and watching a plan get built into code.

**Estimated time:** 30 minutes (less if you skip the full pipeline and use mock mode).

---

> **New to terminals, AI, or MCP?** Read [CONCEPTS.md](CONCEPTS.md) first — it explains everything in plain English.

---

## Before you begin — checklist

- [ ] I have a Mac, Windows, or Linux computer
- [ ] I have an internet connection
- [ ] I have VS Code installed (or will install it below)

That's it. Everything else gets installed in the steps below.

---

## A note on multi-line commands

Several commands in this guide are long and are split across multiple lines using a backslash `\` at the end of each line. The `\` just means "this command continues on the next line." The whole block is **one single command**.

You can copy and paste the entire block at once — your terminal will run it as one command.

```bash
# This is one command split across 3 lines:
npx tsx src/autoresearch/main.ts \
  --idea-id test-idea \
  --iterations 3
```

---

## Step 1: Install VS Code

**VS Code** is the free code editor this demo runs inside.

1. Go to [code.visualstudio.com](https://code.visualstudio.com)
2. Click the download button for your operating system
3. Run the installer and follow the prompts

> **What is VS Code?** See [CONCEPTS.md → What is VS Code?](CONCEPTS.md#what-is-vs-code)

---

## Step 2: Install Node.js

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

## Step 3: Install Claude Code in VS Code

Claude Code is the AI assistant that lives inside your code editor.

1. Open **VS Code**
2. Click the **Extensions** icon on the left sidebar (it looks like four squares)
3. Search for **Claude Code**
4. Click **Install**

Once installed, you'll see a Claude icon in the sidebar. You can sign in with your Anthropic account or use it without signing in for basic features.

> **What is an extension?** See [CONCEPTS.md → What is an "extension" in VS Code?](CONCEPTS.md#what-is-an-extension-in-vs-code)

---

## Step 4: Get an Anthropic API key

> **Skip this step if you just want to try mock mode** (no API key needed). You can come back to this later.

1. Go to [console.anthropic.com](https://console.anthropic.com) and create a free account
2. In the dashboard, click **API Keys** in the left menu
3. Click **Create Key**, give it a name like `autoresearch-demo`
4. Copy the key — it starts with `sk-ant-...`

**Keep this key private.** Don't share it or commit it to git.

---

## Step 5: Download this project

**Option A — If you have git installed:**

Check if git is installed by running:

```bash
git --version
```

If you see a version number, run:

```bash
git clone https://github.com/your-username/autoresearch-pm-demo.git
cd autoresearch-pm-demo
```

**Option B — No git? Download the ZIP:**

1. Go to the project's GitHub page
2. Click the green **Code** button
3. Click **Download ZIP**
4. Unzip the downloaded file
5. You'll have a folder called `autoresearch-pm-demo`

Then open the folder in VS Code: **File → Open Folder** → select `autoresearch-pm-demo`.

---

## Step 6: Open a terminal inside VS Code

In VS Code, go to **Terminal → New Terminal** (or press Ctrl+backtick on Windows/Linux, Cmd+backtick on Mac).

A terminal panel will open at the bottom of the screen. It should show a prompt like:

```text
~/autoresearch-pm-demo $
```

This means you are inside the project folder and ready to run commands. The `$` just means "type your command here" — you don't type the `$` itself.

If the folder name in the prompt looks wrong, use **File → Open Folder** to reopen VS Code in the correct folder.

---

## Step 7: Install dependencies

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

## Step 8: Build the project

This translates the TypeScript source code into JavaScript so Node.js can run it.

```bash
npm run build
```

**Expected output:**

```text
(no output = success)
```

If you see errors, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md#cannot-find-module).

> **What does "build" mean?** TypeScript needs to be translated before it can run. `npm run build` does that translation and puts the result in a `dist/` folder. You only need to run this once (or again after making code changes). See [CONCEPTS.md → What is TypeScript?](CONCEPTS.md#what-is-typescript)
>
> **Want to start completely fresh?** Run `npm run clean` to delete both the `dist/` folder (compiled code) and the `artifacts/` folder (output from previous demo runs), then `npm run build` to rebuild. Think of it like clearing your browser's cache — old saved files can cause problems, and starting fresh fixes them.

```bash
npm run clean && npm run build
```

---

## Step 9: Try mock mode first (no API key needed)

Before connecting real AI, run the loop with fake data. This is a great way to see how the system works without spending any money.

```bash
npx tsx src/autoresearch/main.ts \
  --idea-id test-idea \
  --target-dir /tmp/demo-target \
  --iterations 3 \
  --mock
```

> **Reminder:** The `\` at the end of each line just means the command continues. Copy and paste the whole block.

**Expected output:**

```text
Autoresearch PM Demo — Epic Refinement Loop
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

The scores go up because mock mode uses scripted responses that improve each iteration. In real mode, the AI actually rewrites and improves the plan.

**Look at what was created.** Run this command to print the finished plan file:

```bash
cat /tmp/demo-target/test-idea-epic.md
```

> **What does `cat` do?** The `cat` command prints a file's contents to the screen. It's like opening a file in a text editor, but right in the terminal.

That's the finished plan file — readable text that a human or AI can understand.

---

## Step 10: Set up your API key (for real mode)

Copy the example environment file:

```bash
cp .env.example .env
```

> **What does `cp` do?** `cp` stands for "copy." This command copies `.env.example` and saves the copy as `.env`.
>
> **What is a `.env` file?** It's a file that stores private settings like your API key. Files that start with a dot (`.`) are hidden by default on Mac and Linux — you won't see them in Finder or File Explorer unless you enable "show hidden files." That's intentional: it keeps secrets out of plain sight.

Open `.env` in VS Code and replace the placeholder with your actual API key:

```text
ANTHROPIC_API_KEY=sk-ant-YOUR_ACTUAL_KEY_HERE
```

Save the file. The `.env` file is in `.gitignore`, which means git will never include it when you save or share your work.

---

## Step 11: Register the MCP server with Claude Code

This adds the three discovery tools to Claude Code so you can use them in Step 12.

**First, make sure you have your API key ready in `.env` from Step 10.**

Run this command:

```bash
claude mcp add autoresearch-demo \
  -e ANTHROPIC_API_KEY=$(grep ANTHROPIC_API_KEY .env | cut -d= -f2) \
  -s user \
  -- node "$(pwd)/dist/mcp/index.js"
```

> **What does this command do?** It registers the demo's MCP server with Claude Code. The `$(grep ...)` part automatically reads your API key from the `.env` file so you don't have to type it manually. The `$(pwd)` part inserts the full path to your current folder.
>
> If this command gives an error about the API key, double-check that your `.env` file is saved and contains your key with no extra spaces.

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

## Step 12: Discovery — Talk to the AI tools

Open Claude Code in VS Code (click the Claude icon in the sidebar, or open a chat panel).

You'll use three tools in order. Each one builds on the last. The same two-step pattern applies to all three:

1. **First call** — Claude asks you clarifying questions
2. **Second call** — you answer, Claude does the full analysis

---

### Tool 1: `validate_problem`

This tool stress-tests your idea. Call it first to get questions:

```text
Use validate_problem with problem_statement: "Developers can't tell which features in their app are actually being used"
```

Claude will respond with an `idea_id` that looks something like `feature-usage-abc123` and will ask you 3 focused questions. The `idea_id` is how the tools remember your work across calls — copy it from Claude's response.

Answer the questions in chat, then call it again with your answers:

```text
Use validate_problem with:
  idea_id: <paste the idea_id from Claude's first response here>
  proceed: true
  session_notes: "We have analytics showing 60% of features have almost no usage.
                  Developers check logs manually which takes hours.
                  The main workaround is quarterly review meetings."
```

**What to look for in the response:**

- `severity` — how serious is the problem? (1–10 scale)
- `worth_solving` — does the AI think it's worth building something?
- `gaps` — what's still unknown?

---

### Tool 2: `prioritize_opportunities`

This tool scores different ways to solve the problem. Same two-step pattern:

```text
Use prioritize_opportunities with:
  idea_id: <same idea_id>
  proceed: false
```

Answer the questions, then:

```text
Use prioritize_opportunities with:
  idea_id: <same idea_id>
  proceed: true
  session_notes: "Top ideas: (1) a usage dashboard, (2) weekly email digest, (3) inline code hints"
```

**What to look for:**

- `top_opportunity` — the one recommended approach
- ICE scores for each option — Impact (how much it helps), Confidence (how sure we are), Effort (how hard to build). Higher total = better bet.

---

### Tool 3: `define_epic`

This writes the first draft of the plan. It bridges Discovery and the Epic Refinement Loop.

```text
Use define_epic with:
  idea_id: <same idea_id>
  proceed: false
```

Answer questions, then:

```text
Use define_epic with:
  idea_id: <same idea_id>
  proceed: true
  session_notes: "Focus on the usage dashboard. Team: 2 engineers, 1 designer. Timeline: one quarter."
```

**The response includes a `next_step` field** — a terminal command to run the Epic Refinement Loop. Copy it. You'll use it in the next step.

You can also inspect the raw plan that was saved:

```bash
cat artifacts/epics/<your-idea-id>/raw.json
```

---

## Step 13: Epic Refinement Loop — Run the autoresearch loop

> **What does this cost?** Before the loop starts making API calls, it prints a cost estimate. For 3 iterations with the default model, expect less than $0.01. You'll be asked to confirm before anything is charged. You can always use `--mock` to test the full flow for free.

Paste the `next_step` command from Step 12 into your terminal. It looks like:

```bash
npx tsx src/autoresearch/main.ts \
  --idea-id <your-idea-id> \
  --target-dir /path/to/your-project/docs \
  --iterations 3
```

Replace `--target-dir` with a folder path where you want the final plan file saved. For example:

- Mac/Linux: `--target-dir ~/Desktop/my-output`
- Windows: `--target-dir C:\Users\YourName\Desktop\my-output`

The loop will print a cost estimate, ask you to confirm, then run 3 iterations. The best version gets saved to your target folder as `<idea-id>-epic.md`.

---

## Step 13a: Try git mode (optional — shows the full Karpathy pattern)

> **What is the Karpathy pattern?** It's the technique this whole project is built around — a loop that generates, scores, and commits/reverts automatically. See [CONCEPTS.md → What is autoresearch?](CONCEPTS.md#what-is-autoresearch) and [HOW_IT_WORKS.md → The Karpathy Pattern](HOW_IT_WORKS.md#the-karpathy-pattern-six-properties).

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

**What this shows:** Every attempt is recorded — even the ones that were thrown away. The revert entries show where the loop tried something, it didn't help, and it went back to the previous best. Read bottom to top: baseline → improved → discarded attempt → final best.

> **New to git?** See [CONCEPTS.md → What is a git commit?](CONCEPTS.md#what-is-a-git-commit)
> **Want the full explanation?** See [HOW_IT_WORKS.md → The Git Revert Pattern](HOW_IT_WORKS.md#the-git-revert-pattern)

---

## Step 13b: Try explore mode (optional — 3 framings, you pick the best)

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

**This is the core PM insight:** The system explored three genuinely different approaches and scored them all before you had to decide. You didn't write any of them — you just picked.

> **Want to understand the three framings?** See [HOW_IT_WORKS.md → Explore Mode](HOW_IT_WORKS.md#explore-mode-pre-decision-exploration)

---

## Step 14: Build — Build from the plan

Open the target project (the folder you pointed `--target-dir` at) in VS Code with Claude Code active.

In the Claude Code chat, run:

```text
/build-from-epic
```

Claude will:

1. Find the `*-epic.md` file in the `docs/` folder
2. Read the plan and summarize it
3. Create a task list
4. Start writing code

**What makes this work:**
 The plan file is structured with specific sections — outcome, scope, success metrics, dependencies. Claude uses those fields to understand exactly what to build and when it's done.

---

## Step 15: Code Quality Loop — improve the code

After the Build stage writes code, the Code Quality Loop applies the same Autoresearch pattern to the code itself: score it, improve it, repeat.

In Claude Code, run:

```text
/run-code-quality
```

Or run it directly in your terminal (replace the paths with your actual file locations):

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

## Step 16: Validation Loop — check the code against the epic

The validation loop closes the pipeline. It reads the success metrics from your epic and checks whether the code actually satisfies each one.

In Claude Code, run:

```text
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

**What this means:** Every success metric from the epic you wrote in Step 12 is now satisfied by the code. "Done" was defined by the plan — the validation loop confirmed it.

---

## What just happened?

Here's the whole pipeline in one sentence per stage:

| Stage | What happened |
| ----- | ------------- |
| Discovery | You described a problem, an AI asked clarifying questions, and together you produced a rough plan |
| Epic Refinement Loop | A program ran a loop (Autoresearch pattern): it rewrote the plan, scored it, and kept improving it until the score was high |
| Build | An AI read the finished plan and started writing real code |
| Code Quality | The same loop pattern improved the code: no security issues, clean types, tests present |
| Validation | The code was checked against the epic's success metrics — all passed |

Every step saved a file. You can open `artifacts/` to see every version of every plan and every code iteration. Nothing is hidden.

---

## Offline demo (no API key at all)

If you just want to explore the system without any account or API key, you already did this in Step 9. Mock mode runs the full Epic Refinement Loop with scripted responses — scores go 2 → 7 → 9 across three iterations.

You can also skip Discovery entirely and create a fake seed file. Run these two commands:

```bash
mkdir -p artifacts/epics/my-test/
```

> **What does `mkdir -p` do?** `mkdir` creates a new folder. The `-p` flag means "also create any parent folders that don't exist yet." So if `artifacts/epics/` doesn't exist, this command creates it along with `my-test/` inside it.

```bash
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

- **Try it on a real problem.** Write your own problem statement and run the full pipeline on something you actually care about.
- **Look at the artifacts.** Open the `artifacts/` folder in VS Code — you can see every version of every plan the loop generated.
- **Run more iterations.** Try `--iterations 10` and watch what happens to the scores.
- **Read how it works.** See [HOW_IT_WORKS.md](HOW_IT_WORKS.md) for a deep explanation of every design decision.
- **Hit a problem?** See [TROUBLESHOOTING.md](TROUBLESHOOTING.md).
