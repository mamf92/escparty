import { Fragment, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { CalmLink, CalmNote, CalmPage } from "../components/CalmPage";
import PartyHostTools from "../components/PartyHostTools";
import { useOwnBallot, type SaveState } from "../hooks/useOwnBallot";
import { usePartyData } from "../hooks/usePartyData";
import type { Party } from "../utils/partyFirestore";
import {
    actScore,
    ballotScores,
    predictionLeaderboard,
    roomStandings,
    type Ballot,
    type Bonuses,
    type Ratings,
} from "../utils/partyModel";
import { randomPartyName } from "../utils/partyNames";
import { actIdsOf, formatScore, hasResults, ordinal, partyBonusList, predictionFor, predictionsFor } from "../utils/partyResults";
import { readPartyIdentity, savePartyIdentity, type PartyIdentity } from "../utils/partySession";

type Tab = "rate" | "ranking" | "room" | "host";

const SAVE_NOTES: Record<SaveState, string> = {
    saved: "Your ratings are saved.",
    saving: "Saving…",
    offline: "Offline: your ratings are kept on this phone and saved when you're back.",
};

/**
 * A guest's phone at a scoreboard party (#83, #84, #86): rate each act as
 * it's performed, see your own ranking and how close it came to the real
 * result, and the room's standings. The host gets their tools here too.
 */
const PartyRoom = () => {
    const navigate = useNavigate();
    const code = useParams().code?.toUpperCase();
    const { party, ballots, error } = usePartyData(code);
    const [identity, setIdentity] = useState<PartyIdentity | null>(() => (code ? readPartyIdentity(code) : null));
    const own = useOwnBallot(code, identity, ballots);
    const [tab, setTab] = useState<Tab>("rate");

    const back = <CalmLink type="button" onClick={() => navigate("/party")}>Leave the party</CalmLink>;

    if (party === undefined) {
        return (
            <CalmPage title="Scoreboard party" footer={back}>
                <CalmNote role="status">{error ?? "Finding the party…"}</CalmNote>
            </CalmPage>
        );
    }
    if (party === null || !code) {
        return (
            <CalmPage title="Scoreboard party" footer={back}>
                <CalmNote role="alert">There's no party with the code {code}. Check the code with the host.</CalmNote>
            </CalmPage>
        );
    }
    if (!identity) {
        return <JoinParty party={party} onJoin={next => { savePartyIdentity(party.code, next); setIdentity(next); }} footer={back} />;
    }

    const isHost = identity.guestId === party.hostId;
    const updateIdentity = (change: Partial<PartyIdentity>) => {
        const next = { ...identity, ...change };
        savePartyIdentity(party.code, next);
        setIdentity(next);
    };
    const tabs: [Tab, string][] = [["rate", "Rate"], ["ranking", "My ranking"], ["room", "The room"], ...(isHost ? [["host", "Host"] as [Tab, string]] : [])];

    return (
        <CalmPage
            title={party.title}
            subtitle={`Party ${party.code} · you're ${identity.name}`}
            footer={
                <>
                    <CalmLink type="button" onClick={() => navigate(`/party/${party.code}/screen`)}>Big screen</CalmLink>
                    {back}
                </>
            }
        >
            <div className="calm-ground">
                <div className="lycra-pane calm-split" role="tablist" aria-label="Party">
                    {tabs.map(([id, label]) => (
                        <button
                            key={id}
                            type="button"
                            role="tab"
                            aria-selected={tab === id}
                            className={`lycra${tab === id ? " is-chosen" : ""}`}
                            onClick={() => setTab(id)}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>
            {error && <CalmNote role="status">{error}</CalmNote>}

            {tab === "rate" && (
                <RateAct
                    party={party}
                    ballot={own.ballot}
                    actIndex={Math.max(party.acts.findIndex(entry => entry.id === identity.actId), 0)}
                    onMove={index => updateIdentity({ actId: party.acts[index].id })}
                    onRate={own.rate}
                    onBonus={own.toggleBonus}
                />
            )}
            {tab === "ranking" && <MyRanking party={party} ballot={{ guestId: identity.guestId, name: identity.name, ...own.ballot }} />}
            {tab === "room" && <TheRoom party={party} ballots={ballots ?? []} me={identity.guestId} />}
            {tab === "host" && isHost && <PartyHostTools party={party} ballots={ballots ?? []} />}

            {tab !== "host" && (party.revealed || isHost) && (
                <div className="calm-ground">
                    <div className="lycra-pane">
                        <button type="button" className="lycra" onClick={() => navigate(`/party/${party.code}/awards`)}>
                            {party.revealed ? "See the awards" : "Preview the awards"}
                        </button>
                    </div>
                </div>
            )}
            {tab === "rate" && <CalmNote role="status">{SAVE_NOTES[own.state]}</CalmNote>}
        </CalmPage>
    );
};

const JoinParty = ({ party, onJoin, footer }: { party: Party; onJoin: (identity: PartyIdentity) => void; footer: ReactNode }) => {
    const [name, setName] = useState(randomPartyName);
    const [tried, setTried] = useState(false);
    const join = () => {
        setTried(true);
        if (!name.trim()) return;
        onJoin({ guestId: uuidv4(), name: name.trim(), isHost: false });
    };
    return (
        <CalmPage title={party.title} subtitle={`Join party ${party.code} and rate every act.`} footer={footer}>
            <div className="calm-ground">
                <div className="lycra-pane">
                    <label>
                        <span className="calm-label">Your name at the party</span>
                        <input className="lycra-field" value={name} maxLength={40} onChange={event => setName(event.target.value)} />
                    </label>
                </div>
            </div>
            {tried && !name.trim() && <CalmNote role="alert">Give yourself a name.</CalmNote>}
            <div className="calm-ground">
                <div className="lycra-pane">
                    <button type="button" className="lycra" onClick={join}>Join the party</button>
                </div>
            </div>
            <CalmNote>
                {party.showNames
                    ? "At the end, the awards name who rated most alike and most differently."
                    : "The awards at the end don't name names: you're only told which ones are yours."}
            </CalmNote>
        </CalmPage>
    );
};

const RateAct = ({ party, ballot, actIndex, onMove, onRate, onBonus }: {
    party: Party;
    ballot: { ratings: Ratings; bonuses: Bonuses };
    actIndex: number;
    onMove: (index: number) => void;
    onRate: (actId: string, categoryId: string, value: number) => void;
    onBonus: (actId: string, bonusId: string) => void;
}) => {
    const act = party.acts[actIndex];
    const bonuses = partyBonusList(party);
    const score = actScore(ballot.ratings[act.id], ballot.bonuses[act.id], party.template.categories, bonuses);
    const ticked = ballot.bonuses[act.id] ?? [];
    return (
        <>
            <div className="calm-ground">
                <div className="lycra-pane">
                    <div className="lycra is-block is-static">
                        <span className="calm-row">
                            <span>{act.flag} {act.country}</span>
                            <span className="calm-sub">{actIndex + 1} of {party.acts.length}</span>
                        </span>
                        <span className="calm-sub">{act.artist} · {act.song}</span>
                    </div>
                </div>
            </div>

            {party.template.categories.map(category => {
                const current = ballot.ratings[act.id]?.[category.id];
                return (
                    <Fragment key={category.id}>
                        <CalmNote>{category.label}{current ? `: ${current}` : ""}</CalmNote>
                        <div className="calm-ground">
                            <div className="lycra-pane calm-scale" role="radiogroup" aria-label={`${category.label} for ${act.country}`}>
                                {Array.from({ length: category.max }, (_, i) => i + 1).map(value => (
                                    <button
                                        key={value}
                                        type="button"
                                        role="radio"
                                        aria-checked={current === value}
                                        className={`lycra${current === value ? " is-chosen" : ""}`}
                                        onClick={() => onRate(act.id, category.id, value)}
                                    >
                                        {value}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </Fragment>
                );
            })}

            {bonuses.length > 0 && (
                <>
                    <CalmNote>Party bonuses</CalmNote>
                    <div className="calm-ground">
                        <div className="lycra-pane">
                            {bonuses.map(bonus => (
                                <button
                                    key={bonus.id}
                                    type="button"
                                    aria-pressed={ticked.includes(bonus.id)}
                                    className={`lycra is-block${ticked.includes(bonus.id) ? " is-chosen" : ""}`}
                                    onClick={() => onBonus(act.id, bonus.id)}
                                >
                                    <span className="calm-row">
                                        <span>{bonus.label}</span>
                                        <span className="calm-sub">+{bonus.points}</span>
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}

            <CalmNote>
                {score === null ? `You haven't rated ${act.country} yet.` : `Your score for ${act.country}: ${formatScore(score)}`}
            </CalmNote>

            <div className="calm-ground">
                <div className="lycra-pane calm-split">
                    <button type="button" className="lycra" disabled={actIndex === 0} onClick={() => onMove(actIndex - 1)}>
                        Previous act
                    </button>
                    <button type="button" className="lycra" disabled={actIndex === party.acts.length - 1} onClick={() => onMove(actIndex + 1)}>
                        Next act
                    </button>
                </div>
            </div>
            <div className="calm-ground">
                <div className="lycra-pane">
                    <label>
                        <span className="calm-label">Jump to an act</span>
                        <select className="lycra-field" value={actIndex} onChange={event => onMove(Number(event.target.value))}>
                            {party.acts.map((entry, index) => (
                                <option key={entry.id} value={index}>
                                    {index + 1}. {entry.country}{ballot.ratings[entry.id] && Object.keys(ballot.ratings[entry.id]).length > 0 ? " ✓" : ""}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
            </div>
        </>
    );
};

const MyRanking = ({ party, ballot }: { party: Party; ballot: Ballot }) => {
    const scores = ballotScores(ballot, actIdsOf(party), party.template.categories, partyBonusList(party));
    const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
    const byId = new Map(party.acts.map(act => [act.id, act]));
    const prediction = predictionFor(party, ballot);

    if (ranked.length === 0) {
        return <CalmNote>Rate an act and your ranking starts here.</CalmNote>;
    }
    return (
        <>
            {prediction && (
                <CalmNote role="status">
                    {party.kind === "semi"
                        ? `You called ${prediction.hits} of the ${party.results.qualifiers?.length} qualifiers so far: ${prediction.points} points.`
                        : `Against the real result so far: ${prediction.points} closeness points over ${prediction.compared} acts.`}
                </CalmNote>
            )}
            <div className="calm-ground">
                <ol className="lycra-pane" aria-label="Your ranking">
                    {ranked.map(([actId, score], index) => {
                        const act = byId.get(actId)!;
                        const real = party.results.places?.[actId];
                        const through = party.results.qualifiers?.includes(actId);
                        return (
                            <li key={actId} className="lycra is-block is-static">
                                <span className="calm-row">
                                    <span>{ordinal(index + 1)} {act.flag} {act.country}</span>
                                    <span>{formatScore(score)}</span>
                                </span>
                                {(real || through) && (
                                    <span className="calm-sub">{real ? `Really came ${ordinal(real)}` : "Went through"}</span>
                                )}
                            </li>
                        );
                    })}
                </ol>
            </div>
            {party.kind === "semi" && <CalmNote>Your top {party.qualifiers} are your picks to go through.</CalmNote>}
        </>
    );
};

const TheRoom = ({ party, ballots, me }: { party: Party; ballots: Ballot[]; me: string }) => {
    const standings = roomStandings(ballots, actIdsOf(party), party.template.categories, partyBonusList(party));
    const byId = new Map(party.acts.map(act => [act.id, act]));
    const leaderboard = hasResults(party) ? predictionLeaderboard(ballots, predictionsFor(party, ballots)) : [];
    const myPlace = leaderboard.findIndex(row => row.guestId === me);

    return (
        <>
            <CalmNote>{ballots.length === 1 ? "1 guest is rating." : `${ballots.length} guests are rating.`}</CalmNote>
            {standings.length === 0 ? (
                <CalmNote>No ratings yet. The room's standings show up with the first one.</CalmNote>
            ) : (
                <div className="calm-ground">
                    <ol className="lycra-pane" aria-label="The room's standings">
                        {standings.map((standing, index) => {
                            const act = byId.get(standing.actId)!;
                            return (
                                <li key={standing.actId} className="lycra is-block is-static">
                                    <span className="calm-row">
                                        <span>{ordinal(index + 1)} {act.flag} {act.country}</span>
                                        <span>{formatScore(standing.average)}</span>
                                    </span>
                                    <span className="calm-sub">{standing.votes === 1 ? "1 rating" : `${standing.votes} ratings`}</span>
                                </li>
                            );
                        })}
                    </ol>
                </div>
            )}
            {leaderboard.length > 0 && (
                party.showNames ? (
                    <>
                        <CalmNote>Closest to the real result</CalmNote>
                        <div className="calm-ground">
                            <ol className="lycra-pane" aria-label="Closest to the real result">
                                {leaderboard.map((row, index) => (
                                    <li key={row.guestId} className={`lycra is-block is-static${row.guestId === me ? " is-chosen" : ""}`}>
                                        <span className="calm-row">
                                            <span>{ordinal(index + 1)} {row.name}</span>
                                            <span>{row.prediction.points}</span>
                                        </span>
                                    </li>
                                ))}
                            </ol>
                        </div>
                    </>
                ) : (
                    <CalmNote role="status">
                        {myPlace >= 0
                            ? `You're ${ordinal(myPlace + 1)} of ${leaderboard.length} closest to the real result.`
                            : "Rate some acts to be in the running for closest to the real result."}
                    </CalmNote>
                )
            )}
        </>
    );
};

export default PartyRoom;
