import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    clearNightIdentity,
    clearPendingNightJoin,
    lastNightCode,
    readNightIdentity,
    readPendingNightJoin,
    saveNightIdentity,
    savePendingNightJoin,
} from "./nightSession";

const me = { guestId: "g1", name: "Jedward" };

beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
});

describe("identity", () => {
    it("is kept per night, and remembers the last night", () => {
        expect(readNightIdentity("ABBA")).toBeNull();
        expect(lastNightCode()).toBeNull();
        saveNightIdentity("ABBA", me);
        expect(readNightIdentity("ABBA")).toEqual(me);
        expect(readNightIdentity("LORD")).toBeNull();
        expect(lastNightCode()).toBe("ABBA");
    });

    it("ignores what doesn't look like one", () => {
        localStorage.setItem("escparty.night.ABBA", JSON.stringify({ guestId: "", name: "x" }));
        expect(readNightIdentity("ABBA")).toBeNull();
        localStorage.setItem("escparty.night.ABBA", "{broken");
        expect(readNightIdentity("ABBA")).toBeNull();
        localStorage.setItem("escparty.lastNight", JSON.stringify("ABBA"));
        expect(lastNightCode()).toBeNull();
        localStorage.setItem("escparty.lastNight", JSON.stringify("abba"));
        expect(lastNightCode()).toBeNull();
    });

    it("offers no way back to a night without a stored identity", () => {
        saveNightIdentity("ABBA", me);
        localStorage.removeItem("escparty.night.ABBA");
        expect(lastNightCode()).toBeNull();
    });

    it("is forgotten on clear, with the pointer and a pending join, but only its own pointer", () => {
        saveNightIdentity("ABBA", me);
        savePendingNightJoin("ABBA", { guestId: "g2", name: "Lordi" });
        saveNightIdentity("LORD", me);
        clearNightIdentity("ABBA");
        expect(readNightIdentity("ABBA")).toBeNull();
        expect(readPendingNightJoin("ABBA")).toBeNull();
        expect(lastNightCode()).toBe("LORD");
        clearNightIdentity("LORD");
        expect(lastNightCode()).toBeNull();
    });

    it("survives storage that throws", () => {
        vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
            throw new Error("full");
        });
        vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
            throw new Error("blocked");
        });
        vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
            throw new Error("blocked");
        });
        expect(() => saveNightIdentity("ABBA", me)).not.toThrow();
        expect(() => clearNightIdentity("ABBA")).not.toThrow();
        expect(() => savePendingNightJoin("ABBA", me)).not.toThrow();
        expect(() => clearPendingNightJoin("ABBA")).not.toThrow();
        expect(readNightIdentity("ABBA")).toBeNull();
        expect(readPendingNightJoin("ABBA")).toBeNull();
        expect(lastNightCode()).toBeNull();
    });
});

describe("pending join", () => {
    it("is kept until cleared, so a retry reuses the same guest id", () => {
        expect(readPendingNightJoin("ABBA")).toBeNull();
        savePendingNightJoin("ABBA", { guestId: "g2", name: "Lordi" });
        expect(readPendingNightJoin("ABBA")).toEqual({ guestId: "g2", name: "Lordi" });
        clearPendingNightJoin("ABBA");
        expect(readPendingNightJoin("ABBA")).toBeNull();
    });

    it("ignores what doesn't look like one", () => {
        localStorage.setItem("escparty.night.ABBA.joining", JSON.stringify({ guestId: "g", name: "" }));
        expect(readPendingNightJoin("ABBA")).toBeNull();
    });
});
