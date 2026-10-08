import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Stepper } from "./Stepper";

const Harness = ({ start, max = 10, onChange }: { start?: number; max?: 5 | 10 | 12; onChange?: (value: number) => void }) => {
    const [value, setValue] = useState<number | undefined>(start);
    return <Stepper label="Vocals for Sweden" value={value} max={max} onChange={next => { setValue(next); onChange?.(next); }} />;
};

const spin = () => screen.getByRole("spinbutton", { name: "Vocals for Sweden" });

describe("Stepper", () => {
    it("says it is not rated until a value is set", () => {
        render(<Harness />);
        expect(spin()).toHaveAttribute("aria-valuemin", "1");
        expect(spin()).toHaveAttribute("aria-valuemax", "10");
        expect(spin()).not.toHaveAttribute("aria-valuenow");
        expect(spin()).toHaveAttribute("aria-valuetext", "Not rated");
        expect(spin()).toHaveTextContent("Not rated");
    });

    it("states the value and its range once set", () => {
        render(<Harness start={7} />);
        expect(spin()).toHaveAttribute("aria-valuenow", "7");
        expect(spin()).toHaveAttribute("aria-valuetext", "7 of 10");
        expect(spin().querySelector(".calm-stepper-value")).toHaveClass("is-chosen");
    });

    it("steps with the arrow keys, from not rated up to the lowest value, and stops at the ends", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<Harness max={5} onChange={onChange} />);
        spin().focus();
        await user.keyboard("{ArrowDown}");
        expect(onChange).not.toHaveBeenCalled();
        await user.keyboard("{ArrowUp}");
        expect(onChange).toHaveBeenLastCalledWith(1);
        await user.keyboard("{ArrowRight}{ArrowRight}");
        expect(onChange).toHaveBeenLastCalledWith(3);
        await user.keyboard("{ArrowLeft}");
        expect(onChange).toHaveBeenLastCalledWith(2);
        await user.keyboard("{PageUp}");
        expect(onChange).toHaveBeenLastCalledWith(5);
        const calls = onChange.mock.calls.length;
        await user.keyboard("{ArrowUp}");
        expect(onChange).toHaveBeenCalledTimes(calls);
        await user.keyboard("{PageDown}");
        expect(onChange).toHaveBeenLastCalledWith(2);
        await user.keyboard("{Home}");
        expect(onChange).toHaveBeenLastCalledWith(1);
        await user.keyboard("{End}");
        expect(onChange).toHaveBeenLastCalledWith(5);
    });

    it("steps with the big minus and plus", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<Harness start={4} onChange={onChange} />);
        const [minus, plus] = Array.from(spin().querySelectorAll("button"));
        await user.click(plus);
        expect(onChange).toHaveBeenLastCalledWith(5);
        await user.click(minus);
        await user.click(minus);
        expect(onChange).toHaveBeenLastCalledWith(3);
        expect(minus).toHaveAttribute("tabindex", "-1");
    });

    it("disables the minus until rated and at the lowest, and the plus at the highest", () => {
        const { unmount } = render(<Harness />);
        expect(spin().querySelectorAll("button")[0]).toBeDisabled();
        expect(spin().querySelectorAll("button")[1]).toBeEnabled();
        unmount();
        render(<Harness start={10} />);
        expect(spin().querySelectorAll("button")[1]).toBeDisabled();
        expect(spin().querySelectorAll("button")[0]).toBeEnabled();
    });

    it("scrubs through the range by dragging across the value", () => {
        const onChange = vi.fn();
        render(<Harness start={5} onChange={onChange} />);
        const value = spin().querySelector(".calm-stepper-value")!;
        fireEvent.pointerDown(value, { clientX: 100, pointerId: 1 });
        fireEvent.pointerMove(value, { clientX: 150, pointerId: 1 });
        expect(onChange).toHaveBeenLastCalledWith(7);
        fireEvent.pointerMove(value, { clientX: 0, pointerId: 1 });
        expect(onChange).toHaveBeenLastCalledWith(1);
        fireEvent.pointerUp(value, { pointerId: 1 });
        const calls = onChange.mock.calls.length;
        fireEvent.pointerMove(value, { clientX: 300, pointerId: 1 });
        expect(onChange).toHaveBeenCalledTimes(calls);
    });
});
