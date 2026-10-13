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
import { isDenied } from "./firestoreRefusal";

/** The collections that hold a code. */
const CODE_COLLECTIONS = ["rooms", "parties", "nights"] as const;

/** How many codes to try before giving up. */
const ATTEMPTS = 5;

/**
 * Draw codes until one is free in every collection. The check is a read, so
 * another host can still take the code before the caller writes it. In the
 * same collection the create rule refuses that write and the caller can
 * retry (createParty, createNight); across collections nothing refuses it,
 * but two hosts drawing one code in the same instant out of 457,000 is rare
 * enough to leave to the Join screen's lookup order (findGame, joinCode.ts).
 *
 * A lookup the rules refuse counts as free rather than failing the whole
 * draw: a build running against rules from before #232 can't read `nights`,
 * and creating a room shouldn't depend on that. Any other failure (offline)
 * is thrown, so the caller says to check the connection rather than writing
 * an unchecked code that waits forever.
 */
export const freeCode = async (): Promise<string> => {
    if (!db) throw new Error("Firebase not initialized");
    const database = db;
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
        const code = generateRoomCode();
        const taken = await Promise.all(
            CODE_COLLECTIONS.map(name => getDoc(doc(database, name, code)).then(
                snapshot => snapshot.exists(),
                error => {
                    if (isDenied(error)) return false;
                    throw error;
                },
            )),
        );
        if (!taken.some(Boolean)) return code;
    }
    throw new Error("Couldn't find a free code. Try again.");
};
