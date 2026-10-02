import type { Room } from "./roomsFirestore";

export interface StartGate {
    /** "yes" when everyone's ready, "anyway" when the host may override, "no" when there's nobody to play. */
    canStart: "yes" | "anyway" | "no";
    /** What the host is told about it. */
    message: string;
}

/** Everyone in the room but the host: who has to be ready, and who the host can take out. */
export const roomGuests = (room: Pick<Room, "hostId" | "players">) => room.players.filter(p => p.id !== room.hostId);

/**
 * Whether the host can start (#65): once at least one guest has joined and
 * every guest is ready. Before that a playing host can still "Start anyway"
 * (a solo test run, or a guest who never taps), but an observer host needs
 * someone to play.
 */
export const startGate = (room: Pick<Room, "hostId" | "hostIsObserver" | "players" | "readyPlayers">): StartGate => {
    const guests = roomGuests(room);
    const ready = room.readyPlayers ?? [];
    const waiting = guests.filter(p => !ready.includes(p.id));

    if (guests.length === 0) {
        return room.hostIsObserver
            ? { canStart: "no", message: "Nobody has joined yet. Share the code to get the show going." }
            : { canStart: "anyway", message: "Nobody has joined yet. Share the code, or start anyway to play alone." };
    }
    if (waiting.length === 0) {
        return { canStart: "yes", message: guests.length === 1 ? "Your guest is ready." : `All ${guests.length} guests are ready.` };
    }
    const names = waiting.map(p => p.name);
    const who = names.length <= 2 ? names.join(" and ") : `${names.length} guests`;
    return { canStart: "anyway", message: `Waiting for ${who} to be ready.` };
};
