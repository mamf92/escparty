import type { Player } from "./roomsFirestore";

/**
 * The quiz finale (#67): the final standings and the order they're revealed
 * in. Pure, so the results page and its tests agree on who placed where.
 */

export interface Placed {
    player: Player;
    /** 1-based; tied scores share a place (1, 1, 3). */
    place: number;
}

/** A score in words: "1 point", "700 points". */
export const points = (score: number) => (score === 1 ? "1 point" : `${score} points`);

/** Players best first, ties sharing a place, then by name so the order is stable. */
export const placePlayers = (players: readonly Player[]): Placed[] => {
    const sorted = [...players].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    return sorted.map(player => ({
        player,
        place: sorted.findIndex(other => other.score === player.score) + 1,
    }));
};

/**
 * Whether anyone leads: a lone player does, and a field that's all level
 * (two or more on one score) doesn't. Standings raise first place only
 * when someone leads, so a tie for everyone doesn't raise every row.
 */
export const someoneLeads = (placed: readonly Placed[]): boolean =>
    placed.length === 1 || placed.some(({ place }) => place > 1);

/**
 * How many rows are showing after each tap of the reveal, counted from the
 * bottom. Everyone below the podium comes out together first (if there is
 * anyone), then third, second and first place one at a time. A tie comes
 * out together. The last step shows everyone.
 */
export const revealSteps = (placed: Placed[]): number[] => {
    const steps: number[] = [];
    const belowPodium = placed.filter(entry => entry.place > 3).length;
    if (belowPodium > 0) steps.push(belowPodium);
    for (const place of [3, 2, 1]) {
        const through = placed.filter(entry => entry.place >= place).length;
        if (through > (steps[steps.length - 1] ?? 0)) steps.push(through);
    }
    return steps;
};

/** The podium's names, in the language of the scoreboard. */
export const PODIUM_POINTS: Record<number, string> = {
    1: "Douze points",
    2: "Dix points",
    3: "Huit points",
};

/** The line that crowns the winner, or null without players. */
export const winnerLine = (placed: Placed[]): string | null => {
    const winners = placed.filter(entry => entry.place === 1).map(entry => entry.player);
    if (winners.length === 0) return null;
    const score = winners[0].score;
    if (winners.length === 1) return `${winners[0].name} wins with ${points(score)}!`;
    return `A tie at the top: ${winners.map(winner => winner.name).join(" and ")}, ${points(score)} each!`;
};

/**
 * What the next tap of the reveal shows, given how many rows are showing:
 * "the rest" (everyone below the podium), "3rd place", "2nd place", or the
 * winner (or winners, in a tie).
 */
export const nextRevealLabel = (placed: Placed[], shown: number): string => {
    const next = placed[placed.length - shown - 1];
    if (!next || next.place > 3) return "the rest";
    if (next.place === 1) return placed.filter(entry => entry.place === 1).length > 1 ? "the winners" : "the winner";
    const tied = placed.filter(entry => entry.place === next.place).length > 1;
    return `${next.place === 2 ? "2nd" : "3rd"} place${tied ? " (a tie)" : ""}`;
};

/**
 * How many rows are showing after `step` taps of the reveal (0 before the
 * first; taps past the last show everyone). The page draws this many rows
 * and the announcement below speaks the same count, so they can't drift.
 */
export const revealedCount = (steps: readonly number[], step: number): number =>
    step <= 0 || steps.length === 0 ? 0 : steps[Math.min(step, steps.length) - 1];

/** Whether the reveal is over after `step` taps: everyone is showing. */
export const revealDone = (steps: readonly number[], step: number): boolean =>
    steps.length > 0 && step >= steps.length;

/**
 * What the reveal says out loud after `step` taps (0 before the first):
 * how many are on the board, then the rows the last tap added, then the
 * winner line once everyone is showing. The standings list isn't a live
 * region, so a screen reader hears each reveal from this line instead.
 * Pass the page's `steps` so both read the same reveal.
 */
export const revealAnnouncement = (placed: Placed[], step: number, steps: readonly number[] = revealSteps(placed)): string => {
    if (step === 0 || steps.length === 0) {
        return `${placed.length === 1 ? "1 player is" : `${placed.length} players are`} on the scoreboard. Start the reveal when the room is ready.`;
    }
    if (revealDone(steps, step)) return winnerLine(placed) ?? "";
    const shown = revealedCount(steps, step);
    const before = revealedCount(steps, step - 1);
    return `On the board: ${placed
        .slice(placed.length - shown, placed.length - before)
        .map(({ player, place }) => `place ${place}, ${player.name}, ${points(player.score)}`)
        .join("; ")}.`;
};
