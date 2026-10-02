import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CalmLink, CalmNote, CalmPage } from "../components/CalmPage";
import { PartyError, PartyNotFound } from "../components/PartyStates";
import { Control, Ground, Pane, Row } from "../design";
import { usePartyData } from "../hooks/usePartyData";
import { predictionLeaderboard } from "../utils/partyModel";
import { awardWinners, awardsFor, hasResults, ordinal, predictionsFor } from "../utils/partyResults";
import { readPartyIdentity } from "../utils/partySession";

/**
 * The end of the party (#87, #89): one award at a time, each named after a
 * piece of Eurovision history, from the Jedward Twins (who rated most
 * alike) to Lordi & Salvador Sobral (most differently); then who came
 * closest to the real result. Names only if the host chose to name names;
 * otherwise "one of you", and each guest is told which ones are theirs.
 */
const PartyAwards = () => {
    const navigate = useNavigate();
    const code = useParams().code?.toUpperCase();
    const { party, ballots, error, retry } = usePartyData(code);
    const [index, setIndex] = useState(0);
    const identity = code ? readPartyIdentity(code) : null;

    const back = <CalmLink onClick={() => navigate(code ? `/party/${code}` : "/party")}>Back to the party</CalmLink>;

    if (party === null) {
        return (
            <CalmPage title="The awards" footer={back}>
                <PartyNotFound code={code} />
            </CalmPage>
        );
    }
    if (party === undefined || ballots === undefined) {
        return (
            <CalmPage title="The awards" footer={back}>
                {error ? <PartyError error={error} onRetry={retry} /> : <CalmNote role="status">Counting the votes…</CalmNote>}
            </CalmPage>
        );
    }

    const isHost = identity?.guestId === party.hostId;
    if (!party.revealed && !isHost) {
        return (
            <CalmPage title="The awards" footer={back}>
                <CalmNote role="status">The host hasn't opened the awards yet. Keep rating!</CalmNote>
            </CalmPage>
        );
    }

    const awards = awardsFor(party, ballots);
    const names = new Map(ballots.map(ballot => [ballot.guestId, ballot.name]));
    const leaderboard = hasResults(party) ? predictionLeaderboard(ballots, predictionsFor(party, ballots)) : [];
    // One page per award, then the closeness table when there's a result.
    const pages = awards.length + (leaderboard.length > 0 ? 1 : 0);
    const page = Math.min(index, Math.max(pages - 1, 0));
    const award = awards[page];

    return (
        <CalmPage
            title="The awards"
            subtitle={party.revealed ? party.title : "Only you can see these until you open them for everyone."}
            footer={back}
        >
            {pages === 0 && (
                <Ground>
                    <Pane>
                        <Row>Not enough ratings for awards yet: they need at least two guests who each rated three acts.</Row>
                    </Pane>
                </Ground>
            )}

            {award && (() => {
                const { who, mine } = awardWinners(award.guestIds, names, party.showNames, identity?.guestId);
                return (
                    <Ground>
                        <Pane>
                            {/* Your own award stands proud, and says so in words too. */}
                            <Row elevation={mine ? "high" : "rest"}>
                                <span className="calm-label">{award.for}</span>
                                <span>{award.title}</span>
                                <span>{who}{mine && party.showNames ? " (that's you!)" : ""}</span>
                                <span className="calm-sub">{award.detail}</span>
                                <span className="calm-sub">{award.story}</span>
                            </Row>
                        </Pane>
                    </Ground>
                );
            })()}

            {!award && leaderboard.length > 0 && (
                <>
                    <h2 className="esc-note">Closest to the real result</h2>
                    <Ground>
                        <Pane as="ol" aria-label="Closest to the real result">
                            {leaderboard.map((row, place) => {
                                const mine = row.guestId === identity?.guestId;
                                if (!party.showNames && !mine) return null;
                                return (
                                    <Row as="li" key={row.guestId} elevation={mine && party.showNames ? "high" : "rest"}>
                                        <span className="calm-row">
                                            <span>{ordinal(place + 1)} {party.showNames ? row.name : "You"}</span>
                                            <span>{row.prediction.points}</span>
                                        </span>
                                        {mine && party.showNames && <span className="calm-sub">That's you</span>}
                                    </Row>
                                );
                            })}
                        </Pane>
                    </Ground>
                    {!party.showNames && <CalmNote>Out of {leaderboard.length} guests. Everyone else's place is theirs to share.</CalmNote>}
                </>
            )}

            {pages > 1 && (
                <>
                    <CalmNote aria-live="polite">{page + 1} of {pages}</CalmNote>
                    <Ground>
                        <Pane layout="split">
                            <Control disabled={page === 0} onClick={() => setIndex(page - 1)}>Previous award</Control>
                            <Control disabled={page === pages - 1} onClick={() => setIndex(page + 1)}>Next award</Control>
                        </Pane>
                    </Ground>
                </>
            )}
        </CalmPage>
    );
};

export default PartyAwards;
