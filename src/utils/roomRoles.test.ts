import { describe, expect, it } from "vitest";
import { isObserverHost, playingPlayers } from "./roomRoles";

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

describe("playingPlayers", () => {
    it("leaves out an observing host", () => {
        expect(playingPlayers({ hostId: "host-1", hostIsObserver: true, players }).map(p => p.id)).toEqual(["p-2"]);
    });

    it("keeps a host who plays", () => {
        expect(playingPlayers({ hostId: "host-1", hostIsObserver: false, players })).toBe(players);
    });
});
