import { afterEach, describe, expect, it, vi } from "vitest";
import { readMultiplayerGame } from "./multiplayerSession";

describe("readMultiplayerGame", () => {
    afterEach(() => sessionStorage.clear());

    it("reads the stored game", () => {
        sessionStorage.setItem("multiplayerGame", JSON.stringify({ multiplayer: true, roomCode: "ABCD", playerId: "p-2", difficulty: "hard", hostIsObserver: true }));
        expect(readMultiplayerGame()).toEqual({ multiplayer: true, roomCode: "ABCD", playerId: "p-2", difficulty: "hard" });
    });

    it("leaves difficulty out when it isn't stored", () => {
        sessionStorage.setItem("multiplayerGame", JSON.stringify({ multiplayer: true, roomCode: "ABCD", playerId: "p-2" }));
        expect(readMultiplayerGame()?.difficulty).toBeUndefined();
    });

    it("is null without a stored game, or with one missing its room or player", () => {
        expect(readMultiplayerGame()).toBeNull();
        sessionStorage.setItem("multiplayerGame", JSON.stringify({ roomCode: "ABCD" }));
        expect(readMultiplayerGame()).toBeNull();
    });

    it("is null (and logs) when the stored value isn't JSON", () => {
        const log = vi.spyOn(console, "error").mockImplementation(() => { });
        sessionStorage.setItem("multiplayerGame", "{not json");
        expect(readMultiplayerGame()).toBeNull();
        expect(log).toHaveBeenCalled();
    });
});
