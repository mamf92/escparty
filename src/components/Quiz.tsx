import { useState, useEffect } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import { useParams } from "react-router-dom";
import { FaHome } from "react-icons/fa";


interface Question {
  id: number;
  question: string;
  options: string[];
  correctAnswer: string;
}

const Quiz = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const navigate = useNavigate();
  const { difficulty } = useParams();



  useEffect(() => {
    const quizFiles: Record<string, string> = {
      easy: "/quizdata/escBeginnerQuiz.json",
      medium: "/quizdata/escIntermediateQuiz.json",
      hard: "/quizdata/escAdvancedQuiz.json"
    };

    const selectedQuiz = quizFiles[difficulty ?? "easy"];

    fetch(selectedQuiz)
      .then((response) => response.json())
      .then((data) => {
        const filteredQuestions = data.filter((q: any) => !q.disabled);
        setQuestions(filteredQuestions);
      })
      .catch((error) => console.error("Error loading quiz data:", error));
  }, [difficulty]);



  if (questions.length === 0) return <Loading>Loading quiz...</Loading>;

  const currentQuestion = questions[currentQuestionIndex];

  const handleAnswer = (answer: string) => {
    setSelectedAnswer(answer);
  };

  const submitAnswer = () => {
    if (selectedAnswer) {
      setIsSubmitted(true);
      if (selectedAnswer === currentQuestion.correctAnswer) {
        setScore(score + 1);
      }
    }
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedAnswer(null);
      setIsSubmitted(false);
    } else {
      // Save score in localStorage
      const previousScores = JSON.parse(localStorage.getItem("quizScores") || "[]");
      const newScore = { score, total: questions.length, date: new Date().toLocaleDateString() };
      localStorage.setItem("quizScores", JSON.stringify([...previousScores, newScore]));

      // Navigate to results page
      navigate("/results", { state: { score, totalQuestions: questions.length } });
    }
  };

  const restartQuiz = () => {
    setCurrentQuestionIndex(0);
    setScore(0);
    setQuizCompleted(false);
    setSelectedAnswer(null);
    setIsSubmitted(false);
  };

  return quizCompleted ? (
    <Container>
      <QuestionText>🎉 Quiz Completed! 🎤</QuestionText>
      <ScoreText>You scored {score} out of {questions.length}!</ScoreText>
      <SubmitButton onClick={restartQuiz}>Restart Quiz</SubmitButton>
    </Container>
  ) : (
    <Container>
      <QuestionText>{currentQuestion.question}</QuestionText>
      <OptionsContainer>
        {currentQuestion.options.map((option) => (
          <OptionButton
            key={option}
            onClick={() => handleAnswer(option)}
            disabled={isSubmitted}
            $isSelected={selectedAnswer === option}
            $isCorrect={isSubmitted && option === currentQuestion.correctAnswer}
            $isWrong={isSubmitted && option !== currentQuestion.correctAnswer && option === selectedAnswer}
          >
            {option}
          </OptionButton>
        ))}
      </OptionsContainer>

      {!isSubmitted ? (
        <SubmitButton onClick={submitAnswer} disabled={!selectedAnswer}>
          Submit Answer
        </SubmitButton>
      ) : (
        <NextButton onClick={nextQuestion}>Next Question</NextButton>
      )}
      <QuitButton onClick={() => navigate("/")}>
        <FaHome size={20} />
      </QuitButton>
    </Container>
  );
};

export default Quiz;

// Styled Components
const Container = styled.div`
  width: 100vw;
  max-width: 500px;
  margin: auto;
  text-align: center;
  padding: 20px;
  background: ${({ theme }) => theme.colors.magnolia};
  border-radius: 10px;
  overflow-x: hidden;
`;

const QuestionText = styled.h2`
  font-family: ${({ theme }) => theme.fonts.heading};
  color: ${({ theme }) => theme.colors.night};
  font-size: 1.5rem;
  margin-bottom: 20px;
`;

const OptionsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const OptionButton = styled.button<{ $isSelected: boolean; $isCorrect: boolean; $isWrong: boolean }>`
  background: ${({ $isSelected, $isCorrect, $isWrong, theme }) =>
    $isCorrect ? theme.colors.correctGreen :
      $isWrong ? theme.colors.incorrectRed :
        $isSelected ? theme.colors.pinkLavender : theme.colors.gray};
  color: white;
  font-size: 1rem;
  padding: 10px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  transition: 0.3s;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  &:hover:not(:disabled) {
    background: ${({ $isSelected, theme }) => ($isSelected ? theme.colors.night : theme.colors.amethyst)};
  }
`;

const SubmitButton = styled.button`
  margin-top: 20px;
  background: ${({ theme }) => theme.colors.amethyst};
  color: white;
  font-size: 1rem;
  padding: 10px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  transition: 0.3s;
  width: 100%;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.pinkLavender};
  }
`;

const NextButton = styled(SubmitButton)``;

const Loading = styled.p`
  text-align: center;
  font-size: 1.2rem;
  color: ${({ theme }) => theme.colors.night};
`;

const ScoreText = styled.p`
  font-size: 1.5rem;
  font-weight: bold;
  color: ${({ theme }) => theme.colors.amethyst};
  margin-bottom: 20px;
`;

const QuitButton = styled.button`
  position: relative;
  margin-top: 20px; /* Creates space below other buttons */
  background: ${({ theme }) => theme.colors.gray};
  color: white;
  border: none;
  border-radius: 50%; 
  width: 40px; 
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.3s;

  &:hover {
    background: ${({ theme }) => theme.colors.night};
  }
`;