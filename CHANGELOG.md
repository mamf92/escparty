# Changelog

## [Unreleased]
### Added
- Quiz timer functionality that automatically submits after 10 seconds and progresses to next question
- Visual timer countdown with color change warning when time is running low
- Auto-progression to next question after time expires
- Synchronized quiz progression to ensure all participants move to the next question at the same time
- Automatic question progression with feedback stage between questions
- Visual feedback for correct/incorrect answers with 5-second display
- Added timer visibility toggle that hides timer when answer is submitted (13 May 2025)
- Added proper loading and error states with UI components (13 May 2025)
- Added high-precision time-based scoring system for multiplayer quizzes (13 May 2025)
- Added millisecond precision timer for more accurate scoring calculation (13 May 2025)
- Added points display that shows earned points after answering a question (13 May 2025)
- Improved points display UI showing as centered text at the top of quiz card (13 May 2025)

### Fixed
- Fixed bug where multiple participants could get the same name when joining a room (13 May 2025)

### Removed
- Removed multiplayer badge indicator from the Quiz component

### Fixed
- Fixed TypeScript errors related to unused variables in Quiz component (13 May 2025)
- Removed redundant timer state variables for cleaner code (13 May 2025)
- Optimized Quiz component rendering logic with proper loading and error states (13 May 2025)

### Fixed
- Resolved issues with timer effect dependencies causing unexpected behavior
- Fixed Promise handling in score update function to prevent runtime errors
- Enhanced submit button to switch to "Next Question" with countdown after answer submission (12 May 2025)
- Removed redundant question counter and status messages for cleaner UI (12 May 2025)
- Fixed auto-progression after time expiration and improved timer handling with separate question/feedback timers (12 May 2025)
- Removed text feedback messages for cleaner UI, relying on color coding for answer feedback (12 May 2025)
- Fixed timer calculation to properly combine remaining question time with feedback time when answer submitted early (12 May 2025)
- Fixed quiz progression by properly resetting question state when moving to new questions (12 May 2025)
- Fixed timer and button state when transitioning between questions to ensure a clean reset (12 May 2025)
- Enforced synchronized quiz progression by preventing manual advancement during feedback phase (12 May 2025)


<!-- Add your changes at the top -->
- Fixed multiplayer quiz difficulty validation issue when using capitalized difficulty levels (11 May 2025)
- Fixed host name display consistency, now showing "👑 HOST 👑" in all UI locations (11 May 2025)
- Fixed Lobby component width to be consistent with other cards (11 May 2025)
- Improved button layout in Lobby with full-width styling for better visual consistency (11 May 2025)
- Fixed Lobby component color scheme for better readability and consistency with other pages (11 May 2025)
- Updated buttons in Lobby component with bold text and consistent purple color scheme (11 May 2025)
- Changed text colors in Lobby to white with purple highlights for important elements (11 May 2025)

- Standardized component styling across the entire application with consistent rem units (11 May 2025)
- Converted all pixel measurements to rem units for better accessibility and scaling (11 May 2025)
- Applied consistent square button styling throughout all pages (11 May 2025)
- Unified container widths to 31.25rem (500px) across all components (11 May 2025)
- Standardized typography with consistent font sizes and spacing (11 May 2025)

- Redid styling to look more like ESC News with square buttons, brighter colors and larger buttons
- Redid most pages, but might have some smaller details left which is not fixed.
- Worked on input validation on join game page, with some user feedback if code is wrong.  

- Fixed input validation feedback in multiplayer game code entry form
- Fixed MultiplayerLobby UI by cleaning up duplicate buttons and improving layout
- Improved styling for multiplayer game options with descriptive cards
- Added proper loading states for game creation and joining (11 May 2025)


- Corrected favicon path references to work in both development and production environments (11 May 2025)

- Fixed quiz loading issues in prod making quiz load properly both in dev and prod. (10 May 2025)


- Fixed build error by removing unused Firestore collection import (10 May 2025)

- Fixed TypeScript errors in production build by properly handling unused variables (10 May 2025)
  - Added underscore prefixes to unused variables in Lobby and MultiplayerLobby components 
  - Enhanced Firebase debugging to provide more detailed error information
  - Added comprehensive logging to diagnose room creation issues in production build

- Fixed Firebase room creation in production preview by improving environment detection logic (10 May 2025)
  - Updated pathUtils.ts with proper environment detection using Vite's MODE variable
  - Enhanced firebase.ts to handle production preview mode correctly
  - Added debugging logs for easier environment identification

- Fixed question continuity issue after midquiz scoreboard by properly handling the question index state (10 May 2025)
- Fixed quiz loop issue that caused the quiz to restart from question 1 instead of continuing from question 6

- Fixed quiz loading issues in single and multiplayer modes with improved error handling and timeouts (10 May 2025)
- Enhanced QuizDataProvider with better debug logging and fallback mechanisms
- Improved Quiz component with loading progress status and error recovery options

- Fixed Firebase error when creating rooms by replacing serverTimestamp() with Timestamp.now() in arrays (10 May 2025)
- Updated player data structure to use static timestamps inside Firestore arrays
- Fixed player joining process to use compatible timestamp objects

- Fixed multiplayer lobby error by adding missing `joinRoom` and `generateRoomCode` functions (10 May 2025)
- Updated MultiplayerLobby component to correctly use the createRoom function
- Added extra validation for room joining to prevent joining games that have already started

- Fixed quiz loading issues in development environment with improved multi-method loading strategy (10 May 2025)
- Added comprehensive debugging and error handling for cross-environment compatibility 
- Enhanced Firebase initialization for better error detection
- Added direct JSON import fallback for quiz data in development mode
- Created built-in fallback quiz data to ensure functionality even when network requests fail
- Improved Firebase connectivity with better error handling and logging
- Added environment-specific optimizations for quiz data loading

- Added robust quiz data loading system that works in both development and production (10 May 2025)
- Created QuizDataProvider with multi-source fallback for reliable quiz loading
- Fixed path resolution issues in localhost development environment 
- Improved Vite configuration to correctly handle base paths in different environments
- Enhanced path utility to leverage Vite's import.meta.env.BASE_URL for consistent asset loading
- Added comprehensive debug logging to help troubleshoot environment-specific issues

- Fixed app compatibility issues between development and production environments
- Added path utility system to handle asset paths correctly in both localhost and deployed environments
- Updated Vite configuration to dynamically set base path according to environment
- Fixed quiz loading in development environment by using environment-aware asset paths
- Improved background image loading to work consistently across all environments

- Fixed multiplayer quiz loading issue for participants by implementing session storage for game state persistence
- Added error handling to gracefully recover from page refreshes during multiplayer games
- Added multiplayer status indicator in the quiz UI
- Enhanced state recovery in MidQuizScoreboard and QuizResults for interrupted multiplayer games
- Improved player score display to highlight the current player in score tables

- Added Firebase Firestore integration for multiplayer quiz rooms
- Replaced local storage room management with real-time Firestore database
- Added multiplayer game state synchronization across devices
- Added player score tracking in Firestore for real-time updates
- Improved lobby UI with real-time room status updates
- Added UUID generation for unique player identification
- Fixed real-time score updates in mid-quiz scoreboard for multiplayer
- Enhanced QuizResults to show multiplayer game winners

- Fixed TypeScript error with Firebase configuration by moving firebase.ts to the src directory to properly access Vite environment variable types
- Fixed horizontal scrollbar in quiz pages by changing container width from viewport units to percentage-based units
- Improved button layout in SelectDifficulty component with proper text wrapping and responsive container
- Enhanced quiz flow components to properly fit within the MobileFrame container
- Fixed content sizing within MobileFrame to properly display pages inside the phone UI
- Updated global styles to ensure all pages adapt to MobileFrame container dimensions
- Enhanced ContentConstraint component with proper overflow handling and padding
- Modified Home component sizing to use relative units instead of viewport units
- Fixed content width constraint in mobile frame to prevent horizontal overflow
- Fixed full-page background color for desktop view using absolute positioning
- Added ContentConstraint component to properly contain page content within phone frame
- Fixed mobile frame styling to prevent horizontal scrolling and ensure content fits properly inside frame
- Fixed background coloring to cover the entire viewport for desktop view
- Added mobile phone frame for desktop users to showcase the mobile-first design
- Improved responsive layout with a simulated phone UI on larger screens
- Added UnderDevelopment page for the Create Quiz feature
- Added route for /quiz to show "Feature Under Development" page
- Fixed navigation issue when clicking "Create Quiz" button

- Fixed asset paths after repository name change from `/europarty/` to `/escparty/`
- Fixed background image path in Home component
- Fixed quiz data loading paths in Quiz component
- Updated favicon and manifest paths in index.html

- Fixed state persistence in quiz flow by ensuring all required data is passed between MidQuizScoreboard and Quiz components
- Fixed TypeScript error in MidQuizScoreboard component by properly using the currentQuestionIndex variable

## Sprint 6
- Fixed issues in Mid-Quiz Scoreboard to update player list and scores dynamically.
- Added setPlayers function to Mid-Quiz Scoreboard to update player list dynamically.
- Fixed fetch logic in Quiz component to ensure correct URL is used for fetching quiz data.
- Fixed bug in MidQuizScoreboard where quiz continuation used incorrect URL format causing JSON loading errors.
- Added state persistence between Quiz and MidQuizScoreboard to maintain question index and score.
