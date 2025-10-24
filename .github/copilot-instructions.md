# ESCParty – Copilot Instructions

**Purpose:** Guide Copilot to generate code matching this project's architecture and conventions.  
**Scope:** React + TypeScript + Vite quiz app with single-player + real-time multiplayer (Firestore). Deployed on GitHub Pages at `/escparty/`.

---

## 0) TL;DR — Critical Rules (Read First)

- **State:** Client session lives in **Zustand (persisted)**.  
- **Firestore:** Use **services** (`src/services/rooms/*`) for all reads/writes/listeners — **never** call the SDK in components.  
- **Routing:** **No** `location.state` for carrying app state.  
- **Storage:** No direct `localStorage`/`sessionStorage` for app state (see transitional rules).  
- **UI:** Keep components **< 150 LOC**; containers **< 250 LOC**.  
- **Styling:** New UI uses **Tailwind**. `styled-components` is legacy (modify only if already there).  
- **Assets / GH Pages:** Always use `getAssetPath()` due to `/escparty/` base path.  
- **Timers:** Use a single `useQuestionTimer()` (rAF + visibility handling), not `setInterval`.  
- **Types/Docs:** Explicit TS types. JSDoc only for non-trivial logic (timers, scoring, sync).

---

## 1) Authoritative Now (Must Follow)

### 1.1 State Responsibilities

**Zustand** (`src/store/gameSession.ts`) is the **single source of truth** for client session:  
`isMultiplayer`, `roomCode`, `playerId`, `playerName`, `difficulty`, `currentQuestionIndex`, `score`.

**Derived flags** like `isHost`, `hostIsObserver` are **derived from Firestore room data** — do **not** store in Zustand.

```ts
// Minimal API preferred
const score = useGameSession(s => s.score);
const setSession = useGameSession(s => s.setSession);
setSession({ score: score + 100 });
```

### 1.2 Firestore via Services

Encapsulate Firestore in `src/services/rooms/*`:
- `roomLifecycle.ts` (create/close/start)
- `playerMutations.ts` (join/leave/score)
- `listeners.ts` (room subscription)
- `index.ts` (barrel export)

Components **import hooks** from services; they never import Firestore SDK.

```ts
// Authoritative pattern
import { useRoomListener } from '@/services/rooms';

const { room, isHost } = useRoomListener(roomCode);
```

### 1.3 Quiz Structure

Split `Quiz.tsx` into small focused components in `src/components/quiz/`:  
`QuizHeader`, `QuizQuestion`, `QuizOptions`, `QuizFooter`, `FeedbackPanel`.

**Scoring System:**
- **Base**: 500 points for correct answer
- **Time bonus**: Up to 500 points (linear decay over 10 seconds)
- **Formula**: `points = 500 + Math.floor((msRemaining / 10000) * 500)`
- **Max**: 1000 points per question

```ts
/**
 * Calculates time-based score bonus.
 * Base: 500 points + time bonus (0-500 based on milliseconds remaining).
 * 
 * @param timeLeftMs - Milliseconds remaining on timer
 * @returns Total points awarded (500-1000)
 */
const calculateScore = (timeLeftMs: number): number => {
  const BASE_SCORE = 500;
  const MAX_BONUS = 500;
  const QUESTION_DURATION_MS = 10000;
  const timeBonus = Math.floor((timeLeftMs / QUESTION_DURATION_MS) * MAX_BONUS);
  return BASE_SCORE + timeBonus;
};
```

**Mid-Quiz Scoreboard Pattern:**
```ts
// Every 5 questions (indices 4, 9, 14, 19...)
if ((currentQuestionIndex + 1) % 5 === 0) {
  navigate("/mid-quiz-scoreboard");
  // State comes from Zustand, not location.state
}
```

### 1.4 Styling

- **Tailwind for all new UI**.  
- `styled-components` only where it already exists; do not add new styled files unless strictly necessary.
- Existing styled-components: Use `$` prefix for transient boolean props to avoid DOM warnings.

```tsx
// Legacy styled-components only
<TimerContainer $timeRunningOut={timeLeft <= 3} $isFeedback={showFeedback} />
```

### 1.5 Data Loading

- Single quiz data source: **`public/quizdata/*`**.  
- Loader is simple (< 80 LOC). No env-specific branches.  
- Always resolve public assets with `getAssetPath()`.

```ts
import { getAssetPath } from '@/utils/pathUtils';

const imageSrc = getAssetPath('/images/eurovision.png');
// Dev: /images/eurovision.png
// Prod: /escparty/images/eurovision.png
```

---

## 2) Transitional (Allowed Temporarily for Backward Compatibility)

> **Ends when Milestone:** *Phase 1 – Stabilize Core* is merged.

- **Dual-write session identity** while migrating: write to Zustand **and** legacy storage **only if needed** to avoid breaking existing flows.
  ```ts
  // Transitional only; remove when Phase 1 closes
  setSession({ playerId: id, playerName: name });
  localStorage.setItem('playerId', id); // legacy compatibility, delete later
  ```
- **Existing `sessionStorage` keys** (e.g., `multiplayerGame`) may be **read** to recover state during migration, but **do not add new writes**.
- **`roomsFirestore.ts` in components**: permitted **only** until the services layer is extracted. Prefer moving logic to `src/services/rooms/*` incrementally.

---

## 3) Deprecated (No New Usage)

- `location.state` as an app state carrier.  
- New `sessionStorage` or direct `localStorage` writes for app state (Zustand persist instead).  
- New `styled-components` usage (prefer Tailwind).  
- `setInterval`/`setTimeout`-based countdowns for quiz timing.  
- New quiz data copies under `src/data/*` (single source is `public/quizdata/*`).

---

## 4) Firestore Patterns (Gotchas)

### Timestamp Handling (Critical)
```ts
// ❌ Wrong - causes errors
players: [{ joinedAt: serverTimestamp() }]

// ✅ Correct - use Timestamp.now() in arrays
players: [{ joinedAt: Timestamp.now() }]

// ✅ serverTimestamp() only at root level
{ createdAt: serverTimestamp(), players: [...] }
```

### Listeners & Cleanup
Services set up subscriptions and return clean unsubscribe functions. Components don't own Firestore lifecycles.

```ts
useEffect(() => {
  const unsubscribe = listenToRoom(roomCode, setRoom);
  return () => unsubscribe();
}, [roomCode]);
```

### Race Conditions
Batch/transaction score updates when simultaneous writes are possible (implement in `playerMutations.ts`).

---

## 5) Timers

Use `useQuestionTimer()` (rAF + `document.visibilityState`).  
It exposes `{ msLeft, secondsLeft, reset }`.  
One timing source of truth across the quiz; no duplicate interval logic in components.

---

## 6) Deployment Constraints (GitHub Pages)

- **Base path**: `/escparty/` in production, `/` in dev (configured in `vite.config.ts`).  
- **Router**: `HashRouter` (required for GitHub Pages).  
- **Always use `getAssetPath()`** for public assets.

```ts
import { isDevelopmentEnvironment, isProductionPreview } from '@/utils/pathUtils';

if (isDevelopmentEnvironment()) {
  // Use emulator or dev-specific logic
}
```

---

## 7) File Layout (Target Structure)

```
src/
  components/
    quiz/
      QuizHeader.tsx
      QuizQuestion.tsx
      QuizOptions.tsx
      QuizFooter.tsx
      FeedbackPanel.tsx
  hooks/
    useQuestionTimer.ts
  services/
    rooms/
      index.ts
      roomLifecycle.ts
      playerMutations.ts
      listeners.ts
  store/
    gameSession.ts
  types/
    room.ts
    quiz.ts
  utils/
    pathUtils.ts     // getAssetPath()
```

---

## 8) Quick Copilot Prompts

Paste these above functions to steer code generation:

```ts
// Intent: Use Zustand as the single source of client session; no new location.state/sessionStorage.
// Constraints: Keep store API minimal (setSession/resetGame/clearSession). Derive isHost from room data in services.

// Intent: Encapsulate Firestore in services/rooms/*. Return hooks for components. No Firestore SDK in components.
// Constraints: Add unsubscribe cleanup. Use Timestamp.now() in arrays; serverTimestamp() at root only.

// Intent: Migrate UI to Tailwind. If touching styled-components, keep it minimal and do not create new styled files.
// Constraints: Component <150 LOC; container <250 LOC.

// Intent: Single quiz data source under public/quizdata/*. Remove src/data duplicates.
// Constraints: Loader <80 LOC; use getAssetPath() for GH Pages base path.
```

---

## 9) Migration Roadmap

### Phase 1 — Stabilize Core (Current)
- [x] Add Zustand with persist middleware
- [x] JSDoc documentation for complex logic
- [ ] Remove dual-write (Zustand only)
- [ ] Extract Firestore services layer
- [ ] Split `Quiz.tsx` into focused components
- [ ] Implement `useQuestionTimer()` hook
- [ ] Unify quiz data source (`public/quizdata/*` only)

### Phase 2 — UI & Testing
- [ ] Tailwind CSS migration
- [ ] Minimal UI kit (Button, Card, Table, Banner)
- [ ] Vitest unit tests + React Testing Library
- [ ] Playwright e2e (happy path: singleplayer + multiplayer join)
- [ ] Component size enforcement (< 150 LOC)

### Phase 3 — Portfolio Polish
- [ ] README with architecture diagram
- [ ] Demo GIF + "What I learned" section
- [ ] Accessibility audit
- [ ] Performance optimization

---

## 10) Development Commands

```bash
npm run dev        # Vite dev server (port 5173, --host enabled)
npm run build      # TypeScript check + Vite build
npm run preview    # Test production build locally
npm run lint       # ESLint check
npm run deploy     # Build + deploy to gh-pages branch
```

---

## 11) Testing Direction (WIP)

**Vitest** (unit, jsdom) and **Playwright** (e2e) are being introduced.  
Once merged, follow:
- Unit tests colocated as `*.test.ts[x]` or in `__tests__`.  
- Minimal "happy path" Playwright tests for singleplayer and multiplayer join.  
- A `TESTING.md` will define patterns in Phase 2.

---

## 12) Out of Scope

- Firebase emulator (not currently used)
- New feature architectures (song discovery, score sheets) - to be documented when implemented
- Authentication system (public access only for now)

---

## One-Line Summary

**Use Zustand (persisted) for session; Firestore (via services) for shared multiplayer; avoid new storage/navigation state; prefer Tailwind; keep components small; use `getAssetPath()`; use rAF timer hook.**

