# Changelog

## [0.1.0] - 2025-05-13
### Added
- Added multiplayer quiz mode

### Fixed
- Fixed hydration issue in HeroBanner
- Fixed Mid-Quiz Scoreboard not updating scores for host in real-time

## [Unreleased]
### Added

### Changed
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
