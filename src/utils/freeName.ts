/** A name as compared for "the same": trimmed, any case. */
export const nameKey = (name: string): string => name.trim().toLowerCase();

/** The names in `pool` that none of `taken` is (trimmed, any case). */
export const freeNames = (taken: readonly string[], pool: readonly string[]): string[] => {
    const takenKeys = new Set(taken.map(nameKey));
    return pool.filter(name => !takenKeys.has(nameKey(name)));
};

/**
 * A name nobody in `taken` has: `wanted` if it is free, else a random free
 * one from `pool`, else `wanted` numbered " 2", " 3"... (the first number
 * that is free). Shared by the quiz rooms and the scoreboard parties so
 * they can't drift apart.
 */
export const pickFreeName = (wanted: string, taken: readonly string[], pool: readonly string[]): string => {
    const takenKeys = new Set(taken.map(nameKey));
    if (!takenKeys.has(nameKey(wanted))) return wanted;
    const free = freeNames(taken, pool);
    if (free.length > 0) return free[Math.floor(Math.random() * free.length)];
    let n = 2;
    while (takenKeys.has(nameKey(`${wanted} ${n}`))) n += 1;
    return `${wanted} ${n}`;
};
