import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CalmLink, CalmNote, CalmPage } from "../components/CalmPage";
import {
  createRoom,
  generateRoomCode,
  joinRoom,
  listenToRoom,
  setNextRoom,
  type Player,
  type Room,
} from "../utils/roomsFirestore";
import { isObserverHost, isRoomHost, playingPlayers } from "../utils/roomRoles";
import { readMultiplayerGame } from "../utils/multiplayerSession";
import { bestKnownScore } from "../utils/quizScoring";
import { PODIUM_POINTS, nextRevealLabel, placePlayers, revealSteps, winnerLine } from "../utils/finale";

interface ScoreEntry {
  score: number;
  total: number;
  date: string;
  difficulty?: string;
}

/**
 * The end of a quiz (#67). Solo: your score and your past ones. In a room:
 * the final standings, revealed like a Eurovision scoreboard, from the
 * bottom up with the podium one place at a time; then the host can start
 * another round with the same guests, who follow from here (#21).
 *
 * Calm, so the reveal is staged by taps, never animated: each tap adds rows.
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

  const [scoreHistory] = useState<ScoreEntry[]>(() => {
    if (gameData.multiplayer) return [];
    try {
      const stored: unknown = JSON.parse(localStorage.getItem("quizScores") || "[]");
      return Array.isArray(stored) ? stored : [];
    } catch {
      return [];
    }
  });
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>(gameData.players);
  const [error, setError] = useState<string | null>(null);
  // An observer host never played, so it gets the standings without a
  // score. Decided from the room once it arrives; the quiz page's router
  // flag only covers the first render.
  const [isObserver, setIsObserver] = useState<boolean>(!!location.state?.observer);
  const [step, setStep] = useState(0);
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
        subtitle={best !== null && best > gameData.score ? `Your best is still ${best}.` : undefined}
        footer={<CalmLink type="button" onClick={() => leave("/")}>Back to ESCParty</CalmLink>}
      >
        <div className="calm-ground">
          <div className="lycra-pane">
            <div className="lycra is-block is-static is-chosen">
              <span className="calm-label">You scored</span>
              <span>{gameData.score} points</span>
            </div>
          </div>
        </div>
        <div className="calm-ground">
          <div className="lycra-pane">
            <button type="button" className="lycra" onClick={() => leave("/quizzes")}>Play another quiz</button>
            <button type="button" className="lycra" onClick={() => leave("/scoreboard")}>See the scoreboard</button>
          </div>
        </div>
        {scoreHistory.length > 0 && (
          <>
            <CalmNote>Your past scores</CalmNote>
            <div className="calm-ground">
              <ol className="lycra-pane" aria-label="Your past scores">
                {scoreHistory.map((entry, index) => (
                  <li key={index} className="lycra is-block is-static">
                    <span className="calm-row">
                      <span>{new Date(entry.date).toLocaleDateString()}</span>
                      <span>{entry.score} / {entry.total}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </>
        )}
      </CalmPage>
    );
  }

  const placed = placePlayers(players);
  const steps = revealSteps(placed);
  const shown = step === 0 ? 0 : steps[Math.min(step, steps.length) - 1];
  const revealed = placed.slice(placed.length - shown);
  const done = steps.length > 0 && step >= steps.length;
  const isHost = isRoomHost(room, gameData.playerId);
  // This player's name in this room (the host included, from the full
  // list), before this device's last-used name, which another tab may have
  // changed since.
  const myName = room?.players.find(p => p.id === gameData.playerId)?.name
    ?? localStorage.getItem("playerName") ?? "Player";

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
      title="And the results are…"
      subtitle={isObserver ? undefined : `You scored ${bestKnownScore(gameData.score, players, gameData.playerId)} points.`}
      footer={<CalmLink type="button" onClick={() => leave("/")}>Back to ESCParty</CalmLink>}
    >
      {error && <CalmNote role="alert">{error}</CalmNote>}
      {placed.length === 0 && !error && <CalmNote role="status">Collecting the final scores…</CalmNote>}

      {revealed.length > 0 && (
        <div className="calm-ground">
          <ol className="lycra-pane" aria-label="Final standings">
            {revealed.map(({ player, place }) => {
              const podium = PODIUM_POINTS[place];
              const mine = player.id === gameData.playerId;
              return (
                <li
                  key={player.id}
                  className={`lycra is-block is-static${place === 1 ? " is-chosen" : ""}`}
                >
                  {podium && <span className="calm-label">{podium}</span>}
                  <span className="calm-row">
                    <span>{place}. {player.name}{mine ? " (you)" : ""}</span>
                    <span>{player.score}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {done ? (
        <CalmNote role="status">{winnerLine(placed)}</CalmNote>
      ) : (
        placed.length > 0 && (
          <div className="calm-ground">
            <div className="lycra-pane calm-split">
              <button type="button" className="lycra" onClick={() => setStep(step + 1)}>
                {step === 0 ? "Start the reveal" : `Reveal ${nextRevealLabel(placed, shown)}`}
              </button>
              <button type="button" className="lycra" onClick={() => setStep(steps.length)}>
                Show everything
              </button>
            </div>
          </div>
        )
      )}

      {room && isHost && !room.nextRoomCode && (
        <div className="calm-ground">
          <div className="lycra-pane">
            <button type="button" className="lycra" disabled={nextRound === "busy"} onClick={playAgain}>
              Play again with everyone
            </button>
          </div>
        </div>
      )}
      {room?.nextRoomCode && (
        <>
          <CalmNote>{isHost ? "You've started another round." : "The host has started another round."}</CalmNote>
          <div className="calm-ground">
            <div className="lycra-pane">
              <button type="button" className="lycra" disabled={nextRound === "busy"} onClick={joinNext}>
                {isHost ? "Back to the next round's lobby" : "Join the next round"}
              </button>
            </div>
          </div>
        </>
      )}
      {nextRound !== "idle" && nextRound !== "busy" && <CalmNote role="status">{nextRound}</CalmNote>}

      {room && !isHost && !room.nextRoomCode && (
        <div className="calm-ground">
          <div className="lycra-pane">
            <button type="button" className="lycra" onClick={() => leave("/multiplayer")}>Join or host another game</button>
          </div>
        </div>
      )}
    </CalmPage>
  );
};

export default QuizResults;
