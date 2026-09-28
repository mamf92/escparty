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

/**
 * Whether `playerId` belongs on the observer screen (HostObserverView) right
 * now: the room's observer host, while the game is on. A finished room sends
 * the observer to the results like everyone else, which also clears a
 * leftover sessionStorage game, and a room from before #61 (no phase, so
 * no break to continue from) goes to the quiz page's "start a new room"
 * error instead. Lobby, the quiz page and the break screen route by this.
 */
export const shouldObserve = (
    room: Pick<Room, "hostId" | "hostIsObserver" | "phase"> | null | undefined,
    playerId: string | null | undefined,
): boolean => isObserverHost(room, playerId) && !!room?.phase && room.phase !== "results";

/** The router state HostObserverView expects; see observerRouteState. */
export interface ObserverRouteState {
    players: Player[];
    roomCode: string;
    playerId: string | null;
}

/**
 * What every redirect to /host-observer hands over (Lobby, the quiz page
 * and the break screen), built in one place so none of them drops a field
 * the observer screen needs, like `playerId` for its Continue.
 */
export const observerRouteState = (
    room: Pick<Room, "hostId" | "hostIsObserver" | "players">,
    roomCode: string,
    playerId: string | null,
): ObserverRouteState => ({
    players: playingPlayers(room),
    roomCode,
    playerId,
});

/**
 * What every multiplayer screen shows for a room created before #61: it has
 * no phase to follow, and the old fixed-delay path for it is gone (#63).
 * Rooms only live for one game, so this only catches a tab left open from
 * before the upgrade.
 */
export const LEGACY_ROOM_MESSAGE = "This room was set up by an older version of the app. Start a new room to play.";
