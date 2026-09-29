## Linked issue

Closes #<!-- issue number -->

## Summary

<!-- What changed and why. -->

## Docs checklist

- [ ] This PR changes architecture, the data model, routes, or adds a
      Firestore field/collection.
  - [ ] If checked above: the matching file(s) in `docs/agent/` were
        updated in this PR (`architecture.md`, `firestore-data-model.md`,
        `multiplayer-sync.md`, or `theming.md` as applicable).
- [ ] This PR adds or changes a Firestore field or collection.
  - [ ] If checked above: `firestore.rules` constrains it (or the PR says
        why it doesn't need to), and `scripts/verify-firestore-rules.mjs`
        covers the new write. Merging a rules change deploys it.

## Test checklist

<!-- Vitest runs in CI with the coverage floors (`npm run test:coverage`), and src/test/testFiles.test.ts fails
     when a new page, component or hook has no test file. See
     docs/agent/testing.md. -->

- [ ] This PR adds or changes a component/page/hook.
  - [ ] Unit tests were added or updated.
  - [ ] If this is a user-facing flow: an e2e test was added or updated.

## Test plan

<!-- How you verified this: commands run, manual steps, screenshots for UI
     changes. -->

## Review

- [ ] This PR is ready for review and will **not** be merged until a review
      (human or agent) approves it — see `CONTRIBUTING.md`.
