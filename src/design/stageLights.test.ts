import { describe, expect, it } from "vitest";
import { BALL_GRID, CALM_BALL, RESTING_LIGHT, SPARKLE_BALL, SPIN, ballCells, ballSpots, lampDirection } from "./stageLights";

const lamp = lampDirection(RESTING_LIGHT.x, RESTING_LIGHT.y);
const luminance = ([r, g, b]: readonly number[]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

describe("the disco ball", () => {
  it("paints a round ball on its grid, empty in the corners", () => {
    const cells = ballCells(CALM_BALL, lamp, 0);
    expect(cells).toHaveLength(BALL_GRID * BALL_GRID);
    expect(cells[0]).toBeNull();
    expect(cells[BALL_GRID * (BALL_GRID / 2) + BALL_GRID / 2]).not.toBeNull();
  });

  it("is muted in Calm and brighter in Sparkle", () => {
    const mean = (look: typeof CALM_BALL) => {
      const lit = ballCells(look, lamp, 0).filter((cell): cell is NonNullable<typeof cell> => cell !== null);
      return lit.reduce((sum, cell) => sum + luminance(cell), 0) / lit.length;
    };
    expect(mean(SPARKLE_BALL)).toBeGreaterThan(mean(CALM_BALL));
  });

  it("throws more spots in Sparkle than in Calm, each on the stage", () => {
    const calm = ballSpots(CALM_BALL, lamp, 0, 0.1);
    const sparkle = ballSpots(SPARKLE_BALL, lamp, 0, 0.1);
    expect(sparkle.length).toBeGreaterThan(calm.length);
    for (const spot of sparkle) {
      expect(spot.x).toBeGreaterThanOrEqual(-0.05);
      expect(spot.x).toBeLessThanOrEqual(1.05);
      expect(spot.alpha).toBeLessThanOrEqual(1);
    }
  });

  it("turns so its spots sweep the room left to right, slowly", () => {
    // A tenth of a second of turning moves the spots right, a little.
    const before = ballSpots(SPARKLE_BALL, lamp, 1, 0.1);
    const after = ballSpots(SPARKLE_BALL, lamp, 1 + SPIN * 0.1, 0.1);
    const shared = Math.min(before.length, after.length);
    const moves = Array.from({ length: shared }, (_, i) => after[i].x - before[i].x);
    const mean = moves.reduce((a, b) => a + b, 0) / shared;
    expect(SPIN).toBeLessThan(0);
    expect(mean).toBeGreaterThan(0);
    expect(mean).toBeLessThan(0.05);
  });
});
