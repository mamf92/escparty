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
  hostIsObserver?: boolean;
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
  const [error, setError] = useState<string | null>(null); // Used in useEffect and conditional rendering
  const [loadingStatus, setLoadingStatus] = useState<string>("Initializing..."); // Used in loading state display
  const [timeLeft, setTimeLeft] = useState(10); // 10 second timer
  const [timeLeftMs, setTimeLeftMs] = useState(10000); // More precise millisecond timer for scoring
  const [showFeedback, setShowFeedback] = useState(false);
  const [isTimerVisible, setIsTimerVisible] = useState(true);
  const [currentQuestionPoints, setCurrentQuestionPoints] = useState(0); // Points earned for current question

  const navigate = useNavigate();
  const { difficulty } = useParams<{ difficulty: string }>();

  // Calculate current question based on currentQuestionIndex and questions array
  const currentQuestion = !loading && questions.length > 0 && currentQuestionIndex < questions.length
    ? questions[currentQuestionIndex]
    : { question: "", options: [], correctAnswer: "" };

  const hostIsObserverFromLocation = locationState?.hostIsObserver;

  useEffect(() => {
    // This effect handles redirection for an observing host.
    // It depends on data being loaded and relevant states being set.
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
        replace: true, // Replace history to prevent back navigation to the quiz page
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
    // If the current user is a host in observer mode, redirect to the mid-quiz scoreboard
    if (locationState?.hostIsObserver && localStorage.getItem("isHost") === "true" && roomCode && playerId && difficulty) {
      navigate("/mid-quiz-scoreboard", {
        state: {
          multiplayer: true, // Host observer implies a multiplayer context
          roomCode: roomCode,
          playerId: playerId,
          difficulty: difficulty,
          hostIsObserver: true, // Explicitly set for the scoreboard
        },
        replace: true // Replace the current entry in history
      });
    }
  }, [locationState, roomCode, playerId, difficulty, navigate]);

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
  }, [difficulty, navigate, location, currentQuestionIndex, score]);  // Timer effect for question countdown
  useEffect(() => {
    if (quizCompleted || loading) return;

    // Only start a new timer if we're in question mode (not feedback mode)
    if (!showFeedback) {
      console.log("Setting up new question timer");
      setTimeLeft(10);
      setTimeLeftMs(10000);

      // Use a more precise interval for millisecond timer (100ms)
      const msTimer = setInterval(() => {
        setTimeLeftMs(prev => {
          if (prev <= 100) { // When 0.1 seconds left
            clearInterval(msTimer);
            handleTimeUp();
            return 0;
          }
          return prev - 100; // Decrease by 100ms each time
        });
      }, 100);

      // Regular timer for visible UI updates (every second)
      const uiTimer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(uiTimer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Return cleanup function for both timers
      return () => {
        clearInterval(msTimer);
        clearInterval(uiTimer);
      };
    }
  }, [currentQuestionIndex, quizCompleted, loading, showFeedback]);  // Separate effect for feedback timer that automatically moves to next question
  useEffect(() => {
    if (showFeedback) {
      // Note: We don't reset time here - it's set in submitAnswer or handleTimeUp
      const feedbackTimer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(feedbackTimer);
            moveToNextQuestion(); // Automatically move to next question when feedback time ends
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

  // Function to handle when the time is up but before showing feedback
  const handleTimeUp = () => {
    if (!isSubmitted) {
      setIsSubmitted(true);
    }

    // Hide timer after time is up
    setIsTimerVisible(false);

    // Set points to 0 for unanswered question
    setCurrentQuestionPoints(0);

    // Show answer feedback for 5 seconds
    setShowFeedback(true);
    setTimeLeft(5);

    // If multiplayer, update score
    if (isMultiplayer && roomCode && playerId) {
      try {
        // Using void to ignore the promise result
        void updatePlayerScore(roomCode, playerId, score).catch(error => {
          console.error("Failed to update score:", error);
        });
      } catch (error) {
        console.error("Failed to update score:", error);
      }
    }
  };

  // Function to automatically move to the next question
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
        // Reset all question-related states
        setShowFeedback(false); // Must be reset before setting new question
        setCurrentQuestionIndex(currentQuestionIndex + 1);
        setSelectedAnswer(null);
        setIsSubmitted(false);
        setTimeLeft(10); // Reset timer for new question
        setTimeLeftMs(10000); // Reset precise timer for new question
        setIsTimerVisible(true); // Show timer again for the next question
        setCurrentQuestionPoints(0); // Reset points for new question
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

  const handleAnswer = (answer: string) => {
    if (!isSubmitted) {
      setSelectedAnswer(answer);
    }
  };

  const submitAnswer = async (answer: string) => {
    if (!answer) return;

    setIsSubmitted(true);
    setIsTimerVisible(false); // Hide timer when answer is submitted

    // Check if answer is correct and calculate time-based score
    if (answer === currentQuestion.correctAnswer) {
      // Calculate time-based score with millisecond precision
      // Base score of 500 + up to 500 more based on time remaining
      const timeBonus = Math.floor((timeLeftMs / 10000) * 500);
      // Using timeLeftMs (milliseconds) for more precise scoring
      const pointsForAnswer = 500 + timeBonus;
      console.log(`Correct answer! Time left: ${timeLeftMs / 1000}s, Time bonus: ${timeBonus}, Total points: ${pointsForAnswer}`);

      // Set points for current question to display in the UI
      setCurrentQuestionPoints(pointsForAnswer);

      const newScore = score + pointsForAnswer;
      setScore(newScore);

      // If multiplayer, update score in Firestore
      if (isMultiplayer && roomCode && playerId) {
        try {
          await updatePlayerScore(roomCode, playerId, newScore);
        } catch (error) {
          console.error("Failed to update score:", error);
        }
      }
    } else {
      // If answer is incorrect, set points to 0
      setCurrentQuestionPoints(0);
    }

    // Show feedback after submission
    // Add remaining question time PLUS 5 seconds for feedback
    const feedbackTime = Math.min(timeLeft, 10) + 5;
    setShowFeedback(true);
    setTimeLeft(feedbackTime);
  };

  const restartQuiz = () => {
    setCurrentQuestionIndex(0);
    setScore(0);
    setQuizCompleted(false);
    setSelectedAnswer(null);
    setIsSubmitted(false);
    setIsTimerVisible(true); // Show timer when restarting the quiz
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
  display: flex; /* Always display the container to maintain layout */
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



