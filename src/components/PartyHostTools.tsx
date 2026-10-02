import { useEffect, useId, useRef, useState } from "react";
import { CalmNote } from "./CalmPage";
import { Control, Field, Ground, Pane } from "../design";
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
import { ordinal, partyLink, resultsFor } from "../utils/partyResults";

type Note = { text: string; failed?: boolean };

/**
 * The host's side of a party (#82, #85, #86, #87): share the code, fix up
 * the running order as the real one is announced, enter the real result as
 * it comes in, and open the awards when the show's over. Every change is
 * one write to the party, so every guest's phone follows it live.
 */
const PartyHostTools = ({ party, ballots }: { party: Party; ballots: Ballot[] }) => {
    const [note, setNote] = useState<Note | null>(null);
    const [busy, setBusy] = useState(false);

    const run = async (what: string, write: () => Promise<unknown>, done?: string) => {
        if (busy) return;
        setBusy(true);
        setNote(null);
        try {
            await write();
            if (done) setNote({ text: done });
        } catch (error) {
            console.error(`Couldn't ${what}:`, error);
            setNote({ text: `Couldn't ${what}. Check your connection and try again.`, failed: true });
        } finally {
            setBusy(false);
        }
    };

    const share = async () => {
        try {
            await navigator.clipboard.writeText(partyLink(party.code));
            setNote({ text: "The link is copied." });
        } catch {
            setNote({ text: `Share this link: ${partyLink(party.code)}` });
        }
    };

    const saveResults = (results: PartyResults) => run("save the result", () => setPartyResults(party.code, results));

    return (
        <>
            <h2 className="esc-note">Guests</h2>
            <CalmNote aria-live="polite">
                Guests join with the code {party.code}. {ballots.length === 1 ? "1 guest" : `${ballots.length} guests`} so far.
            </CalmNote>
            <Ground>
                <Pane>
                    <Control onClick={share}>Copy the party link</Control>
                </Pane>
            </Ground>

            <h2 className="esc-note">The real result</h2>
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
                    await updatePartyActs(party.code, contest.acts, party.results);
                }, "Loaded the latest lineup.")}
            />

            <h2 className="esc-note">The awards</h2>
            <Ground>
                <Pane>
                    <Control
                        disabled={busy}
                        onClick={() => run("change the awards", () => setPartyRevealed(party.code, !party.revealed))}
                    >
                        {party.revealed ? "Hide the awards again" : "Open the awards for everyone"}
                    </Control>
                </Pane>
            </Ground>
            {/* Kept in the page, so a screen reader hears each note as it lands. */}
            <div role="status">{note && !note.failed && <CalmNote>{note.text}</CalmNote>}</div>
            {note?.failed && <CalmNote role="alert">{note.text}</CalmNote>}
        </>
    );
};

/**
 * A two-step confirm for a host action that overwrites what's there
 * (#178): the first tap swaps the button for a question, with the safe
 * answer first and focused, so a stray tap or Enter can't wipe anything.
 */
const ConfirmStep = ({ question, keep, confirm, busy, onKeep, onConfirm }: {
    question: string;
    keep: string;
    confirm: string;
    busy: boolean;
    onKeep: () => void;
    onConfirm: () => void;
}) => {
    const keepRef = useRef<HTMLButtonElement>(null);
    useEffect(() => keepRef.current?.focus(), []);
    return (
        <>
            <CalmNote role="alert">{question}</CalmNote>
            <Ground>
                <Pane layout="split">
                    <Control ref={keepRef} onClick={onKeep}>{keep}</Control>
                    <Control disabled={busy} onClick={onConfirm}>{confirm}</Control>
                </Pane>
            </Ground>
        </>
    );
};

/** A final's real result, tapped in from the top as the scoreboard reveals it. */
const FinalResults = ({ party, busy, onSave }: { party: Party; busy: boolean; onSave: (results: PartyResults) => void }) => {
    const [clearing, setClearing] = useState(false);
    // Only acts still in the show, in case the lineup changed under the result.
    const places = resultsFor(party.acts, party.results).places ?? {};
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
            <CalmNote aria-live="polite">
                {unplaced.length === 0
                    ? "The real result is in."
                    : `The real result: tap who came ${ordinal(next)}.`}
            </CalmNote>
            {unplaced.length > 0 && (
                <Ground>
                    <Pane role="group" aria-label={`Who came ${ordinal(next)}`}>
                        {unplaced.map(act => (
                            <Control
                                key={act.id}
                                block
                                disabled={busy}
                                onClick={() => onSave({ places: { ...places, [act.id]: next } })}
                            >
                                {act.flag} {act.country}
                            </Control>
                        ))}
                    </Pane>
                </Ground>
            )}
            {placed.length > 0 && (
                <>
                    <CalmNote>
                        So far: {placed.map(act => `${ordinal(places[act.id])} ${act.country}`).join(", ")}.
                    </CalmNote>
                    {clearing ? (
                        <ConfirmStep
                            question="Clear the whole result? Everyone's closeness points go back to nothing until you tap it in again."
                            keep="Keep the result"
                            confirm="Yes, clear it"
                            busy={busy}
                            onKeep={() => setClearing(false)}
                            onConfirm={() => {
                                setClearing(false);
                                onSave({});
                            }}
                        />
                    ) : (
                        <Ground>
                            <Pane layout="split">
                                <Control disabled={busy} onClick={undo}>
                                    Undo {placed[placed.length - 1].country}
                                </Control>
                                <Control disabled={busy} onClick={() => setClearing(true)}>
                                    Clear the result
                                </Control>
                            </Pane>
                        </Ground>
                    )}
                </>
            )}
        </>
    );
};

/** A semi-final's qualifiers, ticked as the envelopes open. */
const SemiResults = ({ party, busy, onSave }: { party: Party; busy: boolean; onSave: (results: PartyResults) => void }) => {
    const qualifiers = resultsFor(party.acts, party.results).qualifiers ?? [];
    const full = qualifiers.length >= party.qualifiers;
    const toggle = (actId: string) =>
        onSave({ qualifiers: qualifiers.includes(actId) ? qualifiers.filter(id => id !== actId) : [...qualifiers, actId] });
    return (
        <>
            <CalmNote aria-live="polite">The real result: tick who goes through ({qualifiers.length} of {party.qualifiers}).</CalmNote>
            <Ground>
                <Pane role="group" aria-label="Who goes through">
                    {party.acts.map(act => {
                        const through = qualifiers.includes(act.id);
                        return (
                            <Control
                                key={act.id}
                                block
                                chosen={through}
                                disabled={busy || (full && !through)}
                                onClick={() => toggle(act.id)}
                            >
                                {act.flag} {act.country}
                            </Control>
                        );
                    })}
                </Pane>
            </Ground>
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
    const actFieldId = useId();
    const [actId, setActId] = useState(party.acts[0].id);
    const [loading, setLoading] = useState(false);
    // The picked act, or the first one if it left the lineup.
    const index = Math.max(party.acts.findIndex(act => act.id === actId), 0);
    const act = party.acts[index];

    const move = (by: number) => {
        const acts = [...party.acts];
        const [moved] = acts.splice(index, 1);
        acts.splice(index + by, 0, moved);
        onSave(acts);
    };

    return (
        <>
            <h2 className="esc-note">The running order</h2>
            <Ground>
                <Pane>
                    <div>
                        <label className="calm-label" htmlFor={actFieldId}>Act</label>
                        <select id={actFieldId} className="lycra-field" value={act.id} onChange={event => setActId(event.target.value)}>
                            {party.acts.map((entry, i) => (
                                <option key={entry.id} value={entry.id}>{i + 1}. {entry.country}</option>
                            ))}
                        </select>
                    </div>
                </Pane>
            </Ground>
            <Ground>
                <Pane layout="split">
                    <Control disabled={busy || index === 0} onClick={() => move(-1)}>Move earlier</Control>
                    <Control disabled={busy || index === party.acts.length - 1} onClick={() => move(1)}>Move later</Control>
                </Pane>
            </Ground>
            {/* Keyed on what's saved, so a newer lineup refills the fields instead of being overwritten by them. */}
            <ActDetails
                key={`${act.id}|${act.artist}|${act.song}`}
                act={act}
                busy={busy}
                onSave={(artist, song) => onSave(
                    party.acts.map(entry => (entry.id === act.id ? { ...entry, artist, song } : entry)),
                    `Saved ${act.country}.`,
                )}
            />
            {loading ? (
                <ConfirmStep
                    question="Load the latest lineup? It replaces this running order, with any artists and songs you've typed in."
                    keep="Keep this lineup"
                    confirm="Yes, load it"
                    busy={busy}
                    onKeep={() => setLoading(false)}
                    onConfirm={() => {
                        setLoading(false);
                        onLoadLatest();
                    }}
                />
            ) : (
                <Ground>
                    <Pane>
                        <Control disabled={busy} onClick={() => setLoading(true)}>Load the latest lineup</Control>
                    </Pane>
                </Ground>
            )}
        </>
    );
};

/** One act's artist and song, as the host types them. */
const ActDetails = ({ act, busy, onSave }: { act: Act; busy: boolean; onSave: (artist: string, song: string) => void }) => {
    const ids = useId();
    const [artist, setArtist] = useState(act.artist);
    const [song, setSong] = useState(act.song);
    return (
        <Ground>
            <Pane>
                <div>
                    <label className="calm-label" htmlFor={`${ids}-artist`}>Artist</label>
                    <Field id={`${ids}-artist`} value={artist} maxLength={80} onChange={event => setArtist(event.target.value)} />
                </div>
                <div>
                    <label className="calm-label" htmlFor={`${ids}-song`}>Song</label>
                    <Field id={`${ids}-song`} value={song} maxLength={80} onChange={event => setSong(event.target.value)} />
                </div>
                <Control disabled={busy} onClick={() => onSave(artist.trim() || act.artist, song.trim() || act.song)}>
                    Save {act.country}
                </Control>
            </Pane>
        </Ground>
    );
};

export default PartyHostTools;
