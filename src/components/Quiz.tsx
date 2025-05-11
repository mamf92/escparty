import { useState, useEffect } from "react";
import styled from "styled-components";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { FaHome } from "react-icons/fa";
import { updatePlayerScore, listenToRoom, Room } from "../utils/roomsFirestore";
import { isDevelopmentEnvironment } from "../utils/pathUtils";
import { loadQuizData, QuizQuestion, QuizDifficulty } from "../utils/QuizDataProvider";

interface MultiplayerGameData {
  multiplayer: boolean;
  roomCode: string;
  playerId: string;
  difficulty?: string;
}

const Quiz = () => {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const location = useLocation();
  const locationState = location.state as {
    currentQuestionIndex?: number;
    score?: number;
    multiplayer?: boolean;
    roomCode?: string;
    playerId?: string;
  } | null;

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(locationState?.currentQuestionIndex || 0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState(locationState?.score || 0);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [isMultiplayer, setIsMultiplayer] = useState(false);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<string>("Initializing...");

  const navigate = useNavigate();
  const { difficulty } = useParams<{ difficulty: string }>();

  useEffect(() => {
    // Clear any previous errors when component mounts or difficulty changes
    setError(null);
    setLoading(true);
    setLoadingStatus("Initializing quiz...");

    // Track component mounting for debug purposes
    console.log("🚀 Quiz component mounted", {
      mode: import.meta.env.MODE,
      baseUrl: import.meta.env.BASE_URL,
      currentUrl: window.location.href,
      difficulty,
      isLocationStatePresent: !!location.state,
      currentQuestionIndex
    });

    // Handle case when difficulty is undefined or invalid
    if (!difficulty || !['easy', 'medium', 'hard'].includes(difficulty)) {
      console.error(`❌ Invalid difficulty parameter: ${difficulty}`);
      setError(`Invalid difficulty level: ${difficulty}`);
      setLoading(false);
      return;
    }

    // Process multiplayer data
    let multiplayerData: MultiplayerGameData | null = null;

    // First try to get multiplayer data from location state
    if (locationState?.multiplayer) {
      console.log("📱 Multiplayer data found in location state:", locationState);
      multiplayerData = {
        multiplayer: true,
        roomCode: locationState.roomCode || '',
        playerId: locationState.playerId || ''
      };
    } else {
      // If not in location state, check sessionStorage (for page refreshes or direct navigation)
      const storedData = sessionStorage.getItem('multiplayerGame');
      if (storedData) {
        try {
          multiplayerData = JSON.parse(storedData) as MultiplayerGameData;
          console.log("📱 Multiplayer data found in sessionStorage:", multiplayerData);
        } catch (e) {
          console.error("❌ Error parsing multiplayer data from sessionStorage:", e);
        }
      }
    }

    // Set multiplayer state if we have valid data
    let unsubscribeRoom: () => void = () => { };
    if (multiplayerData?.multiplayer && multiplayerData.roomCode && multiplayerData.playerId) {
      console.log("🔄 Setting up multiplayer mode...");
      setIsMultiplayer(true);
      setRoomCode(multiplayerData.roomCode);
      setPlayerId(multiplayerData.playerId);
      setLoadingStatus("Connecting to game room...");

      // Store multiplayer info in session storage (for page refresh recovery)
      sessionStorage.setItem('multiplayerGame', JSON.stringify(multiplayerData));

      // Set up listener for room changes in multiplayer
      unsubscribeRoom = listenToRoom(multiplayerData.roomCode, (roomData) => {
        if (roomData) {
          console.log("🎮 Room data updated:", roomData);
          setRoom(roomData);

          // If we get room data with difficulty, use it as backup
          if (!difficulty && roomData.difficulty) {
            console.log(`Using room difficulty: ${roomData.difficulty}`);
          }
        } else {
          console.error("❌ Game room not found");
          // Room doesn't exist, go back to multiplayer lobby
          setError("Game room no longer exists");
          setTimeout(() => navigate("/multiplayer"), 2000);
        }
      });
    }

    // Enhanced debugging
    console.log(`🌐 Environment: ${isDevelopmentEnvironment() ? 'Development' : 'Production'}`);
    console.log(`📂 Base URL: ${import.meta.env.BASE_URL}`);
    console.log(`🎮 Difficulty parameter: ${difficulty}`);

    // Load quiz data using our QuizDataProvider
    setLoadingStatus("Loading quiz data...");

    // Use Promise.race with a timeout to prevent infinite loading
    const quizLoaderPromise = loadQuizData(difficulty as QuizDifficulty);
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Quiz loading timed out after 10 seconds')), 10000);
    });

    Promise.race([quizLoaderPromise, timeoutPromise])
      .then((quizData) => {
        console.log("✅ Fetched Quiz Data:", quizData);
        if (!quizData || !Array.isArray(quizData)) {
          console.error("❌ Quiz data is not in expected format:", quizData);
          setError("Quiz data format is invalid");
          setLoading(false);
          return;
        }

        const filteredQuestions = quizData.filter(q => !q.disabled);
        console.log(`📋 Loaded ${filteredQuestions.length} questions for ${difficulty} difficulty`);

        if (filteredQuestions.length === 0) {
          setError("No questions available for this difficulty level");
          setLoading(false);
          return;
        }

        setQuestions(filteredQuestions);
        setLoading(false);

        // We now use the state initialized at the component level
        // instead of trying to retrieve it from localStorage
        console.log(`Using question index: ${currentQuestionIndex}, score: ${score}`);
      })
      .catch((error) => {
        console.error("❌ Error loading quiz data:", error);
        setError(`Failed to load quiz: ${error.message}`);
        setLoading(false);
      });

    // Cleanup function
    return () => {
      // Clean up room listener if it was set
      unsubscribeRoom();
      console.log("🧹 Quiz component unmounting, cleaned up listeners");
    };
  }, [difficulty, navigate, location, currentQuestionIndex, score]);

  if (loading) {
    return (
      <LoadingContainer>
        <LoadingSpinner />
        <Loading>{loadingStatus}</Loading>
      </LoadingContainer>
    );
  }

  if (error) {
    return (
      <ErrorContainer>
        <ErrorMessage>{error}</ErrorMessage>
        <RetryButton onClick={() => window.location.reload()}>Retry</RetryButton>
        <RetryButton onClick={() => navigate("/")}>Back to Home</RetryButton>
      </ErrorContainer>
    );
  }

  if (questions.length === 0) {
    return (
      <ErrorContainer>
        <ErrorMessage>No questions available for this quiz.</ErrorMessage>
        <RetryButton onClick={() => navigate("/")}>Back to Home</RetryButton>
      </ErrorContainer>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];

  const handleAnswer = (answer: string) => {
    setSelectedAnswer(answer);
  };

  const submitAnswer = async () => {
    if (selectedAnswer) {
      setIsSubmitted(true);

      // Check if answer is correct and increment score
      if (selectedAnswer === currentQuestion.correctAnswer) {
        const newScore = score + 1;
        setScore(newScore);

        // If multiplayer, update score in Firestore
        if (isMultiplayer && roomCode && playerId) {
          try {
            await updatePlayerScore(roomCode, playerId, newScore);
          } catch (error) {
            console.error("Failed to update score:", error);
          }
        }
      }
    }
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      if ((currentQuestionIndex + 1) % 5 === 0) {
        navigate("/mid-quiz-scoreboard", {
          state: {
            score,
            totalQuestions: questions.length,
            currentQuestionIndex: currentQuestionIndex + 1,
            difficulty,
            players: isMultiplayer && room ? room.players : [{ name: "Player 1", score }],
            multiplayer: isMultiplayer,
            roomCode,
            playerId
          }
        });
      } else {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
        setSelectedAnswer(null);
        setIsSubmitted(false);
      }
    } else {
      const difficultyLevel = difficulty ?? "easy";

      if (!isMultiplayer) {
        const previousScores = JSON.parse(localStorage.getItem("quizScores") || "[]");
        const newScore = {
          score,
          total: questions.length,
          difficulty: difficultyLevel,
          date: new Date().toISOString()
        };
        localStorage.setItem("quizScores", JSON.stringify([...previousScores, newScore]));
      }

      navigate("/results", {
        state: {
          score,
          totalQuestions: questions.length,
          difficulty,
          multiplayer: isMultiplayer,
          roomCode,
          playerId,
          players: isMultiplayer && room ? room.players : null
        }
      });
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
  position: relative;
  width: 100%;
  max-width: 31.25rem; /* 500px */
  margin: auto;
  text-align: center;
  padding: 1.25rem; /* 20px */
  background: ${({ theme }) => theme.colors.magnolia};
  overflow-x: hidden;
`;

const QuestionText = styled.h2`
  font-family: ${({ theme }) => theme.fonts.heading};
  color: ${({ theme }) => theme.colors.night};
  font-size: 1.5rem;
  margin-bottom: 1.25rem; /* 20px */
`;

const OptionsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const OptionButton = styled.button<{ $isSelected: boolean; $isCorrect: boolean; $isWrong: boolean }>`
  background: ${({ $isSelected, $isCorrect, $isWrong, theme }) =>
    $isCorrect ? theme.colors.accentgreen :
      $isWrong ? theme.colors.incorrectRed :
        $isSelected ? theme.colors.pinkLavender : theme.colors.gray};
  color: white;
  font-size: 1rem;
  font-weight: bold;
  padding: 1rem;
  border: none;
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
  margin-top: 1.25rem; /* 20px */
  background: ${({ theme }) => theme.colors.purple};
  color: white;
  font-size: 1rem;
  font-weight: bold;
  padding: 1rem;
  border: none;
  cursor: pointer;
  transition: 0.3s;
  width: 100%;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.darkpurple};
  }
`;

const NextButton = styled(SubmitButton)``;

const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2.5rem 1.25rem; /* 40px 20px */
  background: ${({ theme }) => theme.colors.magnolia};
  border-radius: 0;
  margin: auto;
  max-width: 31.25rem; /* 500px */
`;

const Loading = styled.p`
  text-align: center;
  font-size: 1.2rem;
  color: ${({ theme }) => theme.colors.night};
  margin-top: 1.25rem; /* 20px */
`;

const LoadingSpinner = styled.div`
  border: 0.25rem solid rgba(0, 0, 0, 0.1); /* 4px */
  border-radius: 50%;
  border-top: 0.25rem solid ${({ theme }) => theme.colors.amethyst}; /* 4px */
  width: 2.5rem; /* 40px */
  height: 2.5rem; /* 40px */
  animation: spin 1s linear infinite;

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const ScoreText = styled.p`
  font-size: 1.5rem;
  font-weight: bold;
  color: ${({ theme }) => theme.colors.amethyst};
  margin-bottom: 1.25rem; /* 20px */
`;

const QuitButton = styled.button`
  position: relative;
  margin-top: 1.25rem; /* 20px */
  background: ${({ theme }) => theme.colors.darkpurple};
  color: white;
  border: none;
  border-radius: 50%;
  width: 2.5rem; /* 40px */
  height: 2.5rem; /* 40px */
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.3s;

  &:hover {
    background: ${({ theme }) => theme.colors.purple};
  }
`;

const ErrorContainer = styled.div`
  width: 100%;
  max-width: 31.25rem; /* 500px */
  margin: auto;
  text-align: center;
  padding: 2.5rem 1.25rem; /* 40px 20px */
  background: ${({ theme }) => theme.colors.magnolia};
  border-radius: 0; /* Changed from 10px to match square design */
`;

const ErrorMessage = styled.p`
  color: ${({ theme }) => theme.colors.incorrectRed};
  font-size: 1.2rem;
  margin-bottom: 1.25rem; /* 20px */
`;

const RetryButton = styled(SubmitButton)`
  max-width: 12.5rem; /* 200px */
  margin: 0.625rem auto; /* 10px auto */
  display: block;
`;