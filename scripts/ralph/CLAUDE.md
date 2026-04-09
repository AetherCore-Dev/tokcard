Read `scripts/ralph/prd.json` and `scripts/ralph/progress.txt`.

Switch to the branch from `branchName` if needed. Complete exactly one unfinished story: choose the `userStories` item with the lowest `priority` where `passes` is `false`.

Implement only that story with minimal changes. Run `npm run build` as the required quality check. If it is UI work and browser tools are available, verify in browser; otherwise note manual verification in progress.

If checks pass, commit all changes as `feat: [Story ID] - [Story Title]`, set that story to `passes: true` in `scripts/ralph/prd.json`, and append a short entry to `scripts/ralph/progress.txt` with what changed, files changed, and reusable learnings.

Keep priorities tight: token usage first, project identity second, ranking third.

If all stories are complete, reply exactly `<promise>COMPLETE</promise>`. Otherwise reply normally.