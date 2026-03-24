# Troubleshooting

Common errors and how to fix them.

---

## `node: command not found`

**What it means:** Node.js isn't installed, or your terminal can't find it.

**Fix:**

1. Go to [nodejs.org](https://nodejs.org) and install the LTS version
2. After installing, **close and reopen** your terminal — the old one won't see the new installation
3. Run `node --version` again

If it still fails on Mac, try: `which node` — if that returns nothing, Node wasn't added to your PATH during install.

> **What is PATH?** PATH is a list of folders your terminal searches when you type a command. When you type `node`, your terminal looks through those folders to find the Node.js program. If Node.js wasn't added to PATH during install, the terminal can't find it even though it's there. Reinstalling usually fixes this automatically.

---

## `ANTHROPIC_API_KEY not set` or `401 Unauthorized`

**What it means:** The program can't find your API key, or the key is wrong.

**Fix:**

1. Make sure you created a `.env` file: `cp .env.example .env`
2. Open `.env` in VS Code and confirm it looks like this (with your real key):

   ```text
   ANTHROPIC_API_KEY=sk-ant-abc123...
   ```

3. Make sure there are no extra spaces or quotes around the key
4. Make sure you're running the command from the project folder (where `.env` lives)

---

## MCP server disconnected

**Symptom:** Running `claude mcp list` shows `autoresearch-demo   disconnected`.

**Most common cause:** The project hasn't been built yet, so `dist/mcp/index.js` doesn't exist.

**Fix:**

```bash
npm run build
```

Then try `claude mcp list` again. If it's still disconnected:

**Step 1 — Check the registered path.** Run this to see what path was registered:

```bash
claude mcp list --verbose
```

It should show the full path to `dist/mcp/index.js` inside your project folder. If the path looks wrong (wrong folder, missing `/dist/`), remove and re-add the server:

**Step 2 — Remove and re-add:**

```bash
claude mcp remove autoresearch-demo
```

Then re-add it (make sure you're in the project folder when you run this):

```bash
claude mcp add autoresearch-demo \
  -e ANTHROPIC_API_KEY=$(grep ANTHROPIC_API_KEY .env | cut -d= -f2) \
  -s user \
  -- node "$(pwd)/dist/mcp/index.js"
```

> **What does `$(pwd)` do?** `pwd` prints your current folder path. `$(pwd)` inserts that path into the command automatically. This ensures the registration always points to the correct absolute location of the file.

---

## `Cannot find module` or `ERR_MODULE_NOT_FOUND`

**What it means:** The compiled JavaScript files in `dist/` are missing or out of date.

**Fix:**

```bash
npm run build
```

If that shows TypeScript errors, look at the error message — it usually points to the exact file and line number. Common cause: a dependency wasn't installed. Run `npm install` first, then `npm run build`.

---

## The autoresearch loop crashes with a JSON parse error

**What it means:** The AI returned something that couldn't be parsed as a valid plan structure.

**Why it happens:** AI outputs aren't always identical — the same prompt can produce slightly different results each time. Sometimes (especially with faster, smaller models) the output format isn't quite right.

**Fix:**

1. Try running again — it often succeeds on a second attempt
2. Switch to a more capable model in `.env`:

   ```text
   MODEL=claude-sonnet-4-6
   ```

3. Make sure your `raw.json` seed file is valid. Open it in VS Code — if the content looks garbled or truncated, that's the problem. Re-run `define_epic` to regenerate it.

---

## The score doesn't improve across iterations

**What it means:** The AI keeps getting similar or worse scores each iteration.

**This is expected behavior at high scores.** Once a plan scores 8 or 9 out of 10, there isn't much left to improve.

**If the score is stuck at a low number (below 5):**

- The seed plan from Discovery may be too vague. Go back and run `define_epic` again with more specific answers in `session_notes`.
- Open `artifacts/epics/<id>/iteration_0.json` in VS Code. Look for the section called `improvementHints` — it lists exactly what the evaluator told the next iteration to fix. If those hints are vague ("improve clarity"), the improvements will be vague too. More specific session notes produce more specific hints.

---

## Mock mode output looks wrong

**Symptom:** Mock mode shows unexpected scores or crashes.

**Fix:**

- Make sure you're passing `--mock` flag
- Make sure `--idea-id` is `test-idea` (mock mode uses pre-written fixture data for this specific ID)
- Delete the old mock artifacts and try fresh:

  ```bash
  rm -rf artifacts/epics/test-idea/
  ```

  > **Warning:** `rm -rf` permanently deletes a folder and everything inside it — there is no undo. The command above only deletes the mock test artifacts inside `artifacts/epics/test-idea/`. Do not modify the path unless you are certain about what you're deleting.

---

## `claude: command not found`

**What it means:** Claude Code CLI isn't installed or isn't in your PATH.

**Fix:** Install Claude Code from VS Code (Extensions → search "Claude Code") or follow the setup in [GETTING_STARTED.md#step-3-install-claude-code-in-vs-code](GETTING_STARTED.md#step-3-install-claude-code-in-vs-code). The `claude` CLI command becomes available after installing the extension.

---

## The `/build-from-epic` command does nothing

**What it means:** Claude Code can't find the epic markdown file, or the command wasn't registered.

**Fix:**

1. Make sure the `*-epic.md` file exists in the `docs/` folder of your **target project** (not this demo project)
2. Make sure you're running `/build-from-epic` in a Claude Code session that has access to that project folder
3. Check that `.claude/commands/build-from-epic.md` exists in this demo project — it should have been included when you cloned/downloaded the project

---

## Something else went wrong

1. Check the terminal output for the exact error message — it usually tells you the file and line number
2. Make sure you're in the right folder. Run `pwd` to see your current folder path — it should end with `autoresearch-pm-demo`
3. Try a clean reinstall:

   ```bash
   rm -rf node_modules dist
   npm install
   npm run build
   ```

   > **What does this do?** `rm -rf node_modules dist` deletes the downloaded packages folder and the compiled output folder. `npm install` re-downloads everything fresh. `npm run build` recompiles. This fixes most "something is broken and I don't know why" situations.
