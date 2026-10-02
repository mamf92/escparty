import { useCallback, useEffect, useState } from "react";
import { listenToBallots, listenToParty, type Party } from "../utils/partyFirestore";
import type { Ballot } from "../utils/partyModel";

export interface PartyData {
    /** Undefined while loading, null when there's no such party. */
    party: Party | null | undefined;
    /** Undefined until the first snapshot of the ballots arrives. */
    ballots: Ballot[] | undefined;
    error: string | null;
    /** Attach both listeners afresh, after one of them failed. */
    retry: () => void;
}

const UNREACHABLE = "The party couldn't be reached. Check your connection.";

/**
 * Follow a scoreboard party and every guest's ballot, live. Firestore keeps
 * a listener going through a dropped connection, so a phone that slept
 * through an act catches up when it wakes. A listener that errors, though,
 * is over for good: `retry` attaches both again.
 */
export const usePartyData = (code: string | undefined): PartyData => {
    const [attempt, setAttempt] = useState(0);
    // Each value is tagged with the code it belongs to, so switching parties
    // reads as loading rather than showing the last party's data. A retry
    // keeps what's on screen until fresh snapshots replace it.
    const key = `${code}#${attempt}`;
    const [party, setParty] = useState<{ code: string; value: Party | null } | null>(null);
    const [ballots, setBallots] = useState<{ code: string; value: Ballot[] } | null>(null);
    // Kept per listener and per attempt: a listener that errored never sends
    // again, so only a retry clears it.
    const [errors, setErrors] = useState<{ key: string; party: boolean; ballots: boolean } | null>(null);

    useEffect(() => {
        if (!code) return;
        const key = `${code}#${attempt}`;
        const failed = (what: "party" | "ballots") => (err: Error) => {
            console.error(`Couldn't follow the party's ${what === "party" ? "details" : "ratings"}:`, err);
            setErrors(current => ({ ...(current?.key === key ? current : { party: false, ballots: false }), key, [what]: true }));
        };
        let unsubscribeParty = () => {};
        let unsubscribeBallots = () => {};
        try {
            unsubscribeParty = listenToParty(code, next => setParty({ code, value: next }), failed("party"));
            unsubscribeBallots = listenToBallots(code, next => setBallots({ code, value: next }), failed("ballots"));
        } catch (err) {
            failed("party")(err as Error);
        }
        return () => {
            unsubscribeParty();
            unsubscribeBallots();
        };
    }, [code, attempt]);

    const retry = useCallback(() => setAttempt(current => current + 1), []);

    // No code, no party: nothing to listen to.
    if (!code) return { party: null, ballots: undefined, error: null, retry };
    const failing = errors?.key === key && (errors.party || errors.ballots);
    return {
        party: party?.code === code ? party.value : undefined,
        ballots: ballots?.code === code ? ballots.value : undefined,
        error: failing ? UNREACHABLE : null,
        retry,
    };
};
