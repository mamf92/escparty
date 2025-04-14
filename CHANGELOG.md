# Changelog

<!-- Add your changes at the top -->

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
