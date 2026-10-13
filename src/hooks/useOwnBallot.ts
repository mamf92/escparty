import { useCallback, useEffect, useRef, useState } from "react";
import { joinParty, saveBallot } from "../utils/partyFirestore";
import type { Ballot, Bonuses, Ratings } from "../utils/partyModel";
import { mergeBallots, readStoredBallot, storeBallot, type PartyIdentity } from "../utils/partySession";

export type SaveState = "saved" | "saving" | "offline";

const SAVE_DELAY_MS = 400;
const RETRY_MS = 5_000;

const same = (a: { ratings: Ratings; bonuses: Bonuses }, b: { ratings: Ratings; bonuses: Bonuses }) =>
    JSON.stringify(a.ratings) === JSON.stringify(b.ratings) && JSON.stringify(a.bonuses) === JSON.stringify(b.bonuses);

/**
 * This guest's ratings in a party (#80, #83): kept on the device on every
 * tap, and saved to Firestore a moment later, whole. A save that fails
 * (offline, a sleeping phone) is retried until it lands, and the device
 * copy means a reload in between loses nothing. When the server's copy
 * first arrives the two are merged, so ratings from before a reload and
 * ratings that never reached the server both survive. A guest
 * joins only once the ballots have loaded, so there is always a server copy
 * (or its absence) to merge with. Joining (joinParty) writes the empty
 * ballot with the name claim; if the server still has none, the first save
 * here joins first (a retried join of this guest's own name succeeds).
 */
export const useOwnBallot = (code: string | undefined, identity: PartyIdentity | null, serverBallots: Ballot[] | undefined) => {
    const [ballot, setBallot] = useState<{ ratings: Ratings; bonuses: Bonuses }>(() => {
        const stored = code ? readStoredBallot(code) : null;
        return { ratings: stored?.ratings ?? {}, bonuses: stored?.bonuses ?? {} };
    });
    const [state, setState] = useState<SaveState>("saved");
    const latest = useRef(ballot);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const merged = useRef(false);
    // No ballot on the server for this guest: the first save joins (claim and
    // ballot together), since the rules refuse a first ballot without its claim.
    const needsJoin = useRef(false);

    // The latest `save`, for its own retry and for the unmount below.
    const saveNow = useRef<(last?: boolean) => Promise<void>>(async () => {});

    /** `last`: the page is closing, so try once and don't schedule a retry. */
    const save = useCallback(async (last = false) => {
        if (!code || !identity) return;
        timer.current = null;
        setState("saving");
        const sent = latest.current;
        try {
            if (needsJoin.current) {
                if (!(await joinParty(code, identity.guestId, identity.name))) {
                    // Another guest holds this name (an identity from before name
                    // claims): retrying can't help, so the ratings stay on the device.
                    console.error(`Couldn't save the ratings: the name ${identity.name} is someone else's.`);
                    setState("offline");
                    return;
                }
                needsJoin.current = false;
            }
            await saveBallot(code, { guestId: identity.guestId, name: identity.name, ...sent });
            // A newer change made while this one was in flight has its own save queued.
            if (latest.current === sent) setState("saved");
        } catch (error) {
            console.error("Couldn't save the ratings, will retry:", error);
            setState("offline");
            if (!last && !timer.current) timer.current = setTimeout(() => void saveNow.current(), RETRY_MS);
        }
    }, [code, identity]);

    const schedule = useCallback((delay = SAVE_DELAY_MS) => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => void save(), delay);
    }, [save]);

    // Leaving the page (to the awards, the big screen) mid-wait sends the
    // waiting save now instead of dropping it. If that fails too, the
    // device copy is merged back in on the next visit.
    useEffect(() => {
        saveNow.current = save;
    }, [save]);
    useEffect(() => () => {
        if (!timer.current) return;
        clearTimeout(timer.current);
        timer.current = null;
        void saveNow.current(true);
    }, []);

    // Merge with the server's copy once, when it first arrives.
    useEffect(() => {
        if (merged.current || !serverBallots || !identity) return;
        merged.current = true;
        const server = serverBallots.find(entry => entry.guestId === identity.guestId) ?? null;
        const next = mergeBallots(server, latest.current);
        latest.current = next;
        setBallot(next);
        if (code) storeBallot(code, next);
        // No ballot on the server yet (not seen yet, or an identity from before name claims): join, then write it.
        if (!server) needsJoin.current = true;
        if (!server || !same(server, next)) schedule(0);
    }, [serverBallots, identity, code, schedule]);

    // This guest's ballot showing up later (a join's own write) means there's nothing to join.
    useEffect(() => {
        if (needsJoin.current && identity && serverBallots?.some(entry => entry.guestId === identity.guestId)) needsJoin.current = false;
    }, [serverBallots, identity]);

    const change = useCallback((update: (current: { ratings: Ratings; bonuses: Bonuses }) => { ratings: Ratings; bonuses: Bonuses }) => {
        const next = update(latest.current);
        latest.current = next;
        setBallot(next);
        if (code) storeBallot(code, next);
        schedule();
    }, [code, schedule]);

    const rate = useCallback((actId: string, categoryId: string, value: number) =>
        change(current => ({
            ...current,
            ratings: { ...current.ratings, [actId]: { ...current.ratings[actId], [categoryId]: value } },
        })), [change]);

    const toggleBonus = useCallback((actId: string, bonusId: string) =>
        change(current => {
            const ticked = current.bonuses[actId] ?? [];
            const next = ticked.includes(bonusId) ? ticked.filter(id => id !== bonusId) : [...ticked, bonusId];
            return { ...current, bonuses: { ...current.bonuses, [actId]: next } };
        }), [change]);

    return { ballot, rate, toggleBonus, state };
};
