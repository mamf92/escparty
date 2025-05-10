# Changelog

<!-- Add your changes at the top -->
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
