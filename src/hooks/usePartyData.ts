import { useEffect, useState } from "react";
import { listenToBallots, listenToParty, type Party } from "../utils/partyFirestore";
import type { Ballot } from "../utils/partyModel";

export interface PartyData {
    /** Undefined while loading, null when there's no such party. */
    party: Party | null | undefined;
    /** Undefined until the first snapshot of the ballots arrives. */
    ballots: Ballot[] | undefined;
    error: string | null;
}

/**
 * Follow a scoreboard party and every guest's ballot, live. Both listeners
 * reattach on their own after a dropped connection (Firestore's), so a
 * phone that slept through an act catches up when it wakes.
 */
export const usePartyData = (code: string | undefined): PartyData => {
    // Each value is tagged with the code it belongs to, so switching parties
    // reads as loading rather than showing the last party's data.
    const [party, setParty] = useState<{ code: string; value: Party | null } | null>(null);
    const [ballots, setBallots] = useState<{ code: string; value: Ballot[] } | null>(null);
    const [error, setError] = useState<{ code: string; value: string | null } | null>(null);

    useEffect(() => {
        if (!code) return;
        const failed = (what: string) => (err: Error) => {
            console.error(`Couldn't follow the party's ${what}:`, err);
            setError({ code, value: "The party couldn't be reached. Check your connection." });
        };
        let unsubscribeParty = () => {};
        let unsubscribeBallots = () => {};
        try {
            unsubscribeParty = listenToParty(code, next => {
                setParty({ code, value: next });
                setError({ code, value: null });
            }, failed("details"));
            unsubscribeBallots = listenToBallots(code, next => setBallots({ code, value: next }), failed("ratings"));
        } catch (err) {
            failed("details")(err as Error);
        }
        return () => {
            unsubscribeParty();
            unsubscribeBallots();
        };
    }, [code]);

    // No code, no party: nothing to listen to.
    if (!code) return { party: null, ballots: undefined, error: null };
    return {
        party: party?.code === code ? party.value : undefined,
        ballots: ballots?.code === code ? ballots.value : undefined,
        error: error?.code === code ? error.value : null,
    };
};
