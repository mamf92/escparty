import type { KeyboardEvent } from "react";

/**
 * Arrow keys for a radio group built from buttons (`role="radio"` inside a
 * `role="radiogroup"`), as the ARIA pattern has it: Up/Left and Down/Right
 * move to the previous and next radio (wrapping), Home and End to the first
 * and last, and moving picks. Pair it with a roving tab stop, so only the
 * picked radio (or the first, when none is) has `tabIndex={0}`:
 * `radioTabIndex(index, pickedIndex)`.
 */
export const radioGroupKeys = (
    event: KeyboardEvent<HTMLElement>,
    index: number,
    count: number,
    pick: (index: number) => void,
) => {
    // Alt+Arrow is the browser's Back and Forward, Ctrl/Meta+Home and End
    // scroll the page: leave them to the browser.
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    let next: number;
    switch (event.key) {
        case "ArrowDown":
        case "ArrowRight":
            next = (index + 1) % count;
            break;
        case "ArrowUp":
        case "ArrowLeft":
            next = (index - 1 + count) % count;
            break;
        case "Home":
            next = 0;
            break;
        case "End":
            next = count - 1;
            break;
        default:
            return;
    }
    event.preventDefault();
    pick(next);
    const group = event.currentTarget.closest('[role="radiogroup"]');
    group?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
};

/** The roving tab stop: the picked radio, or the first when none is picked. */
export const radioTabIndex = (index: number, picked: number | null) =>
    index === (picked ?? 0) ? 0 : -1;
