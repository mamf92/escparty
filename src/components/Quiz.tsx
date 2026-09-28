import { useState, useEffect, useMemo, useRef } from "react";
import styled from "styled-components";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { FaHome } from "react-icons/fa";
import { updatePlayerScore, listenToRoom, advanceQuestion, Room } from "../utils/roomsFirestore";
import { isDevelopmentEnvironment } from "../utils/pathUtils";
import { loadQuizData, filterEnabledQuestions, isFallbackQuizData, QuizQuestion, QuizDifficulty } from "../utils/QuizDataProvider";
import { bestKnownScore, calculateQuestionScore, calculateTimeBonus } from "../utils/quizScoring";
import { FEEDBACK_MS, MID_QUIZ_EVERY, QUESTION_MS, QUESTION_SLOT_MS, questionClock, startedAtMillis } from "../utils/quizTiming";

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

  // In multiplayer the room drives progression (#62): every client shows
  // room.currentQuestionIndex and times it from room.phaseStartedAt, so they
  // stay in lockstep and a backgrounded tab catches up on return. Single
  // player keeps the local timers below.
  const sharedClock = isMultiplayer && !!room?.phase;
  const localClock = !isMultiplayer;
  // A room created before #61 has no phase to follow, and the old local-timer
  // path for it is gone (#63). Rooms only live for one game, so this only
  // catches a tab left open from before the upgrade.
  const legacyRoom = isMultiplayer && room !== null && !room.phase;
  const roomStartMs = startedAtMillis(room?.phaseStartedAt);
  // This player's score as the room has it.
  const storedScore = room?.players.find(p => p.id === playerId)?.score ?? 0;

  // Calculate current question based on currentQuestionIndex and questions array
  const currentQuestion = !loading && questions.length > 0 && currentQuestionIndex < questions.length
    ? questions[currentQuestionIndex]
    : { question: "", options: [], correctAnswer: "" };

  // An observer host watches from HostObserverView instead of playing. Who
  // that is comes from the room, not from localStorage "isHost": that's
  // shared by every tab and outlives a game, so it can say "host" for a
  // guest (who'd be bounced out of the quiz) or "not host" for the real one
  // (who'd end up playing).
  const isObserverHost = !!room && !!playerId && room.hostIsObserver === true && room.hostId === playerId;
  useEffect(() => {
    if (!isMultiplayer || !isObserverHost || !room) return;
    navigate("/host-observer", {
      state: {
        currentQuestionIndex: room.currentQuestionIndex ?? 0,
        difficulty,
        players: room.players,
        roomCode
      },
      replace: true // Replace history to prevent back navigation to the quiz page
    });
  }, [isMultiplayer, isObserverHost, room, difficulty, roomCode, navigate]);

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
      isLocationStatePresent: !!location.state
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

        // In multiplayer, a client that could only load the small built-in
        // bank would be on different questions from everyone else, and its
        // shorter quiz could end the game for the whole room. Stop here.
        if (multiplayerData?.multiplayer && isFallbackQuizData(quizData)) {
          setError("Couldn't load this quiz's questions. Check your connection and reload the page to rejoin.");
          setLoading(false);
          return;
        }

        const filteredQuestions = filterEnabledQuestions(quizData);
        console.log(`📋 Loaded ${filteredQuestions.length} questions for ${difficulty} difficulty`);

        if (filteredQuestions.length === 0) {
          setError("No questions available for this difficulty level");
          setLoading(false);
          return;
        }

        setQuestions(filteredQuestions);
        setLoading(false);

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
  }, [difficulty, navigate, location]);

  // Timer effect for question countdown (single player only)
  useEffect(() => {
    if (quizCompleted || loading || !localClock) return;

    // Only start a new timer if we're in question mode (not feedback mode)
    if (!showFeedback) {
      console.log("Setting up new question timer");
      setTimeLeft(QUESTION_MS / 1000);
      setTimeLeftMs(QUESTION_MS);

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
  }, [currentQuestionIndex, quizCompleted, loading, showFeedback, localClock]);

  // Separate effect for feedback timer that automatically moves to next question
  useEffect(() => {
    if (showFeedback && localClock) {
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
  }, [showFeedback, localClock]);

  // --- Shared, room-driven progression (multiplayer) ---

  // Refs so the 100ms tick below reads current values without restarting.
  const isSubmittedRef = useRef(isSubmitted);
  isSubmittedRef.current = isSubmitted;
  const lastAdvanceAttemptRef = useRef(0);
  const advanceInFlightRef = useRef(false);
  const leftQuizRef = useRef(false);
  const markTimeUpRef = useRef<() => void>(() => { });
  const lockQuestionRef = useRef<(options: { hideTimer: boolean }) => void>(() => { });

  // Whoever ends a question first wins and everyone else's attempt is a
  // no-op, but each attempt is a transaction on the same document. So one
  // client, picked from the room itself, tries right away: the host, or the
  // first player by ID when the host only observes. Everyone else waits a
  // moment (spread per player) and only steps in if the room hasn't moved
  // on, e.g. the leader closed their tab.
  const advanceLeaderId = useMemo(() => room
    ? (room.hostIsObserver ? room.players.filter(p => p.id !== room.hostId) : [{ id: room.hostId }])
        .map(p => p.id).sort()[0]
    : undefined, [room]);

  const advanceGraceMs = playerId && playerId === advanceLeaderId
    ? 0
    : 1500 + ([...(playerId ?? "")].reduce((sum, c) => sum + c.charCodeAt(0), 0) % 1000);

  // The question this client already answered (or timed out on), kept in
  // sessionStorage so a refresh can't reopen it and score it a second time.
  const answeredKey = roomCode ? `answeredQuestion:${roomCode}` : null;
  const rememberAnswered = (index: number) => {
    if (!sharedClock || !answeredKey) return;
    // Only ever move forward: a slow score write for an earlier question
    // can resolve after a later one was answered.
    const current = Number(sessionStorage.getItem(answeredKey) ?? -1);
    if (index > current) sessionStorage.setItem(answeredKey, String(index));
  };
  const answeredIndex = answeredKey ? Number(sessionStorage.getItem(answeredKey) ?? -1) : -1;

  // Pick the player's score back up from the room after a refresh or rejoin:
  // local state starts at 0 without router state, and updatePlayerScore
  // refuses a write lower than what's stored, so every later answer would
  // otherwise be dropped.
  useEffect(() => {
    if (!sharedClock || !playerId) return;
    if (storedScore > score) {
      setScore(storedScore);
    }
  }, [sharedClock, playerId, storedScore, score]);

  // Follow the room onto its current question. This is the only place the
  // question index changes in multiplayer.
  useEffect(() => {
    if (!sharedClock || room?.phase !== "question") return;
    const roomIndex = room.currentQuestionIndex ?? 0;
    if (roomIndex !== currentQuestionIndex) {
      setCurrentQuestionIndex(roomIndex);
      setSelectedAnswer(null);
      setIsSubmitted(false);
      setShowFeedback(false);
      setIsTimerVisible(true);
      setCurrentQuestionPoints(0);
      setTimeLeft(QUESTION_MS / 1000);
      setTimeLeftMs(QUESTION_MS);
    }
  }, [sharedClock, room?.phase, room?.currentQuestionIndex, currentQuestionIndex]);

  // Back on a question this client already answered (a refresh): show it as
  // answered rather than letting it be answered and scored again.
  useEffect(() => {
    if (!sharedClock || room?.phase !== "question") return;
    if ((room.currentQuestionIndex ?? 0) !== currentQuestionIndex) return;
    if (answeredIndex >= currentQuestionIndex && !isSubmitted) {
      // Keep the timer: its points display would read 0 for a question
      // that was scored before the refresh.
      lockQuestionRef.current({ hideTimer: false });
    }
  }, [sharedClock, room?.phase, room?.currentQuestionIndex, currentQuestionIndex, answeredIndex, isSubmitted]);

  // The countdown every client shows, derived from the room's start time
  // rather than counted down locally, and the shared advance once the
  // question's slot (answering + feedback) is over.
  useEffect(() => {
    if (!sharedClock || loading || room?.phase !== "question") return;
    if ((room.currentQuestionIndex ?? 0) !== currentQuestionIndex) return; // wait for the sync above
    if (!roomCode || questions.length === 0) return;

    // While our own write's serverTimestamp() is pending it reads as null;
    // count from now until the confirmed value arrives a moment later.
    const startMs = roomStartMs ?? Date.now();
    const index = currentQuestionIndex;

    const tick = () => {
      const now = Date.now();
      const clock = questionClock(startMs, now);
      setTimeLeftMs(clock.timeLeftMs);

      if (clock.answeringOpen && !isSubmittedRef.current) {
        setTimeLeft(Math.ceil(clock.timeLeftMs / 1000));
      } else {
        if (!isSubmittedRef.current) {
          markTimeUpRef.current();
        }
        setTimeLeft(Math.max(0, Math.ceil((QUESTION_SLOT_MS - clock.elapsedMs) / 1000)));
      }

      // Any client may end the question; the transaction makes the extra
      // attempts no-ops, and the rules turn away a too-early one (a fast
      // local clock), so just retry once a second until the room moves on.
      if (clock.elapsedMs >= QUESTION_SLOT_MS + advanceGraceMs &&
          !advanceInFlightRef.current && now - lastAdvanceAttemptRef.current >= 1000) {
        lastAdvanceAttemptRef.current = now;
        advanceInFlightRef.current = true;
        void advanceQuestion(roomCode, index, questions.length)
          .catch(error => {
            console.warn("Advancing the question didn't go through yet, retrying:", error);
          })
          .finally(() => {
            advanceInFlightRef.current = false;
          });
      }
    };

    tick();
    const interval = setInterval(tick, 100);
    return () => clearInterval(interval);
  }, [sharedClock, loading, room?.phase, room?.currentQuestionIndex, roomStartMs, currentQuestionIndex, roomCode, questions.length, advanceGraceMs]);

  // When the room leaves the question phase, everyone goes where it went.
  // Waits for the question load to finish (not to succeed: a player whose
  // load failed still follows the room to the results), so the next page
  // gets the real question count when there is one, and hands on the
  // room's copy of this player's score if it's higher: a player coming back
  // from a refresh or a locked phone may not have picked it back up yet.
  useEffect(() => {
    if (!sharedClock || !room || loading || leftQuizRef.current) return;
    const bestScore = bestKnownScore(score, room.players, playerId);
    if (room.phase === "mid-scoreboard") {
      leftQuizRef.current = true;
      navigate("/mid-quiz-scoreboard", {
        state: {
          score: bestScore,
          totalQuestions: questions.length,
          currentQuestionIndex: room.currentQuestionIndex ?? 0, // the question after the break
          difficulty,
          players: room.players,
          multiplayer: true,
          roomCode,
          playerId
        }
      });
    } else if (room.phase === "results") {
      leftQuizRef.current = true;
      navigate("/results", {
        state: {
          score: bestScore,
          totalQuestions: questions.length,
          difficulty,
          multiplayer: true,
          roomCode,
          playerId,
          players: room.players
        }
      });
    }
  }, [sharedClock, room, loading, score, questions.length, difficulty, roomCode, playerId, navigate]);

  // Lock the current question: no more answers, show its feedback.
  const lockQuestion = ({ hideTimer }: { hideTimer: boolean }) => {
    isSubmittedRef.current = true;
    setIsSubmitted(true);
    setShowFeedback(true);
    if (hideTimer) setIsTimerVisible(false);
  };

  // Time's up without an answer (both clocks): lock the question with 0
  // points. The score didn't change, so nothing is written: an
  // unchanged-score write from every timed-out player at once only competes
  // with real score writes. (A failed answer write is retried where it
  // fails, in submitAnswer.)
  const markTimeUp = () => {
    lockQuestion({ hideTimer: true });
    setCurrentQuestionPoints(0);
    rememberAnswered(currentQuestionIndex);
  };
  markTimeUpRef.current = markTimeUp;
  lockQuestionRef.current = lockQuestion;

  // Local clock only: time's up, then 5 seconds of feedback
  const handleTimeUp = () => {
    markTimeUp();
    setTimeLeft(FEEDBACK_MS / 1000);
  };

  // Local clock only: move on once the feedback time is over
  const moveToNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      if ((currentQuestionIndex + 1) % MID_QUIZ_EVERY === 0) {
        navigate("/mid-quiz-scoreboard", {
          state: {
            score,
            totalQuestions: questions.length,
            currentQuestionIndex: currentQuestionIndex + 1,
            difficulty,
            players: [{ name: "Player 1", score }],
            multiplayer: false,
            roomCode: null,
            playerId
          }
        });
      } else {
        // Reset all question-related states
        setShowFeedback(false); // Must be reset before setting new question
        setCurrentQuestionIndex(currentQuestionIndex + 1);
        setSelectedAnswer(null);
        setIsSubmitted(false);
        setTimeLeft(QUESTION_MS / 1000); // Reset timer for new question
        setTimeLeftMs(QUESTION_MS); // Reset precise timer for new question
        setIsTimerVisible(true); // Show timer again for the next question
        setCurrentQuestionPoints(0); // Reset points for new question
      }
    } else {
      const difficultyLevel = difficulty ?? "easy";

      const previousScores = JSON.parse(localStorage.getItem("quizScores") || "[]");
      const newScore = {
        score,
        total: questions.length,
        difficulty: difficultyLevel,
        date: new Date().toISOString()
      };
      localStorage.setItem("quizScores", JSON.stringify([...previousScores, newScore]));

      navigate("/results", {
        state: {
          score,
          totalQuestions: questions.length,
          difficulty,
          multiplayer: false,
          roomCode: null,
          playerId,
          players: null
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
    if (sharedClock && roomStartMs !== null && !questionClock(roomStartMs, Date.now()).answeringOpen) return;

    const answeredQuestion = currentQuestionIndex;
    lockQuestion({ hideTimer: true }); // also flags the ref the shared tick reads

    // Feedback shows right away (lockQuestion above), before awaiting any
    // score write: if the write is slow and the room moves on meanwhile, a
    // late setShowFeedback(true) would land on (and lock) the next question.
    // Locally: remaining question time PLUS 5 seconds; in multiplayer the
    // shared tick counts down to the slot's end.
    if (!sharedClock) {
      const feedbackTime = Math.min(timeLeft, QUESTION_MS / 1000) + FEEDBACK_MS / 1000;
      setTimeLeft(feedbackTime);
    }

    // Check if answer is correct and calculate time-based score
    if (answer === currentQuestion.correctAnswer) {
      // Base score plus a time bonus, both clamped and rounded in
      // `quizScoring.ts` so the rule is unit-tested rather than inline here.
      const timeBonus = calculateTimeBonus(timeLeftMs);
      const pointsForAnswer = calculateQuestionScore(timeLeftMs);
      console.log(`Correct answer! Time left: ${timeLeftMs / 1000}s, Time bonus: ${timeBonus}, Total points: ${pointsForAnswer}`);

      // Set points for current question to display in the UI
      setCurrentQuestionPoints(pointsForAnswer);

      const newScore = score + pointsForAnswer;
      setScore(newScore);

      // If multiplayer, update score in Firestore. The question only counts
      // as answered once the score is safely stored: a refresh while the
      // write is in flight drops it, and the player should get to answer
      // again rather than find the question locked with the points lost.
      // A failed write is retried a couple of times, since nothing else
      // would repair it: the room (and every scoreboard built from it)
      // would keep the lower score.
      if (isMultiplayer && roomCode && playerId) {
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            await updatePlayerScore(roomCode, playerId, newScore);
            rememberAnswered(answeredQuestion);
            break;
          } catch (error) {
            console.error(`Failed to update score (attempt ${attempt} of 3):`, error);
            if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
        }
      }
    } else {
      // If answer is incorrect, set points to 0
      setCurrentQuestionPoints(0);
      rememberAnswered(answeredQuestion);
    }
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
  if (error || legacyRoom) {
    return (
      <ErrorContainer>
        <ErrorMessage>{error ?? "This room was set up by an older version of the app. Start a new room to play."}</ErrorMessage>
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



