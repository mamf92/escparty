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
    type DocumentReference,
    type DocumentSnapshot,
    type FieldValue,
    type WriteBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { expiryFromNow } from "./expiry";
import { freeCode } from "./freeCode";
import { isDenied, settleRefusal } from "./firestoreRefusal";
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
const expiry = () => expiryFromNow(NIGHT_LIFETIME_DAYS);

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
            if (isDenied(error)) {
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
 * night refuses every join: that refusal is rethrown, also when someone else
 * holds the name, so `false` only ever means taken in an open night.
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
        if (!isDenied(error)) throw error;
        const claim = await getDoc(doc(firestore, "nights", code, "names", nameKey(name)));
        if (!claim.exists()) throw error;
        if (claim.data().guestId === guestId) return true;
        // Someone else has the name, but a closed night would refuse any
        // name: say that, not "taken", or the guest just spins again.
        const night = await getDoc(doc(firestore, "nights", code));
        if (night.exists() && night.data().closed === true) throw error;
        return false;
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
    const guest = doc(firestore, "nights", code, "guests", guestId);
    const batch = writeBatch(firestore);
    batch.delete(guest);
    batch.delete(doc(firestore, "nights", code, "names", nameKey(name)));
    // A retry after a leave that went through (its answer lost) deletes
    // documents that are gone, which the rules refuse: done all the same.
    await batch.commit().catch(error => settleRefusal(error, async () => !(await getDoc(guest)).exists()));
};

/** Follow a night. `onNight(null)` when it doesn't exist. Returns the unsubscribe. */
export const listenToNight = (code: string, onNight: (night: Night | null) => void, onError?: (error: Error) => void) =>
    onSnapshot(
        doc(requireDb(), "nights", code),
        snapshot => onNight(fromSnapshot(snapshot)),
        error => onError?.(error),
    );

/**
 * A night as it comes from Firestore. The rules check each activity when it
 * is added, but a night's list is still tidied here, so a screen never meets
 * an entry it can't open.
 */
const fromSnapshot = (snapshot: DocumentSnapshot): Night | null =>
    snapshot.exists() ? toNight(snapshot.data() as Night) : null;

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
                .map(entry => {
                    const data = entry.data();
                    return { guest: toGuest(entry.id, data), joinedAt: joinedAtMillis(data.joinedAt) };
                })
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

/** Read a night once, e.g. to number its next quiz from what is listed now. */
export const fetchNight = async (code: string): Promise<Night | null> =>
    readNight(doc(requireDb(), "nights", code));

/**
 * List an activity in the night (an arrayUnion). The rules accept it only
 * when the room or party it names exists and was made for this night
 * (`nightCode`), so create that first.
 */
export const addNightActivity = async (code: string, activity: NightActivity): Promise<void> => {
    const ref = doc(requireDb(), "nights", code);
    // A retry of an add that went through changes nothing (arrayUnion skips
    // an entry equal in every field), which the rules refuse, since the
    // list must grow by one: done all the same.
    await updateDoc(ref, { activities: arrayUnion(activity) }).catch(error => settleRefusal(error, async () =>
        (await readNight(ref))?.activities.some(listed =>
            listed.kind === activity.kind && listed.code === activity.code && listed.title === activity.title) === true));
};

/** End the evening: nobody joins and nothing is added after this. */
export const closeNight = async (code: string): Promise<void> => {
    const ref = doc(requireDb(), "nights", code);
    // Closing a closed night (a retry) is refused, and already done.
    await updateDoc(ref, { closed: true }).catch(error => settleRefusal(error, async () =>
        (await readNight(ref))?.closed === true));
};

/**
 * Carry the guests on to a fresh night, `toCode` (made by the same host,
 * open, with no activities yet): this one is closed and points at it. Once.
 */
export const moveNight = async (code: string, toCode: string): Promise<void> => {
    const ref = doc(requireDb(), "nights", code);
    // A retry of a move that went through is refused (movedTo is set once):
    // done when it points where this one would have.
    await updateDoc(ref, { movedTo: toCode, closed: true }).catch(error => settleRefusal(error, async () =>
        (await readNight(ref))?.movedTo === toCode));
};

const readNight = async (ref: DocumentReference): Promise<Night | null> => fromSnapshot(await getDoc(ref));
