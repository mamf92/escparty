/**
 * What the party screens show, worked out from a party and its ballots:
 * which bonuses count, each guest's closeness to the real result, and the
 * awards. Kept apart from the pages so the room, the big screen and the
 * awards all agree.
 */
import type { Act } from "../data/contests2027";
import type { Party, PartyResults } from "./partyFirestore";
import {
    PARTY_BONUSES,
    ballotScores,
    partyAwards,
    predictFinal,
    predictSemi,
    type Award,
    type Ballot,
    type BonusCategory,
    type Prediction,
} from "./partyModel";

export const partyBonusList = (party: Pick<Party, "bonuses">): BonusCategory[] => (party.bonuses ? PARTY_BONUSES : []);

export const actIdsOf = (party: Pick<Party, "acts">) => party.acts.map(act => act.id);

/** Whether the host has entered any of the real result yet. */
export const hasResults = (party: Pick<Party, "kind" | "results">) =>
    party.kind === "final"
        ? Object.keys(party.results.places ?? {}).length > 0
        : (party.results.qualifiers ?? []).length > 0;

/** One guest's closeness to the real result, or null before there is one. */
export const predictionFor = (party: Party, ballot: Ballot): Prediction | null => {
    if (!hasResults(party)) return null;
    const scores = ballotScores(ballot, actIdsOf(party), party.template.categories, partyBonusList(party));
    const results = resultsFor(party.acts, party.results);
    return party.kind === "final"
        ? predictFinal(scores, results.places ?? {})
        : predictSemi(scores, results.qualifiers ?? []);
};

/** Every guest's closeness, keyed by guest id; empty before there's a result. */
export const predictionsFor = (party: Party, ballots: Ballot[]): Map<string, Prediction> => {
    const predictions = new Map<string, Prediction>();
    for (const ballot of ballots) {
        const prediction = predictionFor(party, ballot);
        if (prediction && prediction.compared > 0) predictions.set(ballot.guestId, prediction);
    }
    return predictions;
};

export const awardsFor = (party: Party, ballots: Ballot[]): Award[] =>
    partyAwards(ballots, actIdsOf(party), party.template.categories, partyBonusList(party), predictionsFor(party, ballots));

/** "1st", "2nd", "3rd", "4th"... */
export const ordinal = (place: number) => {
    const tens = place % 100;
    if (tens >= 11 && tens <= 13) return `${place}th`;
    return `${place}${["th", "st", "nd", "rd"][place % 10] ?? "th"}`;
};

/** A score to one decimal, without a trailing ".0". */
export const formatScore = (score: number) => (Math.round(score * 10) / 10).toString();

/**
 * Who an award goes to, in words (#89). With names on, the names (and
 * "that's you" when it's this guest); with names off, only "one of you" or
 * "two of you", except this guest is told when it's them.
 */
export const awardWinners = (
    guestIds: string[],
    names: Map<string, string>,
    showNames: boolean,
    me: string | undefined,
): { who: string; mine: boolean } => {
    const mine = !!me && guestIds.includes(me);
    if (showNames) {
        return { who: guestIds.map(id => names.get(id) ?? "A guest").join(" & "), mine };
    }
    if (guestIds.length === 1) return { who: mine ? "You" : "One of you", mine };
    return { who: mine ? "You and one other guest" : "Two of you", mine };
};

/** The link a guest opens to join: the app's own address, at the party. */
export const partyLink = (code: string) => `${window.location.origin}${window.location.pathname}#/party/${code}`;

/** A result trimmed to the acts in the show. */
export const resultsFor = (acts: Act[], results: PartyResults): PartyResults => {
    const ids = new Set(acts.map(act => act.id));
    const trimmed: PartyResults = {};
    if (results.places) {
        const kept = Object.entries(results.places).filter(([actId]) => ids.has(actId)).sort((a, b) => a[1] - b[1]);
        trimmed.places = Object.fromEntries(kept.map(([actId], index) => [actId, index + 1]));
    }
    if (results.qualifiers) trimmed.qualifiers = results.qualifiers.filter(actId => ids.has(actId));
    return trimmed;
};
