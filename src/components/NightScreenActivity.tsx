import { CalmNote } from "./CalmPage";
import { RoomStandings } from "./RoomStandings";
import { NightActivityHeading, NothingOnYet } from "./NightActivities";
import { Standings } from "./Standings";
import { Ground, Pane, Row } from "../design";
import { usePartyData } from "../hooks/usePartyData";
import { useRoom } from "../hooks/useRoom";
import { placePlayers, revealDone, revealSteps } from "../utils/finale";
import { quizStage } from "../utils/nightActivities";
import type { NightActivity } from "../utils/nightsFirestore";
import { playingPlayers } from "../utils/roomRoles";
import type { Player } from "../utils/roomsFirestore";

/**
 * "Now on" for the party night's TV (#238): the newest activity, in full. A
 * quiz still in its lobby shows who is waiting, a quiz being played only
 * who is playing (no scores while questions are open), and a quiz done the
 * results as far as the host's reveal on the phones has got; a scoreboard
 * shows the room's standings the way the party's own big screen does. Only
 * the newest, since a wall shows one thing: the
 * phones have a card for each (NightActivities). The quiz's players are
 * named on the wall, as they are in its own lobby; the night's guests are not.
 */
export const NightScreenActivity = ({ activities }: { activities: readonly NightActivity[] }) => {
    const newest = activities[activities.length - 1];
    return (
        <>
            <h2 className="esc-section">Now on</h2>
            {!newest ? (
                <NothingOnYet />
            ) : (
                <>
                    <Ground>
                        <Pane>
                            <NightActivityHeading activity={newest} />
                        </Pane>
                    </Ground>
                    {newest.kind === "quiz" ? <QuizOnScreen code={newest.code} /> : <ScoreboardOnScreen code={newest.code} />}
                </>
            )}
        </>
    );
};

/** The names on a list: who is waiting, or who is playing. */
const Names = ({ title, players }: { title: string; players: readonly Player[] }) => (
    <>
        <h3 className="esc-section">{title}</h3>
        <Ground>
            <Pane as="ul" aria-label={title}>
                {players.length === 0
                    ? <Row as="li">Nobody has joined yet.</Row>
                    : players.map(player => <Row as="li" key={player.id}>{player.name}</Row>)}
            </Pane>
        </Ground>
    </>
);

const QuizOnScreen = ({ code }: { code: string }) => {
    const room = useRoom(code);
    if (room === undefined) return <CalmNote role="status">Finding the quiz…</CalmNote>;
    if (room === null) return <CalmNote role="status">This quiz isn&apos;t available any more.</CalmNote>;
    const players = playingPlayers(room);
    const stage = quizStage(room);
    if (stage === "lobby") return <Names title="Waiting for players" players={players} />;
    // Scores stay off the wall while questions are open: they would show who
    // answered right before the question closes.
    if (stage === "running") return <Names title="Playing now" players={players} />;
    // The wall shows what the host's reveal has revealed on the phones, and
    // everything once it is over (or when there is nothing to reveal).
    const placed = placePlayers(players);
    const step = room.revealStep ?? 0;
    const done = placed.length === 0 || revealDone(revealSteps(placed), step);
    return (
        <>
            <h3 className="esc-section">Final standings</h3>
            <Standings
                players={players}
                label="Quiz standings"
                empty={done ? "No scores yet." : "The host will reveal the results soon."}
                live
                revealStep={done ? undefined : step}
            />
        </>
    );
};

const ScoreboardOnScreen = ({ code }: { code: string }) => {
    const { party, ballots, error } = usePartyData(code);
    if (party === undefined) return <CalmNote role="status">{error ?? "Finding the party…"}</CalmNote>;
    if (party === null) return <CalmNote role="status">This party isn&apos;t available any more.</CalmNote>;
    return (
        <>
            <h3 className="esc-section">The room&apos;s standings</h3>
            {/* Until the ratings arrive, say so: an empty table would claim nobody has rated. */}
            {ballots === undefined
                ? <CalmNote role="status">{error ?? "Counting the ratings…"}</CalmNote>
                : <RoomStandings party={party} ballots={ballots} limit={10} />}
        </>
    );
};
