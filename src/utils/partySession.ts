/**
 * Who this device is in a scoreboard party, and its ratings so far (#80).
 *
 * One small record per party code in localStorage, so closing the tab or
 * the phone locking mid-show loses nothing: reopening the party's link
 * lands the guest back on their sheet. Their ballot is mirrored here on
 * every change and saved to Firestore; a rating made offline waits here
 * until the next save gets through. Every read and write is wrapped:
 * private mode or full storage only costs the resume, never the party.
 */
import type { Bonuses, Ratings } from "./partyModel";

export interface PartyIdentity {
    guestId: string;
    name: string;
    isHost: boolean;
    /** The act they were on, by id, so a reordered lineup keeps them there. */
    actId?: string;
}

export interface StoredBallot {
    ratings: Ratings;
    bonuses: Bonuses;
    savedAt: number;
}

const identityKey = (code: string) => `escparty.party.${code}`;
const ballotKey = (code: string) => `escparty.party.${code}.ballot`;
const LAST_PARTY_KEY = "escparty.lastParty";

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
        // Storage unavailable: the party goes on, only the resume is lost.
    }
};

const isIdentity = (value: unknown): value is PartyIdentity => {
    const identity = value as PartyIdentity | null;
    return !!identity && typeof identity.guestId === "string" && identity.guestId.length > 0 &&
        typeof identity.name === "string" && typeof identity.isHost === "boolean";
};

const isStoredBallot = (value: unknown): value is StoredBallot => {
    const ballot = value as StoredBallot | null;
    return !!ballot && typeof ballot.ratings === "object" && ballot.ratings !== null &&
        typeof ballot.bonuses === "object" && ballot.bonuses !== null && typeof ballot.savedAt === "number";
};

export const readPartyIdentity = (code: string) => read(identityKey(code), isIdentity);

export const savePartyIdentity = (code: string, identity: PartyIdentity) => {
    write(identityKey(code), identity);
    write(LAST_PARTY_KEY, code);
};

export const readStoredBallot = (code: string) => read(ballotKey(code), isStoredBallot);

export const storeBallot = (code: string, ballot: Omit<StoredBallot, "savedAt">) =>
    write(ballotKey(code), { ...ballot, savedAt: Date.now() });

/** The party this device was last in, to offer a way back. */
export const lastPartyCode = (): string | null => {
    const code = read(LAST_PARTY_KEY, (value): value is string => typeof value === "string" && /^[A-Z]{4}$/.test(value));
    return code && readPartyIdentity(code) ? code : null;
};

/**
 * Put a ballot from the server and this device's copy together: every
 * rating either has, this device's winning where both do (it's the one the
 * guest touched last on this device, and may not have reached the server).
 */
export const mergeBallots = (
    server: { ratings: Ratings; bonuses: Bonuses } | null,
    local: { ratings: Ratings; bonuses: Bonuses } | null,
): { ratings: Ratings; bonuses: Bonuses } => {
    const ratings: Ratings = {};
    for (const source of [server?.ratings ?? {}, local?.ratings ?? {}]) {
        for (const [actId, values] of Object.entries(source)) ratings[actId] = { ...ratings[actId], ...values };
    }
    return { ratings, bonuses: { ...(server?.bonuses ?? {}), ...(local?.bonuses ?? {}) } };
};
