Purpose: Provide AI agents with concise, actionable repository knowledge so suggestions and edits stay within project constraints.

Project facts:
- Framework: React (Vite) with TypeScript.
- Styling: styled-components.
- Routing: react-router (HashRouter).
- Backend: Firebase Firestore (client-side), supports emulator for local testing.
- Hosting: currently configured for GitHub Pages (`vite.config.ts` base `/escparty/`), but can be deployed to Vercel/Netlify.

Important scripts (in `package.json`):
- `npm run dev` — start dev server (Vite).
- `npm run build` — run `tsc -b` then `vite build` for production bundle.
- `npm run preview` — preview built site.
- `npm run lint` — run ESLint.
- `npm run deploy` — deploy to GitHub Pages (uses `gh-pages`).

Environment variables:
- Uses Vite env vars (`import.meta.env.VITE_*`). Required keys (see `src/firebase.ts`):
    - `VITE_FIREBASE_API_KEY`
    - `VITE_FIREBASE_AUTH_DOMAIN`
    - `VITE_FIREBASE_PROJECT_ID`
    - `VITE_FIREBASE_STORAGE_BUCKET`
    - `VITE_FIREBASE_MESSAGING_SENDER_ID`
    - `VITE_FIREBASE_APP_ID`
- For local testing, prefer using the Firebase emulator and `firebase.json` secrets. Provide a `.env.example` in the repo for guidance.

Where to look for core logic:
- Firebase init and env handling: `src/firebase.ts`.
- Firestore multiplayer API: `src/utils/roomsFirestore.ts`.
- Quiz UI + scoring: `src/components/Quiz.tsx`.
- Multiplayer pages: `src/pages/MultiplayerLobby.tsx`, `src/pages/Lobby.tsx`, `src/pages/MidQuizScoreboard.tsx`, `src/pages/HostObserverView.tsx`.
- Single-player entry: `src/pages/SelectDifficulty.tsx` -> `src/components/Quiz.tsx` (route: `/quiz/:difficulty`).

State patterns and conventions:
- The app currently uses local component state, `sessionStorage` and `localStorage` for ephemeral persistence and recovery.
- Do not introduce global state libraries without a migration plan; if suggesting a store (e.g., Zustand), recommend incremental migration and keeping Firestore as the source of truth for multiplayer data.

Guidance for edits and suggestions:
- Preserve `vite.config.ts` base path unless explicitly changing hosting target — changing this will break GitHub Pages deployments.
- Avoid adding runtime secrets to source. Prefer using CI/CD secrets or `.env` files excluded by `.gitignore`.
- For changes involving Firebase/Firestore, add emulator-friendly code paths and unit/integration tests that run against the emulator in CI.
- When modifying multiplayer logic, be conservative: ensure Firestore security rules and data validation remain intact.

CI and testing expectations:
- Add a GitHub Actions workflow that runs `npm ci`, `npm run build`, and `npm run lint` on PRs/pushes.
- For integration tests involving Firestore, use the Firebase emulator in CI and do not rely on production credentials.

CHANGELOG policy:
- After every implementation or significant change, update `CHANGELOG.md` with one-line bullets under the appropriate version heading.

Do-not-change list (unless instructed):
- `vite.config.ts` base path (used for GitHub Pages).
- `src/utils/roomsFirestore.ts` public API signatures unless making a coordinated migration.
- Existing production Firestore rules without a tested replacement.

If unsure, ask the user before making changes that affect hosting, env vars, or Firestore rules.
