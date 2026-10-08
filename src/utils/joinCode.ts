/**
 * The one code field on the Join screen: a quiz room and a scoreboard party
 * both have a four-letter code (generateRoomCode), in their own
 * collections, so a typed or scanned code is looked up in both.
 */
import { getRoom } from "./roomsFirestore";
import { partyExists } from "./partyFirestore";

export const CODE_LENGTH = 4;
export const CODE_PATTERN = /^[A-Z]{4}$/;

/** What a code field keeps of what was typed: four letters, upper case. */
export const cleanCode = (typed: string): string =>
    typed.toUpperCase().replace(/[^A-Z]/g, "").slice(0, CODE_LENGTH);

/**
 * The code in a scanned QR code: the big screen's party link
 * (`…#/party/ABBA`), a join link (`…#/join/ABBA`) or a bare code.
 * Null for anything else, so a stray QR code is never joined.
 */
export const codeFromScan = (text: string): string | null => {
    const trimmed = text.trim();
    const link = /#\/(?:party|join)\/([A-Za-z]{4})(?![A-Za-z])/.exec(trimmed);
    if (link) return link[1].toUpperCase();
    return /^[A-Za-z]{4}$/.test(trimmed) ? trimmed.toUpperCase() : null;
};

export type GameKind = "quiz" | "party";

/**
 * Which game a code opens, or null when nothing has it. Should a quiz
 * room and a party ever share a code, a room still taking players (or the
 * one this device was playing in) wins; otherwise the party, which anyone
 * can join at any time.
 */
export const findGame = async (code: string): Promise<GameKind | null> => {
    const [room, party] = await Promise.all([getRoom(code), partyExists(code)]);
    if (room && party) {
        const mine = localStorage.getItem("gameCode") === code;
        return mine || (room.phase ?? "lobby") === "lobby" ? "quiz" : "party";
    }
    if (room) return "quiz";
    return party ? "party" : null;
};
