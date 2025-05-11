import { useState, useEffect } from "react";
import styled from "styled-components";
import { useLocation, useNavigate } from "react-router-dom";
import { Player, listenToRoom } from "../utils/roomsFirestore";

interface ScoreEntry {
  score: number;
  total: number;
  date: string;
  difficulty?: string;
}

interface MultiplayerGameData {
  multiplayer: boolean;
  roomCode: string;
  playerId: string;
  difficulty?: string;
}

const QuizResults = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Try to get data from location state first
  const locationState = location.state || {
    score: 0,
    totalQuestions: 0,
    multiplayer: false,
    players: [],
    roomCode: null,
    playerId: null
  };

  const [gameData, setGameData] = useState({
    score: locationState.score || 0,
    totalQuestions: locationState.totalQuestions || 0,
    multiplayer: locationState.multiplayer || false,
    roomCode: locationState.roomCode || null,
    playerId: locationState.playerId || null,
    players: locationState.players || []
  });

  const [scoreHistory, setScoreHistory] = useState<ScoreEntry[]>([]);
  const [winner, setWinner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>(gameData.players || []);

  useEffect(() => {
    // Try to recover multiplayer data from sessionStorage if not in location state
    if (!location.state && !gameData.multiplayer) {
      const storedData = sessionStorage.getItem('multiplayerGame');
      if (storedData) {
        try {
          const multiplayerData = JSON.parse(storedData) as MultiplayerGameData;
          setGameData(prev => ({
            ...prev,
            multiplayer: true,
            roomCode: multiplayerData.roomCode,
            playerId: multiplayerData.playerId
          }));
        } catch (e) {
          console.error("Error parsing multiplayer data from sessionStorage:", e);
        }
      }
    }

    // Clear session storage data as we're at the end of the game
    sessionStorage.removeItem('multiplayerGame');

    // Handle single player case
    if (!gameData.multiplayer) {
      const storedScores = JSON.parse(localStorage.getItem("quizScores") || "[]");
      setScoreHistory(storedScores);

      if (storedScores.length > 0) {
        // Determine the best score
        const highestScore = Math.max(...storedScores.map((entry: ScoreEntry) => entry.score));
        const winnerEntry = storedScores.find((entry: ScoreEntry) => entry.score === highestScore);
        if (winnerEntry) {
          setWinner(`Best Score: ${winnerEntry.score} out of ${winnerEntry.total}`);
        }
      }
    }
    // Handle multiplayer case
    else if (gameData.roomCode) {
      // Set up one final listen to get the final scores
      const unsubscribe = listenToRoom(gameData.roomCode, (room) => {
        if (room) {
          setPlayers(room.players);

          // Calculate winner
          if (room.players.length > 0) {
            const sortedPlayers = [...room.players].sort((a, b) => b.score - a.score);
            const highestScore = sortedPlayers[0].score;

            // Check for a tie
            const winners = sortedPlayers.filter(player => player.score === highestScore);

            if (winners.length === 1) {
              setWinner(`Winner: ${winners[0].name} with ${highestScore} points!`);
            } else if (winners.length > 1) {
              const winnerNames = winners.map(w => w.name).join(', ');
              setWinner(`Tie between ${winnerNames} with ${highestScore} points!`);
            }
          }
        } else {
          setError("Game room no longer exists");
        }
      });

      // Clean up listener after 2 seconds - we just need a snapshot of final scores
      setTimeout(() => unsubscribe(), 2000);
    }
  }, [gameData.multiplayer, gameData.roomCode, gameData.playerId, location.state]);

  return (
    <Container>
      <Title>🎉 Quiz Completed! 🎤</Title>
      <Score>You scored {gameData.score} out of {gameData.totalQuestions}!</Score>
      {winner && <WinnerText>{winner}</WinnerText>}
      {error && <ErrorText>{error}</ErrorText>}

      <ButtonContainer>
        <ActionButton onClick={() => navigate("/quiz")}>Restart Quiz</ActionButton>
        {!gameData.multiplayer && (
          <ScoreboardButton onClick={() => navigate("/scoreboard")}>
            📊 View Scoreboard
          </ScoreboardButton>
        )}
        <HomeButton onClick={() => navigate("/")}>Return to Home</HomeButton>
      </ButtonContainer>

      {gameData.multiplayer && players && players.length > 0 && (
        <>
          <ScoreTitle>📊 Final Scores</ScoreTitle>
          <ScoreTable>
            <thead>
              <tr>
                <th>Player</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {players.sort((a: Player, b: Player) => b.score - a.score).map((player: Player) => (
                <tr key={player.id}>
                  <td>{player.name}{player.id === gameData.playerId ? " (You)" : ""}</td>
                  <td>{player.score}</td>
                </tr>
              ))}
            </tbody>
          </ScoreTable>
        </>
      )}

      {!gameData.multiplayer && scoreHistory.length > 0 && (
        <>
          <ScoreTitle>📊 Past Scores</ScoreTitle>
          <ScoreTable>
            <thead>
              <tr>
                <th>Date</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {scoreHistory.map((entry, index) => (
                <tr key={index}>
                  <td>{new Date(entry.date).toLocaleDateString()}</td>
                  <td>{entry.score} / {entry.total}</td>
                </tr>
              ))}
            </tbody>
          </ScoreTable>
        </>
      )}
    </Container>
  );
};

export default QuizResults;

// Styled Components
const Container = styled.div`
  width: 100%;
  max-width: 500px;
  margin: auto;
  text-align: center;
  padding: 20px;
  background: ${({ theme }) => theme.colors.white};
`;

const Title = styled.h2`
  font-family: ${({ theme }) => theme.fonts.heading};
  color: ${({ theme }) => theme.colors.night};
  font-size: 1.5rem;
  margin-bottom: 20px;
`;

const Score = styled.p`
  font-size: 1.5rem;
  font-weight: bold;
  color: ${({ theme }) => theme.colors.purple};
  margin-bottom: 20px;
`;

const WinnerText = styled.p`
  font-size: 1.5rem;
  font-weight: bold;
  color: ${({ theme }) => theme.colors.correctGreen};
  margin-bottom: 20px;
`;

const ErrorText = styled.p`
  font-size: 1rem;
  color: ${({ theme }) => theme.colors.incorrectRed};
  margin-bottom: 20px;
`;

const ButtonContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const ActionButton = styled.button`
  background: ${({ theme }) => theme.colors.purple};
  color: white;
  font-size: 1rem;
  font-weight: bold;
  padding: 1rem;
  border: none;
  cursor: pointer;
  transition: 0.3s;
  width: 100%;

  &:hover {
    background: ${({ theme }) => theme.colors.darkpurple};
  }
`;

const ScoreboardButton = styled(ActionButton)`
  background: ${({ theme }) => theme.colors.darkpurple};

  &:hover {
    background: ${({ theme }) => theme.colors.purple};
  }`;

const HomeButton = styled(ActionButton)`
  background: ${({ theme }) => theme.colors.gray};

  &:hover {
    background: ${({ theme }) => theme.colors.night};
  }
`;

const ScoreTitle = styled.h3`
  font-family: ${({ theme }) => theme.fonts.heading};
  color: ${({ theme }) => theme.colors.night};
  margin-top: 20px;
`;

const ScoreTable = styled.table`
  width: 100%;
  margin-top: 10px;
  border-collapse: collapse;
  font-size: 1rem;
  
  th, td {
    border: 1px solid ${({ theme }) => theme.colors.gray};
    padding: 8px;
    text-align: center;
  }

  th {
    background: ${({ theme }) => theme.colors.nightblue};
    color: white;
  }

  td {
  color: ${({ theme }) => theme.colors.black};
`;

