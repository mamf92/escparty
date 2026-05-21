# Short-Term Plan: Prep repo for robust AI guidance, deployment, Zustand, and single-player fixes

TL;DR - Create robust Copilot instructions, add CI/CD and test coverage, introduce (or plan) Zustand for centralized multiplayer client state, and fix routing/UX to reopen single-player easily. Use GitHub Actions + Vercel/Netlify as target hosting; use Firebase emulator in CI for integration tests; add unit and smoke tests for critical flows.

## Steps
1. Update Copilot instructions (short task, depends on nothing).
   1. Audit existing .github/copilot-instructions.md and expand: project tech, build/test commands, runtime env vars, Firestore constraints, Firebase emulator usage, important files and state patterns, and explicit do-not-change lists (e.g., Vite base for gh-pages) - parallelizable with step 2.
   2. Add explicit troubleshooting tips and required env keys (list from repo scan). Save examples of safe dev workflows (use emulator, local .env.development). Deliverable: updated .github/copilot-instructions.md.

2. CI/CD and tests (main phase, blocks deployment until basic CI exists)
   1. Create CI workflow (.github/workflows/ci.yml) to run npm ci, npm run build, and lint. Add caching for node modules. Depends on 1 (copilot docs) for commands confirmation.
   2. Add a deploy workflow (.github/workflows/deploy.yml) that runs on push to main and deploys to chosen host (Vercel or GitHub Pages). If Github Pages: use existing gh-pages script; if Vercel/Netlify: configure build and env secrets. Recommend Vercel for automatic PR previews and simple env secret handling.
   3. Add tests: introduce vitest + @testing-library/react and a minimal test suite for critical components: roomsFirestore (with emulator), Quiz scoring logic, and routing. Create test script in package.json.
   4. Integration tests: use Firebase emulator in CI to run basic multiplayer flows: create room, join player, update score, listen snapshot. Use firebase-tools and set up emulator startup in CI job.
   5. Branch protection: enforce status checks (CI and tests) before merge to main and require PR review.

3. Zustand plan (design and incremental rollout, parallelizable with testing setup)
   1. Decision: introduce Zustand as lightweight global state to track active multiplayer session (room, playerId, playerName, isHost, gameState, local UI flags) and transient UI state (current question index, timer). Keep persistence in sessionStorage but move canonical client state into the store.
   2. Implementation steps:
      - Create src/store/useGameStore.ts using zustand with TypeScript types for Player, RoomState, GameState.
      - Migrate small slices first: sessionStorage wrappers -> store hydration (load from sessionStorage on init), then update components that currently read/write sessionStorage directly: MultiplayerLobby.tsx, Lobby.tsx, Quiz.tsx, HostObserverView.tsx.
      - Ensure Firestore listeners write into the store (single source of truth) and UI subscribes to store rather than multiple local states.
      - Add selectors to avoid unnecessary re-renders.
   3. Verification: run app locally, test reconnect/refresh flows, ensure mid-quiz continue flow still triggers properly.

4. Reopen single-player quiz (quick UX and routing fix)
   1. Fix Home buttons to link to /select-difficulty instead of /quiz (placeholder). Update src/pages/Home.tsx to point the single-player button to src/pages/SelectDifficulty.tsx.
   2. Ensure /quiz/:difficulty route is reachable and Quiz.tsx handles single-player by detecting absence of multiplayer session flags.
   3. Add a smoke test to CI verifying navigation: home -> select difficulty -> quiz page renders question.

## Relevant files
- .github/copilot-instructions.md - extend with required project facts
- package.json - scripts to reference (dev, build, deploy)
- vite.config.ts - base handling for GitHub Pages
- src/firebase.ts - env keys required and emulator logic
- src/utils/roomsFirestore.ts - core multiplayer DB API, add integration tests here
- src/components/Quiz.tsx - scoring logic and where to integrate store
- src/pages/MultiplayerLobby.tsx
- src/pages/Lobby.tsx
- src/pages/HostObserverView.tsx
- src/pages/MidQuizScoreboard.tsx
- src/pages/Home.tsx
- src/pages/SelectDifficulty.tsx

## Verification
1. Local dev: npm run dev - confirm navigation Home -> SelectDifficulty -> Quiz and multiplayer flows using Firebase emulator.
2. CI: GitHub Actions job: npm ci && npm run build && npm test must pass on PRs.
3. Integration: emulator-run test that creates a room, joins a player, advances one question, and verifies Firestore updates.
4. End-to-end: optional Cypress/Playwright test to simulate host + 2 players joining and scoring.

## Decisions and assumptions
- Host choice: recommend Vercel for ease; GitHub Pages is fine for static hosting but lacks previews and serverless functions if later needed.
- Use Firebase emulator in CI to avoid requiring production secrets in CI.
- Zustand will be used as client-side single source of truth for multiplayer session state; Firestore remains the authoritative backend.

## Further considerations
1. Env vars: compile a list of required VITE_ env keys from src/firebase.ts and document in Copilot instructions and repo README with .env.example.
2. Firestore rules: ensure production rules match dev assumptions - include a step to export/import rules in repo and test them with the emulator.
3. Rollout plan for Zustand: migrate incrementally per component to minimize risk; keep old storage persistence until fully verified.
