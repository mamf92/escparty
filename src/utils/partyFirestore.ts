/**
 * The scoreboard party's Firestore API (#80, #83, #85): a party is its own
 * collection, `parties/{code}`, not a quiz room; each guest's ratings are
 * their own document, `parties/{code}/ballots/{guestId}`, so guests never
 * write over each other. Shapes and rules: docs/agent/scoreboard-party.md.
 */
import {
    collection,
    doc,
    getDoc,
    onSnapshot,
    serverTimestamp,
    setDoc,
    Timestamp,
    updateDoc,
    type FieldValue,
} from "firebase/firestore";
import { db } from "../firebase";
import { contestById, type Act, type Contest } from "../data/contests2027";
import type { Ballot, Bonuses, RatingTemplate, Ratings } from "./partyModel";
import { generateRoomCode } from "./roomsFirestore";

export interface PartyResults {
    /** A final's real places, act id -> 1-based place. */
    places?: Record<string, number>;
    /** A semi-final's qualifiers, act ids. */
    qualifiers?: string[];
}

export interface Party {
    code: string;
    hostId: string;
    title: string;
    contestId: string;
    kind: Contest["kind"];
    /** How many go through, for a semi-final. */
    qualifiers: number;
    acts: Act[];
    template: RatingTemplate;
    /** Whether the party bonus layer (wind machine, key change...) is on. */
    bonuses: boolean;
    /** Whether the awards name names (#89): chosen by the host at setup. */
    showNames: boolean;
    results: PartyResults;
    /** Whether the host has opened the awards to everyone. */
    revealed: boolean;
    createdAt?: Timestamp | FieldValue;
    /** When the party can be deleted (a Firestore TTL policy, see the docs). */
    expireAt?: Timestamp;
}

export type NewParty = Omit<Party, "code" | "results" | "revealed" | "createdAt" | "expireAt">;

/** How long a party's data is kept. The expireAt field, for a TTL policy. */
export const PARTY_LIFETIME_DAYS = 30;

const requireDb = () => {
    if (!db) throw new Error("Firebase not initialized");
    return db;
};

/**
 * A show's running order: the one in Firestore `contests/{id}` if there is
 * one (the real lineup, entered once it's announced), else the bundled
 * fictive one. Falls back quietly: a party can always start.
 */
export const fetchContest = async (contestId: string): Promise<Contest | undefined> => {
    const bundled = contestById(contestId);
    try {
        const snapshot = await getDoc(doc(requireDb(), "contests", contestId));
        if (!snapshot.exists()) return bundled;
        const data = snapshot.data() as Partial<Contest>;
        const acts = (Array.isArray(data.acts) ? data.acts : []).filter(isAct);
        if (acts.length === 0) return bundled;
        return {
            id: contestId,
            title: typeof data.title === "string" ? data.title : bundled?.title ?? contestId,
            kind: data.kind === "semi" || data.kind === "final" ? data.kind : bundled?.kind ?? "final",
            qualifiers: typeof data.qualifiers === "number" ? data.qualifiers : bundled?.qualifiers,
            date: typeof data.date === "string" ? data.date : bundled?.date ?? "",
            acts,
        };
    } catch (error) {
        console.error("Couldn't read the lineup, using the bundled one:", error);
        return bundled;
    }
};

export const isAct = (value: unknown): value is Act => {
    const act = value as Act | null;
    return !!act && ["id", "country", "flag", "artist", "song"].every(key => typeof act[key as keyof Act] === "string") &&
        /^[a-z0-9-]{1,20}$/.test(act.id);
};

/** When a document written now can be deleted: PARTY_LIFETIME_DAYS from now. */
const expiry = () => Timestamp.fromMillis(Date.now() + PARTY_LIFETIME_DAYS * 24 * 60 * 60 * 1000);

/**
 * Create a party under a fresh 4-letter code and return the code. Tries a
 * few codes, since the create rule refuses an existing one.
 */
export const createParty = async (party: NewParty): Promise<string> => {
    const database = requireDb();
    for (let attempt = 0; attempt < 5; attempt++) {
        const code = generateRoomCode();
        const ref = doc(database, "parties", code);
        if ((await getDoc(ref)).exists()) continue;
        const expireAt = expiry();
        await setDoc(ref, {
            ...party,
            code,
            results: {},
            revealed: false,
            createdAt: serverTimestamp(),
            expireAt,
        });
        return code;
    }
    throw new Error("Couldn't find a free party code. Try again.");
};

/** Follow a party. `onParty(null)` when it doesn't exist. Returns the unsubscribe. */
export const listenToParty = (code: string, onParty: (party: Party | null) => void, onError?: (error: Error) => void) =>
    onSnapshot(
        doc(requireDb(), "parties", code),
        snapshot => onParty(snapshot.exists() ? (snapshot.data() as Party) : null),
        error => onError?.(error),
    );

/** Follow every guest's ballot in a party. */
export const listenToBallots = (code: string, onBallots: (ballots: Ballot[]) => void, onError?: (error: Error) => void) =>
    onSnapshot(
        collection(requireDb(), "parties", code, "ballots"),
        snapshot => onBallots(snapshot.docs.map(entry => toBallot(entry.id, entry.data()))),
        error => onError?.(error),
    );

const toBallot = (guestId: string, data: Record<string, unknown>): Ballot => ({
    guestId,
    name: typeof data.name === "string" ? data.name : "Guest",
    ratings: isRecord(data.ratings) ? (data.ratings as Ratings) : {},
    bonuses: isRecord(data.bonuses) ? (data.bonuses as Bonuses) : {},
});

const isRecord = (value: unknown) => !!value && typeof value === "object" && !Array.isArray(value);

/**
 * Save a guest's whole ballot. Small (a few numbers per act), so it's one
 * document write per change; only this guest writes it, so nothing else
 * can be overwritten.
 */
export const saveBallot = async (code: string, ballot: Ballot): Promise<void> => {
    await setDoc(doc(requireDb(), "parties", code, "ballots", ballot.guestId), {
        name: ballot.name,
        ratings: ballot.ratings,
        bonuses: ballot.bonuses,
        updatedAt: serverTimestamp(),
        // A ballot is its own document, so it needs its own expiry for the
        // TTL policy: 30 days after the guest's last change.
        expireAt: expiry(),
    });
};

/** Read one guest's ballot, e.g. to restore it after a reload. */
export const fetchBallot = async (code: string, guestId: string): Promise<Ballot | null> => {
    const snapshot = await getDoc(doc(requireDb(), "parties", code, "ballots", guestId));
    return snapshot.exists() ? toBallot(guestId, snapshot.data()) : null;
};

/** The host's edits: the running order, the real results, opening the awards. */
export const updatePartyActs = (code: string, acts: Act[]) =>
    updateDoc(doc(requireDb(), "parties", code), { acts });

export const setPartyResults = (code: string, results: PartyResults) =>
    updateDoc(doc(requireDb(), "parties", code), { results });

export const setPartyRevealed = (code: string, revealed: boolean) =>
    updateDoc(doc(requireDb(), "parties", code), { revealed });
