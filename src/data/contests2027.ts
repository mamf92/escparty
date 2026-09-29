/**
 * The Eurovision 2027 shows in Burgas, Bulgaria (#79, #82): semi-final 1
 * (11 May), semi-final 2 (13 May) and the grand final (15 May).
 *
 * FICTIVE. The countries are the ones confirmed by late September 2026 plus
 * likely returners, in a made-up running order, with artists and songs to
 * be announced. There's no reliable free API for the running order or the
 * results (#82), so the real lineup is entered by hand: when it's known,
 * write it to Firestore `contests/<id>` (see docs/agent/scoreboard-party.md)
 * and every new party picks it up; a host can also edit the order of their
 * own party. This file is the fallback when no `contests/` doc exists.
 */

export interface Act {
    /** Stable within a show: the country code, lowercase. */
    id: string;
    country: string;
    /** The country's flag emoji. */
    flag: string;
    artist: string;
    song: string;
}

export interface Contest {
    id: string;
    title: string;
    /** "final" ranks every act; a semi reveals only who qualifies. */
    kind: "semi" | "final";
    /** How many acts go through, for a semi-final. */
    qualifiers?: number;
    date: string;
    acts: Act[];
}

const TBA = "To be announced";

const COUNTRIES: Record<string, [string, string]> = {
    al: ["Albania", "🇦🇱"], am: ["Armenia", "🇦🇲"], at: ["Austria", "🇦🇹"], au: ["Australia", "🇦🇺"],
    az: ["Azerbaijan", "🇦🇿"], be: ["Belgium", "🇧🇪"], bg: ["Bulgaria", "🇧🇬"], ca: ["Canada", "🇨🇦"],
    ch: ["Switzerland", "🇨🇭"], cy: ["Cyprus", "🇨🇾"], cz: ["Czechia", "🇨🇿"], de: ["Germany", "🇩🇪"],
    dk: ["Denmark", "🇩🇰"], ee: ["Estonia", "🇪🇪"], fi: ["Finland", "🇫🇮"], fr: ["France", "🇫🇷"],
    gb: ["United Kingdom", "🇬🇧"], ge: ["Georgia", "🇬🇪"], gr: ["Greece", "🇬🇷"], hr: ["Croatia", "🇭🇷"],
    il: ["Israel", "🇮🇱"], it: ["Italy", "🇮🇹"], lt: ["Lithuania", "🇱🇹"], lu: ["Luxembourg", "🇱🇺"],
    lv: ["Latvia", "🇱🇻"], mk: ["North Macedonia", "🇲🇰"], mt: ["Malta", "🇲🇹"], no: ["Norway", "🇳🇴"],
    pl: ["Poland", "🇵🇱"], pt: ["Portugal", "🇵🇹"], ro: ["Romania", "🇷🇴"], rs: ["Serbia", "🇷🇸"],
    se: ["Sweden", "🇸🇪"], sm: ["San Marino", "🇸🇲"], ua: ["Ukraine", "🇺🇦"],
};

const lineup = (codes: string[]): Act[] =>
    codes.map(code => {
        const [country, flag] = COUNTRIES[code];
        return { id: code, country, flag, artist: TBA, song: TBA };
    });

export const CONTESTS_2027: Contest[] = [
    {
        id: "burgas-2027-semi-1",
        title: "Burgas 2027 · Semi-final 1",
        kind: "semi",
        qualifiers: 10,
        date: "2027-05-11",
        acts: lineup(["se", "al", "mt", "pl", "lt", "ch", "gr", "ua", "hr", "pt", "no", "ee", "cy", "rs", "az"]),
    },
    {
        id: "burgas-2027-semi-2",
        title: "Burgas 2027 · Semi-final 2",
        kind: "semi",
        qualifiers: 10,
        date: "2027-05-13",
        acts: lineup(["fi", "ca", "il", "lv", "lu", "at", "dk", "mk", "ro", "sm", "au", "am", "cz", "ge", "be"]),
    },
    {
        id: "burgas-2027-final",
        title: "Burgas 2027 · Grand final",
        kind: "final",
        date: "2027-05-15",
        // The host (Bulgaria) and the Big Four go straight through; the
        // other twenty are a guess at who qualifies.
        acts: lineup([
            "ua", "de", "mt", "fi", "il", "se", "fr", "lt", "au", "no",
            "it", "at", "ch", "dk", "gr", "gb", "pl", "ee", "lv", "al",
            "bg", "ro", "am", "lu", "ge",
        ]),
    },
];

export const contestById = (id: string): Contest | undefined => CONTESTS_2027.find(contest => contest.id === id);
