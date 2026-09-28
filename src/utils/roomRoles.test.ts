import { describe, expect, it } from "vitest";
import { isObserverHost, isRoomHost, observerRouteState, playingPlayers, shouldObserve } from "./roomRoles";

const players = [
    { id: "host-1", name: "Host", score: 0 },
    { id: "p-2", name: "Guest", score: 500 },
];

describe("isObserverHost", () => {
    it("is true only for the host of a room whose host observes", () => {
        const room = { hostId: "host-1", hostIsObserver: true };
        expect(isObserverHost(room, "host-1")).toBe(true);
        expect(isObserverHost(room, "p-2")).toBe(false);
    });

    it("is false when the host plays, or without a room or player", () => {
        expect(isObserverHost({ hostId: "host-1", hostIsObserver: false }, "host-1")).toBe(false);
        expect(isObserverHost({ hostId: "host-1" }, "host-1")).toBe(false);
        expect(isObserverHost(null, "host-1")).toBe(false);
        expect(isObserverHost({ hostId: "host-1", hostIsObserver: true }, null)).toBe(false);
    });
});

describe("isRoomHost", () => {
    it("is true for the host whether or not they observe", () => {
        expect(isRoomHost({ hostId: "host-1" }, "host-1")).toBe(true);
        expect(isRoomHost({ hostId: "host-1" }, "p-2")).toBe(false);
        expect(isRoomHost(undefined, "host-1")).toBe(false);
        expect(isRoomHost({ hostId: "host-1" }, undefined)).toBe(false);
    });
});

describe("shouldObserve", () => {
    const room = { hostId: "host-1", hostIsObserver: true };

    it("sends the observer host to the observer screen while the game is on", () => {
        expect(shouldObserve({ ...room, phase: "question" }, "host-1")).toBe(true);
        expect(shouldObserve({ ...room, phase: "mid-scoreboard" }, "host-1")).toBe(true);
    });

    it("not once the room has finished, nor anyone but the observer host", () => {
        expect(shouldObserve({ ...room, phase: "results" }, "host-1")).toBe(false);
        expect(shouldObserve({ ...room, phase: "question" }, "p-2")).toBe(false);
    });
});

describe("observerRouteState", () => {
    it("hands over the room's position, the players without the observer, and who's viewing", () => {
        const room = { hostId: "host-1", hostIsObserver: true, players, currentQuestionIndex: 5, difficulty: "hard" };
        expect(observerRouteState(room, "ABCD", "host-1")).toEqual({
            currentQuestionIndex: 5,
            difficulty: "hard",
            players: [players[1]],
            roomCode: "ABCD",
            playerId: "host-1",
        });
    });

    it("starts at question 0 when the room has no index", () => {
        expect(observerRouteState({ hostId: "host-1", players }, "ABCD", null).currentQuestionIndex).toBe(0);
    });
});

describe("playingPlayers", () => {
    it("leaves out an observing host", () => {
        expect(playingPlayers({ hostId: "host-1", hostIsObserver: true, players }).map(p => p.id)).toEqual(["p-2"]);
    });

    it("keeps a host who plays", () => {
        expect(playingPlayers({ hostId: "host-1", hostIsObserver: false, players })).toBe(players);
    });
});
