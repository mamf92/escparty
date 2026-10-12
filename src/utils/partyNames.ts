/**
 * The Eurovision legends a guest becomes at a scoreboard party, so the
 * awards read like a Eurovision night. Guests pick one on the name reel
 * (`NamePicker`); names are claimed the moment a guest joins, so nobody
 * else is offered one that is taken.
 */
export const PARTY_NAMES = [
    "Loreen", "Käärijä", "Conchita", "Rybak", "Netta", "Lordi", "Verka", "Ruslana",
    "Måneskin", "Nemo", "JJ", "Dana International", "Johnny Logan", "Céline", "Lys Assia",
    "Sandie Shaw", "Jedward", "Babushka", "Dustin the Turkey", "Epic Sax Guy", "Daði",
    "Hatari", "Subwoolfer", "Salvador", "Marija", "Helena", "Sertab", "Lena", "Emmelie",
    "Duncan", "Kalush", "Jamala", "Måns", "Carola", "Bobbysocks", "Secret Garden",
];

export const randomPartyName = (): string => PARTY_NAMES[Math.floor(Math.random() * PARTY_NAMES.length)];

/** A name as compared for "the same": trimmed, any case. */
const nameKey = (name: string): string => name.trim().toLowerCase();

/** The participant names nobody has taken; every name if all are taken (a suffix sorts that out later). */
export const availablePartyNames = (takenNames: readonly string[]): string[] => {
    const taken = new Set(takenNames.map(nameKey));
    const free = PARTY_NAMES.filter(name => !taken.has(nameKey(name)));
    return free.length > 0 ? free : [...PARTY_NAMES];
};

/** A random participant name nobody has taken; with all taken, a random one numbered " 2", " 3"... */
export const freePartyName = (takenNames: readonly string[]): string => {
    const taken = new Set(takenNames.map(nameKey));
    const free = PARTY_NAMES.filter(name => !taken.has(nameKey(name)));
    if (free.length > 0) return free[Math.floor(Math.random() * free.length)];
    const base = randomPartyName();
    let n = 2;
    while (taken.has(nameKey(`${base} ${n}`))) n += 1;
    return `${base} ${n}`;
};

/**
 * Whether this guest has to give their name up: another guest's ballot has
 * the same name (case and edge spaces ignored) and a guest ID that sorts
 * before this one's. Of two guests who took a name at the same moment,
 * exactly one is told to move, and both can work it out alone.
 */
export const nameClash = (ballots: readonly { guestId: string; name: string }[], me: { guestId: string; name: string }): boolean =>
    ballots.some(ballot => ballot.guestId !== me.guestId && nameKey(ballot.name) === nameKey(me.name) && ballot.guestId < me.guestId);

/**
 * Names to show for a list of guests: a name shared by several (older
 * parties, or a clash not yet settled) gets " 2", " 3" in guest ID order,
 * so a list never has two of the same. Keyed by guest ID.
 */
export const distinctNames = (entries: readonly { id: string; name: string }[]): Map<string, string> => {
    const sorted = [...entries].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const seen = new Map<string, number>();
    const result = new Map<string, string>();
    for (const { id, name } of sorted) {
        const key = nameKey(name);
        const count = (seen.get(key) ?? 0) + 1;
        seen.set(key, count);
        result.set(id, count === 1 ? name : `${name} ${count}`);
    }
    return result;
};

/** The ballots with `distinctNames` applied to their names. */
export const withDistinctNames = <T extends { guestId: string; name: string }>(ballots: readonly T[]): T[] => {
    const names = distinctNames(ballots.map(ballot => ({ id: ballot.guestId, name: ballot.name })));
    return ballots.map(ballot => ({ ...ballot, name: names.get(ballot.guestId) ?? ballot.name }));
};
