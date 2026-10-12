import { freeNames, nameKey, pickFreeName } from "./freeName";

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

/** The participant names nobody has taken; every name if all are taken (a suffix sorts that out later). */
export const availablePartyNames = (takenNames: readonly string[]): string[] => {
    const free = freeNames(takenNames, PARTY_NAMES);
    return free.length > 0 ? free : [...PARTY_NAMES];
};

/** A random participant name nobody has taken; with all taken, a random one numbered " 2", " 3"... */
export const freePartyName = (takenNames: readonly string[]): string =>
    pickFreeName(randomPartyName(), takenNames, PARTY_NAMES);

/** Whether a ballot has any rating or bonus in it (an empty one only claims a name). */
const hasActivity = (ballot: { ratings?: object; bonuses?: object }): boolean =>
    Object.keys(ballot.ratings ?? {}).length > 0 || Object.keys(ballot.bonuses ?? {}).length > 0;

/**
 * Names to show for a list of guests: a name shared by several (older
 * parties, or two guests who took it at the same instant) gets " 2", " 3",
 * so a list never has two of the same. The bare name goes to the guest who
 * most plausibly held it first: one with ratings or bonuses beats one
 * without, then guest ID order. A number never lands on a name another
 * guest really has. Keyed by guest ID.
 */
export const distinctNames = (
    entries: readonly { id: string; name: string; ratings?: object; bonuses?: object }[],
): Map<string, string> => {
    const sorted = [...entries].sort((a, b) => {
        const active = Number(hasActivity(b)) - Number(hasActivity(a));
        return active || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    });
    const used = new Set(sorted.map(entry => nameKey(entry.name)));
    const seen = new Set<string>();
    const result = new Map<string, string>();
    for (const { id, name } of sorted) {
        const key = nameKey(name);
        if (!seen.has(key)) {
            seen.add(key);
            result.set(id, name);
            continue;
        }
        let n = 2;
        while (used.has(nameKey(`${name} ${n}`))) n += 1;
        used.add(nameKey(`${name} ${n}`));
        result.set(id, `${name} ${n}`);
    }
    return result;
};

type NamedBallot = { guestId: string; name: string; ratings?: object; bonuses?: object };

const distinctBallotNames = (ballots: readonly NamedBallot[]) =>
    distinctNames(ballots.map(ballot => ({ id: ballot.guestId, name: ballot.name, ratings: ballot.ratings, bonuses: ballot.bonuses })));

/** The ballots with `distinctNames` applied to their names. */
export const withDistinctNames = <T extends NamedBallot>(ballots: readonly T[]): T[] => {
    const names = distinctBallotNames(ballots);
    return ballots.map(ballot => ({ ...ballot, name: names.get(ballot.guestId) ?? ballot.name }));
};

/** The name the lists show for this guest ("Loreen 2" if a clash numbered them); `fallback` while their ballot isn't in. */
export const displayNameOf = (ballots: readonly NamedBallot[] | undefined, guestId: string, fallback: string): string =>
    (ballots && distinctBallotNames(ballots).get(guestId)) ?? fallback;
