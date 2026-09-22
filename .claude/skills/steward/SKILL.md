---
name: steward
description: Drive one ESCParty task through the full dev loop — pick a task from Issues/the Project board, plan it if non-trivial, execute on a branch, commit it, open a PR, get it reviewed, fix what review and CI raise, and merge only after review approves. Use whenever asked to pick up an issue, work a task end-to-end, or "just go implement something" in this repo. Also use when reviewing whether an in-flight PR is following this loop (e.g. about to be merged without review). This is the standing default for how work gets done here — reach for it instead of improvising a pick/plan/execute/commit/PR/review/fix/merge sequence from scratch.
---

# Steward

The written form of "pick a task, plan it, ship it, get it reviewed, fix
what comes back, merge after review" — so that sequence means the same thing
every session instead of being re-improvised each time. Humans get the same
policy in `CONTRIBUTING.md`; this skill is that policy encoded for an agent
doing the work directly.

## The loop

1. **Pick a task.** Prefer an existing GitHub issue (an open sub-issue of an
   epic beats inventing new scope) or an item from the Project board. Don't
   silently expand scope beyond what the issue asks for — if the real fix
   needs more, say so before doing it.

2. **Plan, if it's non-trivial.** Write a short plan before touching code
   when the change spans more than one file, or touches Firestore,
   multiplayer-sync, or theming code (see `docs/agent/` for what counts as
   each). The plan can be a comment on the issue or a scratch note in the
   PR description — it needs to exist and be checkable, not be exhaustive.
   A one-line bug fix or typo can skip straight to execution.

3. **Execute on a branch.** Never commit to `main` directly. See
   `CONTRIBUTING.md` for branch-naming conventions.

4. **Commit.** One logical change per commit. Subject line in the
   imperative and under ~72 characters; the body says *why*, since the diff
   already says what. Reference the issue (`#NN`). Add the one-line
   `CHANGELOG.md` bullet under `[Unreleased]` as part of the same commit —
   it's a repo expectation, not paperwork for later. Run `npm run lint`,
   `npm run build` and `npm test` **before** committing, not after the push
   comes back red. Never commit secrets: Firebase config belongs in
   `.env.local` (gitignored) or CI secrets.

5. **Open a PR.** Link the issue, fill in `.github/pull_request_template.md`,
   and check its docs box honestly (see below). Confirm CI is green
   (`npm run build`, `npm run lint`) before asking for review, not after.

6. **Get it reviewed.** Every PR needs a review pass before merge — a human
   review, or an agent-driven one (the `code-review` skill, or GitHub's
   Claude Approvals check where the repo has it configured). Never skip
   both. If you are the one who opened the PR, don't also be the only
   reviewer of it in any way that substitutes for an independent pass.

7. **Fix what review and CI raise.** A red or conflicted PR is work now,
   not something to wait out — it is never "waiting on review" while it's
   red. Reproduce the failure locally, fix the root cause, show the same
   check passing, then push; "flake" is not a root cause. Never skip,
   disable or quarantine a test to get green, and never push an empty
   commit to kick CI. Implement a reviewer's small, local asks (nits,
   renames, an added test) and push them; for an ask bigger than the PR,
   reply with a proposal and let the author decide rather than widening the
   diff unilaterally. Treat a review bot's finding as a bug report until
   you've verified otherwise. Resolve the threads you actually addressed,
   and re-request review after pushing fixes for a changes-requested
   review. Repeated findings across your pushes mean fix the root cause —
   they don't mean stop.

8. **Merge only after review approves — never on green CI alone.** This is
   a hard default, not a suggestion to weigh against convenience. Green CI
   means the build didn't break; it says nothing about whether the change
   is right. Don't self-merge a non-trivial change because CI is green and
   review is merely pending. Don't merge with an unresolved review comment
   still open, even if it looks minor — resolve it or get explicit sign-off
   that it's deferred, then merge.

## Keep the agent docs fresh — enforced here, not by memory

Before approving or merging a PR, check whether it changes architecture,
adds or changes a Firestore field/collection, or adds a route. If it does
and the matching `docs/agent/*.md` file (`architecture.md`,
`firestore-data-model.md`, `multiplayer-sync.md`, or `theming.md`) wasn't
updated in the same PR, flag it in review — don't approve on the promise of
a follow-up. "Someday" is how the docs and the code drifted apart the first
time; the whole point of this epic was to stop relying on that promise.

## Degrading gracefully around the missing test suite

There is no test framework in this repo yet (`docs/agent/testing.md` is a
stub). Don't hard-fail a PR for missing tests while that's true — note it
as a known gap in review instead of blocking on it. Once a test suite
lands, this tightens automatically: re-read `docs/agent/testing.md` at that
point, and start treating "no tests for a new component/flow" as a real
review finding rather than a known gap. Don't hand-wire that tightening
yourself before the suite actually exists — check the file, don't assume.

## Applying this to a small real task

Following this skill for something like "add a Current Players section for
single player" (a real, cited example from this repo's issue tracker) looks
like:

1. Confirm the issue exists (or file it) and read it fully.
2. If it touches one file with a small, obvious fix — skip to a branch. If
   it touches multiplayer state or more than one file, write 3-5 lines of
   plan as an issue comment first.
3. Branch and implement.
4. Run `npm run lint`, `npm run build` and `npm test` locally, then commit
   with the CHANGELOG bullet and the issue reference.
5. Open a PR with the template filled in, linking the issue.
6. Request review (or run the `code-review` skill against the diff).
7. Fix what comes back — review findings and any red check — and push,
   resolving the threads you addressed.
8. Merge only once that review comes back approving, with nothing it raised
   left open.

## Related

- `CONTRIBUTING.md` — the human-facing version of this same loop.
- `.github/pull_request_template.md` — the checklist this skill enforces.
- `CLAUDE.md` / `docs/agent/` — project facts to read before planning.
- `code-review` skill — one valid way to satisfy step 6.
