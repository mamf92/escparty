import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Control, Pane, Row } from "../design";
import { PARTY_NAMES } from "../utils/partyNames";

const SWIPE_STEP_PX = 36;
const WHEEL_GAP_MS = 120;

const prefersReducedMotion = () =>
    typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * A slot-machine style name picker (#208): the Eurovision participant names
 * on a reel you can spin, nudge with the buttons, swipe, wheel or step with
 * the arrow keys. There is no free text, and nothing is picked until the
 * guest lands on a name. With reduced motion the spin jumps straight to its
 * name instead of ticking past the others.
 *
 * `value` is the landed name (or null); `onChange` hears every landing, but
 * not the names that tick past while it spins.
 */
export const NamePicker = ({ value, onChange, onSpinningChange, names = PARTY_NAMES, label = "Your name" }: {
    value: string | null;
    onChange: (name: string) => void;
    /** Told when a spin starts and ends, so a Continue beside the reel can wait for it. */
    onSpinningChange?: (spinning: boolean) => void;
    names?: readonly string[];
    label?: string;
}) => {
    const count = names.length;
    const landed = value === null ? -1 : names.indexOf(value);
    // While it spins the reel shows names that are not the answer yet.
    const [spinning, setSpinning] = useState<number | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const reel = useRef<HTMLDivElement>(null);
    const drag = useRef({ y: 0, active: false });
    const lastWheel = useRef(0);
    const isSpinning = spinning !== null;
    const shown = isSpinning ? spinning : landed;

    useEffect(() => () => clearTimeout(timer.current), []);

    const wrap = (index: number) => ((index % count) + count) % count;

    useEffect(() => { onSpinningChange?.(isSpinning); }, [isSpinning, onSpinningChange]);

    const step = (delta: number) => {
        if (isSpinning) return;
        const from = landed < 0 ? (delta > 0 ? -1 : 0) : landed;
        onChange(names[wrap(from + delta)]);
    };
    // The wheel listener is added once and calls whichever step is current.
    const stepRef = useRef(step);
    useEffect(() => { stepRef.current = step; });

    const spin = () => {
        if (isSpinning) return;
        // Always a different name from the one already landed on.
        const end = landed < 0 ? Math.floor(Math.random() * count) : wrap(landed + 1 + Math.floor(Math.random() * (count - 1)));
        if (prefersReducedMotion()) {
            onChange(names[end]);
            return;
        }
        const total = 16 + Math.floor(Math.random() * count);
        const tick = (done: number, at: number) => {
            if (done >= total) {
                setSpinning(null);
                onChange(names[wrap(at)]);
                return;
            }
            setSpinning(wrap(at));
            // Slows down towards the end, like a reel running out of spin.
            timer.current = setTimeout(() => tick(done + 1, at + 1), 50 + (done / total) ** 2 * 260);
        };
        tick(0, end - total);
    };

    // A wheel over the reel steps it instead of scrolling the page.
    useEffect(() => {
        const node = reel.current;
        if (!node) return;
        const onWheel = (event: WheelEvent) => {
            event.preventDefault();
            const now = Date.now();
            if (now - lastWheel.current < WHEEL_GAP_MS || event.deltaY === 0) return;
            lastWheel.current = now;
            stepRef.current(event.deltaY > 0 ? 1 : -1);
        };
        node.addEventListener("wheel", onWheel, { passive: false });
        return () => node.removeEventListener("wheel", onWheel);
    }, []);

    const onKeyDown = (event: KeyboardEvent) => {
        const moves: Record<string, () => void> = {
            ArrowDown: () => step(1),
            ArrowRight: () => step(1),
            ArrowUp: () => step(-1),
            ArrowLeft: () => step(-1),
            Home: () => !isSpinning && onChange(names[0]),
            End: () => !isSpinning && onChange(names[count - 1]),
        };
        const move = moves[event.key];
        if (!move) return;
        event.preventDefault();
        move();
    };

    const onPointerDown = (event: PointerEvent) => {
        drag.current = { y: event.clientY, active: true };
        event.currentTarget.setPointerCapture?.(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
        if (!drag.current.active) return;
        const moved = drag.current.y - event.clientY;
        if (Math.abs(moved) < SWIPE_STEP_PX) return;
        drag.current.y = event.clientY;
        step(moved > 0 ? 1 : -1);
    };
    const endDrag = () => { drag.current.active = false; };

    // Before the first landing the reel rests at the top of the list.
    const edge = (offset: number) => (shown < 0 ? names[offset < 0 ? count - 1 : 0] : names[wrap(shown + offset)]);

    return (
        <div className="party-picker">
            <div
                ref={reel}
                className="party-reel"
                role="spinbutton"
                tabIndex={0}
                aria-label={label}
                aria-busy={isSpinning}
                aria-valuemin={1}
                aria-valuemax={count}
                aria-valuenow={landed >= 0 && !isSpinning ? landed + 1 : undefined}
                aria-valuetext={landed >= 0 && !isSpinning ? names[landed] : "No name yet"}
                onKeyDown={onKeyDown}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
            >
                <Row className="party-reel-edge" aria-hidden="true">{edge(-1)}</Row>
                <Row className="party-reel-name esc-pick" elevation="high" aria-hidden="true">{shown < 0 ? "?" : names[shown]}</Row>
                <Row className="party-reel-edge" aria-hidden="true">{edge(1)}</Row>
            </div>
            <p className="esc-note" role="status">
                {isSpinning ? "Spinning…" : value !== null ? `You're ${value}.` : "Spin the reel, or swipe, scroll or use the arrow keys."}
            </p>
            <Pane layout="split">
                <Control onClick={() => step(-1)} disabled={isSpinning}>Previous name</Control>
                <Control onClick={() => step(1)} disabled={isSpinning}>Next name</Control>
            </Pane>
            <Pane>
                <Control onClick={spin} disabled={isSpinning}>{value === null ? "Spin for a name" : "Spin again"}</Control>
            </Pane>
        </div>
    );
};
