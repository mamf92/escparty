import { useEffect, useState } from "react";
import styled from "styled-components";
import { useLocation, useNavigate } from "react-router-dom";
import { Player, listenToRoom } from "../utils/roomsFirestore";

interface MultiplayerGameData {
  multiplayer: boolean;
  roomCode: string;
  playerId: string;
  difficulty?: string;
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
    playerId: null
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
    playerId: locationState.playerId || null
  });

  const [players, setPlayers] = useState<Player[]>(gameData.players);
  const [error, setError] = useState<string | null>(null);

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
            difficulty: multiplayerData.difficulty || prev.difficulty
          }));
        } catch (e) {
          console.error("Error parsing multiplayer data from sessionStorage:", e);
          setError("Unable to retrieve game data. Please return to the lobby.");
        }
      }
    }

    // Set up real-time listener if we have multiplayer details
    if (gameData.multiplayer && gameData.roomCode) {
      const unsubscribe = listenToRoom(gameData.roomCode, (room) => {
        if (room) {
          setPlayers(room.players);
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

    // Pass all the necessary state back to the Quiz component
    navigate(`/quiz/${gameData.difficulty}`, {
      state: {
        currentQuestionIndex: gameData.currentQuestionIndex,
        score: gameData.score,
        players,
        multiplayer: gameData.multiplayer,
        roomCode: gameData.roomCode,
        playerId: gameData.playerId
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
      <Score>You scored {gameData.score} out of {gameData.totalQuestions} so far!</Score>
      <PlayerListTitle>Current players:</PlayerListTitle>
      <PlayerList>
        {players.map((player: Player, index: number) => (
          <PlayerItem key={player.id || index}>
            {player.name}: {player.score}
            {player.id === gameData.playerId ? " (You)" : ""}
          </PlayerItem>
        ))}
      </PlayerList>
      <NextButton onClick={continueQuiz}>Continue Quiz</NextButton>
    </Container>
  );
};

export default MidQuizScoreboard;

// Styled Components
const Container = styled.div`
  width: 100%;
  max-width: 500px;
  margin: auto;
  text-align: center;
  padding: 20px;
  background: ${({ theme }) => theme.colors.magnolia};
  border-radius: 10px;
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

const PlayerListTitle = styled.h3`
  font-size: 1.2rem;
  margin-top: 1em;
  text-align: left;
  text-decoration: underline;
  color: ${({ theme }) => theme.colors.darkpurple};
`;

const PlayerList = styled.ul`
  list-style: none;
  padding: 0;
  text-align: left;
  margin: 20px 0;
`;

const PlayerItem = styled.li`
  font-size: 1rem;
  font-weight: bold;
  margin: 5px 0;
  color: ${({ theme }) => theme.colors.black};
`;

const NextButton = styled.button`
  margin-top: 20px;
  padding: 1rem 2rem;
  font-size: 1rem;
  font-weight: bold;
  background-color: ${({ theme }) => theme.colors.purple};
  color: white;
  border: none;
  cursor: pointer;
  transition: 0.3s;
  &:hover {
    background: ${({ theme }) => theme.colors.pinkLavender};
  }
`;

const ErrorMessage = styled.p`
  color: ${({ theme }) => theme.colors.incorrectRed};
  font-size: 1.2rem;
  margin-bottom: 20px;
`;
