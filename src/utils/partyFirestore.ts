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
    writeBatch,
    type FieldValue,
    type WriteBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { contestById, type Act, type Contest } from "../data/contests2027";
import { sanitiseBonuses, type Ballot, type Bonuses, type RatingTemplate, type Ratings } from "./partyModel";
import { resultsFor } from "./partyResults";
import { generateRoomCode } from "./roomsFirestore";
import { nameKey } from "./freeName";

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

/** Whether a party has this code: the Join screen tells a party from a quiz room by it. */
export const partyExists = async (code: string): Promise<boolean> =>
    (await getDoc(doc(requireDb(), "parties", code))).exists();

/**
 * Create a party under a fresh 4-letter code and return the code. Tries a
 * few codes, since the create rule refuses an existing one. The host joins
 * in the same batch, under `hostName` (their claim and empty ballot).
 */
export const createParty = async (party: NewParty, hostName: string): Promise<string> => {
    const database = requireDb();
    for (let attempt = 0; attempt < 5; attempt++) {
        const code = generateRoomCode();
        const ref = doc(database, "parties", code);
        if ((await getDoc(ref)).exists()) continue;
        try {
            const batch = writeBatch(database);
            batch.set(ref, {
                ...party,
                code,
                results: {},
                revealed: false,
                createdAt: serverTimestamp(),
                expireAt: expiry(),
            });
            addJoin(batch, code, party.hostId, hostName);
            await batch.commit();
        } catch (error) {
            // Another host took this code between the check and the write:
            // the write then counts as an update, which the rules refuse. Any
            // other refusal (of the host's claim or ballot) is the real error.
            if ((error as { code?: string }).code === "permission-denied") {
                const taken = await getDoc(ref).then(snapshot => snapshot.exists(), () => false);
                if (taken) continue;
            }
            throw error;
        }
        return code;
    }
    throw new Error("Couldn't find a free party code. Try again.");
};

/** Follow a party. `onParty(null)` when it doesn't exist. Returns the unsubscribe. */
export const listenToParty = (code: string, onParty: (party: Party | null) => void, onError?: (error: Error) => void) =>
    onSnapshot(
        doc(requireDb(), "parties", code),
        snapshot => onParty(snapshot.exists() ? toParty(snapshot.data() as Party) : null),
        error => onError?.(error),
    );

/**
 * A party as it comes from Firestore. The rules only check a template's
 * categories, so its bonus list is tidied here (`sanitiseBonuses`): a list
 * that is present but unusable becomes none; only an absent list (an older
 * party) leaves the premade bonuses to `partyBonusList`.
 */
const toParty = (party: Party): Party => {
    if (!isRecord(party.template) || !("bonuses" in party.template)) return party;
    const { bonuses, ...rest } = party.template;
    // A list the host chose but that isn't usable means no bonuses, not the premade five.
    return { ...party, template: { ...rest, bonuses: sanitiseBonuses(bonuses) ?? [] } };
};

/** Follow every guest's ballot in a party. */
export const listenToBallots = (code: string, onBallots: (ballots: Ballot[]) => void, onError?: (error: Error) => void) =>
    onSnapshot(
        collection(requireDb(), "parties", code, "ballots"),
        snapshot => onBallots(snapshot.docs.map(entry => toBallot(entry.id, entry.data()))),
        error => onError?.(error),
    );

/**
 * A ballot as it comes from Firestore, tidied. Anyone with the code can
 * write a ballot and the rules only check its outline, so every rating
 * that isn't a number and every bonus list that isn't a list of strings is
 * dropped here, before any screen or award works with it.
 */
const toBallot = (guestId: string, data: Record<string, unknown>): Ballot => {
    const ratings: Ratings = {};
    if (isRecord(data.ratings)) {
        for (const [actId, values] of Object.entries(data.ratings as Record<string, unknown>)) {
            if (!isRecord(values)) continue;
            ratings[actId] = Object.fromEntries(
                Object.entries(values as Record<string, unknown>).filter((entry): entry is [string, number] => typeof entry[1] === "number"),
            );
        }
    }
    const bonuses: Bonuses = {};
    if (isRecord(data.bonuses)) {
        for (const [actId, ids] of Object.entries(data.bonuses as Record<string, unknown>)) {
            if (Array.isArray(ids)) bonuses[actId] = ids.filter((id): id is string => typeof id === "string");
        }
    }
    return { guestId, name: typeof data.name === "string" ? data.name : "Guest", ratings, bonuses };
};

const isRecord = (value: unknown) => !!value && typeof value === "object" && !Array.isArray(value);

/**
 * Save a guest's whole ballot. Small (a few numbers per act), so it's one
 * document write per change; only this guest writes it, so nothing else
 * can be overwritten.
 */
export const saveBallot = async (code: string, ballot: Ballot): Promise<void> => {
    await setDoc(doc(requireDb(), "parties", code, "ballots", ballot.guestId), ballotDoc(ballot));
};

/** A ballot as stored; the rules pin exactly these keys. */
const ballotDoc = (ballot: Ballot) => ({
    name: ballot.name,
    ratings: ballot.ratings,
    bonuses: ballot.bonuses,
    updatedAt: serverTimestamp(),
    // A ballot is its own document, so it needs its own expiry for the
    // TTL policy: 30 days after the guest's last change.
    expireAt: expiry(),
});

/**
 * Add a guest's name claim, `parties/{code}/names/{key}`, and their empty
 * first ballot to `batch`. The rules want both in one write (#229).
 */
const addJoin = (batch: WriteBatch, code: string, guestId: string, name: string) => {
    const firestore = requireDb();
    batch.set(doc(firestore, "parties", code, "names", nameKey(name)), { name, guestId, expireAt: expiry() });
    batch.set(doc(firestore, "parties", code, "ballots", guestId), ballotDoc({ guestId, name, ratings: {}, bonuses: {} }));
};

/** How long a join may wait for the server before the guest is told to try again. */
export const JOIN_TIMEOUT_MS = 10_000;

/**
 * Join a party under `name` (#229): claim the name and write the guest's
 * empty ballot in one batch. The rules only ever create a claim, so if
 * another guest took the name first the batch is refused and nothing is
 * written. Resolves `true` when the name is this guest's (also when an
 * earlier try with the same `guestId` already claimed it), `false` when
 * someone else has it. Offline, a write waits rather than fails, so after
 * JOIN_TIMEOUT_MS this rejects; the queued write may still land, which a
 * retry with the same `guestId` then finds.
 */
export const joinParty = async (code: string, guestId: string, name: string): Promise<boolean> => {
    const firestore = requireDb();
    const batch = writeBatch(firestore);
    addJoin(batch, code, guestId, name);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(Object.assign(new Error("The join took too long"), { code: "deadline-exceeded" })), JOIN_TIMEOUT_MS);
    });
    try {
        await Promise.race([batch.commit(), timeout]);
        return true;
    } catch (error) {
        if ((error as { code?: string }).code !== "permission-denied") throw error;
        const claim = await getDoc(doc(firestore, "parties", code, "names", nameKey(name)));
        if (!claim.exists()) throw error;
        return claim.data().guestId === guestId;
    } finally {
        clearTimeout(timer);
    }
};

/** Read one guest's ballot, e.g. to restore it after a reload. */
export const fetchBallot = async (code: string, guestId: string): Promise<Ballot | null> => {
    const snapshot = await getDoc(doc(requireDb(), "parties", code, "ballots", guestId));
    return snapshot.exists() ? toBallot(guestId, snapshot.data()) : null;
};

/** The host's edits: the running order, the real results, opening the awards. */
/**
 * Replace the running order. When acts leave the show, their places and
 * qualifier ticks go too, in the same write, so the result never points at
 * an act that isn't there; the places left are renumbered 1, 2, 3...
 */
export const updatePartyActs = (code: string, acts: Act[], results?: PartyResults) =>
    updateDoc(doc(requireDb(), "parties", code), results ? { acts, results: resultsFor(acts, results) } : { acts });

export const setPartyResults = (code: string, results: PartyResults) =>
    updateDoc(doc(requireDb(), "parties", code), { results });

export const setPartyRevealed = (code: string, revealed: boolean) =>
    updateDoc(doc(requireDb(), "parties", code), { revealed });
