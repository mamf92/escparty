# Changelog

## [0.1.0] - 2025-05-13
### Added
- Added multiplayer quiz mode

### Fixed
- Fixed hydration issue in HeroBanner
- Fixed Mid-Quiz Scoreboard not updating scores for host in real-time

## [Unreleased]
### Added
- The multiplayer lobby is now the Calm "green room" (#65): guests tap "I'm ready", the host sees who's ready, can take out a player who joined by mistake, and starts once everyone is ready, or on purpose with "Start anyway" (an observer host can't start an empty room). Typing the code of the game this device was last in offers to rejoin as the same player, even mid-game; a guest who leaves the lobby takes themselves out; and after 20 seconds of a break the observer host can "Continue without them" past a player who never reaches it. New `readyPlayers` field and rules, verify case 15 (2026-09-29)
- Redesigned the quiz finale (#67, #21): `QuizResults` is a Calm page that reveals a room's final standings like a Eurovision scoreboard, from the bottom up with the podium one place at a time ("Huit points", "Dix points", "Douze points"; ties together), with a skip. The observer host's screen now follows the room to the results, and the host can "Play again with everyone": a new room whose code the finished room carries (`nextRoomCode`, set once, checked by `firestore.rules`), which guests join from their results with the same name. A reload on the results no longer loses the game (the stored game is kept until you leave). Solo results moved to Calm, and "Restart Quiz", which led to an unfinished page, is now "Play another quiz" (2026-09-29)
- A guest joining just as the host starts the game now hears "already started" instead of a rules error, and a full room (32 players) says so (#64): `addPlayerToRoom` re-reads the room when the rules refuse its join and throws a typed `JoinRejected`; a player already in the room gets back in even after the start. `scripts/verify-firestore-rules.mjs` now runs simultaneous joins, a join racing the start, and simultaneous score writes from separate clients against the emulator. Added the first decision record, `docs/agent/adr/0001-firestore-vs-websockets.md`, on keeping Firestore listeners for sync (#66) (2026-09-29)
- Added the scoreboard party (#79-#91, #24) at `/party`: a host picks a Burgas 2027 show (both semis and the final, with a fictive running order the host can edit, or the real one once it's entered in Firestore `contests/`), a rating sheet (The Jury, MGP Sofa, Douze Points, or up to six categories of their own) and optional party bonuses; guests join with a code or the QR code on the big screen and rate each act on their phone, offline-safe. Everyone sees their own ranking and the room's standings; the host taps in the real result and everyone sees how close they came. At the end, awards named after Eurovision history (the Jedward Twins for the two who rated most alike, Lordi & Salvador Sobral for the most different, Euphoria, Nul Points, Hatari, the Johnny Logan and more), anonymous if the host chose so (#89). `firestore.rules` gains `parties/`, `parties/*/ballots/` and read-only `contests/`; parties and ballots carry a 30-day `expireAt` for a TTL policy. Home's "Create quiz" now opens the quiz builder (2026-09-29)
- A finished quiz room no longer accepts score writes, so final scores can't be rewritten after the results (#142): a late write in the first 30s still lands, after that the quiz says the game had finished instead of retrying; the unused `continueReady` flag is refused in rooms with a phase (2026-09-29)
- Added the quiz builder (#73-#77): build a quiz from bank questions (filter by category and difficulty) and your own (2-6 answers, tap the right one), reorder, choose when the scoreboard break comes, and save it to Firestore `quizzes/`. Saved quizzes are listed on this device in the quiz library, can be played solo, hosted, edited (saved as a new version) or copied from a premade quiz. Rooms now carry the quiz's break setting (`breakEvery`), which `firestore.rules` enforces, so premade and custom quizzes break where they say in multiplayer too (2026-09-29)
- Added a quiz data model (`quizModel.ts`, #70), a tagged question bank of 106 questions (the classic 30 plus 76 new) current to Eurovision 2026 and the road to Burgas 2027 (#71, #72), six premade quizzes (Road to Burgas, Nordic Nights, Winners' Circle, Nul Points, Wind Machine, Quick Fire; their own mid-quiz scoreboard settings apply solo for now, rooms still break every 5) with no question giving away another's answer, and a Calm-styled quiz library at `/quizzes` to play one solo or host it. The bank loads in its own chunk when a premade quiz starts. A room's `difficulty` now names any quiz (`t-<id>` for a premade one) and `firestore.rules` checks that shape on room creation as well as on update. The Scoreboard and the new Calm pages share one stylesheet (`calm-page.css`) (2026-09-29)
- Fixed `updatePlayerScore` resolving successfully for a player who isn't in the room (#131); a guest who drew a name already in the room is now added under their own ID instead of skipped (which left every score they sent unsaved), and the quiz tells a player once when the room can't take their score instead of retrying silently and `fetchQuizData`/the bundled import leaving their 5s timers running after a failure (#132); added a `Quiz.tsx` test proving an answer's correctness isn't visible before Submit (#22); `npm test` now fails when a new page, component or hook has no test file (#140) and the steward treats missing tests as blocking (#58); the PR template asks about `firestore.rules` for new Firestore fields; the Vite `base` is `/` everywhere now that GitHub Pages is gone (#125) (2026-09-29)
- Replaced the mid-quiz `continueReady` handshake with the room's phase (#63, fixes #23): the host's continue is just `resumeAfterMidQuiz` (shared by both break screens via `useResumeRoom`), and every break screen leaves as soon as it sees the room out of the break, however late, going on to the results directly if the room is already there. The flag and its fixed 3s reset are gone, so a throttled or offline client can no longer miss the signal and get stuck. `firestore.rules` now only accepts a ready mark during the break, one appended player ID per write, so a mark queued offline can't land after the resume; marks are only written in observer-host rooms, the only ones that read them. Who's the host and whether they only observe now comes from the room (`roomRoles.ts`) instead of `localStorage`, which every tab shares: Lobby sends an observer host straight to its screen, and a guest with a stale host flag is no longer bounced around. A single-player quiz no longer picks up an old multiplayer game from `sessionStorage` (`readMultiplayerGame`, used only without router state). Multiplayer rooms without a phase (created before #61) now show a "start a new room" error instead of running on local timers (2026-09-28)
- Made multiplayer question progression follow the room (#62): every client shows `Room.currentQuestionIndex` and times it from `phaseStartedAt`, so all screens stay on the same question, and a returning tab catches up at once. Any client ends a question when its 15s slot is over, via the new transactional `advanceQuestion` (duplicate attempts are no-ops); the host's continue resumes the room with `resumeAfterMidQuiz`, and a player who missed that returns on their own. `firestore.rules` gains `isAdvancingPhase`, which only allows legal phase moves and never before the slot is over, and drops the legacy started-only start. `markPlayerAtMidQuiz` is now an `arrayUnion` and the resume clears the ready marks in the same write, because every player now reaches the break at once. Fixed the mid-quiz scoreboard skipping a question after every break (2026-09-28)
- Added server-authoritative quiz progression fields (`phase`, `currentQuestionIndex`, `phaseStartedAt`) to the Firestore `Room` document. `createRoom` and `startGame` write them and `firestore.rules` validates them; no client reads them yet (#61) (2026-09-25)
- Added `.github/workflows/firestore-rules.yml`, which verifies `firestore.rules` against the emulator on PRs and deploys it on merge to `main`. It refuses to overwrite rules edited outside the repo and checks that the live rules match afterwards, so rules no longer get pasted into the Firebase console by hand. Added `scripts/firestore-live-rules.mjs` for reading the live rules back. `scripts/verify-firestore-rules.mjs` now counts only `permission-denied` as a denial; before, any error passed, including a list query that unexpectedly succeeded (2026-09-25)
- Added `npm test` as a required step in `ci.yml`, bumped the CI Node matrix from 18.x/20.x to 22.x/24.x (jsdom's engine requirement) and added a matching `engines` field to `package.json`, and ignored `.claude/worktrees/` (2026-09-23)
- Added baseline unit tests for the critical logic: `roomsFirestore.ts` (Firebase SDK mocked, covering the join/score/mid-quiz guards and every wrapped error message), `QuizDataProvider.ts` (the three-tier dev/prod fallback chain) and the quiz scoring math, which moved out of `Quiz.tsx` into a pure `src/utils/quizScoring.ts`; added `npm run test:coverage` with per-file coverage floors for exactly those three files (2026-09-22)
- Added a Vitest + React Testing Library unit/component test harness (`npm test`, `npm run test:watch`), a `renderWithProviders` helper that mounts components under the app's ThemeProvider + router, and a `Home.tsx` smoke test proving it works end to end (2026-09-22)
- Added `firestore.rules` at the repo root, imported verbatim from the Firebase console and wired into `firebase.json`, so production access control is versioned and reviewable for the first time (2026-09-18)
- Added `scripts/verify-firestore-rules.mjs`, a manual emulator-based verification script for `firestore.rules` (2026-09-18)
- Added a `gitleaks` CI check that scans every PR for likely secrets (2026-09-18)
- Added root CLAUDE.md, docs/agent/ deep dives, a steward skill for the pick/plan/execute/PR/review/merge loop, a PR template, and CONTRIBUTING.md; trimmed .github/copilot-instructions.md to a pointer file (2026-09-17)
- Added product manager custom agent for planning and progress tracking (2026-05-21)
- Added short-term plan and long-term roadmap docs under plans/ (2026-05-21)
- Added Project Board Cleanup prompt for GitHub Project backlog refresh (2026-05-21)
- Added host observer mode allowing quiz hosts to monitor players without participating (13 May 2025)
- Added initial Zustand client store sketch for session and multiplayer state management (2026-05-16)
- Added GitHub Actions CI workflow to run build and lint on PRs (2026-05-16)
### Removed
- Removed the GitHub Pages deploy path (`predeploy`/`deploy` scripts and the `gh-pages` devDependency) and `.github/workflows/deploy-vercel.yml`, which had failed on all 12 of its runs for want of the `VERCEL_*` secrets; Vercel's GitHub integration is the one deploy path that actually runs (2026-09-22)

### Changed
- Let agents merge PRs they opened without waiting for a person, when CI is green, a `code-review` pass posted on the PR has every Important finding addressed, no thread is open, and the PR doesn't touch the guardrails themselves. The rule lives in `CONTRIBUTING.md` section 8, and `.claude/settings.json` allows the GitHub merge tool (2026-09-28)
- Pointed the README live-demo link, `SECURITY.md`'s supported-version URL and `package.json`'s `homepage` at https://escparty-murex.vercel.app, replacing the GitHub Pages URL whose last build was from October 2025 (2026-09-22)
- Added the missing Commit and Fix steps to the dev loop in `.claude/skills/steward/SKILL.md` and `CONTRIBUTING.md`, so the written loop is pick → plan → execute → commit → PR → review → fix → merge (2026-09-22)
- Updated Home navigation: Single-player button now routes to `/select-difficulty` (2026-05-16)
### Updated
- Refreshed the long-term roadmap milestones and README to reflect the 2026-2027 product goals (2026-05-21)
- Expanded repository Copilot instructions to document tech stack, env vars, CI guidance, and dev recommendations (2026-05-16)
- Added dedicated HostObserverView component for better separation of concerns (14 May 2025)
- Added player readiness tracking at mid-quiz scoreboard to ensure all participants are ready before continuing (14 May 2025)
- Simplified the host observer view UI by removing redundant status information (14 May 2025)
- Improved player readiness indicator with checkmarks and simplified helper text (14 May 2025)
- Standardized button styling across components for better UI consistency (14 May 2025)

### Fixed
- Fixed `firestore.rules` allowing any client to list/enumerate the entire `rooms` collection with no room code at all (`allow read: if true` covered both `get` and `list`; the app never queries the collection, so `list` is now denied outright), and allowing `difficulty` to be re-set repeatedly before a game starts instead of only once; disabled the Lobby difficulty buttons while a selection is in flight so the new one-shot rule can't turn a double-click into a dead-end error screen (2026-09-18)
- Fixed two bugs in `firestore.rules` caused by a broken `hasAll(isValidPlayerBasic)` call: score updates were being denied outright once a game had started (silently swallowed client-side, so scores never synced to other players), and the resulting fallback path let a write replace the whole `players` array with no shape validation at all. Also closed a gap where a legitimate write (e.g. setting difficulty) could piggyback an unrelated forged field (e.g. `hostId`) in the same request (2026-09-18)
- Fixed `updatePlayerScore` silently dropping a concurrent score update by moving it to a Firestore transaction, and rejecting non-finite/negative/decreasing score writes; clamped `timeLeftMs` in `Quiz.tsx` before computing the time bonus (2026-09-18)
- Fixed Zustand setup by adding the missing dependency and updating `useGameStore` typings/imports for strict TypeScript builds (2026-05-16)
- Fixed scoreboard not updating dynamically for observing hosts when participants answer questions (13 May 2025)
- Fixed quiz timer issue with duplicate cleanup functions causing timer malfunction when reaching zero (13 May 2025)
- Removed unused interface definition in HostObserverView component (14 May 2025)
- Fixed quiz timer functionality to automatically submit after 10 seconds and progress to the next question (13 May 2025)
- Fixed visual timer countdown to warn with color changes when time is running low (13 May 2025)
- Fixed question auto-progression after time expires (13 May 2025)
- Fixed quiz progression synchronization so all participants move to the next question at the same time (13 May 2025)
- Fixed automatic question progression with a feedback stage between questions (13 May 2025)
- Fixed visual feedback behavior for correct/incorrect answers with a 5-second display (13 May 2025)
- Added timer visibility toggle that hides timer when answer is submitted (13 May 2025)
- Added proper loading and error states with UI components (13 May 2025)
- Added high-precision time-based scoring system for multiplayer quizzes (13 May 2025)
- Added millisecond precision timer for more accurate scoring calculation (13 May 2025)
- Fixed Vercel deployment asset paths by switching Vite to use the root base path on Vercel builds (2026-05-16)
- Fixed bug where quiz participants were incorrectly redirected to the scoreboard instead of the quiz (13 May 2025)
- Fixed bug where multiple participants could get the same name when joining a room (13 May 2025)
### Removed
- Removed multiplayer badge indicator from the Quiz component
- Resolved issues with timer effect dependencies causing unexpected behavior
- Fixed timer calculation to properly combine remaining question time with feedback time when answer submitted early (12 May 2025)

- Fixed Lobby component width to be consistent with other cards (11 May 2025)
- Fixed Lobby component color scheme for better readability and consistency with other pages (11 May 2025)
- Changed text colors in Lobby to white with purple highlights for important elements (11 May 2025)
- Standardized component styling across the entire application with consistent rem units (11 May 2025)
- Applied consistent square button styling throughout all pages (11 May 2025)
- Unified container widths to 31.25rem (500px) across all components (11 May 2025)
- Standardized typography with consistent font sizes and spacing (11 May 2025)

- Redid most pages, but might have some smaller details left which is not fixed.
- Worked on input validation on join game page, with some user feedback if code is wrong.  

- Fixed input validation feedback in multiplayer game code entry form
- Added proper loading states for game creation and joining (11 May 2025)

- Fixed build error by removing unused Firestore collection import (10 May 2025)
  - Enhanced Firebase debugging to provide more detailed error information
- Fixed question continuity issue after midquiz scoreboard by properly handling the question index state (10 May 2025)
- Fixed Firebase error when creating rooms by replacing serverTimestamp() with Timestamp.now() in arrays (10 May 2025)
- Added extra validation for room joining to prevent joining games that have already started
- Created built-in fallback quiz data to ensure functionality even when network requests fail
- Added comprehensive debug logging to help troubleshoot environment-specific issues
- Added UUID generation for unique player identification
- Fixed horizontal scrollbar in quiz pages by changing container width from viewport units to percentage-based units
- Fixed content sizing within MobileFrame to properly display pages inside the phone UI
- Updated global styles to ensure all pages adapt to MobileFrame container dimensions
- Fixed mobile frame styling to prevent horizontal scrolling and ensure content fits properly inside frame
- Fixed background coloring to cover the entire viewport for desktop view
- Added mobile phone frame for desktop users to showcase the mobile-first design
- Improved responsive layout with a simulated phone UI on larger screens

- Fixed asset paths after repository name change from `/europarty/` to `/escparty/`
- Fixed state persistence in quiz flow by ensuring all required data is passed between MidQuizScoreboard and Quiz components
- Fixed TypeScript error in MidQuizScoreboard component by properly using the currentQuestionIndex variable
- Fixed fetch logic in Quiz component to ensure correct URL is used for fetching quiz data.
- Fixed bug in MidQuizScoreboard where quiz continuation used incorrect URL format causing JSON loading errors.

### Fixed
- Resolved Firestore security rules blocking multiplayer room join operations
- Fixed arrayUnion compatibility issues with security rule validation  
- Fixed permission-denied errors when adding players to game rooms

### Added
- Comprehensive Firestore security rules for multiplayer quiz functionality
- Data validation ensuring proper room and player structure
- Business logic protection preventing invalid game state changes
- Enhanced error handling with specific user-friendly messages

### Security
- Implemented secure Firestore rules that work without user authentication
- Added protection against malformed data and unauthorized operations
- Validated all room operations (create, join, start, update scores, etc.)
- Prevented room deletion and ensured data integrity

### Performance
- Optimized room join process with better error handling
- Reduced unnecessary Firebase calls through improved validation logic
- Cleaned up debug logging for production readiness
