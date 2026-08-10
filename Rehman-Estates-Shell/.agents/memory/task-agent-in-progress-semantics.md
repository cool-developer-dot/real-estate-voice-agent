---
name: Project task IN_PROGRESS/IMPLEMENTED means an isolated task agent
description: A project task showing IN_PROGRESS or IMPLEMENTED (without a MAIN_ prefix) is being worked by a task agent in a separate, isolated Repl — not by the main agent.
---

## The rule
If a project task's `state`/`displayState` is `IN_PROGRESS` or `IMPLEMENTED` (not `MAIN_IN_PROGRESS`/`MAIN_IMPLEMENTED`), a separate task agent already owns it in an isolated environment. The main agent should not independently implement that same task's plan directly on the main branch.

**Why:** Doing the same work twice creates two divergent implementations of the same files. When the task agent's isolated work is later approved and merged by the user, it can conflict with or silently overwrite the main-agent's direct edits (or vice versa), and the reconciliation script may not resolve it cleanly. Calling `markTaskComplete` for such a task from the main agent correctly fails with `no_active_task` — that response is a reliable signal you were not the assigned executor.

**How to apply:** Before implementing a project task's plan directly on main, check its `state` via `queryProjectTasks`/`getProjectTask`. If it's already `IN_PROGRESS`/`IMPLEMENTED` (task-agent-owned), don't redo the work — wait for the merge, or flag the overlap to the user so they can choose whether to discard one side. If you already did redundant work when this happens, tell the user plainly so they can decide whether to skip that task's merge from the tasks panel (no programmatic cancel/reject call exists for the main agent).
