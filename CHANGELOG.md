# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Added
- Zustand state management for client-side session persistence
- Centralized game session store (`useGameSession`) with full TypeScript typing
- Persist middleware for automatic localStorage synchronization (`europarty:session`)

### Changed
- **Lobby component now reads all session state from Zustand instead of localStorage**
- **Difficulty selection writes to both Firestore (multiplayer sync) and Zustand (local state)**
- MultiplayerLobby now writes session data to Zustand when creating/joining rooms
- Replaced fragile navigation state dependencies with centralized store

### Fixed
- Fixed styled-components warning for boolean `secondary` prop in MultiplayerLobby
- Multiplayer lobby state now persists reliably across page refreshes
- Players no longer lose room context when refreshing during lobby
- Removed unused `_playerId` and `_index` variables

### Technical
- **Completed Issue #1: Zustand now manages full session lifecycle (write + read + persist)**
- Lobby.tsx migration removes all direct localStorage reads for session data
- Store uses `europarty:session` localStorage key with version 0
- No TypeScript `any` types in store implementation

---

## [0.3.0] - 2025-06-17

### Added
- Host observer mode - hosts can watch multiplayer games without participating
- Player readiness tracking at mid-quiz scoreboard
- High-precision millisecond timer for accurate scoring calculation
- Points display showing earned points after each question
- Sorted leaderboard with table layout in mid-quiz scoreboard
- Real-time score updates for observing hosts

### Changed
- Simplified host observer UI by removing redundant status information
- Standardized button styling across all components
- Improved player readiness indicator with checkmarks

### Fixed
- Firestore security rules now properly allow multiplayer room operations
- Timer automatically submits answers and progresses to next question
- Scoreboard updates in real-time for all participants
- Observing hosts no longer appear in player lists and leaderboards
- Quiz participants no longer incorrectly redirected to scoreboard
- Multiple participants can no longer get duplicate names when joining

### Security
- Implemented comprehensive Firestore security rules without requiring authentication
- Added data validation for room and player structures
- Protected against malformed data and unauthorized operations

---

## [0.2.0] - 2025-05-13

### Added
- Multiplayer quiz mode with real-time synchronization via Firebase Firestore
- Room management system with unique room codes
- UUID-based player identification
- Mid-quiz scoreboard with leaderboard after every 5 questions
- Real-time player score tracking across devices
- Session storage for state persistence during page refreshes
- Multiplayer status indicator in quiz UI

### Changed
- Replaced localStorage room management with Firestore database
- Quiz flow now supports both singleplayer and multiplayer modes
- Timer system with separate question and feedback phases
- Answer submission now shows 5-second feedback before progressing

### Fixed
- Quiz loading works correctly in both development and production
- Players can rejoin rooms after accidental disconnection
- State properly persists between Quiz and MidQuizScoreboard components
- Difficulty validation now handles capitalized difficulty levels
- Question continuity after mid-quiz scoreboard maintains correct index

---

## [0.1.0] - 2025-05-10

### Added
- Initial release with single-player quiz functionality
- Three difficulty levels (easy, medium, hard)
- 10-second timer per question with time-based scoring bonus
- Visual feedback for correct/incorrect answers
- Results screen with final score summary
- Mobile-first design with simulated phone frame on desktop
- Quiz data loading with fallback mechanisms
- Environment-aware asset path handling

### Changed
- Standardized component styling with consistent rem units
- Square button design inspired by ESC News
- Unified container widths to 31.25rem (500px)
- Converted all measurements from pixels to rem for better accessibility

### Fixed
- Quiz data loading works in both localhost and production
- Background images load correctly across environments
- Proper base path handling via Vite configuration
- Horizontal scrollbar removed from quiz pages
- Content properly fits within mobile frame container

---

## [0.0.1] - 2025-01-10

### Added
- Project initialization
- Basic quiz structure
- Routing setup
- Theme system with styled-components

---

## How to Use This Changelog

- **[Unreleased]**: Features currently in development
- **[X.Y.Z]**: Released versions (newest first)
  - **[0.3.0]**: Latest release with multiplayer improvements
  - **[0.2.0]**: Multiplayer mode introduction
  - **[0.1.0]**: Initial singleplayer release
- **Added**: New features
- **Changed**: Changes to existing functionality
- **Fixed**: Bug fixes
- **Security**: Security improvements
- **Performance**: Performance improvements
