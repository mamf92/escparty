import { useEffect, useState, useCallback, useRef } from "react";
import styled from "styled-components";
import { useLocation, useNavigate } from "react-router-dom";
import { Player, listenToRoom, markPlayerAtMidQuiz, resumeAfterMidQuiz } from "../utils/roomsFirestore";
import { hasLeftBreak } from "../utils/quizTiming";

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
  // The host's Continue: in flight until the room resumes and the listener
  // takes everyone back, or failed with a message and a retry.
  const [resuming, setResuming] = useState(false);
  const [continueError, setContinueError] = useState<string | null>(null);

  // Which break this is: the index of the question after it. Router state
  // carries it; after a refresh there's none, so it's taken from the room's
  // first snapshot instead (0 would read as "the room is past this break").
  const breakIndexRef = useRef<number | null>(location.state ? gameData.currentQuestionIndex : null);
  // The room's own difficulty, so a refreshed page (no router state) goes
  // back to the right quiz rather than the "easy" default.
  const roomDifficultyRef = useRef<string | null>(null);
  const markedRef = useRef(false);

  // Check if host is observer and redirect if needed
  useEffect(() => {
    // Check if current user is the host and is an observer
    if (isHost && hostIsObserver) {
      // Redirect to dedicated HostObserverView
      navigate("/host-observer", {
        state: {
          currentQuestionIndex: gameData.currentQuestionIndex,
          difficulty: gameData.difficulty,
          players: players,
          roomCode: gameData.roomCode
        }
      });
    }
  }, [isHost, hostIsObserver, navigate, gameData, players]);

  // This player's score. Without router state (a refresh) gameData.score is
  // 0, so in multiplayer the room's copy wins when it's higher.
  const roomScore = players.find(p => p.id === gameData.playerId)?.score ?? 0;
  const myScore = gameData.multiplayer ? Math.max(gameData.score, roomScore) : gameData.score;

  // Back to the quiz after the break. In multiplayer the quiz page follows
  // the room from there: onto its current question, or straight on to the
  // next break or the results if the room has already moved past this one.
  const leftBreakRef = useRef(false);
  const returnToQuiz = useCallback(() => {
    // Once only: a second snapshot before this page unmounts would navigate
    // again, and the quiz page reloads on every navigation.
    if (leftBreakRef.current) return;
    leftBreakRef.current = true;
    navigate(`/quiz/${roomDifficultyRef.current ?? gameData.difficulty}`, {
      state: {
        // The quiz already hands us the index of the question after the
        // break (it used to be incremented again here, which skipped a
        // question at every mid-quiz break).
        currentQuestionIndex: gameData.currentQuestionIndex,
        score: myScore,
        players: gameData.multiplayer ? players : gameData.players,
        multiplayer: gameData.multiplayer,
        roomCode: gameData.roomCode,
        playerId: gameData.playerId,
        hostIsObserver: gameData.multiplayer ? hostIsObserver : false
      }
    });
  }, [gameData, hostIsObserver, navigate, players, myScore]);

  const continueQuiz = useCallback(async () => {
    if (error) {
      navigate("/multiplayer");
      return;
    }

    if (!gameData.multiplayer) {
      returnToQuiz();
      return;
    }

    // The host starts the next question for the whole room. It doesn't
    // navigate here: everyone, the host included, goes back when the
    // listener below sees the room resumed (#63). That also covers a
    // second host tab, or a resume whose reply got lost. The button stays
    // disabled meanwhile, so repeated taps don't queue more transactions.
    if (isHost && gameData.roomCode && !resuming) {
      setResuming(true);
      setContinueError(null);
      try {
        await resumeAfterMidQuiz(gameData.roomCode);
      } catch (err) {
        console.error("Error in host continue logic:", err);
        setContinueError("Couldn't continue the quiz. Check your connection and try again.");
        setResuming(false);
      }
    }
  }, [gameData.multiplayer, gameData.roomCode, isHost, navigate, error, returnToQuiz, resuming]);

  const returnToQuizRef = useRef(returnToQuiz);
  useEffect(() => {
    returnToQuizRef.current = returnToQuiz;
  }, [returnToQuiz]);

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

    // Whether this user is the host (and only observes) comes from the
    // room's snapshot below, never from localStorage: that's shared by
    // every tab and outlives the game, so another tab, or an old game, can
    // leave it saying "host" for a guest or a single player. Until the
    // snapshot arrives nobody gets the host's Continue.

    // Set up real-time listener if we have multiplayer details
    if (gameData.multiplayer && gameData.roomCode) {
      const unsubscribe = listenToRoom(gameData.roomCode, (room) => {
        if (room) {
          // Filter out host from players list if host is in observer mode
          const filteredPlayers = room.hostIsObserver
            ? room.players.filter(player => player.id !== room.hostId)
            : room.players;

          // Always update players array to ensure real-time score updates
          setPlayers(filteredPlayers);

          // Who's the host, and whether they only observe, as the room has it.
          const roomSaysHost = !!gameData.playerId && room.hostId === gameData.playerId;
          const observerHost = roomSaysHost && room.hostIsObserver === true;
          setIsHost(roomSaysHost);
          setHostIsObserver(observerHost);
          if (room.difficulty) roomDifficultyRef.current = room.difficulty;

          const roomIndex = room.currentQuestionIndex ?? 0;
          if (breakIndexRef.current === null && room.phase === "mid-scoreboard") {
            breakIndexRef.current = roomIndex;
          }

          // Mark this player ready, once, while the room is actually in the
          // break (the rules refuse a mark at any other time). An observer
          // host isn't a player: it only passes through here on its way to
          // HostObserverView.
          if (room.phase === "mid-scoreboard" && !observerHost && gameData.playerId && !markedRef.current) {
            markedRef.current = true;
            markPlayerAtMidQuiz(gameData.roomCode, gameData.playerId).catch(err => {
              console.error("Error marking player as ready at mid-quiz:", err);
            });
          }

          // The room's state is the signal (#63): leave this break as soon
          // as the room isn't in it any more, however late this snapshot
          // arrives (a throttled background tab, a locked phone, a slow
          // network). It's a state, not a moment, so there's no window to
          // miss, and a snapshot that skips straight to the results still
          // gets this player there, via the quiz page. Observer hosts stay
          // on HostObserverView instead.
          if (!observerHost && hasLeftBreak(room.phase, roomIndex, breakIndexRef.current ?? -1)) {
            returnToQuizRef.current();
          }
        } else {
          setError("Game room no longer exists");
          setTimeout(() => navigate("/multiplayer"), 2000);
        }
      });

      return () => unsubscribe();
    }
  }, [gameData.multiplayer, gameData.roomCode, gameData.playerId, location.state, navigate]);

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
      <Score>You scored {myScore} so far!</Score>
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

      {/* Only show continue button for the host in multiplayer mode, or for anyone in single-player */}
      {(isHost || !gameData.multiplayer) ? (
        <>
          <NextButton onClick={continueQuiz} disabled={resuming}>
            {resuming ? "Continuing..." : "Continue Quiz"}
          </NextButton>
          {continueError && <ErrorMessage>{continueError}</ErrorMessage>}
        </>
      ) : (
        <WaitingMessage>Waiting for the host to continue...</WaitingMessage>
      )}
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

const WaitingMessage = styled.p`
  color: ${({ theme }) => theme.colors.purple};
  font-size: 1.2rem;
  font-weight: bold;
  margin-top: 1.25rem; /* 20px */
  padding: 1rem;
  border: 1px solid ${({ theme }) => theme.colors.pinkLavender};
  background-color: ${({ theme }) => theme.colors.magnolia};
`;
