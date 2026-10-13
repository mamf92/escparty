import { useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { CalmNote } from "./CalmPage";
import { Control, Ground, Pane, Row } from "../design";
import { usePartyData } from "../hooks/usePartyData";
import { useRoom } from "../hooks/useRoom";
import { quizStage } from "../utils/nightActivities";
import type { NightActivity, NightActivityKind } from "../utils/nightsFirestore";
import type { NightIdentity } from "../utils/nightSession";
import { readPartyIdentity, savePartyIdentity } from "../utils/partySession";
import { joinRoom } from "../utils/roomsFirestore";

const KIND_LABELS: Record<NightActivityKind, string> = { quiz: "Quiz", scoreboard: "Scoreboard" };

/** The cards as a list with no bullets, a card to a row of the page. */
const Cards = styled.ul`
    display: grid;
    gap: var(--esc-space-4);
    margin: 0;
    padding: 0;
    list-style: none;
`;

/**
 * The "Now on" section of a party night (#233, #235): what has been added to
 * the evening so far, newest first, as a card for each. A card is a dark tile
 * saying what the activity is and where it stands, and a white button that
 * takes this guest into it with the night's own guest id and name, so nobody
 * types a code or picks a name again. Each card follows its room or party
 * live (fine for the 20 a night holds at most). The TV shows the newest one
 * in full instead (NightScreenActivity).
 */
export const NightActivities = ({ activities, me }: { activities: readonly NightActivity[]; me: NightIdentity }) => (
    <>
        <h2 className="esc-section">Now on</h2>
        {activities.length === 0 ? (
            <Ground>
                <Pane>
                    <Row>Nothing on yet. The host will start a quiz or a scoreboard soon.</Row>
                </Pane>
            </Ground>
        ) : (
            <Cards aria-label="Now on">
                {activities.map((activity, index) => ({ activity, index })).reverse().map(({ activity, index }) => (
                    // The rules let one room or party be listed twice
                    // (under another title), so the code alone isn't a key.
                    <li key={`${index}-${activity.kind}-${activity.code}`}>
                        <Ground>
                            <Pane>
                                {activity.kind === "quiz"
                                    ? <QuizCard activity={activity} me={me} />
                                    : <ScoreboardCard activity={activity} me={me} />}
                            </Pane>
                        </Ground>
                    </li>
                ))}
            </Cards>
        )}
    </>
);

/** The tile every card starts with: its kind and title, and where it stands. */
const Heading = ({ activity, status }: { activity: NightActivity; status: string }) => (
    <Row>
        <span className="calm-sub">{KIND_LABELS[activity.kind]}</span>
        <span>{activity.title}</span>
        <span className="calm-sub">{status}</span>
    </Row>
);

const GONE = "Not available any more";

/** A quiz room: join it in its lobby, go back into it once it runs, see how it ended. */
const QuizCard = ({ activity, me }: { activity: NightActivity; me: NightIdentity }) => {
    const navigate = useNavigate();
    const room = useRoom(activity.code);
    const [joining, setJoining] = useState(false);
    const [note, setNote] = useState<string | null>(null);

    if (room === undefined) return <Heading activity={activity} status="Looking for the room…" />;
    if (room === null) return <Heading activity={activity} status={GONE} />;

    const stage = quizStage(room);
    const player = room.players.some(entry => entry.id === me.guestId);
    /** This device is this guest in the room: what Lobby reads (#65), also for a rejoin. */
    const takeSeat = () => {
        localStorage.setItem("playerId", me.guestId);
        localStorage.setItem("playerName", me.name);
        localStorage.setItem("gameCode", activity.code);
        localStorage.setItem("isHost", String(room.hostId === me.guestId));
    };
    const join = async () => {
        if (joining) return;
        setJoining(true);
        setNote(null);
        try {
            // Names are unique in the night, so there is no free name to find.
            if (await joinRoom(activity.code, me.guestId, me.name)) {
                takeSeat();
                navigate("/lobby");
                return;
            }
            setNote("This quiz has already started.");
        } catch (error) {
            console.error("Couldn't join the quiz:", error);
            setNote("Couldn't join the quiz. Check your connection and try again.");
        }
        setJoining(false);
    };
    // Lobby sends a started room's player on to the quiz, or the observer host to their screen.
    const back = () => {
        takeSeat();
        navigate("/lobby");
    };
    const results = () => {
        takeSeat();
        sessionStorage.setItem("multiplayerGame", JSON.stringify({
            multiplayer: true, roomCode: activity.code, playerId: me.guestId, difficulty: room.difficulty,
        }));
        navigate("/results", { state: { multiplayer: true, roomCode: activity.code, playerId: me.guestId } });
    };

    return (
        <>
            <Heading activity={activity} status={STAGE_STATUS[stage]} />
            {stage === "lobby" && (
                <Control disabled={joining} onClick={player ? back : () => void join()}>
                    {player ? "Back to the waiting room" : joining ? "Joining…" : "Join the quiz"}
                </Control>
            )}
            {stage === "running" && player && <Control onClick={back}>Back to the quiz</Control>}
            {stage === "results" && player && <Control onClick={results}>See the results</Control>}
            {note && <CalmNote role="alert">{note}</CalmNote>}
        </>
    );
};

const STAGE_STATUS: Record<ReturnType<typeof quizStage>, string> = {
    lobby: "Waiting for players",
    running: "In progress",
    results: "Finished",
};

/** A scoreboard party: rate along as the night's guest, with the party remembering who this is. */
const ScoreboardCard = ({ activity, me }: { activity: NightActivity; me: NightIdentity }) => {
    const navigate = useNavigate();
    const { party } = usePartyData(activity.code);

    if (party === undefined) return <Heading activity={activity} status="Looking for the party…" />;
    if (party === null) return <Heading activity={activity} status={GONE} />;

    const rate = () => {
        // The party's room page reads who this is from here and joins with
        // that name; a guest back on a card keeps their place in the lineup.
        const stored = readPartyIdentity(party.code);
        if (stored?.guestId !== me.guestId) {
            savePartyIdentity(party.code, { guestId: me.guestId, name: me.name, isHost: me.guestId === party.hostId });
        }
        navigate(`/party/${party.code}`);
    };
    return (
        <>
            <Heading activity={activity} status={`${party.acts.length} acts to rate`} />
            <Control onClick={rate}>Rate</Control>
        </>
    );
};

