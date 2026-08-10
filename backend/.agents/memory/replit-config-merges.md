---
name: .replit edits vs task merges
description: Port mapping in .replit was lost after a task merge; re-verify after merges.
---

The rule: after a project-task merge completes, re-read the live `.replit` and confirm the `[[ports]]` block (localPort 5000 → externalPort 80 for this project) is still present.

**Why:** During the scaffold task (Aug 2026), a validated `.replit` replacement that added the ports mapping was reverted by the merge process, leaving the webview showing "We couldn't reach this app" even though Vite was serving fine on 0.0.0.0:5000.

**How to apply:** Whenever a task reaches Merged state or `.replit` changes hands, `cat .replit` and re-apply via the temp-file + verifyAndReplaceDotReplit flow if the ports block is missing. Also: merge validation runs `vite build`, which recreates `dist/` at the repo root — delete it after merges (it is gitignored; harmless but the user wants a clean tree). Happened after tasks #1 and #4 (Aug 2026). Prefer plain build-mode prompts over project tasks in this repo to avoid the revert cycle.
