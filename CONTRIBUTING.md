# Contributing

This is the dev loop for ESCParty — the same loop whether you're a human or
an AI agent (the `steward` skill at `.claude/skills/steward/SKILL.md`
encodes this exact policy for agent sessions). For project facts (stack,
architecture, known landmines), read `CLAUDE.md` and `docs/agent/` first —
this file is about *how* to work, not *what* the codebase is.

## 1. Pick up work

Prefer an existing issue over inventing new scope — check the
[Issues list](https://github.com/mamf92/escparty/issues) or the GitHub
Project board. If you're picking up a sub-issue of an epic, work the
sub-issue, not the whole epic at once.

## 2. Plan first, if it's non-trivial

Write a short plan before writing code when the change touches more than
one file, or touches Firestore/multiplayer-sync/theming code. The plan can
be a comment on the issue or a scratch note — it doesn't need to be formal,
it needs to exist before the diff does.

Trivial fixes (a typo, a one-line bug) can skip straight to execution.

## 3. Execute on a branch

Never commit directly to `main`. Branch naming isn't rigidly enforced in
this repo's history, but prefer a short `type/description` form (e.g.
`fix/vercel-base-path`, `feat/fabric-ui-membrane-demo`) or an
issue-numbered form (e.g. `43-write-root-claude-md`) over an unscoped name.

## 4. Open a PR

Every PR should:

- Link the issue it closes or addresses.
- Fill in `.github/pull_request_template.md` (it auto-populates when you
  open the PR) — including the docs-updated checkbox if the change touches
  architecture, the data model, or routes.
- Pass CI (`npm run build` and `npm run lint`, per
  `.github/workflows/ci.yml`). Run `npm test` locally too — the unit suite
  isn't a CI check yet, so CI going green says nothing about it (see
  `docs/agent/testing.md`).

## 5. Get it reviewed

Every PR needs a review pass before merge — a human review, or an
agent-driven one (the `code-review` skill, or GitHub's Claude Approvals
check where configured). Never skip both.

## 6. Merge only after review — never on green CI alone

This is the one hard rule in this document: **do not merge with green CI
but no review, and do not merge with unresolved review comments.** Green CI
means the change didn't break the build; it says nothing about whether the
change is the right one. Waiting on review is not a bottleneck to route
around by self-merging — it's the point of having the rule.

## Changelog

After every implementation or otherwise significant change, add a one-line
bullet to `CHANGELOG.md` under the appropriate `[Unreleased]`/version
heading. This is a process expectation carried over from the repo's
original Copilot instructions — it didn't stop applying just because it
moved documents.

## Secrets

Never commit runtime secrets to source. Firebase config belongs in
`.env.local` (already gitignored — copy `.env.example` to start) or in
CI/CD secrets, never hardcoded.

## Keeping the docs in sync

If your change touches architecture, the data model, or adds a route,
update the matching `docs/agent/*.md` file in the same PR — don't defer it
to "a follow-up." See `CLAUDE.md`'s "Keeping this file honest" section for
why this matters: each fact should have exactly one home, and a stale
`docs/agent/` file is worse than a missing one because the next reader will
trust it.
