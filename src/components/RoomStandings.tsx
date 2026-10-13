import { Ground, Pane, Row } from "../design";
import type { Party } from "../utils/partyFirestore";
import { roomStandings, type Ballot } from "../utils/partyModel";
import { actIdsOf, formatScore, ordinal, partyBonusList } from "../utils/partyResults";

/**
 * A scoreboard party's room standings, best act first (#84): the average of
 * everyone's rating for each act, and the real place or the qualifying tick
 * once the host has entered them. Shared by the party's big screen and the
 * party night's, which shows the newest scoreboard the same way (#238).
 * No guest's name shows here, only the acts. `limit` keeps the top of a long
 * table readable from the sofa.
 */
export const RoomStandings = ({ party, ballots, limit }: { party: Party; ballots: readonly Ballot[]; limit?: number }) => {
    const standings = roomStandings([...ballots], actIdsOf(party), party.template.categories, partyBonusList(party));
    const byId = new Map(party.acts.map(act => [act.id, act]));
    return (
        <Ground>
            {standings.length === 0 ? (
                <Pane>
                    <Row>No ratings yet. The table fills up as soon as someone rates an act.</Row>
                </Pane>
            ) : (
                <Pane as="ol" aria-label="The room's standings">
                    {standings.slice(0, limit).map((standing, index) => {
                        const act = byId.get(standing.actId)!;
                        const real = party.results.places?.[act.id];
                        const through = party.results.qualifiers?.includes(act.id);
                        return (
                            <Row as="li" key={act.id}>
                                <span className="calm-row">
                                    <span>{ordinal(index + 1)} {act.flag} {act.country}</span>
                                    <span>{formatScore(standing.average)}</span>
                                </span>
                                {(real || through) && <span className="calm-sub">{real ? `Really ${ordinal(real)}` : "Through"}</span>}
                            </Row>
                        );
                    })}
                </Pane>
            )}
        </Ground>
    );
};
