import { useState } from "react";
import { CalmNote } from "./CalmPage";
import type { Act } from "../data/contests2027";
import {
    fetchContest,
    setPartyResults,
    setPartyRevealed,
    updatePartyActs,
    type Party,
    type PartyResults,
} from "../utils/partyFirestore";
import type { Ballot } from "../utils/partyModel";
import { ordinal, partyLink } from "../utils/partyResults";

/**
 * The host's side of a party (#82, #85, #86, #87): share the code, fix up
 * the running order as the real one is announced, enter the real result as
 * it comes in, and open the awards when the show's over. Every change is
 * one write to the party, so every guest's phone follows it live.
 */
const PartyHostTools = ({ party, ballots }: { party: Party; ballots: Ballot[] }) => {
    const [note, setNote] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const run = async (what: string, write: () => Promise<unknown>, done?: string) => {
        if (busy) return;
        setBusy(true);
        setNote(null);
        try {
            await write();
            if (done) setNote(done);
        } catch (error) {
            console.error(`Couldn't ${what}:`, error);
            setNote(`Couldn't ${what}. Check your connection and try again.`);
        } finally {
            setBusy(false);
        }
    };

    const share = async () => {
        try {
            await navigator.clipboard.writeText(partyLink(party.code));
            setNote("The link is copied.");
        } catch {
            setNote(`Share this link: ${partyLink(party.code)}`);
        }
    };

    const saveResults = (results: PartyResults) => run("save the result", () => setPartyResults(party.code, results));

    return (
        <>
            <CalmNote>Guests join with the code {party.code}. {ballots.length === 1 ? "1 guest" : `${ballots.length} guests`} so far.</CalmNote>
            <div className="calm-ground">
                <div className="lycra-pane">
                    <button type="button" className="lycra" onClick={share}>Copy the party link</button>
                </div>
            </div>

            {party.kind === "final"
                ? <FinalResults party={party} busy={busy} onSave={saveResults} />
                : <SemiResults party={party} busy={busy} onSave={saveResults} />}

            <RunningOrder
                party={party}
                busy={busy}
                onSave={(acts, done) => run("save the running order", () => updatePartyActs(party.code, acts), done)}
                onLoadLatest={() => run("load the latest lineup", async () => {
                    const contest = await fetchContest(party.contestId);
                    if (!contest) throw new Error(`No show ${party.contestId}`);
                    await updatePartyActs(party.code, contest.acts);
                }, "Loaded the latest lineup.")}
            />

            <CalmNote>The awards</CalmNote>
            <div className="calm-ground">
                <div className="lycra-pane">
                    <button
                        type="button"
                        className="lycra"
                        disabled={busy}
                        onClick={() => run("change the awards", () => setPartyRevealed(party.code, !party.revealed))}
                    >
                        {party.revealed ? "Hide the awards again" : "Open the awards for everyone"}
                    </button>
                </div>
            </div>
            {note && <CalmNote role="status">{note}</CalmNote>}
        </>
    );
};

/** A final's real result, tapped in from the top as the scoreboard reveals it. */
const FinalResults = ({ party, busy, onSave }: { party: Party; busy: boolean; onSave: (results: PartyResults) => void }) => {
    const places = party.results.places ?? {};
    const placed = party.acts.filter(act => places[act.id] !== undefined).sort((a, b) => places[a.id] - places[b.id]);
    const unplaced = party.acts.filter(act => places[act.id] === undefined);
    const next = placed.length + 1;
    const undo = () => {
        const last = placed[placed.length - 1];
        const rest = { ...places };
        delete rest[last.id];
        onSave({ places: rest });
    };
    return (
        <>
            <CalmNote>
                {unplaced.length === 0
                    ? "The real result is in."
                    : `The real result: tap who came ${ordinal(next)}.`}
            </CalmNote>
            {unplaced.length > 0 && (
                <div className="calm-ground">
                    <div className="lycra-pane" aria-label={`Who came ${ordinal(next)}`}>
                        {unplaced.map(act => (
                            <button
                                key={act.id}
                                type="button"
                                className="lycra is-block"
                                disabled={busy}
                                onClick={() => onSave({ places: { ...places, [act.id]: next } })}
                            >
                                {act.flag} {act.country}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            {placed.length > 0 && (
                <>
                    <CalmNote>
                        So far: {placed.map(act => `${ordinal(places[act.id])} ${act.country}`).join(", ")}.
                    </CalmNote>
                    <div className="calm-ground">
                        <div className="lycra-pane calm-split">
                            <button type="button" className="lycra" disabled={busy} onClick={undo}>
                                Undo {placed[placed.length - 1].country}
                            </button>
                            <button type="button" className="lycra" disabled={busy} onClick={() => onSave({})}>
                                Clear the result
                            </button>
                        </div>
                    </div>
                </>
            )}
        </>
    );
};

/** A semi-final's qualifiers, ticked as the envelopes open. */
const SemiResults = ({ party, busy, onSave }: { party: Party; busy: boolean; onSave: (results: PartyResults) => void }) => {
    const qualifiers = party.results.qualifiers ?? [];
    const full = qualifiers.length >= party.qualifiers;
    const toggle = (actId: string) =>
        onSave({ qualifiers: qualifiers.includes(actId) ? qualifiers.filter(id => id !== actId) : [...qualifiers, actId] });
    return (
        <>
            <CalmNote>The real result: tick who goes through ({qualifiers.length} of {party.qualifiers}).</CalmNote>
            <div className="calm-ground">
                <div className="lycra-pane" aria-label="Who goes through">
                    {party.acts.map(act => {
                        const through = qualifiers.includes(act.id);
                        return (
                            <button
                                key={act.id}
                                type="button"
                                aria-pressed={through}
                                className={`lycra is-block${through ? " is-chosen" : ""}`}
                                disabled={busy || (full && !through)}
                                onClick={() => toggle(act.id)}
                            >
                                {act.flag} {act.country}
                            </button>
                        );
                    })}
                </div>
            </div>
        </>
    );
};

/**
 * Fix up the running order: move an act, or give it its real artist and
 * song. Or load the lineup from Firestore `contests/`, once it's been
 * entered there, for the whole show at once.
 */
const RunningOrder = ({ party, busy, onSave, onLoadLatest }: {
    party: Party;
    busy: boolean;
    onSave: (acts: Act[], done?: string) => void;
    onLoadLatest: () => void;
}) => {
    const [actId, setActId] = useState(party.acts[0].id);
    const index = Math.max(party.acts.findIndex(act => act.id === actId), 0);
    const act = party.acts[index];
    const [artist, setArtist] = useState(act.artist);
    const [song, setSong] = useState(act.song);

    const pick = (id: string) => {
        const next = party.acts.find(entry => entry.id === id) ?? party.acts[0];
        setActId(next.id);
        setArtist(next.artist);
        setSong(next.song);
    };
    const move = (by: number) => {
        const acts = [...party.acts];
        const [moved] = acts.splice(index, 1);
        acts.splice(index + by, 0, moved);
        onSave(acts);
    };
    const saveDetails = () =>
        onSave(
            party.acts.map(entry => (entry.id === act.id
                ? { ...entry, artist: artist.trim() || entry.artist, song: song.trim() || entry.song }
                : entry)),
            `Saved ${act.country}.`,
        );

    return (
        <>
            <CalmNote>The running order</CalmNote>
            <div className="calm-ground">
                <div className="lycra-pane">
                    <label>
                        <span className="calm-label">Act</span>
                        <select className="lycra-field" value={act.id} onChange={event => pick(event.target.value)}>
                            {party.acts.map((entry, i) => (
                                <option key={entry.id} value={entry.id}>{i + 1}. {entry.country}</option>
                            ))}
                        </select>
                    </label>
                    <label>
                        <span className="calm-label">Artist</span>
                        <input className="lycra-field" value={artist} maxLength={80} onChange={event => setArtist(event.target.value)} />
                    </label>
                    <label>
                        <span className="calm-label">Song</span>
                        <input className="lycra-field" value={song} maxLength={80} onChange={event => setSong(event.target.value)} />
                    </label>
                </div>
            </div>
            <div className="calm-ground">
                <div className="lycra-pane calm-split">
                    <button type="button" className="lycra" disabled={busy || index === 0} onClick={() => move(-1)}>Move earlier</button>
                    <button type="button" className="lycra" disabled={busy || index === party.acts.length - 1} onClick={() => move(1)}>Move later</button>
                </div>
            </div>
            <div className="calm-ground">
                <div className="lycra-pane">
                    <button type="button" className="lycra" disabled={busy} onClick={saveDetails}>Save {act.country}</button>
                    <button type="button" className="lycra" disabled={busy} onClick={onLoadLatest}>Load the latest lineup</button>
                </div>
            </div>
        </>
    );
};

export default PartyHostTools;
