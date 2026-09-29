import type { Party } from "../utils/partyFirestore";
import type { Ballot } from "../utils/partyModel";

/** Four acts of a made-up final, for the party tests. */
export const fixtureActs = [
    { id: "se", country: "Sweden", flag: "🇸🇪", artist: "Loreen", song: "Tattoo" },
    { id: "no", country: "Norway", flag: "🇳🇴", artist: "Keiino", song: "Spirit in the Sky" },
    { id: "fi", country: "Finland", flag: "🇫🇮", artist: "Käärijä", song: "Cha Cha Cha" },
    { id: "ie", country: "Ireland", flag: "🇮🇪", artist: "Jedward", song: "Lipstick" },
];

export const makeParty = (change: Partial<Party> = {}): Party => ({
    code: "ABBA",
    hostId: "host-1",
    title: "Burgas 2027 · Grand final",
    contestId: "burgas-2027-final",
    kind: "final",
    qualifiers: 0,
    acts: fixtureActs,
    template: { id: "douze", name: "Douze points", blurb: "", categories: [{ id: "points", label: "Points", max: 12 }] },
    bonuses: false,
    showNames: true,
    results: {},
    revealed: false,
    ...change,
});

/** A douze-points ballot from points in running order. */
export const makeBallot = (guestId: string, name: string, points: number[]): Ballot => ({
    guestId,
    name,
    bonuses: {},
    ratings: Object.fromEntries(points.map((value, i) => [fixtureActs[i].id, { points: value }])),
});
