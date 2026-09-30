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
    const [party, setParty] = useState<Party | null | undefined>(undefined);
    const [ballots, setBallots] = useState<Ballot[] | undefined>(undefined);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!code) return;
        const failed = (what: string) => (err: Error) => {
            console.error(`Couldn't follow the party's ${what}:`, err);
            setError("The party couldn't be reached. Check your connection.");
        };
        let unsubscribeParty = () => {};
        let unsubscribeBallots = () => {};
        try {
            unsubscribeParty = listenToParty(code, next => {
                setParty(next);
                setError(null);
            }, failed("details"));
            unsubscribeBallots = listenToBallots(code, setBallots, failed("ratings"));
        } catch (err) {
            failed("details")(err as Error);
        }
        return () => {
            unsubscribeParty();
            unsubscribeBallots();
        };
    }, [code]);

    // No code, no party: nothing to listen to.
    return { party: code ? party : null, ballots, error };
};
