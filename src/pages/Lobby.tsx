import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalmLink, CalmNote, CalmPage } from "../components/CalmPage";
import { listenToRoom, removePlayerFromRoom, Room, setPlayerReady, startGame } from "../utils/roomsFirestore";
import { observerRouteState, playingPlayers, shouldObserve } from "../utils/roomRoles";
import { QUIZ_CHOICES, setRoomQuiz } from "../utils/quizCatalog";
import { customQuizKey, listMyQuizzes } from "../utils/customQuizzes";
import { useQuizTitle } from "../hooks/useQuizTitle";
import { startGate } from "../utils/lobbyGate";

interface Identity {
    gameCode: string;
    playerId: string;
    playerName: string;
}

const readIdentity = (): Identity | null => {
    const gameCode = localStorage.getItem("gameCode");
    const playerId = localStorage.getItem("playerId");
    const playerName = localStorage.getItem("playerName");
    return gameCode && playerId && playerName ? { gameCode, playerId, playerName } : null;
};

/**
 * The waiting room before a multiplayer quiz, the green room (#65). Guests
 * say when they're ready; the host picks the quiz, can take out a player
 * who joined by mistake, and starts once everyone is ready, or on purpose
 * with "Start anyway". Every client follows the room to the quiz when it
 * starts. Who's the host comes from the room, not localStorage (#63).
 */
const Lobby = () => {
    const navigate = useNavigate();
    const [identity] = useState(readIdentity);
    const [room, setRoom] = useState<Room | null | undefined>(undefined);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    // A second tap in the same render can't see `busy` yet.
    const inFlight = useRef(false);
    const [pickError, setPickError] = useState<string | null>(null);
    const [selected, setSelected] = useState<string | null>(null);
    const roomQuizTitle = useQuizTitle(room?.difficulty);
    // This device's saved quizzes, offered alongside the premade ones.
    const [myQuizzes] = useState(listMyQuizzes);

    useEffect(() => {
        if (!identity) {
            const timer = setTimeout(() => navigate("/multiplayer"), 2000);
            return () => clearTimeout(timer);
        }
        const { gameCode, playerId } = identity;
        return listenToRoom(gameCode, (roomData) => {
            setRoom(roomData);
            if (!roomData?.started) return;
            // Save essentials to sessionStorage to persist through page refresh.
            // (Whether this user is an observer host isn't passed on: the quiz
            // and break screens read it from the room, #63.)
            sessionStorage.setItem("multiplayerGame", JSON.stringify({
                multiplayer: true,
                roomCode: gameCode,
                playerId,
                difficulty: roomData.difficulty,
            }));
            // An observer host goes straight to its own screen rather than
            // loading the quiz only to be redirected from it (unless the game
            // is already over: the quiz page sends a finished room on to the
            // results, as for everyone else).
            if (shouldObserve(roomData, playerId)) {
                navigate("/host-observer", {
                    state: observerRouteState(roomData, gameCode, playerId),
                    replace: true, // Back from the observer screen skips this started lobby
                });
                return;
            }
            navigate(`/quiz/${roomData.difficulty}`, {
                state: { multiplayer: true, roomCode: gameCode, playerId },
            });
        });
    }, [identity, navigate]);

    // A guest who leaves takes themselves out, so the host's start gate
    // doesn't count them as present (and ready). Leaving goes ahead even if
    // that write fails; the host can still take them out.
    const leaveRoom = async () => {
        const self = room && identity && room.hostId !== identity.playerId && !room.started
            ? room.players.find(p => p.id === identity.playerId)
            : undefined;
        if (self && identity) {
            try {
                await removePlayerFromRoom(identity.gameCode, self);
            } catch (err) {
                console.error("Couldn't leave the room:", err);
            }
        }
        navigate("/multiplayer");
    };
    const leave = <CalmLink type="button" onClick={leaveRoom}>Leave the waiting room</CalmLink>;

    if (!identity) {
        return (
            <CalmPage title="The green room">
                <CalmNote role="alert">Missing game data. Returning to multiplayer lobby.</CalmNote>
            </CalmPage>
        );
    }
    if (room === undefined) {
        return (
            <CalmPage title="The green room" footer={leave}>
                <CalmNote role="status">Opening the waiting room…</CalmNote>
            </CalmPage>
        );
    }
    if (room === null || error) {
        return (
            <CalmPage title="The green room" footer={leave}>
                <CalmNote role="alert">{error ?? "Game not found"}</CalmNote>
            </CalmPage>
        );
    }

    const { gameCode, playerId } = identity;
    const isHost = room.hostId === playerId;
    const me = room.players.find(p => p.id === playerId);

    // Taken out by the host: this tab isn't in the room any more.
    if (!me) {
        return (
            <CalmPage title="The green room" footer={leave}>
                <CalmNote role="alert">The host took you out of this game. You can join again with the code.</CalmNote>
                <div className="calm-ground">
                    <div className="lycra-pane">
                        <button type="button" className="lycra" onClick={() => navigate("/multiplayer")}>Join a game</button>
                    </div>
                </div>
            </CalmPage>
        );
    }

    const ready = room.readyPlayers ?? [];
    const players = playingPlayers(room);
    const gate = startGate(room);
    const amReady = ready.includes(playerId);
    const chosen = isHost ? room.players.find(p => p.id === selected && p.id !== room.hostId) : undefined;

    /**
     * One write at a time; a failure leaves a note and the page usable,
     * unless `onError` handles it. (The quiz pick is one-shot in the rules,
     * so a double tap's second write would be denied.)
     */
    const run = async (what: string, write: () => Promise<void>, onError?: (err: unknown) => void) => {
        if (inFlight.current) return;
        inFlight.current = true;
        setBusy(true);
        setPickError(null);
        try {
            await write();
        } catch (err) {
            console.error(`Couldn't ${what}:`, err);
            if (onError) onError(err);
            else setPickError(`Couldn't ${what}. Try again.`);
        } finally {
            inFlight.current = false;
            setBusy(false);
        }
    };

    // The room's `difficulty` names the quiz (quizCatalog.ts). Nothing was
    // written if the quiz couldn't be read, so the host can pick again; a
    // refused write is a dead end as before.
    const handleSelectQuiz = (quizKey: string) => run("set the quiz", () => setRoomQuiz(gameCode, quizKey), (err) => {
        if (String(err).includes("Failed to set difficulty")) setError("Failed to set difficulty");
        else setPickError("That quiz couldn't be loaded. Check your connection, or pick another.");
    });

    const status = (id: string) => {
        if (id === room.hostId) return "Host";
        return ready.includes(id) ? "Ready" : "Getting ready";
    };

    return (
        <CalmPage
            title="The green room"
            subtitle={<>Game code <strong>{gameCode}</strong> · you are {me.name}</>}
            footer={leave}
        >
            <CalmNote>Quiz: {room.difficulty ? roomQuizTitle : isHost ? "pick one below" : "the host is picking"}</CalmNote>

            {isHost && !room.difficulty && (
                <>
                    <CalmNote>Pick a quiz</CalmNote>
                    <div className="calm-ground">
                        <div className="lycra-pane">
                            {myQuizzes.map(quiz => (
                                <button key={quiz.id} type="button" className="lycra" disabled={busy} onClick={() => handleSelectQuiz(customQuizKey(quiz.id))}>
                                    {quiz.title}
                                </button>
                            ))}
                            {QUIZ_CHOICES.map(choice => (
                                <button key={choice.key} type="button" className="lycra" disabled={busy} onClick={() => handleSelectQuiz(choice.key)}>
                                    {choice.title}
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}

            <CalmNote>{players.length === 1 ? "1 player" : `${players.length} players`}</CalmNote>
            <div className="calm-ground">
                <div className="lycra-pane" role="group" aria-label="Players">
                    {players.map(player => {
                        const row = (
                            <span className="calm-row">
                                <span>{player.name}{player.id === playerId ? " (you)" : ""}</span>
                                <span>{status(player.id)}</span>
                            </span>
                        );
                        return isHost && player.id !== room.hostId ? (
                            <button
                                key={player.id}
                                type="button"
                                className={`lycra is-block${selected === player.id ? " is-chosen" : ""}`}
                                aria-pressed={selected === player.id}
                                onClick={() => setSelected(selected === player.id ? null : player.id)}
                            >
                                {row}
                            </button>
                        ) : (
                            <div key={player.id} className="lycra is-block is-static">{row}</div>
                        );
                    })}
                </div>
            </div>

            {chosen && (
                <div className="calm-ground">
                    <div className="lycra-pane">
                        <button
                            type="button"
                            className="lycra"
                            disabled={busy}
                            onClick={() => run(`remove ${chosen.name}`, async () => {
                                await removePlayerFromRoom(gameCode, chosen);
                                setSelected(null);
                            })}
                        >
                            Take {chosen.name} out of the game
                        </button>
                    </div>
                </div>
            )}

            {!isHost && (
                <div className="calm-ground">
                    <div className="lycra-pane">
                        <button
                            type="button"
                            className={`lycra${amReady ? " is-chosen" : ""}`}
                            aria-pressed={amReady}
                            disabled={busy}
                            onClick={() => run("change whether you're ready", () => setPlayerReady(gameCode, playerId, !amReady))}
                        >
                            {amReady ? "I'm ready (tap to undo)" : "I'm ready"}
                        </button>
                    </div>
                </div>
            )}
            {!isHost && <CalmNote role="status">{amReady ? "Waiting for the host to start." : "Tap when you're ready to play."}</CalmNote>}

            {isHost && room.difficulty && (
                <>
                    <CalmNote role="status">{gate.message}</CalmNote>
                    {gate.canStart !== "no" && (
                        <div className="calm-ground">
                            <div className="lycra-pane">
                                <button
                                    type="button"
                                    className={`lycra${gate.canStart === "yes" ? " is-chosen" : ""}`}
                                    disabled={busy}
                                    onClick={() => run("start the game", () => startGame(gameCode))}
                                >
                                    {gate.canStart === "yes" ? "Start the show" : "Start anyway"}
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
            {pickError && <CalmNote role="alert">{pickError}</CalmNote>}
        </CalmPage>
    );
};

export default Lobby;
