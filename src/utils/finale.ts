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

/** Players best first, ties sharing a place, then by name so the order is stable. */
export const placePlayers = (players: Player[]): Placed[] => {
    const sorted = [...players].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    return sorted.map(player => ({
        player,
        place: sorted.findIndex(other => other.score === player.score) + 1,
    }));
};

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
    if (winners.length === 1) return `${winners[0].name} wins with ${score} points!`;
    return `A tie at the top: ${winners.map(winner => winner.name).join(" and ")}, ${score} points each!`;
};
