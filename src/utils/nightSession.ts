/**
 * Who this device is at a party night, and which night it was last in (#233).
 *
 * One small record per night code in localStorage, so closing the tab or the
 * phone locking mid-evening loses nothing: reopening the night's link lands
 * the guest back on its home. Like partySession.ts, every read and write is
 * wrapped: private mode or full storage only costs the resume, never the
 * night. The night's identity is the guest id and name for every activity in
 * it, so the quizzes and scoreboards that come later read it from here.
 */

export interface NightIdentity {
    guestId: string;
    name: string;
    isHost: boolean;
}

const identityKey = (code: string) => `escparty.night.${code}`;
const joiningKey = (code: string) => `escparty.night.${code}.joining`;
const LAST_NIGHT_KEY = "escparty.lastNight";

const read = <T,>(key: string, valid: (value: unknown) => value is T): T | null => {
    try {
        const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
        return valid(parsed) ? parsed : null;
    } catch {
        return null;
    }
};

const write = (key: string, value: unknown) => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Storage unavailable: the night goes on, only the resume is lost.
    }
};

const remove = (key: string) => {
    try {
        localStorage.removeItem(key);
    } catch {
        // Storage unavailable: nothing was kept.
    }
};

const isIdentity = (value: unknown): value is NightIdentity => {
    const identity = value as NightIdentity | null;
    return !!identity && typeof identity.guestId === "string" && identity.guestId.length > 0 &&
        typeof identity.name === "string" && typeof identity.isHost === "boolean";
};

export const readNightIdentity = (code: string) => read(identityKey(code), isIdentity);

export const saveNightIdentity = (code: string, identity: NightIdentity) => {
    write(identityKey(code), identity);
    write(LAST_NIGHT_KEY, code);
};

/**
 * Forget this device's place in a night (it left, or the roster no longer
 * has it). The last-night pointer goes too when it points here, so Home
 * stops offering a way back to a night this device isn't in.
 */
export const clearNightIdentity = (code: string) => {
    remove(identityKey(code));
    remove(joiningKey(code));
    if (read(LAST_NIGHT_KEY, isCode) === code) remove(LAST_NIGHT_KEY);
};

/**
 * A join that was sent but not confirmed (as for a party, #229): the same
 * guest id and name are tried again, also after a reload, so a write that
 * landed late is found rather than left as a second guest.
 */
export interface PendingNightJoin {
    guestId: string;
    name: string;
}

const isPendingJoin = (value: unknown): value is PendingNightJoin => {
    const pending = value as PendingNightJoin | null;
    return !!pending && typeof pending.guestId === "string" && pending.guestId.length > 0 &&
        typeof pending.name === "string" && pending.name.length > 0;
};

export const readPendingNightJoin = (code: string) => read(joiningKey(code), isPendingJoin);

export const savePendingNightJoin = (code: string, pending: PendingNightJoin) => write(joiningKey(code), pending);

export const clearPendingNightJoin = (code: string) => remove(joiningKey(code));

const isCode = (value: unknown): value is string => typeof value === "string" && /^[A-Z]{4}$/.test(value);

/** The night this device was last in, to offer a way back; null unless an identity for it is still stored. */
export const lastNightCode = (): string | null => {
    const code = read(LAST_NIGHT_KEY, isCode);
    return code && readNightIdentity(code) ? code : null;
};
