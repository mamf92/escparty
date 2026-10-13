import { useCallback, useEffect, useState } from "react";
import { listenToGuests, listenToNight, type Night, type NightGuest } from "../utils/nightsFirestore";

export interface NightData {
    /** Undefined while loading, null when there's no such night. */
    night: Night | null | undefined;
    /** Undefined until the first snapshot of the roster arrives. */
    guests: NightGuest[] | undefined;
    error: string | null;
    /** Attach both listeners afresh, after one of them failed. */
    retry: () => void;
}

const UNREACHABLE = "The party night couldn't be reached. Check your connection.";

/**
 * Follow a party night and its roster, live (#233). Built like usePartyData:
 * Firestore keeps a listener going through a dropped connection, but one that
 * errors is over for good, so `retry` attaches both again.
 */
export const useNightData = (code: string | undefined): NightData => {
    const [attempt, setAttempt] = useState(0);
    // Each value is tagged with the code it belongs to, so switching nights
    // reads as loading rather than showing the last night's data. A retry
    // keeps what's on screen until fresh snapshots replace it.
    const key = `${code}#${attempt}`;
    const [night, setNight] = useState<{ code: string; value: Night | null } | null>(null);
    const [guests, setGuests] = useState<{ code: string; value: NightGuest[] } | null>(null);
    const [errors, setErrors] = useState<{ key: string; night: boolean; guests: boolean } | null>(null);

    useEffect(() => {
        if (!code) return;
        const key = `${code}#${attempt}`;
        const failed = (what: "night" | "guests") => (err: Error) => {
            console.error(`Couldn't follow the night's ${what === "night" ? "details" : "guests"}:`, err);
            setErrors(current => ({ ...(current?.key === key ? current : { night: false, guests: false }), key, [what]: true }));
        };
        let unsubscribeNight = () => {};
        let unsubscribeGuests = () => {};
        // Each listener's own failure, so the log names the one that failed.
        try {
            unsubscribeNight = listenToNight(code, next => setNight({ code, value: next }), failed("night"));
        } catch (err) {
            failed("night")(err as Error);
        }
        try {
            unsubscribeGuests = listenToGuests(code, next => setGuests({ code, value: next }), failed("guests"));
        } catch (err) {
            failed("guests")(err as Error);
        }
        return () => {
            unsubscribeNight();
            unsubscribeGuests();
        };
    }, [code, attempt]);

    const retry = useCallback(() => setAttempt(current => current + 1), []);

    // No code, no night: nothing to listen to.
    if (!code) return { night: null, guests: undefined, error: null, retry };
    const failing = errors?.key === key && (errors.night || errors.guests);
    return {
        night: night?.code === code ? night.value : undefined,
        guests: guests?.code === code ? guests.value : undefined,
        error: failing ? UNREACHABLE : null,
        retry,
    };
};
