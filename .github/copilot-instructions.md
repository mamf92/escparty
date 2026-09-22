Purpose: this file exists only because GitHub Copilot looks here
specifically. It is not the source of truth for project facts — that's
`/CLAUDE.md` and `docs/agent/` at the repo root. Read those instead; this
file should never carry a fact that isn't also findable there, so it stays
a pointer rather than a second copy that can drift.

## Read first

- `/CLAUDE.md` — stack, commands, `src/` map, design themes, do-not-change
  list, known landmines.
- `docs/agent/` — deep dives on architecture, the Firestore data model,
  multiplayer sync, and theming, loaded only when the task needs them.
- `/CONTRIBUTING.md` — the dev loop: pick a task, plan if non-trivial,
  execute on a branch, commit, open a PR, get it reviewed, fix what review
  and CI raise, merge only after review approves.

## Copilot-specific notes

- Copilot doesn't read `CLAUDE.md` or `docs/agent/` automatically the way
  an agent session does — if a suggestion here seems to ignore a fact from
  those files, it's because this file wasn't kept in front of it; point
  Copilot at the relevant file directly rather than re-deriving the fact
  here.
- Everything else that used to live in this file (project facts, the
  do-not-change list, environment variables, CI expectations, the
  CHANGELOG policy) has moved to the files listed above. If you're tempted
  to add a fact here instead of there, don't — add it to `CLAUDE.md` or the
  matching `docs/agent/*.md` file so Copilot and any other agent read the
  same thing.
