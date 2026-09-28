import type { Player, Room } from "./roomsFirestore";

// Who's who in a room, read from the room itself (#63). Pages used to work
// this out from localStorage "isHost"/"hostIsObserver", which every tab
// shares and which outlives a game, so a guest could be treated as the host
// or the real observer host as a player.

/** Whether `playerId` is this room's host and only observes (never plays). */
export const isObserverHost = (
    room: Pick<Room, "hostId" | "hostIsObserver"> | null | undefined,
    playerId: string | null | undefined,
): boolean => isRoomHost(room, playerId) && room?.hostIsObserver === true;

/** The room's players, without the host when the host only observes. */
export const playingPlayers = (room: Pick<Room, "hostId" | "hostIsObserver" | "players">): Player[] =>
    room.hostIsObserver ? room.players.filter(p => p.id !== room.hostId) : room.players;

/** Whether `playerId` is this room's host (playing or observing). */
export const isRoomHost = (
    room: Pick<Room, "hostId"> | null | undefined,
    playerId: string | null | undefined,
): boolean => !!room && !!playerId && room.hostId === playerId;
