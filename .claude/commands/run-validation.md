---
description: Run the validation loop to check whether the code satisfies the epic's success metrics. Use after /run-code-quality.
---

You are running the **Validation Loop** (Layer 5 of the autoresearch pipeline).

This loop closes the circle: it reads the `success_metrics` from the epic that Layer 2 wrote, and checks whether the code actually satisfies each one.

The score here is a **pass rate**: how many of the epic's metrics does the code satisfy?
- 10/10 = all metrics pass — the code is "done" as defined by the plan
- 6/10 = 3 out of 5 metrics pass — the loop will try to improve the remaining 3

## Step 1: Find the epic and the code file

1. Find the most recent `*-epic.md` file in this project's `docs/` directory
2. Find the most recently modified `.ts` or `.js` file (the output of `/run-code-quality`)
3. Extract the `--idea-id` from the epic filename

## Step 2: Run the validation loop

Run this command (replace values in `<>`):

```bash
npx tsx <path-to-autoresearch-pm-demo>/src/autoresearch/main.ts \
  --idea-id <idea-id-from-epic-filename> \
  --target-dir <path-to-this-project>/docs \
  --target-file <path-to-the-code-file> \
  --iterations 3 \
  --validate \
  --mock
```

Remove `--mock` if you have an `ANTHROPIC_API_KEY` set and want real AI validation.

The `--validate` flag automatically runs the code quality loop first, then the validation loop. You get both in one command.

## Step 3: Review the results

After the loop completes:
- Each success metric from the epic is shown as Pass ✓ or Fail ✗
- Iteration logs are in `artifacts/validation/<idea-id>/`
- If metrics are still failing, the hints tell you exactly what's missing

## Understanding the output

```
Metric                                   Pass?  Note
─────────────────────────────────────────────────────────────────
Onboarding drop-off rate                 ✓ Yes  analytics events found at each step
Time to first action                     ✗ No   no timing measurement found
Feature discovery rate                   ✓ Yes  feature flag tracking present
```

A "✗ No" means the code doesn't yet implement the measurement or behaviour that the epic's metric requires. The note tells you specifically what's missing.

## What "done" means

The pipeline is complete when all metrics show ✓. That's not the programmer's definition of done — it's the PM's definition, written in the epic at the start of the pipeline.
