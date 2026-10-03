import { afterEach, describe, expect, it, vi } from "vitest";
import { focusSoon } from "./focusSoon";

describe("focusSoon", () => {
    afterEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = "";
    });

    it("finds and focuses the element on the next frame, not before", () => {
        let frame: FrameRequestCallback | undefined;
        vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => {
            frame = callback;
            return 1;
        });
        const find = vi.fn(() => document.getElementById("later"));
        focusSoon(find);
        expect(find).not.toHaveBeenCalled();

        const button = document.createElement("button");
        button.id = "later";
        document.body.append(button);
        frame?.(0);
        expect(document.activeElement).toBe(button);
    });

    it("does nothing when the element isn't there", () => {
        vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => {
            callback(0);
            return 1;
        });
        expect(() => focusSoon(() => null)).not.toThrow();
    });
});
