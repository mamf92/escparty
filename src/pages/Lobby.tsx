import styled from "styled-components";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalmLink, CalmNote, CalmPage } from "../components/CalmPage";
import { Badge, Control, Ground, Pane, Row } from "../design";
import { ConfirmLeave } from "../components/ConfirmLeave";
import { QrFullScreen } from "../components/QrFullScreen";
import { listenToRoom, QuizPickRefused, removePlayerFromRoom, Room, setPlayerReady, startGame } from "../utils/roomsFirestore";
import { observerRouteState, playingPlayers, shouldObserve } from "../utils/roomRoles";
import { quizCardsFor, setRoomQuiz } from "../utils/quizCatalog";
import { QuizCardGrid } from "../components/QuizCard";
import { listMyQuizzes } from "../utils/customQuizzes";
import { useQuizTitle } from "../hooks/useQuizTitle";
import { roomGuests, startGate } from "../utils/lobbyGate";
import { useLeaveGuard } from "../hooks/useLeaveGuard";

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

/** The code badge and the QR button side by side, wrapping at a narrow width. */
const CodeRow = styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: var(--esc-space-3);
`;

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
    const [busy, setBusy] = useState(false);
    // A second tap in the same render can't see `busy` yet.
    const inFlight = useRef(false);
    const [pickError, setPickError] = useState<string | null>(null);
    // The rules refused the last quiz pick; said only while the picker shows.
    const [pickRefused, setPickRefused] = useState(false);
    const [selected, setSelected] = useState<string | null>(null);
    // The host is changing the quiz: the picker is back, with a way to keep the current one.
    const [changing, setChanging] = useState(false);
    // The host is asked before leaving a room that hasn't started; the QR code can fill the screen.
    const [askingLeave, setAskingLeave] = useState(false);
    const [showingQr, setShowingQr] = useState(false);
    const qrButton = useRef<HTMLButtonElement>(null);
    const leaveLink = useRef<HTMLButtonElement>(null);
    const roomQuizTitle = useQuizTitle(room?.difficulty);
    // This device's saved quizzes, offered alongside the premade ones.
    const [myQuizzes] = useState(listMyQuizzes);
    const quizCards = quizCardsFor(myQuizzes);

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
    const leaveRoom = async (to = "/multiplayer") => {
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
        navigate(to);
    };
    // The brand asks while this tab is in the room, and leaves it the same
    // way as the footer link, so a guest doesn't linger in the start gate.
    const inRoom = !!identity && !!room && room.players.some(p => p.id === identity.playerId);
    const hostWaiting = inRoom && room.hostId === identity.playerId && !room.started;
    useLeaveGuard(inRoom ? {
        message: hostWaiting
            ? "Go back to ESCParty? You're the host. If you leave, this game can't start, and everyone waiting will need a new code."
            : "Go back to ESCParty? You'll leave the waiting room.",
        onLeave: () => void leaveRoom("/"),
    } : null);
    const leave = <CalmLink ref={leaveLink} type="button" onClick={() => void leaveRoom()}>Leave the waiting room</CalmLink>;
    /** The footer's way back from a waiting room this tab isn't in. */
    const backToMultiplayer = <CalmLink type="button" onClick={() => navigate("/multiplayer")}>Back to join or host</CalmLink>;
    /** The way out of a waiting room that can't go on. */
    const wayOut = (label: string, onClick: () => void) => (
        <Ground>
            <Pane>
                <Control onClick={onClick}>{label}</Control>
            </Pane>
        </Ground>
    );

    if (!identity) {
        return (
            <CalmPage title="The green room" footer={backToMultiplayer}>
                <CalmNote role="alert">This tab isn't in a game yet. Taking you to join or host one…</CalmNote>
                {wayOut("Join or host a game", () => navigate("/multiplayer"))}
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
    // Also what an offline first snapshot looks like (a cache-only miss);
    // the room comes back by itself if the server then finds it.
    if (room === null) {
        return (
            <CalmPage title="The green room" footer={leave}>
                <CalmNote role="alert">
                    We can't find this game. It may have closed, the code may be wrong, or you may be offline. Join with another code, or host your own.
                </CalmNote>
                {wayOut("Join or host a game", () => void leaveRoom())}
            </CalmPage>
        );
    }

    const { gameCode, playerId } = identity;
    const isHost = room.hostId === playerId;
    const me = room.players.find(p => p.id === playerId);

    // Taken out by the host: this tab isn't in the room any more.
    if (!me) {
        return (
            <CalmPage title="The green room" footer={backToMultiplayer}>
                <CalmNote role="alert">The host took you out of this game. You can join again with the code.</CalmNote>
                {wayOut("Join a game", () => navigate("/multiplayer"))}
            </CalmPage>
        );
    }

    const ready = room.readyPlayers ?? [];
    const players = playingPlayers(room);
    const guests = roomGuests(room);
    const gate = startGate(room);
    const amReady = ready.includes(playerId);
    const canChange = isHost && !room.started && !!room.difficulty;
    const chosen = isHost ? guests.find(p => p.id === selected) : undefined;

    /**
     * One write at a time; a failure leaves a note and the page usable,
     * unless `onError` handles it. (A double tap must not write twice.)
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

    // The room's `difficulty` names the quiz (quizCatalog.ts), and the host
    // may change it until the game starts. A pick the rules refuse wrote
    // nothing: the rules won't take this quiz (its key or break setting) or
    // the game has started, so the host picks another. Anything else (the
    // quiz couldn't be read, the network) can be retried. Picking the quiz
    // the room already has writes nothing and just closes the picker.
    const handleSelectQuiz = (quizKey: string) => {
        if (changing && quizKey === room.difficulty) {
            setChanging(false);
            return;
        }
        return run("set the quiz", async () => {
            setPickRefused(false);
            await setRoomQuiz(gameCode, quizKey);
            setChanging(false);
        }, (err) => {
            if (err instanceof QuizPickRefused) {
                setPickRefused(true);
            } else {
                setPickError("That quiz couldn't be loaded. Check your connection, or pick another.");
            }
        });
    };

    const status = (id: string) => {
        if (id === room.hostId) return "Host";
        return ready.includes(id) ? "Ready" : "Getting ready";
    };

    // The guest's "I'm ready" and the host's start sit at the thumb (design-system.md, "Page anatomy").
    const actions = (
        <>
            {!isHost && (
                <>
                    <Ground>
                        <Pane>
                            <Control
                                chosen={amReady}
                                disabled={busy}
                                onClick={() => run("change whether you're ready", () => setPlayerReady(gameCode, playerId, !amReady))}
                            >
                                I'm ready
                            </Control>
                        </Pane>
                    </Ground>
                    <CalmNote role="status">
                        {amReady ? "Waiting for the host to start. Tap again if you need a moment." : "Tap when you're ready to play."}
                    </CalmNote>
                </>
            )}

            {isHost && room.difficulty && (
                <>
                    <CalmNote role="status">{gate.message}</CalmNote>
                    {gate.canStart !== "no" && (
                        <Ground>
                            <Pane>
                                {/* Everyone ready: the next step is the black button (design-system.md, "Page anatomy"). */}
                                <Control
                                    elevation={gate.canStart === "yes" ? "high" : "rest"}
                                    disabled={busy}
                                    onClick={() => run("start the game", () => startGame(gameCode))}
                                >
                                    {gate.canStart === "yes" ? "Start the show" : "Start anyway"}
                                </Control>
                            </Pane>
                        </Ground>
                    )}
                </>
            )}
        </>
    );

    return (
        <CalmPage
            title="The green room"
            subtitle={`You are ${me.name}`}
            footer={isHost && !room.started ? (
                askingLeave ? (
                    <ConfirmLeave
                        prompt="You're the host. If you leave, this game can't start, and everyone waiting will need a new code."
                        stayLabel="Stay here"
                        leaveLabel="Leave the room"
                        onLeave={() => void leaveRoom()}
                        onStay={() => { setAskingLeave(false); setTimeout(() => leaveLink.current?.focus()); }}
                    />
                ) : (
                    <CalmLink ref={leaveLink} type="button" onClick={() => setAskingLeave(true)}>Leave the waiting room</CalmLink>
                )
            ) : leave}
            actions={actions}
        >
            <CodeRow>
                <Badge label="Game code" value={gameCode} spell selectable />
                <Control ref={qrButton} onClick={() => setShowingQr(true)}>Show QR code</Control>
            </CodeRow>
            {showingQr && (
                <QrFullScreen
                    code={gameCode}
                    onClose={() => { setShowingQr(false); setTimeout(() => qrButton.current?.focus()); }}
                />
            )}

            {isHost && !room.started && (!room.difficulty || changing) ? (
                <>
                    <h2 className="esc-section" id="lobby-pick-quiz">Pick a quiz</h2>
                    <QuizCardGrid
                        labelledBy="lobby-pick-quiz"
                        quizzes={quizCards}
                        picked={room.difficulty ?? null}
                        onPick={handleSelectQuiz}
                        disabled={busy}
                    />
                    {room.difficulty && (
                        <Ground>
                            <Pane>
                                <Control disabled={busy} onClick={() => setChanging(false)}>
                                    Keep {roomQuizTitle}
                                </Control>
                            </Pane>
                        </Ground>
                    )}
                </>
            ) : (
                <>
                    <h2 className="esc-section">The quiz</h2>
                    <Ground>
                        <Pane layout={canChange ? "split" : undefined}>
                            {/* Polite: guests hear when the host changes the quiz. */}
                            <Row aria-live="polite">{room.difficulty ? roomQuizTitle : "The host is picking…"}</Row>
                            {canChange && (
                                <Control disabled={busy} aria-label="Change the quiz" onClick={() => setChanging(true)}>
                                    Change
                                </Control>
                            )}
                        </Pane>
                    </Ground>
                </>
            )}

            {/* Polite: someone joining or leaving is news to whoever waits. */}
            <h2 className="esc-section" aria-live="polite">{players.length === 1 ? "1 player" : `${players.length} players`}</h2>
            <Ground>
                <Pane as="ol" aria-label="Players">
                    {players.map(player => (
                        <Row key={player.id} as="li" elevation={player.id === playerId ? "high" : "rest"}>
                            <span className="calm-row">
                                <span>{player.name}{player.id === playerId ? " (you)" : ""}</span>
                                <span>{status(player.id)}</span>
                            </span>
                        </Row>
                    ))}
                </Pane>
            </Ground>

            {isHost && guests.length > 0 && (
                <>
                    <h2 className="esc-section" id="lobby-take-out">Joined by mistake? Pick who to take out</h2>
                    <Ground>
                        <Pane role="group" aria-labelledby="lobby-take-out">
                            {guests.map(guest => (
                                <Control
                                    key={guest.id}
                                    chosen={selected === guest.id}
                                    disabled={busy}
                                    onClick={() => setSelected(selected === guest.id ? null : guest.id)}
                                >
                                    {guest.name}
                                </Control>
                            ))}
                            {chosen && (
                                <Control
                                    disabled={busy}
                                    onClick={() => run(`remove ${chosen.name}`, async () => {
                                        await removePlayerFromRoom(gameCode, chosen);
                                        setSelected(current => current === chosen.id ? null : current);
                                    })}
                                >
                                    Take {chosen.name} out of the game
                                </Control>
                            )}
                        </Pane>
                    </Ground>
                </>
            )}

            {pickRefused && (!room.difficulty || changing) && <CalmNote role="alert">This room won't take that quiz. Pick another one.</CalmNote>}
            {pickError && <CalmNote role="alert">{pickError}</CalmNote>}
        </CalmPage>
    );
};

export default Lobby;
