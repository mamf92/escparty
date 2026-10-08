import { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NamePicker } from "./NamePicker";

const NAMES = ["Loreen", "Nemo", "Lordi", "Netta"];

const Harness = ({ onPick }: { onPick?: (name: string) => void }) => {
    const [value, setValue] = useState<string | null>(null);
    return <NamePicker names={NAMES} value={value} onChange={name => { setValue(name); onPick?.(name); }} />;
};

const reducedMotion = (reduced: boolean) =>
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: reduced, media: query, addEventListener: () => {}, removeEventListener: () => {} }));

describe("NamePicker", () => {
    beforeEach(() => reducedMotion(true));
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it("starts with no name picked, and offers no way to type one", () => {
        render(<Harness />);
        expect(screen.getByRole("spinbutton", { name: "Your name" })).toHaveAttribute("aria-valuetext", "No name yet");
        expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
        expect(screen.getByRole("status")).toHaveTextContent("Spin the reel");
    });

    it("steps through the names with the buttons and wraps around", async () => {
        const user = userEvent.setup();
        render(<Harness />);
        await user.click(screen.getByRole("button", { name: "Next name" }));
        expect(screen.getByRole("status")).toHaveTextContent("You're Loreen.");
        await user.click(screen.getByRole("button", { name: "Previous name" }));
        expect(screen.getByRole("status")).toHaveTextContent("You're Netta.");
        await user.click(screen.getByRole("button", { name: "Next name" }));
        expect(screen.getByRole("status")).toHaveTextContent("You're Loreen.");
    });

    it("starts from the end when the first step is backwards", async () => {
        render(<Harness />);
        await userEvent.setup().click(screen.getByRole("button", { name: "Previous name" }));
        expect(screen.getByRole("status")).toHaveTextContent("You're Netta.");
    });

    it("is a spin button for the keyboard and screen readers", async () => {
        const user = userEvent.setup();
        render(<Harness />);
        const reel = screen.getByRole("spinbutton", { name: "Your name" });
        reel.focus();
        await user.keyboard("{ArrowDown}{ArrowDown}");
        expect(reel).toHaveAttribute("aria-valuetext", "Nemo");
        expect(reel).toHaveAttribute("aria-valuenow", "2");
        await user.keyboard("{ArrowUp}");
        expect(reel).toHaveAttribute("aria-valuetext", "Loreen");
        await user.keyboard("{End}");
        expect(reel).toHaveAttribute("aria-valuetext", "Netta");
        await user.keyboard("{Home}");
        expect(reel).toHaveAttribute("aria-valuetext", "Loreen");
    });

    it("steps on a swipe and on the wheel", () => {
        render(<Harness />);
        const reel = screen.getByRole("spinbutton", { name: "Your name" });
        fireEvent.pointerDown(reel, { clientY: 200, pointerId: 1 });
        fireEvent.pointerMove(reel, { clientY: 190, pointerId: 1 });
        expect(reel).toHaveAttribute("aria-valuetext", "No name yet");
        fireEvent.pointerMove(reel, { clientY: 100, pointerId: 1 });
        expect(reel).toHaveAttribute("aria-valuetext", "Loreen");
        fireEvent.pointerUp(reel, { pointerId: 1 });
        fireEvent.pointerMove(reel, { clientY: 0, pointerId: 1 });
        expect(reel).toHaveAttribute("aria-valuetext", "Loreen");
        fireEvent.wheel(reel, { deltaY: 100 });
        expect(reel).toHaveAttribute("aria-valuetext", "Nemo");
    });

    it("jumps straight to a name when motion is reduced", async () => {
        vi.spyOn(Math, "random").mockReturnValue(0.5);
        const onPick = vi.fn();
        render(<Harness onPick={onPick} />);
        await userEvent.setup().click(screen.getByRole("button", { name: "Spin for a name" }));
        expect(onPick).toHaveBeenCalledOnce();
        expect(onPick).toHaveBeenCalledWith("Lordi");
        expect(screen.getByRole("button", { name: "Spin again" })).toBeEnabled();
    });

    it("ticks past other names, then lands on one, when motion is allowed", () => {
        reducedMotion(false);
        vi.useFakeTimers();
        vi.spyOn(Math, "random").mockReturnValue(0);
        const onPick = vi.fn();
        render(<Harness onPick={onPick} />);
        fireEvent.click(screen.getByRole("button", { name: "Spin for a name" }));
        expect(screen.getByRole("status")).toHaveTextContent("Spinning…");
        expect(screen.getByRole("button", { name: "Next name" })).toBeDisabled();
        expect(screen.getByRole("spinbutton", { name: "Your name" })).toHaveAttribute("aria-busy", "true");
        expect(onPick).not.toHaveBeenCalled();
        act(() => { vi.runAllTimers(); });
        expect(onPick).toHaveBeenCalledOnce();
        expect(screen.getByRole("status")).toHaveTextContent(/^You're /);
        expect(screen.getByRole("button", { name: "Next name" })).toBeEnabled();
    });

    it("stops its timer when it goes away mid-spin", () => {
        reducedMotion(false);
        vi.useFakeTimers();
        const { unmount } = render(<Harness />);
        fireEvent.click(screen.getByRole("button", { name: "Spin for a name" }));
        unmount();
        expect(vi.getTimerCount()).toBe(0);
    });

    it("never spins again onto the name it already has, with or without motion", async () => {
        for (const reduced of [true, false]) {
            reducedMotion(reduced);
            for (const random of [0, 0.25, 0.5, 0.75, 0.999]) {
                vi.useFakeTimers();
                vi.spyOn(Math, "random").mockReturnValue(random);
                const onPick = vi.fn();
                const { unmount } = render(<Harness onPick={onPick} />);
                for (let spins = 0; spins < 3; spins++) {
                    fireEvent.click(screen.getByRole("button", { name: spins === 0 ? "Spin for a name" : "Spin again" }));
                    act(() => { vi.runAllTimers(); });
                }
                const picks = onPick.mock.calls.map(call => call[0]);
                expect(picks).toHaveLength(3);
                picks.slice(1).forEach((pick, i) => expect(pick).not.toBe(picks[i]));
                unmount();
                vi.restoreAllMocks();
                vi.useRealTimers();
            }
        }
    });

    it("tells its parent when a spin starts and ends", () => {
        reducedMotion(false);
        vi.useFakeTimers();
        const onSpinningChange = vi.fn();
        render(<NamePicker names={NAMES} value={null} onChange={() => {}} onSpinningChange={onSpinningChange} />);
        expect(onSpinningChange).toHaveBeenLastCalledWith(false);
        fireEvent.click(screen.getByRole("button", { name: "Spin for a name" }));
        expect(onSpinningChange).toHaveBeenLastCalledWith(true);
        act(() => { vi.runAllTimers(); });
        expect(onSpinningChange).toHaveBeenLastCalledWith(false);
    });
});
