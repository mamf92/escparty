import { useState, useEffect } from "react";
import styled from "styled-components";
import { useLocation, useNavigate } from "react-router-dom"; // ✅ Import useLocation

interface ScoreEntry {
  score: number;
  total: number;
  date: string;
}

const QuizResults = () => {
  const location = useLocation(); // ✅ Get quiz results from navigation state
  const navigate = useNavigate();
  const { score, totalQuestions } = location.state || { score: 0, totalQuestions: 0 };
  const [scoreHistory, setScoreHistory] = useState<ScoreEntry[]>([]);
  const [winner, setWinner] = useState<string | null>(null);

  useEffect(() => {
    const storedScores = JSON.parse(localStorage.getItem("quizScores") || "[]");
    setScoreHistory(storedScores);

    // Determine the winner
    const highestScore = Math.max(...storedScores.map((entry: ScoreEntry) => entry.score));
    const winnerEntry = storedScores.find((entry: ScoreEntry) => entry.score === highestScore);
    if (winnerEntry) {
      setWinner(`Winner: ${winnerEntry.score} out of ${winnerEntry.total}`);
    }
  }, []);

  return (
    <Container>
      <Title>🎉 Quiz Completed! 🎤</Title>
      <Score>You scored {score} out of {totalQuestions}!</Score>
      {winner && <WinnerText>{winner}</WinnerText>}

      <ButtonContainer>
        <ActionButton onClick={() => navigate("/quiz")}>Restart Quiz</ActionButton>
        <ScoreboardButton onClick={() => navigate("/scoreboard")}>📊 View Scoreboard</ScoreboardButton>
        <HomeButton onClick={() => navigate("/")}>Return to Home</HomeButton>
      </ButtonContainer>

      {scoreHistory.length > 0 && (
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
                  <td>{entry.date}</td>
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

const WinnerText = styled.p`
  font-size: 1.5rem;
  font-weight: bold;
  color: ${({ theme }) => theme.colors.correctGreen};
  margin-bottom: 20px;
`;

export default QuizResults;

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

const ButtonContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const ActionButton = styled.button`
  background: ${({ theme }) => theme.colors.amethyst};
  color: white;
  font-size: 1rem;
  padding: 10px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  transition: 0.3s;
  width: 100%;

  &:hover {
    background: ${({ theme }) => theme.colors.pinkLavender};
  }
`;

const ScoreboardButton = styled(ActionButton)`
  background: ${({ theme }) => theme.colors.pinkLavender};

  &:hover {
    background: ${({ theme }) => theme.colors.amethyst};
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
    color: ${({ theme }) => theme.colors.night}; /* ✅ Set text color to black */
  }

  th {
    background: ${({ theme }) => theme.colors.pinkLavender};
  }
`;

