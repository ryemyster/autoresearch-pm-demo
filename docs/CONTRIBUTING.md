# Contributing to autoresearch-pm-demo

First off — thanks for wanting to help! This project is meant to be a learning tool, so contributions that make it clearer, more useful, or easier to run are especially welcome.

---

## You don't have to write code to contribute

Some of the most useful contributions are:

- Fixing a typo or unclear sentence in the docs
- Reporting a bug ("I ran step 3 and got this error...")
- Suggesting a clearer explanation for a concept
- Sharing how you used this project in the real world

---

## How contributing works (the pull request flow)

Think of it like this: the `main` branch is the "official" version of the project — the one everyone sees when they visit the repo. You can't edit it directly. Instead, you make a copy, make your changes in that copy, and then ask for your changes to be included. That ask is called a **pull request** (or PR).

Here's the full flow, step by step:

### 1. Fork the repo

A **fork** is your own personal copy of the project on GitHub. Changes you make to your fork don't affect the original until you ask for them to be merged.

Click the **Fork** button at the top-right of the repo page on GitHub. GitHub will create a copy under your own account.

### 2. Clone your fork to your computer

**Cloning** means downloading your fork so you can edit it locally.

```bash
git clone https://github.com/YOUR-USERNAME/autoresearch-pm-demo.git
cd autoresearch-pm-demo
```

Replace `YOUR-USERNAME` with your GitHub username.

### 3. Create a branch

A **branch** is like a separate workspace inside the project. It lets you make changes without touching anything else.

```bash
git checkout -b my-fix
```

Name the branch something short that describes what you're doing — like `fix-typo-in-readme` or `add-windows-install-note`.

### 4. Make your changes

Edit the files you want to change. If you're touching TypeScript source files, run the build to make sure nothing is broken:

```bash
npm install
npm run build
```

If the build succeeds (no red errors), you're good.

### 5. Commit your changes

A **commit** is like hitting "save" in a way that records what you changed and why.

```bash
git add .
git commit -m "fix: correct typo in GETTING_STARTED.md"
```

Keep the message short and specific. Start with a word like `fix:`, `docs:`, or `feat:` to make it easy to scan.

### 6. Push your branch to GitHub

**Pushing** sends your local changes up to your fork on GitHub.

```bash
git push origin my-fix
```

### 7. Open a pull request

Go to your fork on GitHub. You'll see a banner saying something like "my-fix had recent pushes — compare & pull request." Click it.

Fill in:
- **Title**: one sentence describing what you changed
- **Description**: why you made the change, and what someone should look at to verify it's correct

Then click **Create pull request**.

That's it! The project maintainer will review it, may ask a question or two, and then merge it if it looks good.

---

## What makes a good contribution

- **Small and focused** — one change per PR is easier to review than ten things at once
- **Explain the why** — "I changed X because Y was confusing" is much more helpful than just "I changed X"
- **Test it yourself first** — run `npm run demo` and make sure the output looks right before submitting

---

## What to work on

Check the [Issues tab](https://github.com/ryemyster/autoresearch-pm-demo/issues) for open bugs or ideas. Issues tagged **good first issue** are specifically picked for people making their first contribution.

If you have an idea that isn't in the issues yet, open one first and describe what you want to do. That way we can discuss it before you spend time writing code.

---

## Code style

- TypeScript, no `any` types unless truly unavoidable
- Comments should explain *why*, not *what* — the code shows what, the comment explains the reasoning
- Keep new functions small and named clearly — this is a learning project, so readability beats cleverness

---

## Questions?

Open an issue and tag it **question**. There are no dumb questions here — this project is designed for people who are still learning.
