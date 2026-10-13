import { useEffect, useState } from "react";
import { listenToParty, type Party } from "../utils/partyFirestore";

/**
 * Follow a scoreboard party's own document, live, without its ballots (the
 * party night's cards only need the party itself, and every rating a guest
 * saves would otherwise be sent to every phone on the night's home).
 * Undefined while loading, null when there's no such party or the listener
 * failed. Tagged with the code it belongs to, so a new code reads as loading.
 */
export const useParty = (code: string | undefined): Party | null | undefined => {
    const [party, setParty] = useState<{ code: string; value: Party | null } | null>(null);
    useEffect(() => {
        if (!code) return;
        const failed = (error: Error) => {
            console.error("Couldn't follow the party:", error);
            setParty({ code, value: null });
        };
        try {
            return listenToParty(code, next => setParty({ code, value: next }), failed);
        } catch (error) {
            failed(error as Error);
        }
    }, [code]);
    if (!code) return null;
    return party?.code === code ? party.value : undefined;
};
