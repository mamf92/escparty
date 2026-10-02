import { useState, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { updatePlayerScore, listenToRoom, advanceQuestion, Room, ScoreWriteRejected } from "../utils/roomsFirestore";
import { isDevelopmentEnvironment } from "../utils/pathUtils";
import { filterEnabledQuestions, isFallbackQuizData, QuizQuestion } from "../utils/QuizDataProvider";
import { QuizNotSavedError, isKnownQuizKey, loadQuiz } from "../utils/quizCatalog";
import { DEFAULT_BREAK_EVERY, isBreakAfter } from "../utils/quizModel";
import { bestKnownScore, calculateQuestionScore, calculateTimeBonus } from "../utils/quizScoring";
import { LEGACY_ROOM_MESSAGE, isObserverHost, observerRouteState, playingPlayers, shouldObserve } from "../utils/roomRoles";
import { MultiplayerSession, readMultiplayerGame } from "../utils/multiplayerSession";
import { FEEDBACK_MS, MID_QUIZ_EVERY, QUESTION_MS, QUESTION_SLOT_MS, phaseAfterQuestion, questionClock, startedAtMillis } from "../utils/quizTiming";
import { useQuizTitle } from "../hooks/useQuizTitle";
import { Control, Ground, Pane } from "../design";
import { CalmNote, CalmPage } from "./CalmPage";
import { QuestionPane } from "./quiz/QuestionPane";
import { QuizOutcome, QuizStatus } from "./quiz/QuizStatus";
import { LeaveQuiz } from "./quiz/LeaveQuiz";
import "./quiz/quiz.css";


const Quiz = () => {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  // Where the single-player break goes: the quiz's own setting (#72).
  // Multiplayer follows the room's phase instead.
  const [breakEvery, setBreakEvery] = useState<number>(DEFAULT_BREAK_EVERY);
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
  const [isMultiplayer, setIsMultiplayer] = useState(locationState?.multiplayer || false);
  const [roomCode, setRoomCode] = useState<string | null>(locationState?.roomCode || null);
  const [playerId, setPlayerId] = useState<string | null>(locationState?.playerId || null);
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null); // Used in useEffect and conditional rendering
  const [loadingStatus, setLoadingStatus] = useState<string>("Getting the quiz ready…"); // Used in loading state display
  const [timeLeft, setTimeLeft] = useState(QUESTION_MS / 1000);
  const [timeLeftMs, setTimeLeftMs] = useState(QUESTION_MS); // More precise millisecond timer for scoring
  const [showFeedback, setShowFeedback] = useState(false);
  // How the current question was settled, once it is: said by QuizStatus.
  const [outcome, setOutcome] = useState<QuizOutcome | null>(null);
  const [currentQuestionPoints, setCurrentQuestionPoints] = useState(0); // Points earned for current question
  const [scoreSyncError, setScoreSyncError] = useState<string | null>(null); // A multiplayer score write that failed for good

  const navigate = useNavigate();
  const { difficulty } = useParams<{ difficulty: string }>();
  const quizName = useQuizTitle(difficulty);

  // In multiplayer the room drives progression (#62): every client shows
  // room.currentQuestionIndex and times it from room.phaseStartedAt, so they
  // stay in lockstep and a backgrounded tab catches up on return. Single
  // player keeps the local timers below.
  const sharedClock = isMultiplayer && !!room?.phase;
  // A room created before #61 has no phase to follow, and the old local-timer
  // path for it is gone (#63). Rooms only live for one game, so this only
  // catches a tab left open from before the upgrade.
  const legacyRoom = isMultiplayer && room !== null && !room.phase;
  const roomStartMs = startedAtMillis(room?.phaseStartedAt);
  // This player's score as the room has it.
  const storedScore = room?.players.find(p => p.id === playerId)?.score ?? 0;
  // Set once this page navigates away for good (to the observer view, a
  // break or the results), so only one of those navigations happens.
  const leftQuizRef = useRef(false);

  // Calculate current question based on currentQuestionIndex and questions array
  const currentQuestion = !loading && questions.length > 0 && currentQuestionIndex < questions.length
    ? questions[currentQuestionIndex]
    : { question: "", options: [], correctAnswer: "" };

  // An observer host watches from HostObserverView instead of playing,
  // while the game is on (shouldObserve in roomRoles.ts). Who that is comes
  // from the room, not from localStorage "isHost".
  const observing = shouldObserve(room, playerId);
  useEffect(() => {
    if (!isMultiplayer || !observing || !room || !roomCode || leftQuizRef.current) return;
    // Claims the one navigation away from this page, so the phase effect
    // below can't send the observer to the players' break or results.
    leftQuizRef.current = true;
    navigate("/host-observer", {
      state: observerRouteState(room, roomCode, playerId),
      replace: true // Replace history to prevent back navigation to the quiz page
    });
  }, [isMultiplayer, observing, room, roomCode, playerId, navigate]);

  useEffect(() => {
    // Clear any previous errors when component mounts or difficulty changes.
    // (A reset for the quiz about to load, which then loads asynchronously.)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null);
    setLoading(true);
    setLoadingStatus("Getting the quiz ready…");

    // Track component mounting for debug purposes
    console.log("🚀 Quiz component mounted", {
      mode: import.meta.env.MODE,
      baseUrl: import.meta.env.BASE_URL,
      currentUrl: window.location.href,
      difficulty,
      isLocationStatePresent: !!location.state
    });

    // The route names a classic difficulty or a premade quiz (quizCatalog.ts)
    if (!isKnownQuizKey(difficulty)) {
      console.error(`❌ Unknown quiz: ${difficulty}`);
      setError(NOT_FOUND);
      setLoading(false);
      return;
    }

    // Process multiplayer data
    let multiplayerData: MultiplayerSession | null = null;

    // First try to get multiplayer data from location state
    if (locationState?.multiplayer) {
      console.log("📱 Multiplayer data found in location state:", locationState);
      multiplayerData = {
        multiplayer: true,
        roomCode: locationState.roomCode || '',
        playerId: locationState.playerId || ''
      };
    } else if (!locationState) {
      // No router state at all (a direct link, or a page that didn't pass
      // any): fall back to sessionStorage. Not when the router state says
      // single player: the blob outlives a multiplayer game in this tab, and
      // reading it would turn a later single-player quiz back into that old
      // room (#63).
      multiplayerData = readMultiplayerGame();
      if (multiplayerData) {
        console.log("📱 Multiplayer data found in sessionStorage:", multiplayerData);
      }
    }

    // Set multiplayer state if we have valid data
    let unsubscribeRoom: () => void = () => { };
    let roomClosedTimer: ReturnType<typeof setTimeout> | undefined;
    if (multiplayerData?.multiplayer && multiplayerData.roomCode && multiplayerData.playerId) {
      console.log("🔄 Setting up multiplayer mode...");
      setIsMultiplayer(true);
      setRoomCode(multiplayerData.roomCode);
      setPlayerId(multiplayerData.playerId);

      // Store multiplayer info in session storage (for page refresh recovery)
      // (with the difficulty, which pages opened without router state
      // read back to find the right quiz)
      sessionStorage.setItem('multiplayerGame', JSON.stringify({ ...multiplayerData, difficulty }));

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
          setError("This game room has closed. Taking you back to the game menu…");
          clearTimeout(roomClosedTimer);
          roomClosedTimer = setTimeout(() => navigate("/multiplayer"), 2000);
        }
      });
    }

    // Enhanced debugging
    console.log(`🌐 Environment: ${isDevelopmentEnvironment() ? 'Development' : 'Production'}`);
    console.log(`📂 Base URL: ${import.meta.env.BASE_URL}`);
    console.log(`🎮 Difficulty parameter: ${difficulty}`);

    // Load quiz data using our QuizDataProvider
    setLoadingStatus("Loading the questions…");

    // Use Promise.race with a timeout to prevent infinite loading
    const quizLoaderPromise = loadQuiz(difficulty);
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Quiz loading timed out after 10 seconds')), 10000);
    });

    Promise.race([quizLoaderPromise, timeoutPromise])
      .then((loaded) => {
        const quizData = loaded.questions;
        console.log("✅ Fetched Quiz Data:", quizData);
        if (!quizData || !Array.isArray(quizData)) {
          console.error("❌ Quiz data is not in expected format:", quizData);
          setError(LOAD_FAILED);
          setLoading(false);
          return;
        }

        // In multiplayer, a client that could only load the small built-in
        // bank would be on different questions from everyone else, and its
        // shorter quiz could end the game for the whole room. Stop here.
        if (multiplayerData?.multiplayer && loaded.classic && isFallbackQuizData(quizData)) {
          setError("Couldn't load this quiz's questions. Check your connection and reload the page to rejoin.");
          setLoading(false);
          return;
        }

        const filteredQuestions = filterEnabledQuestions(quizData);
        console.log(`📋 Loaded ${filteredQuestions.length} questions for ${difficulty} difficulty`);

        if (filteredQuestions.length === 0) {
          setError("This quiz has no questions to play yet.");
          setLoading(false);
          return;
        }

        setQuestions(filteredQuestions);
        setBreakEvery(loaded.breakEvery);
        setLoading(false);

      })
      .catch((error) => {
        console.error("❌ Error loading quiz data:", error);
        // A deleted custom quiz isn't a connection problem: retrying won't help.
        setError(error instanceof QuizNotSavedError ? NOT_FOUND : LOAD_FAILED);
        setLoading(false);
      });

    // Cleanup function
    return () => {
      // Clean up room listener if it was set
      unsubscribeRoom();
      // Don't send a page that has already gone (the player took the
      // button) to the game menu a second time.
      clearTimeout(roomClosedTimer);
      console.log("🧹 Quiz component unmounting, cleaned up listeners");
    };
  }, [difficulty, navigate, location]);

  // The latest render's handlers, for the solo timers below and the shared
  // tick, which must not restart on every render. Set after each render,
  // before any effect runs (see the useLayoutEffect after the handlers).
  const handleTimeUpRef = useRef<() => void>(() => { });
  const moveToNextQuestionRef = useRef<() => void>(() => { });
  // Single player: when the open question and its feedback end. Answers are
  // scored from the question's deadline, never from the last tick's state,
  // so a question that has only just (re)started can't score stale time.
  const questionDeadlineRef = useRef<number | null>(null);
  const feedbackDeadlineRef = useRef(0);

  // Single player: the question's countdown. It counts to a deadline rather
  // than counting ticks, so a phone that throttles timers still ends on
  // time, and time's up is handled here, never inside a state updater
  // (which React may run twice).
  useEffect(() => {
    if (loading || isMultiplayer || showFeedback) return;
    const deadline = Date.now() + QUESTION_MS;
    questionDeadlineRef.current = deadline;
    const tick = setInterval(() => {
      const ms = Math.max(0, deadline - Date.now());
      setTimeLeftMs(ms);
      setTimeLeft(Math.ceil(ms / 1000));
      if (ms === 0) {
        clearInterval(tick);
        handleTimeUpRef.current();
      }
    }, 100);
    return () => clearInterval(tick);
  }, [currentQuestionIndex, loading, showFeedback, isMultiplayer]);

  // Single player: the feedback countdown, then the next question. It lasts
  // until the deadline submitAnswer or handleTimeUp set.
  useEffect(() => {
    if (!showFeedback || isMultiplayer) return;
    const deadline = feedbackDeadlineRef.current;
    const tick = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setTimeLeft(left);
      if (left === 0) {
        clearInterval(tick);
        moveToNextQuestionRef.current();
      }
    }, 250);
    return () => clearInterval(tick);
  }, [showFeedback, isMultiplayer]);

  // --- Shared, room-driven progression (multiplayer) ---

  // Refs so the 100ms tick below reads current values without restarting.
  const isSubmittedRef = useRef(isSubmitted);
  const lastAdvanceAttemptRef = useRef(0);
  const advanceInFlightRef = useRef(false);
  const markTimeUpRef = useRef<() => void>(() => { });
  const lockQuestionRef = useRef<(how: QuizOutcome) => void>(() => { });

  // Whoever ends a question first wins and everyone else's attempt is a
  // no-op, but each attempt is a transaction on the same document. So one
  // client, picked from the room itself, tries right away: the host, or the
  // first player by ID when the host only observes. Everyone else waits a
  // moment (spread per player) and only steps in if the room hasn't moved
  // on, e.g. the leader closed their tab.
  const advanceLeaderId = useMemo(() => room
    ? (room.hostIsObserver ? playingPlayers(room) : [{ id: room.hostId }])
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
      // Syncing from the room's snapshot; deriving it instead is part of #27.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setScore(storedScore);
    }
  }, [sharedClock, playerId, storedScore, score]);

  // Follow the room onto its current question. This is the only place the
  // question index changes in multiplayer.
  useEffect(() => {
    if (!sharedClock || room?.phase !== "question") return;
    const roomIndex = room.currentQuestionIndex ?? 0;
    if (roomIndex !== currentQuestionIndex) {
      // Syncing from the room's snapshot; deriving it instead is part of #27.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrentQuestionIndex(roomIndex);
      setSelectedAnswer(null);
      setIsSubmitted(false);
      setShowFeedback(false);
      setOutcome(null);
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
      // This page never saw how it was settled (answered or timed out),
      // only that it was.
      lockQuestionRef.current("restored");
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
    if (!sharedClock || !room || loading || observing || leftQuizRef.current) return;
    const bestScore = bestKnownScore(score, room.players, playerId);
    if (room.phase === "mid-scoreboard") {
      leftQuizRef.current = true;
      navigate("/mid-quiz-scoreboard", {
        state: {
          score: bestScore,
          totalQuestions: questions.length,
          currentQuestionIndex: room.currentQuestionIndex ?? 0, // the question after the break
          difficulty,
          players: playingPlayers(room),
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
          players: playingPlayers(room),
          observer: isObserverHost(room, playerId) // shown the standings without a score
        }
      });
    }
  }, [sharedClock, room, loading, observing, score, questions.length, difficulty, roomCode, playerId, navigate]);

  // Lock the current question: no more answers, show its feedback.
  const lockQuestion = (how: QuizOutcome) => {
    isSubmittedRef.current = true;
    setIsSubmitted(true);
    setShowFeedback(true);
    setOutcome(how);
  };

  // Time's up without an answer (both clocks): lock the question with 0
  // points. The score didn't change, so nothing is written: an
  // unchanged-score write from every timed-out player at once only competes
  // with real score writes. (A failed answer write is retried where it
  // fails, in submitAnswer.)
  const markTimeUp = () => {
    lockQuestion("timed-out");
    setCurrentQuestionPoints(0);
    rememberAnswered(currentQuestionIndex);
  };

  // Local clock only: time's up, then 5 seconds of feedback
  const handleTimeUp = () => {
    markTimeUp();
    feedbackDeadlineRef.current = Date.now() + FEEDBACK_MS;
    setTimeLeft(FEEDBACK_MS / 1000);
  };

  // The solo run is saved once, even if the last question's feedback ends
  // twice (it used to end inside a state updater, which StrictMode ran
  // twice, saving every run twice).
  const savedRunRef = useRef(false);

  // Local clock only: move on once the feedback time is over
  const moveToNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      if (isBreakAfter(currentQuestionIndex, questions.length, breakEvery)) {
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
        setOutcome(null); // The next question is open
        setCurrentQuestionPoints(0); // Reset points for new question
      }
    } else {
      if (savedRunRef.current) return;
      savedRunRef.current = true;
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

  // Keep the refs the timers and the shared tick read current.
  useLayoutEffect(() => {
    isSubmittedRef.current = isSubmitted;
    markTimeUpRef.current = markTimeUp;
    lockQuestionRef.current = lockQuestion;
    handleTimeUpRef.current = handleTimeUp;
    moveToNextQuestionRef.current = moveToNextQuestion;
  });

  const handleAnswer = (answer: string) => {
    if (!isSubmitted) {
      setSelectedAnswer(answer);
    }
  };

  const submitAnswer = async (answer: string) => {
    if (!answer) return;
    if (sharedClock && roomStartMs !== null && !questionClock(roomStartMs, Date.now()).answeringOpen) return;

    const answeredQuestion = currentQuestionIndex;
    lockQuestion("answered"); // also flags the ref the shared tick reads

    // Feedback shows right away (lockQuestion above), before awaiting any
    // score write: if the write is slow and the room moves on meanwhile, a
    // late setShowFeedback(true) would land on (and lock) the next question.
    // Locally: remaining question time PLUS 5 seconds; in multiplayer the
    // shared tick counts down to the slot's end.
    const msLeft = !isMultiplayer && questionDeadlineRef.current !== null
      ? Math.max(0, questionDeadlineRef.current - Date.now())
      : timeLeftMs;
    if (!sharedClock) {
      const feedbackTime = Math.min(Math.ceil(msLeft / 1000), QUESTION_MS / 1000) + FEEDBACK_MS / 1000;
      feedbackDeadlineRef.current = Date.now() + feedbackTime * 1000;
      setTimeLeft(feedbackTime);
    }

    // Check if answer is correct and calculate time-based score
    if (answer === currentQuestion.correctAnswer) {
      // Base score plus a time bonus, both clamped and rounded in
      // `quizScoring.ts` so the rule is unit-tested rather than inline here.
      const timeBonus = calculateTimeBonus(msLeft);
      const pointsForAnswer = calculateQuestionScore(msLeft);
      console.log(`Correct answer! Time left: ${msLeft / 1000}s, Time bonus: ${timeBonus}, Total points: ${pointsForAnswer}`);

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
        let scoreToSave = newScore;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            await updatePlayerScore(roomCode, playerId, scoreToSave);
            rememberAnswered(answeredQuestion);
            setScoreSyncError(null);
            break;
          } catch (error) {
            console.error(`Failed to update score (attempt ${attempt} of 3):`, error);
            if (error instanceof ScoreWriteRejected) {
              // The room already holds more than this tab knew (it hadn't
              // picked the room's score up yet): add this answer's points
              // to the room's score instead, rather than drop them.
              if (error.reason === "lower-score" && error.currentScore !== undefined && attempt < 3) {
                scoreToSave = error.currentScore + pointsForAnswer;
                setScore(scoreToSave);
                continue;
              }
              if (error.reason === "finished") {
                setScoreSyncError("The game had already finished, so that answer didn't count.");
                break;
              }
              // Retrying can't fix a room that doesn't know this player, or
              // is gone: say so once instead of failing quietly (#131).
              if (error.reason !== "lower-score") {
                setScoreSyncError("Your score isn't being saved to this room. Ask the host to start a new game.");
                break;
              }
            }
            if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            else setScoreSyncError("Your score couldn't reach the room. Check your connection.");
          }
        }
      }
    } else {
      // If answer is incorrect, set points to 0
      setCurrentQuestionPoints(0);
      rememberAnswered(answeredQuestion);
    }
  };

  // Where the room (or the solo run) goes once this question's feedback
  // ends, for the button's countdown: the same arithmetic advanceQuestion
  // and moveToNextQuestion use.
  const nextPhase = phaseAfterQuestion(
    currentQuestionIndex,
    questions.length,
    // A room without the setting breaks every MID_QUIZ_EVERY, as advanceQuestion does.
    sharedClock ? room?.breakEvery ?? MID_QUIZ_EVERY : breakEvery,
  ).phase;
  const nextLabel = nextPhase === "results" ? "Results"
    : nextPhase === "mid-scoreboard" ? "Scoreboard"
    : "Next question";

  // Settling a question disables the button or answer that had focus, which
  // would drop a keyboard player at the top of the page: give focus to the
  // question instead, from where the next tab reaches the controls again.
  const questionHeadingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!isSubmitted) return;
    const focused = document.activeElement;
    if (!focused || focused === document.body || (focused as HTMLButtonElement).disabled) {
      questionHeadingRef.current?.focus();
    }
  }, [isSubmitted, currentQuestionIndex]);

  // A player who picked "Leave the quiz" and confirmed it.
  const leaveQuiz = () => navigate("/");

  // Loading: a note in place of the questions.
  if (loading) {
    return (
      <CalmPage title={quizName}>
        <CalmNote role="status">{loadingStatus}</CalmNote>
      </CalmPage>
    );
  }

  // Couldn't play: what happened, and the way out.
  if (error || legacyRoom) {
    return (
      <CalmPage title="Quiz unavailable">
        <CalmNote role="alert">{error === LOAD_FAILED && isMultiplayer ? LOAD_FAILED_ROOM : error ?? LEGACY_ROOM_MESSAGE}</CalmNote>
        <Ground>
          <Pane>
            {isMultiplayer
              ? <Control onClick={() => navigate("/multiplayer")}>Back to the game menu</Control>
              : <Control onClick={() => navigate("/quizzes")}>Back to the quiz library</Control>}
          </Pane>
        </Ground>
      </CalmPage>
    );
  }

  return (
    <CalmPage
      title={quizName}
      subtitle={`Question ${currentQuestionIndex + 1} of ${questions.length}`}
      footer={<LeaveQuiz multiplayer={isMultiplayer} onLeave={leaveQuiz} />}
    >
      <QuizStatus
        timeLeft={timeLeft}
        settled={isSubmitted}
        picked={selectedAnswer}
        correctAnswer={currentQuestion.correctAnswer}
        points={currentQuestionPoints}
        outcome={outcome}
        counted={!scoreSyncError}
      />
      {scoreSyncError && <CalmNote role="alert">{scoreSyncError}</CalmNote>}
      <QuestionPane
        question={currentQuestion.question}
        options={currentQuestion.options}
        picked={selectedAnswer}
        correctAnswer={currentQuestion.correctAnswer}
        settled={isSubmitted}
        lockedIn={outcome === "answered"}
        onPick={handleAnswer}
        headingRef={questionHeadingRef}
      />
      <Ground>
        <Pane>
          <Control
            onClick={() => submitAnswer(selectedAnswer ?? "")}
            disabled={!selectedAnswer || isSubmitted || showFeedback}
          >
            {showFeedback ? `${nextLabel} in ${timeLeft}s` : "Lock in my answer"}
          </Control>
        </Pane>
      </Ground>
    </CalmPage>
  );
};

/** A quiz key that names nothing, or a custom quiz that was deleted or emptied. */
const NOT_FOUND = "We can't find that quiz. The link may be wrong, or the quiz was deleted or emptied.";

/** Any other failure to load a quiz's questions, said without the raw error. */
const LOAD_FAILED = "We couldn't load this quiz. Check your connection and try again, or pick another from the library.";

/** The same in a room, where the way out is the game menu, not the library. */
const LOAD_FAILED_ROOM = "We couldn't load this quiz. Check your connection and reload the page to rejoin the game.";

export default Quiz;
