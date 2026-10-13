/**
 * A 4-letter code nothing uses yet (#232). Quiz rooms, scoreboard parties and
 * party nights each keep their codes in their own collection, but the Join
 * screen takes one code field for all of them, so a code must be free in all
 * three: a code that is a room and also a night would open whichever the
 * screen asks first.
 */
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { generateRoomCode } from "./roomsFirestore";

/** The collections that hold a code. */
const CODE_COLLECTIONS = ["rooms", "parties", "nights"] as const;

/** How many codes to try before giving up. */
const ATTEMPTS = 5;

/**
 * Draw codes until one is free in every collection. The check is a read, so
 * another host can still take the code before the caller writes it; the
 * create rules refuse that write, and callers that can retry do (createParty,
 * createNight).
 */
export const freeCode = async (): Promise<string> => {
    if (!db) throw new Error("Firebase not initialized");
    const database = db;
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
        const code = generateRoomCode();
        const taken = await Promise.all(
            CODE_COLLECTIONS.map(async name => (await getDoc(doc(database, name, code))).exists()),
        );
        if (!taken.some(Boolean)) return code;
    }
    throw new Error("Couldn't find a free code. Try again.");
};
