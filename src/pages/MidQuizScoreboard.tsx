import { useEffect, useState, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Player, Room, listenToRoom, markPlayerAtMidQuiz } from "../utils/roomsFirestore";
import { useResumeRoom } from "../hooks/useResumeRoom";
import { hasLeftBreak } from "../utils/quizTiming";
import { bestKnownScore } from "../utils/quizScoring";
import { LEGACY_ROOM_MESSAGE, isObserverHost, isRoomHost, observerRouteState, playingPlayers, shouldObserve } from "../utils/roomRoles";
import { readStoredGame } from "../utils/multiplayerSession";
import { CalmLink, CalmNote, CalmPage } from "../components/CalmPage";
import { Standings } from "../components/Standings";
import { points } from "../utils/finale";
import { Control, Ground, Pane } from "../design";

const TITLE = "Scoreboard break";

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

  // Router state from the page that brought us here; without any (a direct
  // link, a new or restored tab) this tab's stored multiplayer game, read
  // up front so the very first render already knows it's multiplayer (and
  // doesn't offer a single-player Continue to a guest). A stored game that
  // can't be read is an error, not a quiet switch to single player.
  const [stored] = useState(() => (location.state ? { game: null, unreadable: false } : readStoredGame()));
  const [gameData] = useState(() => {
    const session = stored.game;
    return {
      score: locationState.score || 0,
      totalQuestions: locationState.totalQuestions || 0,
      currentQuestionIndex: locationState.currentQuestionIndex || 0,
      difficulty: session?.difficulty || locationState.difficulty || "easy",
      players: locationState.players || [],
      multiplayer: session ? true : (locationState.multiplayer || false),
      roomCode: session?.roomCode ?? (locationState.roomCode || null),
      playerId: session?.playerId ?? (locationState.playerId || null)
    };
  });

  const [players, setPlayers] = useState<Player[]>(gameData.players);
  // Whether the room's first snapshot is in: until then the standings are
  // whatever the quiz handed over, or a note that they're on their way.
  const [scoresLoaded, setScoresLoaded] = useState(false);
  // A multiplayer break with no room to follow (unreadable stored game, or
  // router state without a code) can't load scores or ever move on.
  const [error, setError] = useState<string | null>(
    stored.unreadable || (gameData.multiplayer && !gameData.roomCode)
      ? "This tab lost track of your game. Join it again from multiplayer."
      : null
  );
  // Whether this user is the host: set only from the room's snapshot (see
  // the listener below).
  const [isHost, setIsHost] = useState(false);
  // The host's Continue. Nobody navigates on it: everyone, the host
  // included, goes back when the listener below sees the room resumed
  // (#63). That also covers a second host tab, or a resume whose reply got
  // lost.
  const { resume, resuming, resumeError } = useResumeRoom(gameData.multiplayer ? gameData.roomCode : null);

  // Which break this is: the index of the question after it. Router state
  // carries it (and survives a refresh); without any (a direct link, a new
  // tab) it's taken from the room's first snapshot instead (0 would read as
  // "the room is past this break").
  const breakIndexRef = useRef<number | null>(location.state ? gameData.currentQuestionIndex : null);
  const markedRef = useRef(false);

  // This player's score. Without router state gameData.score is 0, and a
  // score write can land after the quiz handed its score over, so in
  // multiplayer the room's copy wins when it's higher.
  const myScore = gameData.multiplayer
    ? bestKnownScore(gameData.score, players, gameData.playerId)
    : gameData.score;

  // Back to the quiz after the break. In multiplayer the quiz page follows
  // the room from there: onto its current question, or straight on to the
  // next break or the results if the room has already moved past this one.
  // In multiplayer it's called from the room listener with that snapshot,
  // so everything it hands on comes from the room rather than from state
  // the same snapshot is still updating.
  const leftBreakRef = useRef(false);
  const returnToQuiz = useCallback((room?: Room) => {
    // Once only: a second snapshot before this page unmounts would navigate
    // again, and the quiz page reloads on every navigation.
    if (leftBreakRef.current) return;
    leftBreakRef.current = true;
    navigate(`/quiz/${room?.difficulty ?? gameData.difficulty}`, {
      // Multiplayer replaces: Back from the quiz shouldn't land on a break
      // that's over (it would only send the player forward again). Single
      // player keeps the break in history, as before.
      replace: gameData.multiplayer,
      state: {
        // The index of the question after the break: the room's, or in
        // single player the one the quiz handed over (it used to be
        // incremented again here, which skipped a question at every break).
        currentQuestionIndex: room?.currentQuestionIndex ?? gameData.currentQuestionIndex,
        score: room ? bestKnownScore(gameData.score, room.players, gameData.playerId) : gameData.score,
        multiplayer: gameData.multiplayer,
        roomCode: gameData.roomCode,
        playerId: gameData.playerId
      }
    });
  }, [gameData, navigate]);

  const continueQuiz = useCallback(async () => {
    if (!gameData.multiplayer) {
      returnToQuiz();
      return;
    }

    if (isHost) {
      await resume();
    }
  }, [gameData.multiplayer, isHost, returnToQuiz, resume]);

  useEffect(() => {
    // Whether this user is the host (and only observes) comes from the
    // room's snapshot below, never from localStorage: that's shared by
    // every tab and outlives the game, so another tab, or an old game, can
    // leave it saying "host" for a guest or a single player. Until the
    // snapshot arrives nobody gets the host's Continue.

    // The latest snapshot, for a retried ready mark (below). Per
    // subscription, like the timer and flag after it.
    let latestRoom: Room | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let goneTimer: ReturnType<typeof setTimeout> | undefined;
    // Set on cleanup: a mark that fails after this page has closed (a write
    // queued offline, refused on reconnect) must not start retrying against
    // the last room this page saw.
    let disposed = false;
    const markIfInBreak = () => {
      if (disposed) return;
      const room = latestRoom;
      const roomCode = gameData.roomCode;
      const playerId = gameData.playerId;
      if (!room || !roomCode || !playerId || markedRef.current) return;
      // Only an observer host's Continue reads the marks; a playing host
      // continues whenever, so in its room they'd be writes nobody reads.
      if (room.phase !== "mid-scoreboard" || !room.hostIsObserver || isObserverHost(room, playerId)) return;
      // Only for this screen's break: a late snapshot can already show a
      // later one, and this player isn't there yet (hasLeftBreak moves it on).
      if ((room.currentQuestionIndex ?? 0) !== breakIndexRef.current) return;
      markedRef.current = true;
      markPlayerAtMidQuiz(roomCode, playerId).catch(err => {
        console.error("Error marking player as ready at mid-quiz:", err);
        // Try again a couple of seconds later if the room is still in the
        // break (an observer host's Continue waits for every mark). Not
        // straight away: a refused write rolls back into a snapshot that can
        // still show the break from the cache, which would just repeat the
        // refusal. And not only on the next snapshot: a room at a break can
        // go quiet.
        if (disposed) return;
        retryTimer = setTimeout(() => {
          markedRef.current = false;
          markIfInBreak();
        }, 2000);
      });
    };

    // Set up real-time listener if we have multiplayer details
    if (gameData.multiplayer && gameData.roomCode) {
      const unsubscribe = listenToRoom(gameData.roomCode, (room) => {
        if (room) {
          // Always update players array to ensure real-time score updates
          setPlayers(playingPlayers(room));
          setScoresLoaded(true);

          // A room from before #61 has no phase to follow (see Quiz.tsx).
          if (!room.phase) {
            setError(LEGACY_ROOM_MESSAGE);
            return;
          }

          // Who's the host, as the room has it. An observer host isn't a
          // player: while the game is on it only passes through here on its
          // way to HostObserverView (a finished room sends it on to the
          // results like everyone else, below).
          setIsHost(isRoomHost(room, gameData.playerId));
          if (shouldObserve(room, gameData.playerId)) {
            if (!leftBreakRef.current && gameData.roomCode) {
              leftBreakRef.current = true;
              navigate("/host-observer", {
                state: observerRouteState(room, gameData.roomCode, gameData.playerId),
                replace: true // no way back into the players' break screen
              });
            }
            return;
          }

          const roomIndex = room.currentQuestionIndex ?? 0;
          if (breakIndexRef.current === null && room.phase === "mid-scoreboard") {
            breakIndexRef.current = roomIndex;
          }

          // Mark this player ready, once, while the room is actually in the
          // break (the rules refuse a mark at any other time).
          latestRoom = room;
          markIfInBreak();

          // The room's state is the signal (#63): leave this break as soon
          // as the room isn't in it any more, however late this snapshot
          // arrives (a throttled background tab, a locked phone, a slow
          // network). It's a state, not a moment, so there's no window to
          // miss, and a snapshot that skips straight to the results still
          // gets this player there, via the quiz page.
          if (hasLeftBreak(room.phase, roomIndex, breakIndexRef.current ?? -1)) {
            returnToQuiz(room);
          }
        } else {
          setError("This game has closed. Taking you back to multiplayer…");
          clearTimeout(goneTimer);
          goneTimer = setTimeout(() => navigate("/multiplayer"), 2000);
        }
      });

      return () => {
        disposed = true;
        unsubscribe();
        clearTimeout(retryTimer);
        clearTimeout(goneTimer);
      };
    }
  }, [gameData.multiplayer, gameData.roomCode, gameData.playerId, navigate, returnToQuiz]);

  if (error) {
    return (
      <CalmPage title={TITLE}>
        <CalmNote role="alert">{error}</CalmNote>
        <Ground>
          <Pane>
            <Control onClick={() => navigate("/multiplayer")}>Back to multiplayer</Control>
          </Pane>
        </Ground>
      </CalmPage>
    );
  }

  // The host continues in multiplayer, anyone in single player; a guest
  // waits for the room to move on.
  const canContinue = isHost || !gameData.multiplayer;
  const nextQuestion = gameData.currentQuestionIndex + 1;

  // The way out (docs/design/design-system.md, "Navigation"), saying what
  // leaving does: a multiplayer game goes on without this player.
  const leave = gameData.multiplayer ? (
    <CalmLink type="button" onClick={() => navigate("/multiplayer")}>Leave the game, it goes on without you</CalmLink>
  ) : (
    <CalmLink type="button" onClick={() => navigate("/")}>End the quiz and go back to ESCParty</CalmLink>
  );

  return (
    <CalmPage title={TITLE} subtitle={`You have ${points(myScore)} so far.`} footer={leave}>
      {gameData.multiplayer && (players.length > 0 || scoresLoaded ? (
        <Standings
          players={players}
          label="Standings at the break"
          meId={gameData.playerId}
          live
          empty="Nobody's on the scoreboard yet."
        />
      ) : (
        <CalmNote role="status">Fetching the scores…</CalmNote>
      ))}
      {!gameData.multiplayer && gameData.totalQuestions > 0 && (
        <CalmNote>Catch your breath: question {nextQuestion} of {gameData.totalQuestions} is up next.</CalmNote>
      )}

      {canContinue ? (
        <Ground>
          <Pane>
            <Control onClick={continueQuiz} disabled={resuming}>
              {resuming ? "Continuing…" : "Continue the quiz"}
            </Control>
          </Pane>
        </Ground>
      ) : (
        <CalmNote role="status">Waiting for the host to continue…</CalmNote>
      )}
      {resumeError && <CalmNote role="alert">{resumeError}</CalmNote>}
    </CalmPage>
  );
};

export default MidQuizScoreboard;
