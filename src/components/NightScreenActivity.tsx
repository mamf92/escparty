import { CalmNote } from "./CalmPage";
import { RoomStandings } from "./RoomStandings";
import { Standings } from "./Standings";
import { Ground, Pane, Row } from "../design";
import { usePartyData } from "../hooks/usePartyData";
import { useRoom } from "../hooks/useRoom";
import { quizStage } from "../utils/nightActivities";
import type { NightActivity } from "../utils/nightsFirestore";
import { playingPlayers } from "../utils/roomRoles";

/**
 * "Now on" for the party night's TV (#238): the newest activity, in full. A
 * quiz still in its lobby shows who is waiting, a quiz being played or done
 * its standings; a scoreboard shows the room's standings the way the party's
 * own big screen does. Only the newest, since a wall shows one thing: the
 * phones have a card for each (NightActivities). The quiz's players are
 * named on the wall, as they are in its own lobby; the night's guests are not.
 */
export const NightScreenActivity = ({ activities }: { activities: readonly NightActivity[] }) => {
    const newest = activities[activities.length - 1];
    return (
        <>
            <h2 className="esc-section">Now on</h2>
            {!newest ? (
                <Ground>
                    <Pane>
                        <Row>Nothing on yet. The host will start a quiz or a scoreboard soon.</Row>
                    </Pane>
                </Ground>
            ) : (
                <>
                    <Ground>
                        <Pane>
                            <Row>
                                {/* A quiz is listed as "Quiz", "Quiz 2"…: no need to say "Quiz" twice. */}
                                {!(newest.kind === "quiz" && newest.title.startsWith("Quiz")) && <span className="calm-sub">{newest.kind === "quiz" ? "Quiz" : "Scoreboard"}</span>}
                                <span>{newest.title}</span>
                            </Row>
                        </Pane>
                    </Ground>
                    {newest.kind === "quiz" ? <QuizOnScreen code={newest.code} /> : <ScoreboardOnScreen code={newest.code} />}
                </>
            )}
        </>
    );
};

const QuizOnScreen = ({ code }: { code: string }) => {
    const room = useRoom(code);
    if (room === undefined) return <CalmNote role="status">Finding the quiz…</CalmNote>;
    if (room === null) return <CalmNote role="status">This quiz isn&apos;t available any more.</CalmNote>;
    const players = playingPlayers(room);
    if (quizStage(room) === "lobby") {
        return (
            <>
                <h3 className="esc-section">Waiting for players</h3>
                <Ground>
                    <Pane as="ul" aria-label="Waiting for players">
                        {players.length === 0
                            ? <Row as="li">Nobody has joined yet.</Row>
                            : players.map(player => <Row as="li" key={player.id}>{player.name}</Row>)}
                    </Pane>
                </Ground>
            </>
        );
    }
    return (
        <>
            <h3 className="esc-section">{room.phase === "results" ? "Final standings" : "Standings"}</h3>
            <Standings players={players} label="Quiz standings" empty="No scores yet." live />
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
