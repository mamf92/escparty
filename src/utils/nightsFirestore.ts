/**
 * The party night's Firestore API (#231, #232): a night is a thin layer above
 * quiz rooms and scoreboard parties, `nights/{code}`, with one 4-letter code
 * for the whole evening. Guests join it once and keep one id and one name for
 * every activity in it. A guest is their own document,
 * `nights/{code}/guests/{guestId}`, and the name is held by a create-only
 * claim, `nights/{code}/names/{key}`, like a party's (#229). Shapes and rules:
 * docs/agent/firestore-data-model.md ("Party nights").
 */
import {
    arrayUnion,
    collection,
    doc,
    getDoc,
    onSnapshot,
    serverTimestamp,
    Timestamp,
    updateDoc,
    writeBatch,
    type FieldValue,
    type WriteBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { freeCode } from "./freeCode";
import { nameKey } from "./freeName";
import { JOIN_TIMEOUT_MS } from "./partyFirestore";

/** What an activity is: a quiz room or a scoreboard party. */
export type NightActivityKind = "quiz" | "scoreboard";

/** One thing played in a night: the code of its room or party, and what to call it. */
export interface NightActivity {
    kind: NightActivityKind;
    code: string;
    title: string;
}

export interface Night {
    code: string;
    hostId: string;
    title: string;
    /** In the order they were added, up to 20. */
    activities: NightActivity[];
    /** The evening is over: nobody joins, nothing is added. */
    closed: boolean;
    /** The fresh night the guests were carried on to (moveNight), once. */
    movedTo?: string;
    createdAt?: Timestamp | FieldValue;
    /** When the night can be deleted (a Firestore TTL policy, see the docs). */
    expireAt?: Timestamp;
}

export interface NightGuest {
    id: string;
    name: string;
}

/** How long a night's data is kept. The expireAt field, for a TTL policy. */
export const NIGHT_LIFETIME_DAYS = 30;

const requireDb = () => {
    if (!db) throw new Error("Firebase not initialized");
    return db;
};

/** When a document written now can be deleted: NIGHT_LIFETIME_DAYS from now. */
const expiry = () => Timestamp.fromMillis(Date.now() + NIGHT_LIFETIME_DAYS * 24 * 60 * 60 * 1000);

/** Whether a night has this code. */
export const nightExists = async (code: string): Promise<boolean> =>
    (await getDoc(doc(requireDb(), "nights", code))).exists();

/**
 * Add a guest and their claim on `name` to `batch`: the rules want both in
 * one write (a guest needs their claim, a claim needs its guest), so a name
 * is never held by nobody on the roster.
 */
const addJoin = (batch: WriteBatch, code: string, guestId: string, name: string) => {
    const firestore = requireDb();
    batch.set(doc(firestore, "nights", code, "names", nameKey(name)), { name, guestId, expireAt: expiry() });
    batch.set(doc(firestore, "nights", code, "guests", guestId), { name, joinedAt: serverTimestamp(), expireAt: expiry() });
};

/**
 * Start a night under a fresh code and return the code. The code is free
 * among rooms, parties and nights (freeCode); it is tried again if the
 * create rule refuses an existing one. The host joins in the same batch
 * under `hostName` (their guest and claim), as for a party.
 */
export const createNight = async (title: string, hostId: string, hostName: string): Promise<string> => {
    const database = requireDb();
    for (let attempt = 0; attempt < 5; attempt++) {
        const code = await freeCode();
        const ref = doc(database, "nights", code);
        try {
            const batch = writeBatch(database);
            batch.set(ref, {
                code,
                hostId,
                title,
                activities: [],
                closed: false,
                createdAt: serverTimestamp(),
                expireAt: expiry(),
            });
            addJoin(batch, code, hostId, hostName);
            await batch.commit();
        } catch (error) {
            // Another host took this code between the check and the write:
            // the write then counts as an update, which the rules refuse. Any
            // other refusal (of the host's claim or guest) is the real error.
            if ((error as { code?: string }).code === "permission-denied") {
                const taken = await getDoc(ref).then(snapshot => snapshot.exists(), () => false);
                if (taken) continue;
            }
            throw error;
        }
        return code;
    }
    throw new Error("Couldn't find a free night code. Try again.");
};

/**
 * Join a night under `name`: the guest and their claim in one batch. The
 * rules only ever create a claim, so if another guest took the name first the
 * batch is refused and nothing is written. Resolves `true` when the name is
 * this guest's (also when an earlier try with the same `guestId` already
 * claimed it), `false` when someone else has it. Offline, a write waits rather
 * than fails, so after JOIN_TIMEOUT_MS this rejects; the queued write may
 * still land, which a retry with the same `guestId` then finds. A closed
 * night refuses the join like a taken name does, but with no claim to find,
 * so the refusal is rethrown.
 */
export const joinNight = async (code: string, guestId: string, name: string): Promise<boolean> => {
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
        const claim = await getDoc(doc(firestore, "nights", code, "names", nameKey(name)));
        if (!claim.exists()) throw error;
        return claim.data().guestId === guestId;
    } finally {
        clearTimeout(timer);
    }
};

/**
 * Leave a night: the guest and their claim on `name` are deleted in one
 * batch (the rules want both together), so the name is free again. `name` is
 * the one the guest joined with.
 */
export const leaveNight = async (code: string, guestId: string, name: string): Promise<void> => {
    const firestore = requireDb();
    const batch = writeBatch(firestore);
    batch.delete(doc(firestore, "nights", code, "guests", guestId));
    batch.delete(doc(firestore, "nights", code, "names", nameKey(name)));
    await batch.commit();
};

/** Follow a night. `onNight(null)` when it doesn't exist. Returns the unsubscribe. */
export const listenToNight = (code: string, onNight: (night: Night | null) => void, onError?: (error: Error) => void) =>
    onSnapshot(
        doc(requireDb(), "nights", code),
        snapshot => onNight(snapshot.exists() ? toNight(snapshot.data() as Night) : null),
        error => onError?.(error),
    );

/**
 * A night as it comes from Firestore. The rules check each activity when it
 * is added, but a night's list is still tidied here, so a screen never meets
 * an entry it can't open.
 */
const toNight = (night: Night): Night => ({
    ...night,
    activities: (Array.isArray(night.activities) ? night.activities : []).filter(isNightActivity),
});

const isNightActivity = (value: unknown): value is NightActivity => {
    const activity = value as NightActivity | null;
    return !!activity && (activity.kind === "quiz" || activity.kind === "scoreboard") &&
        typeof activity.code === "string" && /^[A-Z]{4}$/.test(activity.code) && typeof activity.title === "string";
};

/** Follow the roster, in the order guests joined. */
export const listenToGuests = (code: string, onGuests: (guests: NightGuest[]) => void, onError?: (error: Error) => void) =>
    onSnapshot(
        collection(requireDb(), "nights", code, "guests"),
        snapshot => onGuests(
            snapshot.docs
                .map(entry => ({ guest: toGuest(entry.id, entry.data()), joinedAt: joinedAtMillis(entry.data().joinedAt) }))
                .sort((a, b) => a.joinedAt - b.joinedAt)
                .map(entry => entry.guest),
        ),
        error => onError?.(error),
    );

const toGuest = (id: string, data: Record<string, unknown>): NightGuest => ({
    id,
    name: typeof data.name === "string" ? data.name : "Guest",
});

/** When a guest joined, for ordering. A join still pending on this device has no time yet: last. */
const joinedAtMillis = (joinedAt: unknown): number => {
    const stamp = joinedAt as { toMillis?: () => number } | null | undefined;
    return typeof stamp?.toMillis === "function" ? stamp.toMillis() : Number.MAX_SAFE_INTEGER;
};

/** Read one guest, e.g. to find out after a reload whether this device is still on the roster. */
export const fetchNightGuest = async (code: string, guestId: string): Promise<NightGuest | null> => {
    const snapshot = await getDoc(doc(requireDb(), "nights", code, "guests", guestId));
    return snapshot.exists() ? toGuest(guestId, snapshot.data()) : null;
};

/**
 * List an activity in the night (an arrayUnion). The rules accept it only
 * when the room or party it names exists and was made for this night
 * (`nightCode`), so create that first.
 */
export const addNightActivity = (code: string, activity: NightActivity) =>
    updateDoc(doc(requireDb(), "nights", code), { activities: arrayUnion(activity) });

/** End the evening: nobody joins and nothing is added after this. */
export const closeNight = (code: string) =>
    updateDoc(doc(requireDb(), "nights", code), { closed: true });

/**
 * Carry the guests on to a fresh night, `toCode` (made by the same host,
 * open, with no activities yet): this one is closed and points at it. Once.
 */
export const moveNight = (code: string, toCode: string) =>
    updateDoc(doc(requireDb(), "nights", code), { movedTo: toCode, closed: true });
