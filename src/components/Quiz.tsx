import { useState, useEffect } from "react";
import styled from "styled-components";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { FaHome } from "react-icons/fa";
import { updatePlayerScore, listenToRoom, Room } from "../utils/roomsFirestore";
import { isDevelopmentEnvironment } from "../utils/pathUtils";
import { loadQuizData, QuizQuestion, QuizDifficulty } from "../utils/QuizDataProvider";

/**
 * Multiplayer game data structure stored in sessionStorage for persistence across page refreshes.
 */
interface MultiplayerGameData {
  multiplayer: boolean;
  roomCode: string;
  playerId: string;
  difficulty?: string;
  hostIsObserver?: boolean;
}

/**
 * Main quiz component that handles both single-player and multiplayer quiz gameplay.
 * Features time-based scoring, real-time multiplayer updates, and automatic progression.
 * 
 * @component
 * @returns The interactive quiz interface with questions, timer, and scoring
 */
const Quiz = () => {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const location = useLocation();
  const locationState = location.state as {
    currentQuestionIndex?: number;
    score?: number;
    multiplayer?: boolean;
    roomCode?: string;
    playerId?: string;
    hostIsObserver?: boolean;
  } | null;

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(locationState?.currentQuestionIndex || 0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState(locationState?.score || 0);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [isMultiplayer, setIsMultiplayer] = useState(locationState?.multiplayer || false);
  const [roomCode, setRoomCode] = useState<string | null>(locationState?.roomCode || null);
  const [playerId, setPlayerId] = useState<string | null>(locationState?.playerId || null);
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<string>("Initializing...");
  const [timeLeft, setTimeLeft] = useState(10);
  const [timeLeftMs, setTimeLeftMs] = useState(10000);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isTimerVisible, setIsTimerVisible] = useState(true);
  const [currentQuestionPoints, setCurrentQuestionPoints] = useState(0);

  const navigate = useNavigate();
  const { difficulty } = useParams<{ difficulty: string }>();

  const currentQuestion = !loading && questions.length > 0 && currentQuestionIndex < questions.length
    ? questions[currentQuestionIndex]
    : { question: "", options: [], correctAnswer: "" };

  const hostIsObserverFromLocation = locationState?.hostIsObserver;

  useEffect(() => {
    if (
      hostIsObserverFromLocation &&
      localStorage.getItem("isHost") === "true" &&
      isMultiplayer &&
      !loading &&
      roomCode &&
      playerId &&
      difficulty &&
      room &&
      room.players &&
      questions &&
      questions.length > 0
    ) {
      navigate("/mid-quiz-scoreboard", {
        state: {
          score,
          totalQuestions: questions.length,
          currentQuestionIndex,
          difficulty,
          players: room.players,
          multiplayer: true,
          roomCode,
          playerId,
          hostIsObserver: true,
        },
        replace: true,
      });
    }
  }, [
    hostIsObserverFromLocation,
    isMultiplayer,
    loading,
    roomCode,
    playerId,
    difficulty,
    room,
    questions,
    score,
    currentQuestionIndex,
    navigate,
  ]);

  useEffect(() => {
    if (locationState?.hostIsObserver && localStorage.getItem("isHost") === "true" && roomCode && playerId && difficulty) {
      navigate("/mid-quiz-scoreboard", {
        state: {
          multiplayer: true,
          roomCode: roomCode,
          playerId: playerId,
          difficulty: difficulty,
          hostIsObserver: true,
        },
        replace: true
      });
    }
  }, [locationState, roomCode, playerId, difficulty, navigate]);

  useEffect(() => {
    setError(null);
    setLoading(true);
    setLoadingStatus("Initializing quiz...");

    console.log("🚀 Quiz component mounted", {
      mode: import.meta.env.MODE,
      baseUrl: import.meta.env.BASE_URL,
      currentUrl: window.location.href,
      difficulty,
      isLocationStatePresent: !!location.state,
      currentQuestionIndex
    });

    if (!difficulty || !['easy', 'medium', 'hard'].includes(difficulty)) {
      console.error(`❌ Invalid difficulty parameter: ${difficulty}`);
      setError(`Invalid difficulty level: ${difficulty}`);
      setLoading(false);
      return;
    }

    let multiplayerData: MultiplayerGameData | null = null;

    if (locationState?.multiplayer) {
      console.log("📱 Multiplayer data found in location state:", locationState);
      multiplayerData = {
        multiplayer: true,
        roomCode: locationState.roomCode || '',
        playerId: locationState.playerId || ''
      };
    } else {
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

    let unsubscribeRoom: () => void = () => { };
    if (multiplayerData?.multiplayer && multiplayerData.roomCode && multiplayerData.playerId) {
      console.log("🔄 Setting up multiplayer mode...");
      setIsMultiplayer(true);
      setRoomCode(multiplayerData.roomCode);
      setPlayerId(multiplayerData.playerId);
      setLoadingStatus("Connecting to game room...");

      sessionStorage.setItem('multiplayerGame', JSON.stringify(multiplayerData));

      unsubscribeRoom = listenToRoom(multiplayerData.roomCode, (roomData) => {
        if (roomData) {
          console.log("🎮 Room data updated:", roomData);
          setRoom(roomData);

          if (!difficulty && roomData.difficulty) {
            console.log(`Using room difficulty: ${roomData.difficulty}`);
          }
        } else {
          console.error("❌ Game room not found");
          setError("Game room no longer exists");
          setTimeout(() => navigate("/multiplayer"), 2000);
        }
      });
    }

    console.log(`🌐 Environment: ${isDevelopmentEnvironment() ? 'Development' : 'Production'}`);
    console.log(`📂 Base URL: ${import.meta.env.BASE_URL}`);
    console.log(`🎮 Difficulty parameter: ${difficulty}`);

    setLoadingStatus("Loading quiz data...");

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

        console.log(`Using question index: ${currentQuestionIndex}, score: ${score}`);
      })
      .catch((error) => {
        console.error("❌ Error loading quiz data:", error);
        setError(`Failed to load quiz: ${error.message}`);
        setLoading(false);
      });

    return () => {
      unsubscribeRoom();
      console.log("🧹 Quiz component unmounting, cleaned up listeners");
    };
  }, [difficulty, navigate, location, currentQuestionIndex, score]);

  useEffect(() => {
    if (quizCompleted || loading) return;

    if (!showFeedback) {
      console.log("Setting up new question timer");
      setTimeLeft(10);
      setTimeLeftMs(10000);

      const msTimer = setInterval(() => {
        setTimeLeftMs(prev => {
          if (prev <= 100) {
            clearInterval(msTimer);
            handleTimeUp();
            return 0;
          }
          return prev - 100;
        });
      }, 100);

      const uiTimer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(uiTimer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        clearInterval(msTimer);
        clearInterval(uiTimer);
      };
    }
  }, [currentQuestionIndex, quizCompleted, loading, showFeedback]);

  useEffect(() => {
    if (showFeedback) {
      const feedbackTimer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(feedbackTimer);
            moveToNextQuestion();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        clearInterval(feedbackTimer);
      };
    }
  }, [showFeedback]);

  /**
   * Handles the timer expiration when a question times out.
   * Marks the question as submitted, hides the timer, awards 0 points, and shows feedback.
   */
  const handleTimeUp = () => {
    if (!isSubmitted) {
      setIsSubmitted(true);
    }

    setIsTimerVisible(false);
    setCurrentQuestionPoints(0);
    setShowFeedback(true);
    setTimeLeft(5);

    if (isMultiplayer && roomCode && playerId) {
      try {
        void updatePlayerScore(roomCode, playerId, score).catch(error => {
          console.error("Failed to update score:", error);
        });
      } catch (error) {
        console.error("Failed to update score:", error);
      }
    }
  };

  /**
   * Advances to the next question or shows the scoreboard/results.
   * After every 5 questions, navigates to mid-quiz scoreboard.
   * After all questions, saves scores and navigates to final results.
   */
  const moveToNextQuestion = () => {
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
        setShowFeedback(false);
        setCurrentQuestionIndex(currentQuestionIndex + 1);
        setSelectedAnswer(null);
        setIsSubmitted(false);
        setTimeLeft(10);
        setTimeLeftMs(10000);
        setIsTimerVisible(true);
        setCurrentQuestionPoints(0);
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

  /**
   * Handles answer selection by the user.
   * Only allows selection if the question hasn't been submitted yet.
   * 
   * @param answer - The selected answer option
   */
  const handleAnswer = (answer: string) => {
    if (!isSubmitted) {
      setSelectedAnswer(answer);
    }
  };

  /**
   * Submits the selected answer and calculates the score.
   * Awards base 500 points + time bonus (up to 500 points) for correct answers.
   * Updates multiplayer scores in real-time via Firestore.
   * 
   * @param answer - The answer to submit
   */
  const submitAnswer = async (answer: string) => {
    if (!answer) return;

    setIsSubmitted(true);
    setIsTimerVisible(false);

    if (answer === currentQuestion.correctAnswer) {
      const timeBonus = Math.floor((timeLeftMs / 10000) * 500);
      const pointsForAnswer = 500 + timeBonus;
      console.log(`Correct answer! Time left: ${timeLeftMs / 1000}s, Time bonus: ${timeBonus}, Total points: ${pointsForAnswer}`);

      setCurrentQuestionPoints(pointsForAnswer);

      const newScore = score + pointsForAnswer;
      setScore(newScore);

      if (isMultiplayer && roomCode && playerId) {
        try {
          await updatePlayerScore(roomCode, playerId, newScore);
        } catch (error) {
          console.error("Failed to update score:", error);
        }
      }
    } else {
      setCurrentQuestionPoints(0);
    }

    const feedbackTime = Math.min(timeLeft, 10) + 5;
    setShowFeedback(true);
    setTimeLeft(feedbackTime);
  };

  /**
   * Resets the quiz to its initial state for replay.
   */
  const restartQuiz = () => {
    setCurrentQuestionIndex(0);
    setScore(0);
    setQuizCompleted(false);
    setSelectedAnswer(null);
    setIsSubmitted(false);
    setIsTimerVisible(true);
  };

  // Render loading state
  if (loading) {
    return (
      <LoadingContainer>
        <LoadingSpinner />
        <Loading>{loadingStatus}</Loading>
      </LoadingContainer>
    );
  }

  // Render error state
  if (error) {
    return (
      <ErrorContainer>
        <ErrorMessage>{error}</ErrorMessage>
        <RetryButton onClick={() => navigate("/")}>
          Back to Home
        </RetryButton>
      </ErrorContainer>
    );
  }

  return quizCompleted ? (
    <Container>
      <QuestionText>🎉 Quiz Completed! 🎤</QuestionText>
      <ScoreText>You scored {score}!</ScoreText>
      <SubmitButton onClick={restartQuiz}>Restart Quiz</SubmitButton>
    </Container>
  ) : (
    <Container>
      {isTimerVisible ? (
        <QuizHeader>
          <TimerContainer
            $timeRunningOut={timeLeft <= 3 && !showFeedback}
            $isFeedback={showFeedback}
            $isVisible={true}
          >
            <TimerText>{timeLeft}s</TimerText>
          </TimerContainer>
        </QuizHeader>
      ) : (
        <PointsDisplay>
          <span className="points-value">{currentQuestionPoints}</span>
          points!
        </PointsDisplay>
      )}
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
      <SubmitButton
        onClick={() => !showFeedback ? submitAnswer(selectedAnswer || "") : undefined}
        disabled={(!showFeedback && !selectedAnswer) || (isSubmitted && !showFeedback) || showFeedback}
      >
        {showFeedback ? `Next Question in ${timeLeft}s...` : "Submit Answer"}
      </SubmitButton>
      <QuitButton onClick={() => navigate("/")}>
        <FaHome size={20} />
      </QuitButton>
    </Container>
  );
};

export default Quiz;

const Container = styled.div`
  position: relative;
  width: 100%;
  max-width: 31.25rem;
  margin: auto;
  text-align: center;
  padding: 1.25rem;
  background: ${({ theme }) => theme.colors.magnolia};
  overflow-x: hidden;
`;

const QuizHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  width: 100%;
`;

const PointsDisplay = styled.div`
  width: 100%;
  text-align: center;
  padding: 0.5rem 0;
  font-weight: bold;
  font-size: 1.5rem;
  color: ${({ theme }) => theme.colors.purple};
  margin-bottom: 1rem;
  
  .points-value {
    font-size: 1.8rem;
    margin-right: 0.5rem;
  }
`;

const TimerContainer = styled.div<{ $timeRunningOut: boolean; $isFeedback: boolean; $isVisible?: boolean }>`
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: ${({ $timeRunningOut, $isFeedback, theme }) =>
    $isFeedback ? theme.colors.amethyst :
      $timeRunningOut ? theme.colors.incorrectRed : theme.colors.purple};
  transition: background-color 0.3s ease;
  animation: ${({ $timeRunningOut }) =>
    $timeRunningOut ? 'pulse 1s infinite' : 'none'};
  
  @keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); }
  }
`;

const TimerText = styled.span`
  color: white;
  font-weight: bold;
  font-size: 1.2rem;
`;

const QuestionText = styled.h2`
  font-family: ${({ theme }) => theme.fonts.heading};
  color: ${({ theme }) => theme.colors.night};
  font-size: 1.5rem;
  margin-bottom: 1.25rem;
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
  margin-top: 1.25rem;
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

const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2.5rem 1.25rem;
  background: ${({ theme }) => theme.colors.magnolia};
  border-radius: 0;
  margin: auto;
  max-width: 31.25rem;
`;

const Loading = styled.p`
  text-align: center;
  font-size: 1.2rem;
  color: ${({ theme }) => theme.colors.night};
  margin-top: 1.25rem;
`;

const LoadingSpinner = styled.div`
  border: 0.25rem solid rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  border-top: 0.25rem solid ${({ theme }) => theme.colors.amethyst};
  width: 2.5rem;
  height: 2.5rem;
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
  margin-bottom: 1.25rem;
`;

const QuitButton = styled.button`
  position: relative;
  margin-top: 1.25rem;
  background: ${({ theme }) => theme.colors.darkpurple};
  color: white;
  border: none;
  border-radius: 50%;
  width: 2.5rem;
  height: 2.5rem;
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
  max-width: 31.25rem;
  margin: auto;
  text-align: center;
  padding: 2.5rem 1.25rem;
  background: ${({ theme }) => theme.colors.magnolia};
  border-radius: 0;
`;

const ErrorMessage = styled.p`
  color: ${({ theme }) => theme.colors.incorrectRed};
  font-size: 1.2rem;
  margin-bottom: 1.25rem;
`;

const RetryButton = styled(SubmitButton)`
  max-width: 12.5rem;
  margin: 0.625rem auto;
  display: block;
`;



