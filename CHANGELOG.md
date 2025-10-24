# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [Unreleased] - 2025-10-24 (Phase 1: Core Stabilization)

### Changed
- Refactoring and stabilization of core quiz functionality
- Code cleanup and optimization across components

## [0.1.0] - 2025-05-13

### Added
- Multiplayer quiz mode with real-time synchronization
- Host observer mode allowing quiz hosts to monitor players without participating
- Player readiness tracking at mid-quiz scoreboard
- High-precision time-based scoring system with millisecond accuracy
- Timer visibility toggle that hides when answer is submitted
- Sorted leaderboard in mid-quiz scoreboard with table layout
- Points display showing earned points after answering
- Automatic question progression with 5-second feedback stage
- Visual timer countdown with color warnings
- Loading and error states with proper UI components
- Firebase Firestore real-time synchronization for multiplayer rooms
- Player score tracking with real-time updates
- UUID generation for unique player identification
- Mobile phone frame UI for desktop users
- Session storage for game state persistence across page refreshes
- Comprehensive Firestore security rules with data validation
- UnderDevelopment page for features in progress

### Changed
- Standardized component styling with consistent rem units
- Improved button layouts with full-width styling and square design
- Enhanced lobby UI with brighter colors matching ESC News theme
- Unified container widths to 31.25rem (500px)
- Replaced local storage room management with Firestore database
- Optimized quiz data loading with multi-source fallback strategy
- Improved path resolution for development and production environments
- Enhanced Firebase initialization with better error detection

### Fixed
- Scoreboard not updating dynamically for observing hosts
- Quiz timer issue with duplicate cleanup functions
- Observing hosts appearing in player lists and leaderboards
- Participants being redirected to scoreboard instead of quiz
- Multiple participants getting the same name when joining
- Multiplayer quiz difficulty validation with capitalized levels
- Question continuity after mid-quiz scoreboard
- Firebase room creation permission-denied errors
- Asset paths after repository rename
- Horizontal scrollbar in quiz pages
- Content sizing within MobileFrame container
- TypeScript build errors with unused variables
- Hydration issue in HeroBanner
- Mid-quiz scoreboard not updating scores for host in real-time

### Security
- Implemented secure Firestore rules without requiring user authentication
- Added protection against malformed data and unauthorized operations
- Validated all room operations with business logic protection
