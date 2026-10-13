import { describe, expect, it } from "vitest";
import { isDenied, settleRefusal } from "./firestoreRefusal";

const denied = Object.assign(new Error("denied"), { code: "permission-denied" });
const offline = Object.assign(new Error("offline"), { code: "unavailable" });

describe("isDenied", () => {
    it("is true only for a rules refusal", () => {
        expect(isDenied(denied)).toBe(true);
        expect(isDenied(offline)).toBe(false);
        expect(isDenied(null)).toBe(false);
        expect(isDenied("nope")).toBe(false);
    });
});

describe("settleRefusal", () => {
    it("counts a refused write as done when the state is already there", async () => {
        await expect(settleRefusal(denied, async () => true)).resolves.toBeUndefined();
    });

    it("keeps the refusal when the state isn't there, or can't be read", async () => {
        await expect(settleRefusal(denied, async () => false)).rejects.toBe(denied);
        await expect(settleRefusal(denied, async () => { throw offline; })).rejects.toBe(denied);
    });

    it("never reads for other failures", async () => {
        let read = false;
        await expect(settleRefusal(offline, async () => (read = true))).rejects.toBe(offline);
        expect(read).toBe(false);
    });
});
