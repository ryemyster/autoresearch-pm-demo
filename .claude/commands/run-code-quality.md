---
description: Run the code quality improvement loop (using Autoresearch pattern) on the implementation that the Build stage just produced. Use after /build-from-epic.
---

You are running the **Code Quality Loop** (Layer 4 of the autoresearch pipeline).

This loop takes the code that the Build stage wrote and applies the same Autoresearch pattern to it:
- Generate an improved version of the code
- Score it on 5 criteria (no lint errors, no security issues, readability, test coverage intent, epic alignment)
- Keep the best version, discard worse ones
- Repeat N times

## Step 1: Find the epic and the code file

1. Find the most recent `*-epic.md` file in this project's `docs/` directory
2. Find the most recently modified `.ts` or `.js` file in this project (excluding `node_modules/`, `dist/`, `.claude/`)
3. Extract the `--idea-id` from the epic filename (e.g. `my-feature-epic.md` → `my-feature`)

## Step 2: Run the code quality loop

Run this command (replace values in `<>`):

```bash
npx tsx <path-to-autoresearch-pm-demo>/src/autoresearch/main.ts \
  --idea-id <idea-id-from-epic-filename> \
  --target-dir <path-to-this-project>/docs \
  --target-file <path-to-the-code-file> \
  --iterations 3 \
  --code-quality \
  --mock
```

Remove `--mock` if you have an `ANTHROPIC_API_KEY` set and want real AI improvements.

## Step 3: Review the results

After the loop completes:
- The code file will be updated in place with the best version found
- Iteration logs are saved to `artifacts/code-quality/<idea-id>/`
- Open `iteration_0.json` and `iteration_2.json` and compare the hints — did the loop address the feedback?

## Next step

After the code quality loop finishes, run `/run-validation` to check whether the code satisfies the epic's success metrics.
