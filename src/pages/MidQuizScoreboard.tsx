import { useEffect, useState } from "react";
import styled from "styled-components";
import { useLocation, useNavigate } from "react-router-dom";

interface Player {
  name: string;
  score: number;
}

const MidQuizScoreboard = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    score,
    totalQuestions,
    currentQuestionIndex,
    difficulty,
    players: initialPlayers
  } = location.state || {
    score: 0,
    totalQuestions: 0,
    currentQuestionIndex: 0,
    difficulty: "easy",
    players: []
  };

  const [players, setPlayers] = useState<Player[]>(initialPlayers);

  useEffect(() => {
    const handleStorageUpdate = () => {
      const updatedPlayers = JSON.parse(localStorage.getItem("players") || "[]");
      setPlayers(updatedPlayers);
    };

    window.addEventListener("storage", handleStorageUpdate);
    return () => {
      window.removeEventListener("storage", handleStorageUpdate);
    };
  }, []);

  const continueQuiz = () => {
    // Pass all the necessary state back to the Quiz component
    navigate(`/quiz/${difficulty}`, {
      state: {
        currentQuestionIndex,
        score,
        players
      }
    });
  };

  return (
    <Container>
      <Title>📊 Mid-Quiz Scoreboard</Title>
      <Score>You scored {score} out of {totalQuestions} so far!</Score>
      <PlayerListTitle>Current players:</PlayerListTitle>
      <PlayerList>
        {players.map((player: Player, index: number) => (
          <Player key={index}>{player.name}: {player.score}</Player>
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
  font-size: 1.8rem;
  margin-bottom: 20px;
`;

const Score = styled.p`
  font-size: 1.5rem;
  font-weight: bold;
  color: ${({ theme }) => theme.colors.amethyst};
  margin-bottom: 20px;
`;

const PlayerListTitle = styled.h3`
  font-size: 1.2rem;
  margin-top: 1em;
  text-align: left;
  text-decoration: underline;
  color: ${({ theme }) => theme.colors.pinkLavender};
`;

const PlayerList = styled.ul`
  list-style: none;
  padding: 0;
  text-align: left;
  margin: 20px 0;
`;

const Player = styled.li`
  font-size: 1.2rem;
  margin: 5px 0;
`;

const NextButton = styled.button`
  margin-top: 20px;
  padding: 10px 20px;
  font-size: 1.2rem;
  background-color: ${({ theme }) => theme.colors.amethyst};
  color: white;
  border: none;
  cursor: pointer;
  border-radius: 5px;
  transition: 0.3s;
  &:hover {
    background: ${({ theme }) => theme.colors.pinkLavender};
  }
`;
