import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { CalmLink, CalmNote, CalmPage } from "../components/CalmPage";
import { NamePicker } from "../components/NamePicker";
import PartyHostTools from "../components/PartyHostTools";
import { PartyError, PartyNotFound } from "../components/PartyStates";
import { Control, Ground, Pane, Row, Sheet, SheetRow, Stepper, useRovingTabs } from "../design";
import { useOwnBallot, type SaveState } from "../hooks/useOwnBallot";
import { useLeaveGuard } from "../hooks/useLeaveGuard";
import { usePartyData } from "../hooks/usePartyData";
import { joinParty, type Party } from "../utils/partyFirestore";
import {
    actScore,
    ballotScores,
    predictionLeaderboard,
    roomStandings,
    type Ballot,
    type Bonuses,
    type Ratings,
} from "../utils/partyModel";
import { prefersReducedMotion } from "../utils/motion";
import { availablePartyNames, withDistinctNames } from "../utils/partyNames";
import { actIdsOf, formatScore, hasResults, ordinal, partyBonusList, predictionFor, predictionsFor } from "../utils/partyResults";
import { readPartyIdentity, savePartyIdentity, type PartyIdentity } from "../utils/partySession";
import "./party-calm.css";

type Tab = "rate" | "ranking" | "room" | "host";

const GUEST_TABS: readonly Tab[] = ["rate", "ranking", "room"];
const HOST_TABS: readonly Tab[] = [...GUEST_TABS, "host"];
const TAB_LABELS: Record<Tab, string> = { rate: "Rate", ranking: "Ranking", room: "Room", host: "Host" };

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
    const { party, ballots, error, retry } = usePartyData(code);
    const [identity, setIdentity] = useState<PartyIdentity | null>(() => (code ? readPartyIdentity(code) : null));
    const own = useOwnBallot(code, identity, ballots);
    const [tab, setTab] = useState<Tab>("rate");
    // Before the early returns, as hooks must be; the host's tab only once
    // the party and who you are are known.
    const isHost = !!party && !!identity && identity.guestId === party.hostId;
    const tabKeys = isHost ? HOST_TABS : GUEST_TABS;
    const tabs = useRovingTabs(tabKeys, tab, setTab);
    // Names with a number where two guests share one, worked out once for every list.
    const distinct = useMemo(() => (ballots ? withDistinctNames(ballots) : undefined), [ballots]);
    // "See your ranking" moves to the Ranking tab, and focus goes with it.
    const focusRanking = useRef(false);
    const rankingTabId = tabs.tab("ranking").id;
    useEffect(() => {
        if (tab !== "ranking" || !focusRanking.current) return;
        focusRanking.current = false;
        document.getElementById(rankingTabId)?.focus();
    }, [tab, rankingTabId]);

    // The brand asks only once this tab is in a party that exists.
    useLeaveGuard(party && identity ? {
        message: "Go back to ESCParty? You'll leave the party's rating room. Your ratings are saved.",
        onLeave: () => navigate("/"),
    } : null);

    const back = <CalmLink onClick={() => navigate("/party")}>Leave the party</CalmLink>;

    if (party === undefined) {
        return (
            <CalmPage title="Scoreboard party" footer={back}>
                {error ? <PartyError error={error} onRetry={retry} /> : <CalmNote role="status">Finding the party…</CalmNote>}
            </CalmPage>
        );
    }
    if (party === null || !code) {
        return (
            <CalmPage title="Scoreboard party" footer={back}>
                <PartyNotFound code={code} />
            </CalmPage>
        );
    }
    if (!identity) {
        return (
            <JoinParty
                party={party}
                ballots={ballots}
                error={error}
                onRetry={retry}
                onJoin={next => {
                    // JoinParty has claimed the name and written the empty ballot.
                    savePartyIdentity(party.code, next);
                    setIdentity(next);
                }}
                footer={back}
            />
        );
    }

    const updateIdentity = (change: Partial<PartyIdentity>) => {
        const next = { ...identity, ...change };
        savePartyIdentity(party.code, next);
        setIdentity(next);
    };

    return (
        <CalmPage
            className="calm-compact calm-noball"
            title={party.title}
            subtitle={`Party ${party.code} · you're ${distinct?.find(ballot => ballot.guestId === identity.guestId)?.name ?? identity.name}`}
            footer={
                <>
                    <CalmLink onClick={() => navigate(`/party/${party.code}/screen`)}>Open the big screen</CalmLink>
                    {back}
                </>
            }
        >
            <Ground>
                <Pane layout="split" role="tablist" aria-label="Party">
                    {tabKeys.map(key => (
                        <Control key={key} {...tabs.tab(key)}>{TAB_LABELS[key]}</Control>
                    ))}
                </Pane>
            </Ground>
            {error && <PartyError error={error} onRetry={retry} />}

            <div className="party-stack" {...tabs.panel}>
                {tab === "rate" && (
                    <RateAct
                        party={party}
                        ballot={own.ballot}
                        actIndex={Math.max(party.acts.findIndex(entry => entry.id === identity.actId), 0)}
                        onMove={index => updateIdentity({ actId: party.acts[index].id })}
                        onRate={own.rate}
                        onBonus={own.toggleBonus}
                        onDone={() => {
                            focusRanking.current = true;
                            setTab("ranking");
                        }}
                    />
                )}
                {tab === "ranking" && <MyRanking party={party} ballot={{ guestId: identity.guestId, name: identity.name, ...own.ballot }} />}
                {tab === "room" && (distinct === undefined
                    ? !error && <CalmNote role="status">Counting the ratings…</CalmNote>
                    : <TheRoom party={party} ballots={distinct} me={identity.guestId} />)}
                {tab === "host" && isHost && <PartyHostTools party={party} ballots={ballots ?? []} />}

                {tab !== "host" && (party.revealed || isHost) && (
                    <Ground>
                        <Pane>
                            <Control onClick={() => navigate(`/party/${party.code}/awards`)}>
                                {party.revealed ? "See the awards" : "Preview the awards"}
                            </Control>
                        </Pane>
                    </Ground>
                )}
                {tab === "rate" && <CalmNote role="status">{SAVE_NOTES[own.state]}</CalmNote>}
            </div>
        </CalmPage>
    );
};

const JoinParty = ({ party, ballots, error, onRetry, onJoin, footer }: {
    party: Party;
    /** Everyone already in the party, whose names are taken; undefined until they arrive. */
    ballots: Ballot[] | undefined;
    /** A listener errored: nobody joins until the taken names can be read. */
    error: string | null;
    onRetry: () => void;
    onJoin: (identity: PartyIdentity) => void;
    footer: ReactNode;
}) => {
    const [name, setName] = useState<string | null>(null);
    const [spinning, setSpinning] = useState(false);
    const [joining, setJoining] = useState(false);
    // One id for every try, so a retry finds a claim an earlier try made.
    const [guestId] = useState(() => uuidv4());
    // Names other guests claimed first when this guest pressed Join, kept off
    // the reel even before their ballots arrive; the last one is said aloud.
    const [refused, setRefused] = useState<string[]>([]);
    const [refusedNow, setRefusedNow] = useState<string | null>(null);
    const [failed, setFailed] = useState(false);
    const checking = ballots === undefined && !error;
    // The names nobody has yet.
    const names = useMemo(
        () => availablePartyNames([...(ballots ?? []).map(ballot => ballot.name), ...refused], withDistinctNames(ballots ?? []).map(ballot => ballot.name)),
        [ballots, refused],
    );
    // Any listener error stops joining, even with ballots on screen: they may be stale.
    const blocked = !!error;
    // A landed name that a ballots update takes before this guest joins is let go.
    const landed = name !== null && names.includes(name) ? name : null;
    const justTaken = name !== null && landed === null ? name : refusedNow;
    const land = (next: string | null) => {
        setName(next);
        setRefusedNow(null);
        setFailed(false);
    };
    const join = async () => {
        if (landed === null) return;
        setJoining(true);
        setFailed(false);
        try {
            if (await joinParty(party.code, guestId, landed)) {
                onJoin({ guestId, name: landed, isHost: false });
                return;
            }
            setName(null);
            setRefused(current => [...current, landed]);
            setRefusedNow(landed);
        } catch (joinError) {
            console.error("Couldn't join the party:", joinError);
            setFailed(true);
        }
        setJoining(false);
    };
    return (
        <CalmPage title={party.title} subtitle={`Join party ${party.code} and rate every act.`} footer={footer}>
            {blocked && error !== null ? <PartyError error={error} onRetry={onRetry} /> : (
                <>
                    <CalmNote>Spin the reel for a Eurovision legend to be tonight. You can&apos;t type your own.</CalmNote>
                    <NamePicker value={landed} onChange={land} onSpinningChange={setSpinning} names={names} disabled={checking || joining} />
                </>
            )}
            {checking && <CalmNote role="status">Checking which names are taken…</CalmNote>}
            {justTaken !== null && <CalmNote role="status">{justTaken} was just taken. Spin again.</CalmNote>}
            {failed && <CalmNote role="alert">You couldn&apos;t join just now. Check your connection and press Join again.</CalmNote>}
            <Ground>
                <Pane>
                    <Control
                        elevation="high"
                        disabled={landed === null || spinning || checking || blocked || joining}
                        onClick={() => void join()}
                    >
                        {joining ? "Joining…" : "Join the party"}
                    </Control>
                </Pane>
            </Ground>
            <CalmNote role="status">
                {party.showNames
                    ? "At the end, the awards name who rated most alike and most differently."
                    : "The awards at the end don't name names: you're only told which ones are yours."}
            </CalmNote>
        </CalmPage>
    );
};

const RateAct = ({ party, ballot, actIndex, onMove, onRate, onBonus, onDone }: {
    party: Party;
    ballot: { ratings: Ratings; bonuses: Bonuses };
    actIndex: number;
    onMove: (index: number) => void;
    onRate: (actId: string, categoryId: string, value: number) => void;
    onBonus: (actId: string, bonusId: string) => void;
    /** Called from "See your ranking" on the last act. */
    onDone: () => void;
}) => {
    const jumpId = useId();
    const header = useRef<HTMLSpanElement>(null);
    // After Previous/Next the pressed button may be gone (first and last act): focus the act header instead of losing it to the page.
    const moved = useRef(false);
    useEffect(() => {
        if (!moved.current) return;
        moved.current = false;
        header.current?.focus({ preventScroll: true });
    }, [actIndex]);
    const move = (index: number) => {
        moved.current = true;
        onMove(index);
    };
    const bonusHeading = useRef<HTMLHeadingElement>(null);
    const lastAct = actIndex === party.acts.length - 1;
    const toBonuses = () => {
        const heading = bonusHeading.current;
        if (!heading) return;
        heading.scrollIntoView?.({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
        heading.focus({ preventScroll: true });
    };
    const act = party.acts[actIndex];
    const bonuses = partyBonusList(party);
    const score = actScore(ballot.ratings[act.id], ballot.bonuses[act.id], party.template.categories, bonuses);
    const ticked = ballot.bonuses[act.id] ?? [];
    return (
        <>
            <Ground>
                <Pane>
                    <Row>
                        <span className="calm-row">
                            <span ref={header} tabIndex={-1}>{act.flag} {act.country}</span>
                            <span className="calm-sub">{actIndex + 1} of {party.acts.length}</span>
                        </span>
                        <span className="calm-sub">{act.artist} · {act.song}</span>
                    </Row>
                </Pane>
            </Ground>

            <Ground>
                <Sheet aria-label={`Your ratings for ${act.country}`}>
                    <tbody>
                        {party.template.categories.map(category => (
                            <SheetRow key={category.id} label={category.label}>
                                <Stepper
                                    label={`${category.label} for ${act.country}`}
                                    value={ballot.ratings[act.id]?.[category.id]}
                                    max={category.max}
                                    onChange={value => onRate(act.id, category.id, value)}
                                />
                            </SheetRow>
                        ))}
                    </tbody>
                </Sheet>
            </Ground>

            <Ground>
                <Pane className="party-actnav">
                    {actIndex > 0
                        ? <Control onClick={() => move(actIndex - 1)}>Previous act</Control>
                        : <span className="party-actnav-gap" aria-hidden="true" />}
                    {bonuses.length > 0
                        ? <Control onClick={toBonuses}>Bonus points <span aria-hidden="true">↓</span></Control>
                        : <span className="party-actnav-gap" aria-hidden="true" />}
                    {lastAct
                        ? <Control elevation="high" onClick={onDone}>See your ranking</Control>
                        : <Control elevation="high" onClick={() => move(actIndex + 1)}>Next act</Control>}
                </Pane>
            </Ground>

            <CalmNote role="status">
                {score === null ? `You haven't rated ${act.country} yet.` : `Your score for ${act.country}: ${formatScore(score)}`}
            </CalmNote>

            {bonuses.length > 0 && (
                <>
                    <h2 className="esc-section" ref={bonusHeading} tabIndex={-1}>Party bonuses</h2>
                    <Ground>
                        <Pane>
                            {bonuses.map(bonus => (
                                <Control key={bonus.id} block chosen={ticked.includes(bonus.id)} onClick={() => onBonus(act.id, bonus.id)}>
                                    <span className="calm-row">
                                        <span>{bonus.label}</span>
                                        <span className="calm-sub">+{bonus.points}</span>
                                    </span>
                                </Control>
                            ))}
                        </Pane>
                    </Ground>
                </>
            )}

            <Ground>
                <Pane>
                    <div>
                        <label className="calm-label" htmlFor={jumpId}>Jump to an act</label>
                        <select id={jumpId} className="lycra-field" value={actIndex} onChange={event => onMove(Number(event.target.value))}>
                            {party.acts.map((entry, index) => (
                                <option key={entry.id} value={index}>
                                    {index + 1}. {entry.country}{ballot.ratings[entry.id] && Object.keys(ballot.ratings[entry.id]).length > 0 ? " ✓" : ""}
                                </option>
                            ))}
                        </select>
                    </div>
                </Pane>
            </Ground>
        </>
    );
};

const MyRanking = ({ party, ballot }: { party: Party; ballot: Ballot }) => {
    const scores = ballotScores(ballot, actIdsOf(party), party.template.categories, partyBonusList(party));
    const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
    const byId = new Map(party.acts.map(act => [act.id, act]));
    const prediction = predictionFor(party, ballot);

    if (ranked.length === 0) {
        return (
            <Ground>
                <Pane>
                    <Row>Rate an act and your ranking starts here.</Row>
                </Pane>
            </Ground>
        );
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
            <Ground>
                <Pane as="ol" aria-label="Your ranking">
                    {ranked.map(([actId, score], index) => {
                        const act = byId.get(actId)!;
                        const real = party.results.places?.[actId];
                        const through = party.results.qualifiers?.includes(actId);
                        return (
                            <Row as="li" key={actId}>
                                <span className="calm-row">
                                    <span>{ordinal(index + 1)} {act.flag} {act.country}</span>
                                    <span>{formatScore(score)}</span>
                                </span>
                                {(real || through) && (
                                    <span className="calm-sub">{real ? `Really came ${ordinal(real)}` : "Went through"}</span>
                                )}
                            </Row>
                        );
                    })}
                </Pane>
            </Ground>
            {party.kind === "semi" && <CalmNote>Your top {party.qualifiers} are your picks to go through.</CalmNote>}
        </>
    );
};

/** `ballots` already have `withDistinctNames` applied. */
const TheRoom = ({ party, ballots, me }: { party: Party; ballots: Ballot[]; me: string }) => {
    const standings = roomStandings(ballots, actIdsOf(party), party.template.categories, partyBonusList(party));
    const byId = new Map(party.acts.map(act => [act.id, act]));
    const leaderboard = hasResults(party) ? predictionLeaderboard(ballots, predictionsFor(party, ballots)) : [];
    const myPlace = leaderboard.findIndex(row => row.guestId === me);

    return (
        <>
            <CalmNote aria-live="polite">{ballots.length === 1 ? "1 guest at the party." : `${ballots.length} guests at the party.`}</CalmNote>
            <Ground>
                {standings.length === 0 ? (
                    <Pane>
                        <Row>No ratings yet. The room's standings show up with the first one.</Row>
                    </Pane>
                ) : (
                    <Pane as="ol" aria-label="The room's standings">
                        {standings.map((standing, index) => {
                            const act = byId.get(standing.actId)!;
                            return (
                                <Row as="li" key={standing.actId}>
                                    <span className="calm-row">
                                        <span>{ordinal(index + 1)} {act.flag} {act.country}</span>
                                        <span>{formatScore(standing.average)}</span>
                                    </span>
                                    <span className="calm-sub">{standing.votes === 1 ? "1 rating" : `${standing.votes} ratings`}</span>
                                </Row>
                            );
                        })}
                    </Pane>
                )}
            </Ground>
            {leaderboard.length > 0 && (
                party.showNames ? (
                    <>
                        <h2 className="esc-section">Closest to the real result</h2>
                        <Ground>
                            <Pane as="ol" aria-label="Closest to the real result">
                                {leaderboard.map((row, index) => (
                                    // Your own row stands proud, and says so in words too.
                                    <Row as="li" key={row.guestId} elevation={row.guestId === me ? "high" : "rest"}>
                                        <span className="calm-row">
                                            <span>{ordinal(index + 1)} {row.name}</span>
                                            <span>{row.prediction.points}</span>
                                        </span>
                                        {row.guestId === me && <span className="calm-sub">That's you</span>}
                                    </Row>
                                ))}
                            </Pane>
                        </Ground>
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
