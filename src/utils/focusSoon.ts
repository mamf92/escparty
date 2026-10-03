/**
 * Focus an element once React has put it on the page: after a state change
 * that renders a note, a confirmation or a moved row, focus waits a frame
 * so it lands on what's actually there and its description is read with it.
 */
export const focusSoon = (find: () => HTMLElement | null | undefined) =>
    requestAnimationFrame(() => find()?.focus());
