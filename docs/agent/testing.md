# Testing

Stub — there is no test suite in this repository yet.

## Current state

`npm run lint` and `npm run build` run in CI (`.github/workflows/ci.yml`) on
every PR and push to `main`. There is no `npm test` script, no unit test
runner, and no e2e test runner configured. Don't assume test commands exist
when writing setup instructions or a PR template checklist item — check this
file first, since it's updated the moment that changes.

## Interim: manual Firestore rules verification

`scripts/verify-firestore-rules.mjs` exercises `firestore.rules` against a
running local emulator using the real client SDK write paths
`roomsFirestore.ts` uses. It's a plain Node script, not wired into any test
runner or CI — run it by hand (`npm run emulators &` then
`node scripts/verify-firestore-rules.mjs`) after changing `firestore.rules`.
Fold it into the real suite once the test infra below lands, rather than
letting it bit-rot as a one-off.

## What's expected to land here

Once test coverage is introduced (tracked as its own epic), this file should
cover:

- How to run unit tests and where they live.
- How to run e2e tests, including any Firestore-emulator setup they need.
  Firestore-touching integration tests should run against the local
  emulator (`npm run emulators`) in CI, never against production
  credentials.
- What's covered vs. known debt (e.g., `Quiz.tsx` at 728 lines is an
  obvious first target given its size and multiplayer branching logic).
- How the `steward` skill's and PR template's test-related checklist items
  tighten once this exists — see `.claude/skills/steward/SKILL.md` and
  `.github/pull_request_template.md` for the language that degrades
  gracefully until then.

Until that epic lands, treat any PR checklist item about "tests added" as
not-yet-applicable rather than something to fake or skip silently — say so
explicitly instead.
