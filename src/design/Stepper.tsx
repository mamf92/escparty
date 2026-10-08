import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { cx } from "./cx";
import { Control } from "./Surface";

/*
 * A value picker for one number in min..max (a rating): a big "−", the
 * value, a big "+". The value is the `spinbutton` (one tab stop): Up/Right
 * and Down/Left step by one, PageUp/PageDown by three, Home and End jump to
 * the ends. Dragging sideways across the value scrubs through the range, one
 * step per 24px, so a thumb can sweep 1..12 in one stroke. It starts "not
 * rated" (no value) and says so to everyone. The − and + are real buttons
 * ("Lower Vocals for Sweden"), out of the tab order but in the accessibility
 * tree, so a screen reader on a phone can rate by activating them. After a
 * press, focus goes to the spinbutton, so it never drops to the page when a
 * button disables itself at the end of the range.
 */


const DRAG_STEP_PX = 24;

type StepperProps = {
    /** What this is the value of; read by screen readers ("Vocals for Sweden"). */
    label: string;
    /** `undefined` is "not rated". */
    value: number | undefined;
    min?: number;
    max: number;
    onChange: (value: number) => void;
    className?: string;
};

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export const Stepper = ({ label, value, min = 1, max, onChange, className }: StepperProps) => {
    const drag = useRef<{ x: number; from: number; last: number; rated: boolean; moved: boolean } | null>(null);
    const spinRef = useRef<HTMLDivElement>(null);
    const set = (next: number) => {
        const clamped = clamp(next, min, max);
        if (clamped !== value) onChange(clamped);
    };
    // From "not rated", the first step up lands on the lowest value.
    const base = value ?? min - 1;
    const step = (next: number) => {
        // Focus first: the button may disable itself once the value changes.
        spinRef.current?.focus();
        set(next);
    };

    const onKeyDown = (event: KeyboardEvent) => {
        const moves: Record<string, number> = {
            ArrowUp: base + 1, ArrowRight: base + 1, ArrowDown: base - 1, ArrowLeft: base - 1,
            PageUp: base + 3, PageDown: base - 3, Home: min, End: max,
        };
        if (!(event.key in moves)) return;
        event.preventDefault();
        // Down from "not rated" stays not rated rather than rating it 1.
        if (value === undefined && moves[event.key] < min) return;
        set(moves[event.key]);
    };

    const onPointerDown = (event: PointerEvent) => {
        if (!event.isPrimary || event.button !== 0) return;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        drag.current = { x: event.clientX, from: base, last: base, rated: value !== undefined, moved: false };
    };
    const onPointerMove = (event: PointerEvent) => {
        const d = drag.current;
        if (!d) return;
        const dx = event.clientX - d.x;
        // A tap's jitter is not a drag: wait for half a step.
        if (!d.moved && Math.abs(dx) < DRAG_STEP_PX / 2) return;
        d.moved = true;
        const steps = Math.round(dx / DRAG_STEP_PX);
        // Unrated stays unrated until the drag has gone a whole step up.
        if (!d.rated && d.from + steps < min) return;
        const next = clamp(d.from + steps, min, max);
        if (next !== d.last) {
            d.last = next;
            set(next);
        }
    };
    const endDrag = () => { drag.current = null; };

    return (
        <div className={cx("calm-stepper", className)}>
            <Control
                tabIndex={-1}
                aria-label={`Lower ${label}`}
                className="calm-stepper-step"
                disabled={value === undefined || value <= min}
                onClick={() => step(base - 1)}
            >
                −
            </Control>
            <div
                ref={spinRef}
                role="spinbutton"
                tabIndex={0}
                aria-label={label}
                aria-valuemin={min}
                aria-valuemax={max}
                aria-valuenow={value}
                aria-valuetext={value === undefined ? "Not rated" : `${value} of ${max}`}
                className={cx("lycra", "is-block", "calm-stepper-value", value !== undefined && "is-chosen")}
                onKeyDown={onKeyDown}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
            >
                {/* aria-valuetext says it; the visible text is for eyes only. */}
                <span aria-hidden="true">
                    {value === undefined ? "–" : <>{value}<span className="calm-sub">/{max}</span></>}
                </span>
            </div>
            <Control
                tabIndex={-1}
                aria-label={`Raise ${label}`}
                className="calm-stepper-step"
                disabled={value !== undefined && value >= max}
                onClick={() => step(base + 1)}
            >
                +
            </Control>
        </div>
    );
};
