---
description: Read the injected epic from this project's docs/ directory and implement it. Use after running the autoresearch loop.
---

Find the most recent `*-epic.md` file in the `docs/` directory of the current project (or in the path provided by the user).

Read it completely, then:

1. **Summarize the epic** (2-3 sentences): title, outcome, top 3 in-scope items
2. **Identify the first buildable unit**: look at `success_metrics[0]` — what is the smallest implementation that would move this metric?
3. **Create a task list** using TodoWrite with these phases:
   - Setup: any scaffolding, dependencies, or config needed
   - Core implementation: the primary feature work
   - Instrumentation: add the measurement tool/event specified in success_metrics
   - Tests: what needs to pass for the epic to be "done"
4. **Begin implementing** starting with the first pending task

If the epic references dependencies (teams, services, or decisions), flag them as blockers before starting.

If no epic file is found in docs/, check the project root and ask the user to provide the path.
