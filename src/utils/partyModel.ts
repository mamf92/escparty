/**
 * The scoreboard party's pure logic (#81, #86, #87): rating templates, a
 * guest's score for an act, their ranking, how close it came to the real
 * result, and the end-of-party awards. No React, no Firestore; the
 * algorithms are documented in docs/agent/scoreboard-party.md.
 */

export interface RatingCategory {
    id: string;
    label: string;
    /** Ratings run 1..max. */
    max: 5 | 10 | 12;
}

export interface BonusCategory {
    id: string;
    label: string;
    /** Added to the act's score when ticked. */
    points: number;
}

export interface RatingTemplate {
    id: string;
    name: string;
    blurb: string;
    categories: RatingCategory[];
}

export const SCALE_CHOICES = [5, 10, 12] as const;
export const CATEGORY_LIMITS = { min: 1, max: 6, maxLabel: 30 } as const;

/** Premade ways to rate (#81), from real-world score sheets. */
export const RATING_TEMPLATES: RatingTemplate[] = [
    {
        id: "jury",
        name: "The Jury",
        blurb: "The five things real Eurovision juries are asked to judge.",
        categories: [
            { id: "vocals", label: "Vocals", max: 10 },
            { id: "performance", label: "Performance", max: 10 },
            { id: "song", label: "Composition", max: 10 },
            { id: "originality", label: "Originality", max: 10 },
            { id: "overall", label: "Overall impression", max: 10 },
        ],
    },
    {
        id: "sofa",
        name: "MGP Sofa",
        blurb: "What the sofa at a Melodi Grand Prix party actually talks about.",
        categories: [
            { id: "song", label: "Song", max: 10 },
            { id: "performance", label: "Performance", max: 10 },
            { id: "staging", label: "Outfit & staging", max: 10 },
            { id: "crowd", label: "Crowd-pleaser", max: 10 },
        ],
    },
    {
        id: "douze",
        name: "Douze Points",
        blurb: "One number per act, from 1 to 12, the way the voting feels.",
        categories: [{ id: "points", label: "Points", max: 12 }],
    },
];

/**
 * The party bonus layer (#81): yes/no extras that go on top of any
 * template, each adding a few points when ticked.
 */
export const PARTY_BONUSES: BonusCategory[] = [
    { id: "language", label: "Sung in their own language", points: 2 },
    { id: "wind", label: "Wind machine", points: 1 },
    { id: "keychange", label: "Key change", points: 1 },
    { id: "pyro", label: "Pyro", points: 1 },
    { id: "grandma", label: "Would make grandma cry", points: 2 },
];

/** One guest's ratings: act id -> category id -> 1..max. */
export type Ratings = Record<string, Record<string, number>>;
/** One guest's ticked bonuses: act id -> bonus ids. */
export type Bonuses = Record<string, string[]>;

export interface Ballot {
    guestId: string;
    name: string;
    ratings: Ratings;
    bonuses: Bonuses;
}

/**
 * What's wrong with one category's name among the sheet's, if anything:
 * blank, too long, or the same as another's (ignoring case). The setup
 * screen marks the fields it's about; categoryProblems words it.
 */
export const categoryLabelProblem = (
    category: RatingCategory,
    categories: RatingCategory[],
): "blank" | "long" | "repeat" | null => {
    const label = category.label.trim().toLowerCase();
    if (!label) return "blank";
    if (label.length > CATEGORY_LIMITS.maxLabel) return "long";
    if (categories.filter(other => other.label.trim().toLowerCase() === label).length > 1) return "repeat";
    return null;
};

/** What's wrong with a set of custom categories, as sentences. */
export const categoryProblems = (categories: RatingCategory[]): string[] => {
    const problems: string[] = [];
    if (categories.length < CATEGORY_LIMITS.min) problems.push("Add at least one category.");
    if (categories.length > CATEGORY_LIMITS.max) problems.push(`Use at most ${CATEGORY_LIMITS.max} categories.`);
    const labelProblems = categories.map(category => categoryLabelProblem(category, categories));
    if (labelProblems.includes("blank")) problems.push("Name every category.");
    if (labelProblems.includes("long")) problems.push(`Keep category names under ${CATEGORY_LIMITS.maxLabel} characters.`);
    if (labelProblems.includes("repeat")) problems.push("Two categories have the same name.");
    if (categories.some(category => !(SCALE_CHOICES as readonly number[]).includes(category.max))) {
        problems.push("Pick a scale for every category.");
    }
    return problems;
};

/** Whether a rating fits a category's scale. */
export const isValidRating = (value: unknown, category: RatingCategory): value is number =>
    typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= category.max;

/**
 * A guest's score for one act, or null if they haven't rated it at all:
 * the mean of their category ratings, each scaled to 0-10 (so a 5-point
 * and a 12-point category weigh the same), plus any bonus points ticked.
 * A category left blank doesn't count against the act.
 */
export const actScore = (
    ratings: Record<string, number> | undefined,
    bonusIds: string[] | undefined,
    categories: RatingCategory[],
    bonuses: BonusCategory[] = [],
): number | null => {
    const scaled = categories
        .filter(category => isValidRating(ratings?.[category.id], category))
        .map(category => (ratings![category.id] / category.max) * 10);
    if (scaled.length === 0) return null;
    const bonus = bonuses
        .filter(entry => bonusIds?.includes(entry.id))
        .reduce((sum, entry) => sum + entry.points, 0);
    return scaled.reduce((sum, value) => sum + value, 0) / scaled.length + bonus;
};

/** Every act a guest rated, with their score for it, in running order. */
export const ballotScores = (
    ballot: Pick<Ballot, "ratings" | "bonuses">,
    actIds: string[],
    categories: RatingCategory[],
    bonuses: BonusCategory[] = [],
): Map<string, number> => {
    const scores = new Map<string, number>();
    for (const actId of actIds) {
        const score = actScore(ballot.ratings[actId], ballot.bonuses[actId], categories, bonuses);
        if (score !== null) scores.set(actId, score);
    }
    return scores;
};

/**
 * Rank positions (1 = best) for scored items, highest score first. Tied
 * scores share the average of the positions they span, so two acts tied
 * for 2nd and 3rd both sit at 2.5: a tie is neither rewarded nor punished.
 */
export const rankPositions = (scores: Map<string, number>): Map<string, number> => {
    const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);
    const positions = new Map<string, number>();
    let start = 0;
    while (start < sorted.length) {
        let end = start;
        while (end + 1 < sorted.length && sorted[end + 1][1] === sorted[start][1]) end++;
        const shared = (start + 1 + end + 1) / 2;
        for (let i = start; i <= end; i++) positions.set(sorted[i][0], shared);
        start = end + 1;
    }
    return positions;
};

/** Points for being `distance` places off, shaped like the Eurovision scale. */
export const CLOSENESS_POINTS = [12, 8, 5, 3, 1] as const;

export const pointsForDistance = (distance: number): number => {
    const places = Math.round(distance);
    return places < CLOSENESS_POINTS.length ? CLOSENESS_POINTS[places] : 0;
};

export interface Prediction {
    /** The closeness score: higher is closer. */
    points: number;
    /** Sum of places off, over the acts compared (the tie-break: lower wins). */
    distance: number;
    /** How many acts with a real result the guest rated. */
    compared: number;
    /** For a semi-final: how many of their top picks went through. */
    hits?: number;
}

/**
 * How close a guest's ranking came to a final's real result (#86).
 *
 * Only acts with a real place count. The guest's scores for those acts are
 * ranked among themselves, and so are the real places, so a result entered
 * halfway (the top 10 so far) still compares like with like. Each act then
 * scores by how many places off it is: 12 for exact, then 8, 5, 3, 1 and 0
 * from five places off. An act with a real place the guest never rated
 * is left out on both sides, so it neither scores nor moves the others'
 * places. Ties in the guest's scores share places (see rankPositions);
 * a fractional distance rounds to the nearest place.
 */
export const predictFinal = (scores: Map<string, number>, realPlaces: Record<string, number>): Prediction => {
    // Only acts with a real place that the guest rated, ranked among
    // themselves on both sides, so skipping an act doesn't shift the rest.
    const compared = Object.keys(realPlaces).filter(actId => Number.isFinite(realPlaces[actId]) && scores.has(actId));
    const realRank = rankPositions(new Map(compared.map(actId => [actId, -realPlaces[actId]])));
    const guestRank = rankPositions(new Map(compared.map(actId => [actId, scores.get(actId)!])));
    let points = 0;
    let distance = 0;
    for (const [actId, guestPlace] of guestRank) {
        const off = Math.abs(guestPlace - realRank.get(actId)!);
        points += pointsForDistance(off);
        distance += off;
    }
    return { points, distance, compared: guestRank.size };
};

/**
 * How close a guest came on a semi-final (#86), where the show only
 * reveals who goes through: their top N (N = how many qualified) against
 * the qualifiers, 12 points per act they called right.
 */
export const predictSemi = (scores: Map<string, number>, qualifiers: string[]): Prediction => {
    const top = [...scores.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, qualifiers.length)
        .map(([actId]) => actId);
    const hits = top.filter(actId => qualifiers.includes(actId)).length;
    return { points: hits * 12, distance: qualifiers.length - hits, compared: scores.size, hits };
};

export interface Standing {
    actId: string;
    /** Mean score across the guests who rated it. */
    average: number;
    votes: number;
}

/** The room's standings: each act's average score, best first (#84). */
export const roomStandings = (
    ballots: Pick<Ballot, "ratings" | "bonuses">[],
    actIds: string[],
    categories: RatingCategory[],
    bonuses: BonusCategory[] = [],
): Standing[] => {
    const standings: Standing[] = [];
    for (const actId of actIds) {
        const scores = ballots
            .map(ballot => actScore(ballot.ratings[actId], ballot.bonuses[actId], categories, bonuses))
            .filter((score): score is number => score !== null);
        if (scores.length > 0) {
            standings.push({ actId, average: mean(scores), votes: scores.length });
        }
    }
    // Stable: equal averages keep running order.
    return standings.sort((a, b) => b.average - a.average);
};

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

const variance = (values: number[]) => {
    const average = mean(values);
    return mean(values.map(value => (value - average) ** 2));
};

/** Pearson correlation of two equal-length lists, or null when either is flat. */
export const pearson = (xs: number[], ys: number[]): number | null => {
    if (xs.length !== ys.length || xs.length < 2) return null;
    const mx = mean(xs);
    const my = mean(ys);
    let num = 0;
    let dx = 0;
    let dy = 0;
    for (let i = 0; i < xs.length; i++) {
        num += (xs[i] - mx) * (ys[i] - my);
        dx += (xs[i] - mx) ** 2;
        dy += (ys[i] - my) ** 2;
    }
    if (dx === 0 || dy === 0) return null;
    return num / Math.sqrt(dx * dy);
};

/** The least acts two guests must both have rated for a pair award. */
export const MIN_SHARED_ACTS = 3;
/** The least acts a guest must have rated to count in the solo awards. */
export const MIN_RATED_ACTS = 3;
/** The most-different pair only counts if they agreed less than this (Pearson r). */
export const OPPOSITES_BELOW = 0.3;

export type AwardId =
    | "twins"
    | "opposites"
    | "euphoria"
    | "nul-points"
    | "wind-machine"
    | "lasha-tumbai"
    | "hatari"
    | "babushki"
    | "johnny-logan";

export interface Award {
    id: AwardId;
    /** A name from Eurovision history. */
    title: string;
    /** What it's for, in plain words. */
    for: string;
    /** The story behind the name. */
    story: string;
    /** One guest id, or two for a pair. */
    guestIds: string[];
    /** The number behind it, as words: "they agreed 0.92". */
    detail: string;
}

export const AWARD_NAMES: Record<AwardId, Pick<Award, "title" | "for" | "story">> = {
    "twins": {
        title: "The Jedward Twins",
        for: "The two of you who rated most alike",
        story: "John and Edward Grimes sang for Ireland in 2011 and 2012, in matching hair, matching jackets and perfect agreement.",
    },
    "opposites": {
        title: "Lordi & Salvador Sobral",
        for: "The two of you who rated most differently",
        story: "Finland won in 2006 with monster masks and pyro. Portugal won in 2017 with a ballad and the words \"music isn't fireworks, music is feeling\". Both were right.",
    },
    "euphoria": {
        title: "Euphoria",
        for: "The most generous rater",
        story: "Loreen took douze points from 18 countries with 'Euphoria' in 2012. You gave out points the same way.",
    },
    "nul-points": {
        title: "Nul Points",
        for: "The toughest rater",
        story: "Jahn Teigen jumped for joy in 1978 after scoring zero for Norway with 'Mil etter mil'. Harsh, but somebody has to be.",
    },
    "wind-machine": {
        title: "The Wind Machine",
        for: "The most decisive rater: big highs, big lows",
        story: "The wind machine never does half measures, and neither did you.",
    },
    "lasha-tumbai": {
        title: "Lasha Tumbai",
        for: "Easiest to please: high scores for everyone",
        story: "Verka Serduchka came second in 2007 in a silver disco star, and the party never stopped. Neither did your good mood.",
    },
    "hatari": {
        title: "Hatari",
        for: "The contrarian: lowest score for the room's favourite",
        story: "Iceland's Hatari brought techno, leather and a banner the rules didn't allow in 2019. Someone always has to go against the room.",
    },
    "babushki": {
        title: "The Babushki",
        for: "The most bonus points handed out",
        story: "Buranovskiye Babushki baked bread on stage in 2012 and won every grandmother's heart. You ticked every box they would have.",
    },
    "johnny-logan": {
        title: "The Johnny Logan",
        for: "Closest to the real result",
        story: "Johnny Logan won Eurovision three times, twice singing and once writing. He always knows, and so did you.",
    },
};

const award = (id: AwardId, guestIds: string[], detail: string): Award => ({ id, ...AWARD_NAMES[id], guestIds, detail });

const round1 = (value: number) => Math.round(value * 10) / 10;

/** Pick the entry with the highest key; the first one wins a tie (guests come in join order). */
const best = <T,>(items: T[], key: (item: T) => number): T | undefined =>
    items.reduce<T | undefined>((top, item) => (top === undefined || key(item) > key(top) ? item : top), undefined);

/**
 * The end-of-party awards (#87). Each needs enough data to mean something
 * and is left out otherwise: the solo awards need two guests who each
 * rated at least MIN_RATED_ACTS acts, the pair awards two guests sharing
 * MIN_SHARED_ACTS acts, the Johnny Logan a real result. `predictions` is
 * each guest's closeness to the real result, when there is one.
 */
export const partyAwards = (
    ballots: Ballot[],
    actIds: string[],
    categories: RatingCategory[],
    bonuses: BonusCategory[] = [],
    predictions?: Map<string, Prediction>,
): Award[] => {
    const scored = ballots
        .map(ballot => ({ ballot, scores: ballotScores(ballot, actIds, categories, bonuses) }))
        .filter(entry => entry.scores.size >= MIN_RATED_ACTS);
    const awards: Award[] = [];

    if (scored.length >= 2) {
        const pairs: { ids: string[]; r: number; shared: number }[] = [];
        for (let i = 0; i < scored.length; i++) {
            for (let j = i + 1; j < scored.length; j++) {
                const shared = actIds.filter(actId => scored[i].scores.has(actId) && scored[j].scores.has(actId));
                if (shared.length < MIN_SHARED_ACTS) continue;
                const r = pearson(shared.map(id => scored[i].scores.get(id)!), shared.map(id => scored[j].scores.get(id)!));
                if (r !== null) pairs.push({ ids: [scored[i].ballot.guestId, scored[j].ballot.guestId], r, shared: shared.length });
            }
        }
        const twins = best(pairs, pair => pair.r);
        const opposites = best(pairs, pair => -pair.r);
        const r2 = (r: number) => r.toFixed(2);
        if (twins && twins.r > 0) {
            awards.push(award("twins", twins.ids, `Their scores rose and fell together over ${twins.shared} acts (correlation ${r2(twins.r)}).`));
        }
        // Only a pair that really disagreed: a weak or negative correlation.
        if (opposites && opposites !== twins && opposites.r < OPPOSITES_BELOW) {
            awards.push(award("opposites", opposites.ids, opposites.r < 0
                ? `When one scored an act up, the other scored it down, over ${opposites.shared} acts (correlation ${r2(opposites.r)}).`
                : `They agreed least of anyone over ${opposites.shared} acts (correlation ${r2(opposites.r)}).`));
        }

        const stats = scored.map(entry => {
            const values = [...entry.scores.values()];
            return { id: entry.ballot.guestId, mean: mean(values), spread: Math.sqrt(variance(values)) };
        });
        const generous = best(stats, stat => stat.mean)!;
        const tough = best(stats, stat => -stat.mean)!;
        if (generous.mean !== tough.mean) {
            awards.push(award("euphoria", [generous.id], `An average of ${round1(generous.mean)} per act.`));
            awards.push(award("nul-points", [tough.id], `An average of ${round1(tough.mean)} per act.`));
        }
        const decisive = best(stats, stat => stat.spread)!;
        if (decisive.spread > 0) {
            awards.push(award("wind-machine", [decisive.id], `Scores swung ${round1(decisive.spread)} either side of their average.`));
        }
        // High and even: the average above the room's, the smallest spread among those.
        const roomMean = mean(stats.map(stat => stat.mean));
        const pleased = best(stats.filter(stat => stat.mean > roomMean), stat => -stat.spread);
        if (pleased) awards.push(award("lasha-tumbai", [pleased.id], `An average of ${round1(pleased.mean)}, never far from it.`));

        const standings = roomStandings(scored.map(entry => entry.ballot), actIds, categories, bonuses);
        const favourite = standings[0];
        if (favourite && favourite.votes >= 2) {
            const raters = scored.filter(entry => entry.scores.has(favourite.actId));
            const lowest = best(raters, entry => -entry.scores.get(favourite.actId)!)!;
            if (lowest.scores.get(favourite.actId)! < favourite.average) {
                awards.push(award("hatari", [lowest.ballot.guestId], `Gave the room's favourite ${round1(lowest.scores.get(favourite.actId)!)} against the room's ${round1(favourite.average)}.`));
            }
        }

        if (bonuses.length > 0) {
            const ticks = scored.map(entry => ({
                id: entry.ballot.guestId,
                count: Object.values(entry.ballot.bonuses).reduce((sum, ids) => sum + ids.filter(id => bonuses.some(b => b.id === id)).length, 0),
            }));
            const babushka = best(ticks, tick => tick.count)!;
            if (babushka.count > 0) awards.push(award("babushki", [babushka.id], `${babushka.count} bonuses ticked.`));
        }
    }

    if (predictions && predictions.size > 0) {
        const ranked = predictionLeaderboard(ballots, predictions);
        const top = ranked[0];
        if (top && top.prediction.points > 0) {
            awards.push(award("johnny-logan", [top.guestId], `${top.prediction.points} closeness points.`));
        }
    }
    return awards;
};

/**
 * Guests ordered by closeness to the real result: most points, then the
 * fewest places off, then by name.
 */
export const predictionLeaderboard = (
    ballots: Pick<Ballot, "guestId" | "name">[],
    predictions: Map<string, Prediction>,
): { guestId: string; name: string; prediction: Prediction }[] =>
    ballots
        .filter(ballot => predictions.has(ballot.guestId))
        .map(ballot => ({ guestId: ballot.guestId, name: ballot.name, prediction: predictions.get(ballot.guestId)! }))
        .sort((a, b) =>
            b.prediction.points - a.prediction.points ||
            a.prediction.distance - b.prediction.distance ||
            a.name.localeCompare(b.name));
