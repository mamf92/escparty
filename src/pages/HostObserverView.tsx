import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Player, Room, listenToRoom } from "../utils/roomsFirestore";
import { CalmNote, CalmPage } from "../components/CalmPage";
import { Standings } from "../components/Standings";
import { Control, Ground, Pane } from "../design";
import { LEGACY_ROOM_MESSAGE, ObserverRouteState, isObserverHost, playingPlayers } from "../utils/roomRoles";
import { useResumeRoom } from "../hooks/useResumeRoom";
import { readMultiplayerGame } from "../utils/multiplayerSession";
import { startedAtMillis } from "../utils/quizTiming";

/** How long the break waits for every player before Continue can go on without some. */
export const MISSING_PLAYER_GRACE_MS = 20_000;

const TITLE = "The host's view";

const HostObserverView = () => {
    const location = useLocation();
    const navigate = useNavigate();

    // Where this screen is and who's viewing: from the redirect that brought
    // us here (observerRouteState), with anything missing filled from this
    // tab's sessionStorage game. Router state survives a refresh, but one
    // from an older version of the app may lack playerId, and without it
    // the Continue below could never be enabled.
    // The session's playerId only counts for the same room: this tab may have
    // played a later game since an old history entry was made.
    const routeState = (location.state ?? {}) as Partial<ObserverRouteState>;
    const [session] = useState(readMultiplayerGame);
    const roomCode = routeState.roomCode ?? session?.roomCode ?? null;
    const playerId = routeState.playerId
        ?? (session && session.roomCode === roomCode ? session.playerId : null);

    // Everything below is derived from the latest snapshot.
    const [room, setRoom] = useState<Room | null>(null);
    // No room to watch (opened in a new tab, or this tab's stored game is
    // gone or unreadable): say so, with the way back, rather than showing
    // an empty table.
    const [error, setError] = useState<string | null>(
        roomCode ? null : "This tab lost track of the game. Find it again from multiplayer."
    );
    const players = room ? playingPlayers(room) : (routeState.players ?? []);
    const playersAtMidQuiz = room?.playersAtMidQuiz ?? [];
    const allPlayersReady = players.length > 0 && players.every(player => playersAtMidQuiz.includes(player.id));
    const inBreak = room?.phase === "mid-scoreboard";
    const missing = players.filter(player => !playersAtMidQuiz.includes(player.id)).map(player => player.name);
    // Continue resumes the room for everyone, so only the room's observer
    // host gets it, checked against the room rather than whoever opened
    // this page.
    const isRoomObserver = isObserverHost(room, playerId);

    // Start the next question for the whole room; the observer host doesn't
    // navigate to the quiz itself. Players follow the room's phase back to
    // the quiz (#63), and the same write clears the ready marks for the next
    // break. This screen stays up for the whole quiz, so any Continue state
    // or message is dropped as soon as the room moves on, keyed on the phase
    // and the index together: a locked phone can get one snapshot that goes
    // straight from one break to the next.
    const { resume, resuming, resumeError, reset } = useResumeRoom(roomCode);

    // A player whose phone died never reaches the break (#65, #23), so after
    // a grace period Continue goes on without whoever is missing. Not at
    // once: the phones need a moment to write their marks.
    // The break the grace period ran out for; a new break starts it again.
    // Keyed on when the break began too, so a new game in the same room
    // doesn't find its break at the same index already waited out.
    const [waitedFor, setWaitedFor] = useState<string | null>(null);
    const breakKey = inBreak ? `${room?.currentQuestionIndex}@${startedAtMillis(room?.phaseStartedAt)}` : null;
    const waitedLongEnough = breakKey !== null && waitedFor === breakKey;
    useEffect(() => {
        if (breakKey === null) return;
        const timer = setTimeout(() => setWaitedFor(breakKey), MISSING_PLAYER_GRACE_MS);
        return () => clearTimeout(timer);
    }, [breakKey]);
    useEffect(() => {
        reset();
    }, [room?.phase, room?.currentQuestionIndex, reset]);

    useEffect(() => {
        if (!roomCode) return;
        const unsubscribe = listenToRoom(roomCode, (snapshot) => {
            if (snapshot && !snapshot.phase) {
                setError(LEGACY_ROOM_MESSAGE); // no phase: no break to continue from
            } else if (snapshot) {
                setRoom(snapshot);
            } else {
                setError("This game has closed. Taking you back to multiplayer…");
                setTimeout(() => navigate("/multiplayer"), 2000);
            }
        });
        return () => unsubscribe();
    }, [roomCode, navigate]);

    // The quiz is over for everyone at once (the room's phase, #62): take
    // the host to the final standings and the next round (#21). Replacing
    // this screen, so Back from the results doesn't bounce here and on
    // again. Without a known player ID the results couldn't tell this is
    // the host, so it stays here and says the quiz is over.
    useEffect(() => {
        if (room?.phase === "results" && roomCode && playerId) {
            navigate("/results", { replace: true, state: { multiplayer: true, roomCode, playerId, observer: true } });
        }
    }, [room?.phase, roomCode, playerId, navigate]);

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

    const waiting = players.length > 0 && !allPlayersReady;
    const readyCount = players.length - missing.length;
    // Where the room is and why Continue is (or isn't) available, as text
    // beside the control rather than a tooltip, in the same order as the
    // disabled check below.
    const status = !room
        ? "Connecting to the room…"
        : !isRoomObserver
        ? "Only the room's host can continue."
        : room.phase === "results"
        ? "The quiz is over."
        : !inBreak
        ? "The players are answering. Continue opens at the next scoreboard break."
        : waiting
        ? `${readyCount} of ${players.length} ready. Still waiting for ${missing.join(", ")}.${waitedLongEnough ? " You can go on without them." : ""}`
        : "Everyone's at the break. Continue when you're ready.";
    const ready = (player: Player) => (playersAtMidQuiz.includes(player.id) ? "Ready" : "On the way");

    return (
        <CalmPage title={TITLE} subtitle={roomCode ? <>Game code <strong>{roomCode}</strong></> : undefined}>
            {(room || players.length > 0) && (
                <Standings
                    players={players}
                    label="Standings"
                    detail={inBreak ? ready : undefined}
                    empty="Nobody's playing in this room yet."
                />
            )}

            <Ground>
                <Pane>
                    <Control
                        onClick={resume}
                        disabled={resuming || !isRoomObserver || !inBreak || (waiting && !waitedLongEnough)}
                        aria-describedby="host-observer-status"
                    >
                        {resuming ? "Continuing…" : inBreak && waiting ? "Continue without them" : "Continue the quiz"}
                    </Control>
                </Pane>
            </Ground>
            <CalmNote id="host-observer-status" role="status">{status}</CalmNote>
            {resumeError && <CalmNote role="alert">{resumeError}</CalmNote>}
        </CalmPage>
    );
};

export default HostObserverView;
