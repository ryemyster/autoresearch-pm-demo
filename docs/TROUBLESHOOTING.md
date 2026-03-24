# Troubleshooting

Common errors and how to fix them.

---

## `node: command not found`

**What it means:** Node.js isn't installed, or your terminal can't find it.

**Fix:**
1. Go to [nodejs.org](https://nodejs.org) and install the LTS version
2. After installing, **close and reopen** your terminal — the old one won't see the new installation
3. Run `node --version` again

If it still fails on Mac, try: `which node` — if that returns nothing, Node wasn't added to your PATH during install. Reinstalling usually fixes this.

---

## `ANTHROPIC_API_KEY not set` or `401 Unauthorized`

**What it means:** The program can't find your API key, or the key is wrong.

**Fix:**
1. Make sure you created a `.env` file: `cp .env.example .env`
2. Open `.env` and confirm it looks like this (with your real key):
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

1. Check the path in your mcp registration. It should point to the absolute path of `dist/mcp/index.js` in this project folder.
2. Remove and re-add the server:
   ```bash
   claude mcp remove autoresearch-demo
   claude mcp add autoresearch-demo \
     -e ANTHROPIC_API_KEY=$(grep ANTHROPIC_API_KEY .env | cut -d= -f2) \
     -s user \
     -- node "$(pwd)/dist/mcp/index.js"
   ```

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

**What it means:** The AI returned something that couldn't be parsed as a valid Epic structure.

**Why it happens:** Claude sometimes returns malformed JSON when the model is very fast (Haiku) or when the prompt is very short.

**Fix:**
1. Try running again — LLM responses have variance, it often succeeds on a second run
2. Switch to a more capable model in `.env`:
   ```text
   MODEL=claude-sonnet-4-6
   ```
3. Make sure your `raw.json` seed file is valid JSON: `cat artifacts/epics/<id>/raw.json | python3 -m json.tool`

---

## The score doesn't improve across iterations

**What it means:** The AI keeps getting similar or worse scores each iteration.

**This is expected behavior at high scores.** Once a plan scores 8 or 9 out of 10, there isn't much left to improve. The hints get more subtle and the LLM may not act on them consistently.

**If the score is stuck at a low number (below 5):**
- The seed plan from Layer 1 may be too vague. Go back and run `define_epic` again with more specific answers in `session_notes`.
- Check `artifacts/epics/<id>/iteration_0.json` — the `improvementHints` field shows exactly what was passed to the next iteration. If the hints are vague, the improvements will be vague.

---

## Mock mode output looks wrong

**Symptom:** Mock mode shows unexpected scores or crashes.

**Fix:**
- Make sure you're passing `--mock` flag
- Make sure `--idea-id` is `test-idea` (mock mode uses hardcoded fixtures for this ID)
- Delete any old artifacts and try fresh: `rm -rf artifacts/epics/test-idea/`

---

## `claude: command not found`

**What it means:** Claude Code CLI isn't installed or isn't in your PATH.

**Fix:** Install Claude Code from VS Code (Extensions → search "Claude Code") or follow the setup in [GETTING_STARTED.md](GETTING_STARTED.md#step-2-install-claude-code-in-vs-code). The `claude` CLI command becomes available after installing the extension.

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
2. Make sure you're in the right folder (`pwd` shows your current directory)
3. Try deleting `node_modules/` and `dist/` and starting fresh:
   ```bash
   rm -rf node_modules dist
   npm install
   npm run build
   ```
