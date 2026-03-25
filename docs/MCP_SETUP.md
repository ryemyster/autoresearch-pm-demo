# Connecting the Discovery Tools

This guide shows you how to connect three AI tools to your computer so you can use them with Claude.

The three tools are:

- **validate_problem** — you describe a problem, and it asks you questions to make it sharper
- **prioritize_opportunities** — it scores different ways to solve the problem
- **define_epic** — it writes a first draft plan you can hand to the AI loop to refine

Right now these tools are just code sitting in a folder on your computer. This guide teaches your AI app where to find them and how to run them.

**You only need to do this once.** After setup, the tools will be there every time you open the app.

---

## What is an MCP tool, and why do I have to "install" it?

Think of it like this.

Your phone comes with a calculator app. If you want a new app — say, a budgeting app — you have to install it first. After that, it just lives on your phone.

These Discovery tools work the same way. They are new abilities that don't come built into Claude. You have to tell Claude's app "hey, there are extra tools living at this location on my computer." Once you do that, Claude can use them whenever you ask.

The technical name for this system is **MCP** (Model Context Protocol). You don't need to understand how it works — just follow the steps below.

---

## Which app are you using?

| I want to use... | Go to |
| ---------------- | ----- |
| VS Code (the code editor) with Claude Code | [Option A](#option-a-vs-code-with-claude-code) |
| Claude Desktop on a Mac | [Option B](#option-b-claude-desktop-on-mac) |
| Claude Desktop on Windows | [Option C](#option-c-claude-desktop-on-windows) |

---

## Before you start — three things to check

**1. Node.js must be installed.**

Node.js is what actually runs these tools on your computer. Think of it like a tiny engine in the background. To check if it's installed, open a terminal and type:

```bash
node --version
```

If you see a number like `v20.11.0`, you're good. If you see an error, go install it from [nodejs.org](https://nodejs.org) — click the big green **LTS** button and follow the installer.

> **What's a terminal?** It's a text-only window where you type commands. On Mac: press Cmd+Space, type "Terminal", press Enter. On Windows: press the Windows key, type "Command Prompt", press Enter.

**2. The project must be built.**

This project needs a one-time "compilation" step before it can run. If you haven't done this yet, open a terminal inside the project folder and run these two commands one at a time:

```bash
npm install
npm run build
```

Wait for each one to finish before running the next. `npm install` downloads needed libraries. `npm run build` translates the code into a runnable form.

**3. You need an Anthropic API key.**

An API key is like a password that lets the tools talk to Claude. You get one for free from [console.anthropic.com](https://console.anthropic.com). It looks like: `sk-ant-abc123...`

If you have one, write it down — you'll need to paste it in the steps below.

> **Don't have one yet?** You can skip the real API key and use mock mode instead. Mock mode uses scripted fake responses — it's completely free and shows you how the system works. See [GETTING_STARTED.md → Step 9](GETTING_STARTED.md#step-9-try-mock-mode-first-no-api-key-needed) for how to run mock mode.

---

## Option A: VS Code with Claude Code

VS Code is a free code editor. Claude Code is the AI assistant that lives inside it. This option is for people who want to run the full pipeline — discovery, refinement loop, and build — all from one place.

### Step A1 — Open the project in VS Code

In VS Code, go to **File → Open Folder** and select the `autoresearch-pm-demo` folder.

You should see the project files listed in the left sidebar.

### Step A2 — Open a terminal inside VS Code

Go to **Terminal → New Terminal** (or press Ctrl+backtick on Windows, Cmd+backtick on Mac).

A black panel opens at the bottom. You'll see a prompt like:

```text
~/autoresearch-pm-demo $
```

The `$` just means "ready for a command." You don't type the `$`.

### Step A3 — Run one command to register the tools

Copy and paste the right command for your operating system:

**Mac or Linux:**

```bash
claude mcp add autoresearch-demo \
  -e ANTHROPIC_API_KEY=$(grep ANTHROPIC_API_KEY .env | cut -d= -f2) \
  -s user \
  -- node "$(pwd)/dist/mcp/index.js"
```

**Windows — Command Prompt:**

```cmd
for /f "tokens=2 delims==" %i in ('findstr ANTHROPIC_API_KEY .env') do set KEY=%i
claude mcp add autoresearch-demo -e ANTHROPIC_API_KEY=%KEY% -s user -- node "%cd%\dist\mcp\index.js"
```

**Windows — PowerShell:**

```powershell
$key = (Get-Content .env | Where-Object { $_ -match "ANTHROPIC_API_KEY" }) -replace ".*=", ""
claude mcp add autoresearch-demo -e ANTHROPIC_API_KEY=$key -s user -- node "$PWD\dist\mcp\index.js"
```

> **What is this doing in plain English?**
> It's saying: "Hey Claude Code — there are three new tools. To run them, use Node.js and point it at this file: `dist/mcp/index.js`. Also, here's my API key so the tools can talk to Claude."
>
> The `$(pwd)` part automatically fills in the current folder path so you don't have to type it manually.

### Step A4 — Check that it worked

Type this and press Enter:

```bash
claude mcp list
```

You should see:

```text
autoresearch-demo   connected
```

If you see `connected` — you're done! Skip to [Step A5](#step-a5--use-the-tools).

If you see `disconnected`, jump to [Troubleshooting → Tools not connecting](#tools-not-connecting-in-vs-code) below.

### Step A5 — Use the tools

Open the Claude Code chat panel (click the Claude icon in the left sidebar).

Type this into the chat:

```text
Use validate_problem with problem_statement: "describe your problem here"
```

Claude will call the tool and come back with questions. Answer them, and you're in the Discovery stage of the pipeline.

---

## Option B: Claude Desktop on Mac

Claude Desktop is a standalone app — like having Claude in its own window, separate from any code editor. Great if you want to use the Discovery tools without dealing with VS Code at all.

### Step B1 — Install Claude Desktop

Go to [claude.ai/download](https://claude.ai/download), download the Mac version, and run the installer (drag it to your Applications folder). Sign in with your Anthropic account.

### Step B2 — Find the path to your project folder

You need the full address of where the project lives on your Mac. Open a terminal, navigate to the project folder, and type:

```bash
pwd
```

It will print something like:

```text
/Users/ryan/autoresearch-pm-demo
```

**Write this down.** You'll paste it in the next step.

### Step B3 — Open Claude Desktop's config file

Claude Desktop reads a settings file to know which tools to load. Open a terminal and run:

```bash
open ~/Library/Application\ Support/Claude/
```

This opens a Finder window. Look for a file called `claude_desktop_config.json`.

- **If the file exists:** open it with any text editor (TextEdit works, or right-click → Open With → VS Code)
- **If the file doesn't exist:** create a new text file in that folder and name it exactly `claude_desktop_config.json`

> **What is a JSON file?** JSON is a way of writing settings that computers can read. It looks like a list of labels and values, with curly brackets `{}` and square brackets `[]`. The most important rule: it's very picky about commas and spelling. One typo and the whole file stops working. Copy the template below exactly and only change the parts marked in capital letters.

### Step B4 — Add the tools to the config file

Delete everything in the file (if anything is there) and paste this:

```json
{
  "mcpServers": {
    "autoresearch-demo": {
      "command": "node",
      "args": ["/REPLACE/WITH/YOUR/PATH/autoresearch-pm-demo/dist/mcp/index.js"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-REPLACE_WITH_YOUR_KEY"
      }
    }
  }
}
```

Now make two replacements:

1. Replace `/REPLACE/WITH/YOUR/PATH/autoresearch-pm-demo` with the path you wrote down in Step B2.
   For example: `/Users/ryan/autoresearch-pm-demo`

2. Replace `sk-ant-REPLACE_WITH_YOUR_KEY` with your actual Anthropic API key.
   For example: `sk-ant-abc123xyz456...`

The finished file should look something like this:

```json
{
  "mcpServers": {
    "autoresearch-demo": {
      "command": "node",
      "args": ["/Users/ryan/autoresearch-pm-demo/dist/mcp/index.js"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-abc123xyz456"
      }
    }
  }
}
```

Save the file.

> **Already have other MCP servers in this file?** Don't delete them. Instead, add the `autoresearch-demo` block inside the existing `"mcpServers": { }` section, after a comma. If you're unsure, jump to [Troubleshooting → JSON errors](#json-file-has-errors--tools-dont-show-up) for how to check your file.

### Step B5 — Restart Claude Desktop (important!)

This step trips a lot of people up.

Closing the window is **not enough**. Claude Desktop loads its config file when it first starts — so you need to fully quit it and reopen it.

On Mac: press **Cmd+Q** while Claude Desktop is the active window, or right-click the Dock icon and choose **Quit**.

Then reopen Claude Desktop from your Applications folder.

### Step B6 — Check that the tools appeared

In Claude Desktop's chat bar, look for a **hammer icon** (🔨). Click it.

You should see three tools listed:

```text
validate_problem
prioritize_opportunities
define_epic
```

If you see them — you're done!

If you don't see the hammer icon, or the tools aren't listed, go to [Troubleshooting → Tools don't appear](#tools-dont-appear-after-restarting-claude-desktop) below.

### Step B7 — Use the tools

In the Claude Desktop chat, type:

```text
Use validate_problem with problem_statement: "describe your problem here"
```

Claude will call the tool and ask you questions. You're in Discovery.

---

## Option C: Claude Desktop on Windows

This is almost identical to the Mac setup. The only difference is where the config file lives.

### Step C1 — Install Claude Desktop

Go to [claude.ai/download](https://claude.ai/download), download the Windows version, and run the installer. Sign in with your Anthropic account.

### Step C2 — Find the path to your project folder

Open a Command Prompt window inside the project folder and type:

```cmd
cd
```

It will print something like:

```text
C:\Users\Ryan\autoresearch-pm-demo
```

**Write this down.** You'll paste it in Step C4.

### Step C3 — Open Claude Desktop's config file

The config file lives here:

```text
C:\Users\YourName\AppData\Roaming\Claude\claude_desktop_config.json
```

The `AppData` folder is hidden. Here's the easiest way to open it:

1. Press **Win+R** on your keyboard (Windows key + the letter R). A small "Run" box opens.
2. Type `%APPDATA%\Claude` and press Enter.
3. A File Explorer window opens showing the Claude config folder.

Look for `claude_desktop_config.json`.

- **If the file exists:** open it with Notepad (right-click → Open with → Notepad)
- **If the file doesn't exist:** right-click in the folder → New → Text Document, then rename it to `claude_desktop_config.json`

> **Warning about file extensions on Windows:** By default, Windows hides file extensions. A file named `config.json` might actually show as just `config` in File Explorer. When you create a new text file and name it `claude_desktop_config.json`, Windows might secretly name it `claude_desktop_config.json.txt`. To check: right-click the file → Properties → look at the full file name. If it ends in `.txt`, rename it to remove that part.

### Step C4 — Add the tools to the config file

Delete everything in the file and paste this:

```json
{
  "mcpServers": {
    "autoresearch-demo": {
      "command": "node",
      "args": ["C:\\REPLACE\\WITH\\YOUR\\PATH\\autoresearch-pm-demo\\dist\\mcp\\index.js"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-REPLACE_WITH_YOUR_KEY"
      }
    }
  }
}
```

Now make two replacements:

1. Replace `C:\\REPLACE\\WITH\\YOUR\\PATH\\autoresearch-pm-demo` with the path you wrote down in Step C2.

   > **Important — double backslashes:** In JSON files, every `\` must be written as `\\`. So if your path is `C:\Users\Ryan\autoresearch-pm-demo`, write it as `C:\\Users\\Ryan\\autoresearch-pm-demo`.
   >
   > Or use forward slashes instead — they also work: `C:/Users/Ryan/autoresearch-pm-demo`

2. Replace `sk-ant-REPLACE_WITH_YOUR_KEY` with your actual Anthropic API key.

The finished file should look something like this:

```json
{
  "mcpServers": {
    "autoresearch-demo": {
      "command": "node",
      "args": ["C:\\Users\\Ryan\\autoresearch-pm-demo\\dist\\mcp\\index.js"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-abc123xyz456"
      }
    }
  }
}
```

Save the file.

### Step C5 — Restart Claude Desktop (important!)

Closing the window is not enough. You need to fully quit Claude Desktop.

Look in the **system tray** — the row of small icons at the bottom-right corner of your taskbar, near the clock. Find the Claude icon there. Right-click it and choose **Exit** or **Quit**.

Then reopen Claude Desktop from the Start menu.

### Step C6 — Check that the tools appeared

In Claude Desktop's chat bar, look for a **hammer icon** (🔨). Click it.

You should see:

```text
validate_problem
prioritize_opportunities
define_epic
```

If you see them — you're done!

If not, go to [Troubleshooting → Tools don't appear](#tools-dont-appear-after-restarting-claude-desktop) below.

### Step C7 — Use the tools

In the Claude Desktop chat, type:

```text
Use validate_problem with problem_statement: "describe your problem here"
```

---

## Troubleshooting

### Tools don't appear after restarting Claude Desktop

Work through these checks in order. Most people find their fix in Check 1 or 2.

**Check 1 — Did you fully quit (not just close the window)?**

Closing the window leaves Claude Desktop running in the background. It only re-reads its config file on a full restart.

- Mac: Press Cmd+Q, or right-click the Dock icon → Quit
- Windows: Right-click the tray icon (bottom-right, near the clock) → Exit

Then reopen the app and check the hammer menu again.

**Check 2 — Is the JSON valid?**

One missing comma or one extra bracket breaks the whole config file silently. Claude Desktop won't tell you what went wrong — it just ignores the file.

To check: go to [jsonlint.com](https://jsonlint.com), paste your entire config file into the box, and click Validate. It will highlight any errors.

**Check 3 — Is the path to the project correct?**

The path in `"args"` must point to a file that actually exists: `dist/mcp/index.js` inside your project folder. If you haven't run `npm run build` yet, this file won't be there.

Open a terminal in the project folder and run:

```bash
npm run build
```

Then restart Claude Desktop and check again.

**Check 4 — Can Claude Desktop find Node.js?**

Claude Desktop runs in a slightly different environment than your terminal, so it sometimes can't find Node.js even when your terminal can.

To test: open a fresh terminal (not one that's already been open) and type `node --version`. If that works, Node.js is installed. But Claude Desktop might still not find it.

The fix is to use the full path to Node.js in your config file instead of just `"node"`.

To find the full path:

- Mac/Linux: type `which node` in your terminal
- Windows: type `where node` in your Command Prompt

Then update the `"command"` field in your config. For example:

```json
{
  "mcpServers": {
    "autoresearch-demo": {
      "command": "/usr/local/bin/node",
      "args": ["/Users/ryan/autoresearch-pm-demo/dist/mcp/index.js"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-abc123"
      }
    }
  }
}
```

---

### Tools not connecting in VS Code

Run `claude mcp list` in the terminal. If it shows `disconnected`:

1. Make sure the project is built: run `npm run build`, then try again.
2. Check the API key: open `.env` and make sure `ANTHROPIC_API_KEY=sk-ant-...` is there with no extra spaces.
3. Remove and re-add: run `claude mcp remove autoresearch-demo`, then re-run the register command from [Step A3](#step-a3--run-one-command-to-register-the-tools).

---

### JSON file has errors — tools don't show up

The most common JSON mistakes:

- **Missing comma** between two entries (every entry except the last one needs a comma after it)
- **Extra comma** after the last entry (the last item in a block must NOT have a trailing comma)
- **Mismatched brackets** — every `{` needs a closing `}`, every `[` needs a `]`
- **Wrong quotes** — JSON requires straight `"` quotes, not curly `"` or `"` quotes (autocorrect sometimes converts these)

The fastest fix: paste your file into [jsonlint.com](https://jsonlint.com) and it will tell you exactly which line has the problem.

---

### API key not working — tools return an error

Check these things:

- The key should start with `sk-ant-` — if yours starts with just `sk-` it might be an OpenAI key, not an Anthropic key
- The key might have been revoked or expired — log in to [console.anthropic.com](https://console.anthropic.com) and check that the key is still active
- There should be no quotation marks around the key in the `"env"` section beyond the ones that are already in the template — no `"sk-ant-..."` wrapped in extra quotes

---

## Done? Here's what to do next

Once the tools are connected:

1. Open Claude (in VS Code or Claude Desktop)
2. Type: `Use validate_problem with problem_statement: "your real problem here"`
3. Answer the questions Claude asks
4. Follow the chain: `prioritize_opportunities` → `define_epic`
5. Take the `next_step` command from `define_epic` and paste it into your terminal

That kicks off the Epic Refinement Loop — the AI loop that rewrites and improves the plan until it scores high enough to hand to a developer.

For the full walkthrough, see [GETTING_STARTED.md](GETTING_STARTED.md).
