# Concepts

New to AI tools, terminals, or code editors? This page explains everything you need to know before running the demo — in plain English.

---

## What is AI?

AI stands for **Artificial Intelligence**. In this context, it means a computer program that can read text you write and write back a useful response — like a very well-read assistant who has read millions of books, articles, and code examples.

Unlike a search engine that just finds links, this kind of AI actually *understands* your question and *writes* a new answer just for you.

> **Analogy:** Imagine a friend who has read every textbook ever written. You ask them a question and they write you a custom answer. That's roughly what modern AI does.

---

## What is Claude?

**Claude** is an AI made by a company called **Anthropic**. It's similar to ChatGPT (made by OpenAI), but a different product from a different company.

In this demo, Claude is the AI doing the thinking — it reads your problem description, asks clarifying questions, writes plans, scores them, and rewrites them.

---

## What is an API key?

When your computer program wants to talk to Claude, it needs permission. That permission comes in the form of an **API key** — a long string of letters and numbers that acts like a password.

> **Analogy:** Think of it like a library card. The library (Anthropic) gives you a card (API key). Whenever your program wants to borrow Claude's brain, it shows the card.

You get an API key by creating an account at [console.anthropic.com](https://console.anthropic.com). There's a free tier to get started.

**Keep your API key private.** Don't share it or put it in files you post online — it's linked to your account.

---

## What is VS Code?

**VS Code** (short for Visual Studio Code) is a free code editor made by Microsoft. Think of it like Microsoft Word, but for writing computer programs instead of essays.

This demo runs entirely inside VS Code. You type commands, chat with Claude, and see all the output in one place.

**Download it free at:** [code.visualstudio.com](https://code.visualstudio.com)

> **Analogy:** VS Code is like a workshop. All your tools are in one place — the code files on the left, a terminal (command line) at the bottom, and Claude as your AI assistant on the side.

---

## What is a terminal?

A **terminal** (also called the **command line** or **shell**) is a way to control your computer by typing text commands instead of clicking icons.

> **Analogy:** Normally you "talk" to your computer by clicking buttons. The terminal is like texting your computer instead. It's faster for technical tasks once you know the commands.

**On a Mac:** Open the app called **Terminal** (search for it in Spotlight with Cmd+Space).

**On Windows:** Open **Windows Terminal** or search for **PowerShell**.

When you open a terminal, you'll see a blinking cursor. That's where you type. Press Enter to run a command.

### Reading a terminal prompt

When the terminal is ready for input, it shows a **prompt** — a line that looks something like this:

```text
~/my-project $
```

- `~` means your home folder (your user account's main folder)
- `/my-project` is the folder you're currently in
- `$` means "ready — type your command here"

You don't type the `$`. It's just a signal that the terminal is waiting.

---

## What is Node.js?

Websites run JavaScript in your browser. **Node.js** lets your computer run JavaScript programs *outside* the browser — on your machine directly.

This project is written in TypeScript (explained below), and Node.js is what runs it.

> **Analogy:** JavaScript is like a language. Your browser already speaks it. Node.js teaches your whole computer to speak it too.

You'll install Node.js in Step 1 of the Getting Started guide. It's free.

---

## What is TypeScript?

**TypeScript** is a version of JavaScript with extra checks built in. It helps catch mistakes before the program runs.

Before Node.js can run TypeScript, it needs to be *compiled* — translated into plain JavaScript. You do this with `npm run build`. The translated files go into a folder called `dist/`.

> **Analogy:** TypeScript is like writing a recipe with strict rules — exact measurements, no vague instructions. The compiler is like a chef's assistant who double-checks the recipe before cooking starts.

You never need to write TypeScript yourself to use this demo. You just run the build command once.

---

## What is npm?

**npm** (Node Package Manager) is a tool that comes with Node.js. It downloads and installs code libraries that this project depends on.

When you run `npm install`, it reads a list of dependencies and downloads them all automatically into a folder called `node_modules/`.

> **Analogy:** npm is like a shopping service. You give it a shopping list (`package.json`) and it fetches everything you need.

---

## What is an "extension" in VS Code?

An **extension** is an add-on you install into VS Code from its built-in app store. Extensions give VS Code new abilities.

Claude Code is installed as an extension. Once installed, it adds a Claude chat panel to VS Code where you can talk to Claude, run commands, and use tools — all without leaving the editor.

> **Analogy:** Extensions are like apps on a phone. The phone works fine without them, but apps add new abilities: maps, a camera, a music player. Claude Code is an app that adds AI to VS Code.

---

## What is MCP?

**MCP** stands for **Model Context Protocol**. It's a standard way to give an AI new abilities by adding tools.

By default, Claude can read and write text. With MCP tools, you can extend it — for example, giving it the ability to save files to your computer, look things up in a database, or (in this demo) run a structured product discovery process.

> **Analogy:** Think of MCP tools like apps on a phone. A new phone can make calls and send texts. But you add apps to give it new abilities — maps, a camera, a calculator. MCP tools are apps for Claude.

In this demo, the MCP server adds three tools to Claude:

- `validate_problem` — helps you stress-test whether your problem is real
- `prioritize_opportunities` — helps you pick the best approach
- `define_epic` — writes a structured plan for the work

> **For developers:** How you *design* MCP tools determines how well the agent uses them. The best reference is **[arcade.dev/patterns](https://www.arcade.dev/patterns)** — a catalog of 44 MCP tool design patterns. The tools in this demo implement five of them. See [HOW_IT_WORKS.md → MCP Tool Design](HOW_IT_WORKS.md#mcp-tool-design) for a walkthrough.

---

## What is Claude Code?

**Claude Code** is a version of Claude that lives inside VS Code. Instead of chatting in a browser window, you talk to Claude directly in the same place where the code lives.

Claude Code can read your files, write code, run commands, and use MCP tools — all without leaving the editor.

> **Analogy:** It's like having an AI pair programmer sitting next to you, looking at the same screen.

You install Claude Code as an extension in VS Code. The Getting Started guide walks you through it.

---

## What is an "epic"?

In software product work, an **epic** is a written plan for a feature or project. It describes:

- **What problem** you're solving and for whom
- **What you're building** (the scope — what's in, what's out)
- **How you'll know it worked** (measurable success criteria)
- **What it depends on** (other teams, tools, or systems)

Think of it like a brief for a school project: before you start building anything, you write down what you're making, why, and how you'll know you're done.

In this demo, Claude writes the epic for you — and then an automated loop scores it, improves it, and hands it to another AI to build from.

---

## How this demo fits together

Here's the whole picture in everyday language:

1. **You describe a problem** to Claude using special tools (Discovery stage). Claude asks you questions, then writes a first draft of a plan (an epic).

2. **A program runs automatically** (Epic Refinement Loop — using the Autoresearch pattern). It reads that plan, writes an improved version, scores it, then writes another improved version. It does this 3 times and keeps the best one.

3. **Claude reads the final plan** and starts writing code (Build stage). It knows exactly what to build because the plan is structured and specific.

Every step saves a file to your computer. You can open those files and see exactly what happened.

---

## What is autoresearch?

Autoresearch is a technique where a program runs an improvement loop automatically — generating new versions of something, scoring them, keeping the best ones, and discarding the rest — without you watching.

> **Analogy:** Imagine a chef trying to perfect a recipe. They make a batch, a food critic scores it out of 10, and gives specific notes: "too salty, needs more acid." The chef adjusts the recipe card and tries again. If the new batch scores higher, they keep the updated recipe card. If it scores lower, they throw out the new version and go back to the previous one. The critic's scoring rubric never changes — you can't win by lowering the bar. The chef runs trials all night while you sleep, and in the morning you have both the best recipe found and a full record of every version tried.
>
> The autoresearch loop is that chef. The product plan (epic) is the recipe card. Claude is both the chef (improves it) and the critic (scores it) — but the scoring criteria are locked and can't be changed from inside the loop.

In this project, the "recipe" is a product plan (an epic). The loop:

1. Generates an improved version of the plan
2. Scores it on 5 criteria (0-10)
3. If the score improved: keeps it as the new best
4. If the score dropped: reverts to the previous best
5. Repeats N times

After N iterations, you have the best-scoring plan the loop could find — and a record of everything it tried.

Read the full explanation: [HOW_IT_WORKS.md](HOW_IT_WORKS.md)

---

## What is a git commit?

Git is a program that tracks changes to files over time. A **commit** is a snapshot — a saved version of your files at one moment.

> **Analogy:** Think of git like a photo album. Every time you commit, you take a photo of your work. You can flip back through the album to see what it looked like before. You can go back to an older photo if you don't like the new one.

A **revert** is: "I don't like this photo — take a new photo that looks like the one from two photos ago." The bad photo is still in the album (with a note: "this was undone"), but you've moved back to the good version.

This project uses git in `--git-mode` to track every version of the plan the loop generates. After the run, you can see the full history:

```text
abc1234  iteration 3: score 9/10  ✓ improvement
def5678  Revert "iteration 2: ..."  (score dropped — discarded)
ghi9012  iteration 2: score 7/10  ✓ improvement
jkl3456  iteration 1: score 2/10  (baseline)
```

The short codes on the left (like `abc1234`) are labels git assigns automatically — git's way of giving each snapshot a unique name. You don't need to type them; they appear in the log so you can reference a specific version.

Every attempt is recorded, even the ones that were thrown away. That record is valuable — it shows what the system tried.

---

## Why this isn't just a doc editor

Most AI writing tools improve what you give them. They make it read better. But the structural decisions — what problem to solve, what to build, how to measure success — stay the same.

This project does something different. It explores multiple framings of the same problem and scores all of them before you commit to any.

> **Litmus test:** Does this system produce options I wouldn't have considered, and eliminate weak ones before I commit?
>
> - If **yes** → right tool
> - If **no** → doc editor

The failure mode to avoid: "Upload plan → improve plan" produces better wording with the same structural problems. The real pain in product work isn't "my plan reads poorly." It's "we keep committing to the wrong thing."

Read more: [HOW_IT_WORKS.md → The Big Idea](HOW_IT_WORKS.md#the-big-idea)

---

Ready? Go to [GETTING_STARTED.md](GETTING_STARTED.md) to run the demo.
