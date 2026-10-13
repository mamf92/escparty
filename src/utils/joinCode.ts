/**
 * The one code field on the Join screen: a quiz room, a scoreboard party and
 * a party night all have a four-letter code (generateRoomCode), in their own
 * collections, so a typed or scanned code is looked up in all three.
 */
import { getRoom } from "./roomsFirestore";
import { partyExists } from "./partyFirestore";
import { nightExists } from "./nightsFirestore";

export const CODE_LENGTH = 4;
export const CODE_PATTERN = /^[A-Z]{4}$/;

/** What a code field keeps of what was typed: four letters, upper case. */
export const cleanCode = (typed: string): string =>
    typed.toUpperCase().replace(/[^A-Z]/g, "").slice(0, CODE_LENGTH);

/**
 * The code in a scanned QR code: the big screen's party link
 * (`…#/party/ABBA`), a party night's link (`…#/n/ABBA`), a join link
 * (`…#/join/ABBA`) or a bare code.
 * Null for anything else, so a stray QR code is never joined.
 */
export const codeFromScan = (text: string): string | null => {
    const trimmed = text.trim();
    const link = /#\/(?:party|join|n)\/([A-Za-z]{4})(?![A-Za-z])/.exec(trimmed);
    if (link) return link[1].toUpperCase();
    return /^[A-Za-z]{4}$/.test(trimmed) ? trimmed.toUpperCase() : null;
};

/**
 * The link a QR code carries to bring a phone to Join with this code
 * looked up: `<this site>#/join/ABBA` (the app is a HashRouter).
 */
export const joinLink = (code: string): string =>
    `${window.location.origin}${window.location.pathname}#/join/${code}`;

/**
 * The link a party night's QR code and TV screen carry:
 * `<this site>#/n/ABBA`, the night's home (#233).
 */
export const nightLink = (code: string): string =>
    `${window.location.origin}${window.location.pathname}#/n/${code}`;

export type GameKind = "quiz" | "party" | "night";

/**
 * Which game a code opens, or null when nothing has it. New codes are drawn
 * free across rooms, parties and nights (freeCode, #232), so a clash can only
 * come from codes made before that. Then: a lobby quiz room still taking
 * players (or the one this device was playing in) wins, as it always has,
 * because someone typing a code on the sofa usually means the quiz that is
 * about to start; then the night, the newest and widest thing a code can be
 * (it holds activities, so its guests are in the right place for any of
 * them); then the party, which anyone can join at any time; and last a quiz
 * room that is already running, which only its own players can still use.
 */
export const findGame = async (code: string): Promise<GameKind | null> => {
    const [room, night, party] = await Promise.all([getRoom(code), nightExists(code), partyExists(code)]);
    const mine = room && localStorage.getItem("gameCode") === code;
    if (room && (mine || (room.phase ?? "lobby") === "lobby")) return "quiz";
    if (night) return "night";
    if (party) return "party";
    return room ? "quiz" : null;
};
