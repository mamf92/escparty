import { describe, expect, it } from "vitest";
import { PODIUM_POINTS, nextRevealLabel, placePlayers, points, revealAnnouncement, revealDone, revealSteps, revealedCount, winnerLine } from "./finale";

const p = (name: string, score: number) => ({ id: name.toLowerCase(), name, score });

describe("finale", () => {
    it("says a score in words, one point singular", () => {
        expect([0, 1, 700].map(points)).toEqual(["0 points", "1 point", "700 points"]);
    });

    it("places players best first, ties sharing a place", () => {
        const placed = placePlayers([p("Lordi", 300), p("Abba", 500), p("Loreen", 500), p("Bucks", 100)]);
        expect(placed.map(entry => `${entry.place} ${entry.player.name}`)).toEqual(["1 Abba", "1 Loreen", "3 Lordi", "4 Bucks"]);
    });

    it("reveals everyone below the podium, then third, second and first", () => {
        const players = [p("A", 900), p("B", 800), p("C", 700), p("D", 600), p("E", 500)];
        expect(revealSteps(placePlayers(players))).toEqual([2, 3, 4, 5]);
        expect(revealSteps(placePlayers(players.slice(0, 3)))).toEqual([1, 2, 3]);
        expect(revealSteps(placePlayers([p("Solo", 10)]))).toEqual([1]);
        expect(revealSteps([])).toEqual([]);
    });

    it("reveals a tie together", () => {
        // Places 1, 1, 3: third, then both winners at once.
        expect(revealSteps(placePlayers([p("A", 5), p("B", 5), p("C", 1)]))).toEqual([1, 3]);
        // Places 1, 2, 2, 4: fourth, then both seconds, then first.
        expect(revealSteps(placePlayers([p("A", 9), p("B", 5), p("C", 5), p("D", 1)]))).toEqual([1, 3, 4]);
    });

    it("names the podium and the winner", () => {
        expect(PODIUM_POINTS[1]).toBe("Douze points");
        expect(winnerLine(placePlayers([p("Loreen", 12), p("Lordi", 3)]))).toBe("Loreen wins with 12 points!");
        expect(winnerLine(placePlayers([p("Lordi", 1), p("Loreen", 0)]))).toBe("Lordi wins with 1 point!");
        expect(winnerLine(placePlayers([p("Loreen", 12), p("Abba", 12)]))).toBe("A tie at the top: Abba and Loreen, 12 points each!");
        expect(winnerLine([])).toBeNull();
    });

    it("says what the next tap reveals", () => {
        const five = placePlayers([p("A", 900), p("B", 800), p("C", 700), p("D", 600), p("E", 500)]);
        expect([0, 2, 3, 4].map(shown => nextRevealLabel(five, shown))).toEqual(["the rest", "3rd place", "2nd place", "the winner"]);
        const tiedTop = placePlayers([p("A", 5), p("B", 5), p("C", 1)]);
        expect(nextRevealLabel(tiedTop, 1)).toBe("the winners");
        const tiedSecond = placePlayers([p("A", 9), p("B", 5), p("C", 5)]);
        expect(nextRevealLabel(tiedSecond, 0)).toBe("2nd place (a tie)");
        expect(nextRevealLabel(tiedSecond, 3)).toBe("the rest");
    });

    it("says out loud what each tap put on the board", () => {
        const four = placePlayers([p("A", 9), p("B", 5), p("C", 5), p("D", 1)]);
        expect(revealAnnouncement(four, 0)).toBe("4 players are on the scoreboard. Start the reveal when the room is ready.");
        expect(revealAnnouncement(four, 1)).toBe("On the board: place 4, D, 1 point.");
        // A tie comes out, and is said, together.
        expect(revealAnnouncement(four, 2)).toBe("On the board: place 2, B, 5 points; place 2, C, 5 points.");
        expect(revealAnnouncement(four, 3)).toBe("A wins with 9 points!");
        // Past the last step it stays on the winner.
        expect(revealAnnouncement(four, 9)).toBe("A wins with 9 points!");
        expect(revealAnnouncement(placePlayers([p("Solo", 3)]), 0)).toBe("1 player is on the scoreboard. Start the reveal when the room is ready.");
    });

    it("counts the rows showing after each tap, and when the reveal is over", () => {
        const steps = [1, 3, 4];
        expect([0, 1, 2, 3, 9].map(step => revealedCount(steps, step))).toEqual([0, 1, 3, 4, 4]);
        expect(revealedCount([], 2)).toBe(0);
        expect([2, 3, 9].map(step => revealDone(steps, step))).toEqual([false, true, true]);
        expect(revealDone([], 0)).toBe(false);
    });
});
