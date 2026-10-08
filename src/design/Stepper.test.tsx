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
        // The visible text is hidden from screen readers; aria-valuetext says it.
        expect(spin()).toHaveTextContent("–");
        expect(spin().querySelector("[aria-hidden='true']")).not.toBeNull();
    });

    it("states the value and its range once set", () => {
        render(<Harness start={7} />);
        expect(spin()).toHaveAttribute("aria-valuenow", "7");
        expect(spin()).toHaveAttribute("aria-valuetext", "7 of 10");
        expect(spin()).toHaveClass("is-chosen");
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

    it("steps with the big minus and plus, real labelled buttons", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<Harness start={4} onChange={onChange} />);
        const minus = screen.getByRole("button", { name: "Lower Vocals for Sweden" });
        const plus = screen.getByRole("button", { name: "Raise Vocals for Sweden" });
        await user.click(plus);
        expect(onChange).toHaveBeenLastCalledWith(5);
        await user.click(minus);
        await user.click(minus);
        expect(onChange).toHaveBeenLastCalledWith(3);
        expect(minus).toHaveAttribute("tabindex", "-1");
    });

    it("disables the minus until rated and at the lowest, and the plus at the highest", () => {
        const { unmount } = render(<Harness />);
        expect(screen.getByRole("button", { name: /^Lower/ })).toBeDisabled();
        expect(screen.getByRole("button", { name: /^Raise/ })).toBeEnabled();
        unmount();
        render(<Harness start={10} />);
        expect(screen.getByRole("button", { name: /^Raise/ })).toBeDisabled();
        expect(screen.getByRole("button", { name: /^Lower/ })).toBeEnabled();
    });

    it("keeps focus on the spinbutton when a step button disables itself", async () => {
        const user = userEvent.setup();
        render(<Harness start={9} />);
        await user.click(screen.getByRole("button", { name: /^Raise/ }));
        expect(screen.getByRole("button", { name: /^Raise/ })).toBeDisabled();
        expect(spin()).toHaveFocus();
    });

    it("scrubs through the range by dragging across the value", () => {
        const onChange = vi.fn();
        render(<Harness start={5} onChange={onChange} />);
        const value = spin();
        fireEvent.pointerDown(value, { clientX: 100, pointerId: 1, isPrimary: true, button: 0 });
        fireEvent.pointerMove(value, { clientX: 150, pointerId: 1 });
        expect(onChange).toHaveBeenLastCalledWith(7);
        fireEvent.pointerMove(value, { clientX: 0, pointerId: 1 });
        expect(onChange).toHaveBeenLastCalledWith(1);
        fireEvent.pointerUp(value, { pointerId: 1 });
        const calls = onChange.mock.calls.length;
        fireEvent.pointerMove(value, { clientX: 300, pointerId: 1 });
        expect(onChange).toHaveBeenCalledTimes(calls);
    });

    it("does not rate on a tiny wobble, and rates once a whole step is dragged", () => {
        const onChange = vi.fn();
        render(<Harness onChange={onChange} />);
        const value = spin();
        fireEvent.pointerDown(value, { clientX: 100, pointerId: 1, isPrimary: true, button: 0 });
        fireEvent.pointerMove(value, { clientX: 103, pointerId: 1 });
        fireEvent.pointerMove(value, { clientX: 90, pointerId: 1 });
        expect(onChange).not.toHaveBeenCalled();
        fireEvent.pointerMove(value, { clientX: 125, pointerId: 1 });
        expect(onChange).toHaveBeenLastCalledWith(1);
    });

    it("ignores secondary pointers and non-left buttons", () => {
        const onChange = vi.fn();
        render(<Harness start={5} onChange={onChange} />);
        const value = spin();
        fireEvent.pointerDown(value, { clientX: 100, pointerId: 2, isPrimary: false });
        fireEvent.pointerMove(value, { clientX: 200, pointerId: 2 });
        fireEvent.pointerUp(value, { pointerId: 2 });
        fireEvent.pointerDown(value, { clientX: 100, pointerId: 1, button: 2 });
        fireEvent.pointerMove(value, { clientX: 200, pointerId: 1 });
        expect(onChange).not.toHaveBeenCalled();
    });
});
