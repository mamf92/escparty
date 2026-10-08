import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CalmLink, CalmNote, CalmPage } from "../components/CalmPage";
import { Control, Ground, Loader, Pane, Row } from "../design";
import {
  createRoom,
  generateRoomCode,
  joinRoom,
  listenToRoom,
  setNextRoom,
  setRevealStep,
  type Player,
  type Room,
} from "../utils/roomsFirestore";
import { isObserverHost, isRoomHost, playingPlayers } from "../utils/roomRoles";
import { readMultiplayerGame } from "../utils/multiplayerSession";
import { bestKnownScore } from "../utils/quizScoring";
import { formatRunDate, readScoreHistory } from "../utils/scoreHistory";
import { PODIUM_POINTS, nextRevealLabel, placePlayers, points, someoneLeads, revealAnnouncement, revealDone, revealSteps, revealedCount } from "../utils/finale";

/**
 * The end of a quiz (#67). Solo: your score and your past ones. In a room:
 * the final standings, revealed like a Eurovision scoreboard, from the
 * bottom up with the podium one place at a time; then the host can start
 * another round with the same guests, who follow from here (#21).
 *
 * Calm, so the reveal is staged by taps, never animated: each tap adds rows.
 * In a room only the host taps: the step lives on the room (`revealStep`) and
 * every phone follows it, with guests waiting under a disco ball until the
 * host starts. Only a room that has gone is revealed locally (no host left
 * to write to).
 */
const QuizResults = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Without router state (a direct link, a reload) this tab's stored
  // multiplayer game, read up front so the first render already knows it's
  // multiplayer. It's kept until the player leaves this page on purpose, so
  // a reload here still finds the room.
  const [gameData] = useState(() => {
    const state = location.state ?? {};
    const session = location.state ? null : readMultiplayerGame();
    return {
      score: (state.score as number) || 0,
      multiplayer: session ? true : !!state.multiplayer,
      roomCode: (session?.roomCode ?? state.roomCode ?? null) as string | null,
      playerId: (session?.playerId ?? state.playerId ?? null) as string | null,
      players: (state.players as Player[] | undefined) ?? [],
    };
  });

  // Read through the shared reader so a broken stored run is skipped here
  // just as on the scoreboard, instead of crashing the page.
  const [scoreHistory] = useState(() => (gameData.multiplayer ? [] : readScoreHistory()));
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>(gameData.players);
  const [error, setError] = useState<string | null>(null);
  // An observer host never played, so it gets the standings without a
  // score. Decided from the room once it arrives; the quiz page's router
  // flag only covers the first render.
  const [isObserver, setIsObserver] = useState<boolean>(!!location.state?.observer);
  // Only used once the room has gone; otherwise the room's revealStep rules.
  const [localStep, setLocalStep] = useState(0);
  const [revealError, setRevealError] = useState<string | null>(null);
  const [nextRound, setNextRound] = useState<"idle" | "busy" | string>("idle");
  // A tap in the same render as another can't see "busy" yet.
  const inFlight = useRef(false);
  // The next round's room once created, so a retry after a failed
  // setNextRoom points at it instead of creating another.
  const createdRoom = useRef<string | null>(null);

  // Leaving this page, however (a button, Back, a typed URL), ends this
  // game for the tab, so its stored game can't resume a finished room
  // later. Deferred, so StrictMode's rehearsal unmount in development
  // doesn't count; a reload never runs it, so a reload keeps the game.
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      setTimeout(() => {
        if (!mounted.current) sessionStorage.removeItem("multiplayerGame");
      }, 0);
    };
  }, []);

  useEffect(() => {
    if (!gameData.multiplayer || !gameData.roomCode) return;
    // Listen while this page is open: the first snapshot can be slow, and
    // the host's next round arrives on this room too.
    return listenToRoom(gameData.roomCode, (next) => {
      if (next) {
        // A room that comes back (a cache-only miss, then the server) is
        // playable again: drop the "gone" notice and its way out.
        setError(null);
        setRoom(next);
        setPlayers(playingPlayers(next));
        setIsObserver(isObserverHost(next, gameData.playerId));
      } else {
        setError("The game room no longer exists.");
      }
    });
  }, [gameData.multiplayer, gameData.roomCode, gameData.playerId]);

  /** Leave on purpose: this game is over for this tab. */
  const leave = (path: string) => {
    sessionStorage.removeItem("multiplayerGame");
    navigate(path);
  };

  /** Hand this tab over to another room's lobby, as MultiplayerLobby does. */
  const goToLobby = (code: string, playerId: string, name: string, host: boolean) => {
    localStorage.setItem("playerId", playerId);
    localStorage.setItem("playerName", name);
    localStorage.setItem("gameCode", code);
    localStorage.setItem("isHost", String(host));
    leave("/lobby");
  };

  if (!gameData.multiplayer) {
    const best = scoreHistory.length > 0 ? Math.max(...scoreHistory.map(entry => entry.score)) : null;
    return (
      <CalmPage
        title="Quiz complete"
        subtitle={best !== null && best > gameData.score ? `Your best is still ${points(best)}.` : undefined}
        footer={<CalmLink type="button" onClick={() => leave("/")}>Back to ESCParty</CalmLink>}
      >
        <Ground>
          <Pane>
            <Row elevation="high">
              <span className="calm-label">You scored</span>
              <span>{points(gameData.score)}</span>
            </Row>
          </Pane>
        </Ground>
        <Ground>
          <Pane>
            {/* The next step is the black button (design-system.md, "Page anatomy"). */}
            <Control elevation="high" onClick={() => leave("/quizzes")}>Play another quiz</Control>
            <Control onClick={() => leave("/scoreboard")}>See the scoreboard</Control>
          </Pane>
        </Ground>
        {scoreHistory.length > 0 && (
          <>
            <h2 className="esc-note" id="results-past-scores">Your past scores</h2>
            <Ground>
              <Pane as="ol" aria-labelledby="results-past-scores">
                {scoreHistory.map((entry, index) => (
                  <Row key={index} as="li">
                    <span className="calm-row">
                      <span>{formatRunDate(entry.date)}</span>
                      <span>{points(entry.score)}{entry.total === undefined ? "" : ` · ${entry.total} ${entry.total === 1 ? "question" : "questions"}`}</span>
                    </span>
                  </Row>
                ))}
              </Pane>
            </Ground>
          </>
        )}
      </CalmPage>
    );
  }

  const placed = placePlayers(players);
  // Rank by elevation as the break's standings do: nobody stands proud for
  // first when everyone is level, only your own row.
  const leads = someoneLeads(placed);
  const steps = revealSteps(placed);
  const isHost = isRoomHost(room, gameData.playerId);
  // With the room gone, scores the page already holds can still be revealed
  // by anyone, on their own phone; otherwise everyone follows the host.
  const roomStep = room?.revealStep ?? 0;
  const step = error ? Math.max(localStep, roomStep) : roomStep;
  const canReveal = isHost || !!error;
  const waitingForHost = !!room && !canReveal && step === 0 && placed.length > 0;
  const shown = revealedCount(steps, step);
  const revealed = placed.slice(placed.length - shown);
  const done = revealDone(steps, step);
  // One status line for the whole reveal, mounted from the first render so
  // screen readers announce each change to it: collecting, then how many
  // are on the board, then what each tap added, then the winner.
  // With the room gone there is nothing left to collect, but scores the
  // page already holds can still be revealed and announced.
  // A guest waiting for the host is told by the Loader, which is a status itself.
  const statusLine = waitingForHost ? "" : placed.length > 0 ? revealAnnouncement(placed, step, steps) : error ? "" : "Collecting the final scores…";
  // This player's name in this room (the host included, from the full
  // list), before this device's last-used name, which another tab may have
  // changed since.
  const myName = room?.players.find(p => p.id === gameData.playerId)?.name
    ?? localStorage.getItem("playerName") ?? "Player";

  /** The host's tap: every phone follows the room's step. */
  const revealTo = async (next: number) => {
    setRevealError(null);
    if (error || !gameData.roomCode) {
      setLocalStep(next);
      return;
    }
    try {
      await setRevealStep(gameData.roomCode, next);
    } catch (err) {
      console.error("Couldn't reveal:", err);
      setRevealError("Couldn't reveal that. Try again.");
    }
  };

  const nextRoundStep = async (what: string, run: (playerId: string) => Promise<void>) => {
    if (inFlight.current || !gameData.playerId) return;
    inFlight.current = true;
    setNextRound("busy");
    try {
      await run(gameData.playerId);
    } catch (err) {
      console.error(`Couldn't ${what}:`, err);
      setNextRound(`Couldn't ${what}. Try again.`);
    } finally {
      inFlight.current = false;
    }
  };

  const playAgain = () => nextRoundStep("start the next round", async (playerId) => {
    if (!room) return;
    if (!createdRoom.current) {
      const code = generateRoomCode();
      await createRoom(code, playerId, myName, room.hostIsObserver === true);
      createdRoom.current = code;
    }
    await setNextRoom(room.id, createdRoom.current);
    goToLobby(createdRoom.current, playerId, myName, true);
  });

  const joinNext = () => nextRoundStep("join the next round", async (playerId) => {
    const code = room?.nextRoomCode;
    if (!code) return;
    if (isHost) {
      // The host already made it: back to its lobby.
      goToLobby(code, playerId, myName, true);
      return;
    }
    if (!(await joinRoom(code, playerId, myName))) {
      setNextRound("That round isn't open any more: it has started or is gone.");
      return;
    }
    goToLobby(code, playerId, myName, false);
  });

  return (
    <CalmPage
      title="The results are in"
      subtitle={isObserver ? undefined : `You scored ${points(bestKnownScore(gameData.score, players, gameData.playerId))}.`}
      footer={<CalmLink type="button" onClick={() => leave("/")}>Back to ESCParty</CalmLink>}
    >
      {error && (
        <>
          <CalmNote role="alert">{error} Join or host another game to play on.</CalmNote>
          <Ground>
            <Pane>
              <Control onClick={() => leave("/multiplayer")}>Join or host another game</Control>
            </Pane>
          </Ground>
        </>
      )}

      {revealed.length > 0 && (
        <Ground>
          <Pane as="ol" aria-label="Final standings">
            {revealed.map(({ player, place }) => {
              const podium = PODIUM_POINTS[place];
              const mine = player.id === gameData.playerId;
              return (
                <Row key={player.id} as="li" elevation={(leads && place === 1) || mine ? "high" : "rest"}>
                  {podium && <span className="calm-label">{podium}</span>}
                  <span className="calm-row">
                    <span>{place}. {player.name}{mine ? " (you)" : ""}</span>
                    <span>{points(player.score)}</span>
                  </span>
                </Row>
              );
            })}
          </Pane>
        </Ground>
      )}

      {/* Empty only once the room has gone with nobody to show: the alert
          above says so, and an empty note would just leave a gap. */}
      {statusLine && <CalmNote role="status">{statusLine}</CalmNote>}
      {waitingForHost && <Loader inline>Wait to see who won…</Loader>}
      {canReveal && !done && placed.length > 0 && (
        <Ground>
          <Pane layout="split">
            <Control onClick={() => revealTo(step + 1)}>
              {step === 0 ? "Start the reveal" : `Reveal ${nextRevealLabel(placed, shown)}`}
            </Control>
            <Control onClick={() => revealTo(steps.length)}>Show everything</Control>
          </Pane>
        </Ground>
      )}
      {revealError && <CalmNote role="alert">{revealError}</CalmNote>}

      {/* A room that's gone can't take a next round: the way out above is all. */}
      {room && isHost && !room.nextRoomCode && !error && (
        <Ground>
          <Pane>
            {/* Once everyone is showing, the next round is the next step (design-system.md, "Page anatomy"). */}
            <Control elevation={done ? "high" : "rest"} disabled={nextRound === "busy"} onClick={playAgain}>Play again with everyone</Control>
          </Pane>
        </Ground>
      )}
      {room?.nextRoomCode && !error && (
        <>
          <CalmNote>{isHost ? "You've started another round." : "The host has started another round."}</CalmNote>
          <Ground>
            <Pane>
              <Control elevation={done ? "high" : "rest"} disabled={nextRound === "busy"} onClick={joinNext}>
                {isHost ? "Back to the next round's lobby" : "Join the next round"}
              </Control>
            </Pane>
          </Ground>
        </>
      )}
      {nextRound !== "idle" && nextRound !== "busy" && <CalmNote role="alert">{nextRound}</CalmNote>}

      {room && !isHost && !room.nextRoomCode && !error && (
        <Ground>
          <Pane>
            <Control onClick={() => leave("/multiplayer")}>Join or host another game</Control>
          </Pane>
        </Ground>
      )}
    </CalmPage>
  );
};

export default QuizResults;
