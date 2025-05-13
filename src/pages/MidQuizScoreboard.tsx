import { useEffect, useState } from "react";
import styled from "styled-components";
import { useLocation, useNavigate } from "react-router-dom";
import { Player, listenToRoom } from "../utils/roomsFirestore";

interface MultiplayerGameData {
  multiplayer: boolean;
  roomCode: string;
  playerId: string;
  difficulty?: string;
  hostIsObserver?: boolean;
}

const MidQuizScoreboard = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Try to get data from location state first
  const locationState = location.state || {
    score: 0,
    totalQuestions: 0,
    currentQuestionIndex: 0,
    difficulty: "easy",
    players: [],
    multiplayer: false,
    roomCode: null,
    playerId: null,
    hostIsObserver: false
  };

  // Use state from location, or try to recover from sessionStorage
  const [gameData, setGameData] = useState({
    score: locationState.score || 0,
    totalQuestions: locationState.totalQuestions || 0,
    currentQuestionIndex: locationState.currentQuestionIndex || 0,
    difficulty: locationState.difficulty || "easy",
    players: locationState.players || [],
    multiplayer: locationState.multiplayer || false,
    roomCode: locationState.roomCode || null,
    playerId: locationState.playerId || null,
    hostIsObserver: locationState.hostIsObserver || false
  });

  const [players, setPlayers] = useState<Player[]>(gameData.players);
  const [error, setError] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [hostIsObserver, setHostIsObserver] = useState(gameData.hostIsObserver);

  useEffect(() => {
    // If we don't have location state but we're on this page, try to recover from sessionStorage
    if (!location.state) {
      const storedData = sessionStorage.getItem('multiplayerGame');
      if (storedData) {
        try {
          const multiplayerData = JSON.parse(storedData) as MultiplayerGameData;
          setGameData(prev => ({
            ...prev,
            multiplayer: true,
            roomCode: multiplayerData.roomCode,
            playerId: multiplayerData.playerId,
            difficulty: multiplayerData.difficulty || prev.difficulty,
            hostIsObserver: multiplayerData.hostIsObserver || false
          }));
          setHostIsObserver(multiplayerData.hostIsObserver || false);
        } catch (e) {
          console.error("Error parsing multiplayer data from sessionStorage:", e);
          setError("Unable to retrieve game data. Please return to the lobby.");
        }
      }
    }

    // Check if current user is the host
    const isUserHost = localStorage.getItem("isHost") === "true";
    setIsHost(isUserHost);
    if (isUserHost) {
      const observerStatus = localStorage.getItem("hostIsObserver") === "true";
      setHostIsObserver(observerStatus);
    }

    // Set up real-time listener if we have multiplayer details
    if (gameData.multiplayer && gameData.roomCode) {
      const unsubscribe = listenToRoom(gameData.roomCode, (room) => {
        if (room) {
          // Filter out host from players list if host is in observer mode
          const filteredPlayers = room.hostIsObserver
            ? room.players.filter(player => player.id !== room.hostId)
            : room.players;

          setPlayers(filteredPlayers);

          // Update hostIsObserver if it exists in the room data
          if (room.hostIsObserver !== undefined && isHost) {
            setHostIsObserver(room.hostIsObserver);
          }
        } else {
          setError("Game room no longer exists");
          setTimeout(() => navigate("/multiplayer"), 2000);
        }
      });

      return () => unsubscribe();
    }
  }, [gameData.multiplayer, gameData.roomCode, location.state, navigate]);

  const continueQuiz = () => {
    if (error) {
      navigate("/multiplayer");
      return;
    }

    // If host is observer, they stay on the scoreboard and don't participate in quiz
    if (isHost && hostIsObserver) {
      // Let's just refresh the current view to get updated scores
      setError(null); // Clear any errors
      return;
    }

    // Pass all the necessary state back to the Quiz component
    navigate(`/quiz/${gameData.difficulty}`, {
      state: {
        currentQuestionIndex: gameData.currentQuestionIndex,
        score: gameData.score,
        players,
        multiplayer: gameData.multiplayer,
        roomCode: gameData.roomCode,
        playerId: gameData.playerId,
        hostIsObserver: hostIsObserver
      }
    });
  };

  if (error) {
    return (
      <Container>
        <Title>Error</Title>
        <ErrorMessage>{error}</ErrorMessage>
        <NextButton onClick={() => navigate("/multiplayer")}>Return to Multiplayer</NextButton>
      </Container>
    );
  }

  return (
    <Container>
      <Title>📊 Mid-Quiz Scoreboard</Title>
      {isHost && hostIsObserver ? (
        <Score>You are monitoring the quiz as host</Score>
      ) : (
        <Score>You scored {gameData.score} so far!</Score>
      )}
      <ScoreTitle>🏆 Current Standings</ScoreTitle>
      <ScoreTable>
        <thead>
          <tr>
            <th>Player</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {players
            .sort((a: Player, b: Player) => b.score - a.score)
            .map((player: Player) => (
              <tr key={player.id}>
                <td>{player.name}{player.id === gameData.playerId ? " (You)" : ""}</td>
                <td>{player.score}</td>
              </tr>
            ))}
        </tbody>
      </ScoreTable>
      <NextButton onClick={continueQuiz}>
        {isHost && hostIsObserver ? "Refresh Scores" : "Continue Quiz"}
      </NextButton>
    </Container>
  );
};

export default MidQuizScoreboard;

// Styled Components
const Container = styled.div`
  width: 100%;
  max-width: 31.25rem; /* 500px */
  margin: auto;
  text-align: center;
  padding: 1.25rem; /* 20px */
  background: ${({ theme }) => theme.colors.magnolia};
  border-radius: 0; /* Changed to match square design */
`;

const Title = styled.h2`
  font-family: ${({ theme }) => theme.fonts.heading};
  color: ${({ theme }) => theme.colors.night};
  font-size: 1.5rem;
  margin-bottom: 1.25rem; /* 20px */
`;

const Score = styled.p`
  font-size: 1.5rem;
  font-weight: bold;
  color: ${({ theme }) => theme.colors.purple};
  margin-bottom: 1.25rem; /* 20px */
`;

const ScoreTitle = styled.h3`
  font-family: ${({ theme }) => theme.fonts.heading};
  color: ${({ theme }) => theme.colors.night};
  margin-top: 1.25rem; /* 20px */
`;

const ScoreTable = styled.table`
  width: 100%;
  margin-top: 0.625rem; /* 10px */
  border-collapse: collapse;
  font-size: 1rem;
  
  th, td {
    border: 0.0625rem solid ${({ theme }) => theme.colors.gray}; /* 1px */
    padding: 0.5rem; /* 8px */
    text-align: center;
  }

  th {
    background: ${({ theme }) => theme.colors.nightblue};
    color: white;
  }

  td {
    color: ${({ theme }) => theme.colors.black};
  }
`;

const NextButton = styled.button`
  margin-top: 1.25rem; /* 20px */
  padding: 1rem 2rem; /* 16px 32px */
  font-size: 1rem;
  font-weight: bold;
  background-color: ${({ theme }) => theme.colors.purple};
  color: white;
  border: none;
  cursor: pointer;
  transition: 0.3s;
  &:hover {
    background: ${({ theme }) => theme.colors.darkpurple};
  }
`;

const ErrorMessage = styled.p`
  color: ${({ theme }) => theme.colors.incorrectRed};
  font-size: 1.2rem;
  margin-bottom: 1.25rem; /* 20px */
`;
