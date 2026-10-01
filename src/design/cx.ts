/** Joins class names, skipping the ones that are off. */
export const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");
