import { describe, expect, it } from "vitest";
import { BALL_GRID, CALM_BALL, RESTING_LIGHT, SPARKLE_BALL, SPIN, ballCells, ballSpots, lampDirection } from "./stageLights";

/** A phone-sized stage with a 96px ball hanging near the top. */
const VIEW = { width: 390, height: 844, centreY: 104, radius: 48 };
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
    const calm = ballSpots(CALM_BALL, lamp, 0, VIEW);
    const sparkle = ballSpots(SPARKLE_BALL, lamp, 0, VIEW);
    expect(calm.length).toBeGreaterThan(0);
    expect(sparkle.length).toBeGreaterThan(calm.length);
    for (const spot of sparkle) {
      expect(spot.x + spot.width).toBeGreaterThanOrEqual(0);
      expect(spot.x - spot.width).toBeLessThanOrEqual(VIEW.width);
      expect(spot.alpha).toBeGreaterThan(0);
      expect(spot.alpha).toBeLessThanOrEqual(1);
    }
  });

  it("fills the stage above and below the ball, not just one side", () => {
    const spots = ballSpots(SPARKLE_BALL, lamp, 0.4, VIEW);
    const above = spots.filter(spot => spot.y < VIEW.centreY - VIEW.radius);
    const below = spots.filter(spot => spot.y > VIEW.centreY + VIEW.radius);
    expect(above.length).toBeGreaterThan(2);
    expect(below.length).toBeGreaterThan(2);
    // The rows reach towards both ends of the stage, and the cap is a real limit.
    expect(Math.min(...spots.map(spot => spot.y))).toBeLessThan(VIEW.centreY * 0.4);
    expect(Math.max(...spots.map(spot => spot.y))).toBeGreaterThan(VIEW.height * 0.6);
    expect(spots.length).toBeLessThanOrEqual(SPARKLE_BALL.maxSpots);
    expect(spots.length).toBeGreaterThan(30);
  });

  it("throws no spot from a facet the lamp does not light", () => {
    for (const aim of [lamp, lampDirection(0.8, 0.5), lampDirection(-0.9, -0.6)]) {
      for (const phase of [0, 0.4, 2.1]) {
        for (const spot of ballSpots(SPARKLE_BALL, aim, phase, VIEW)) {
          const o = (spot.column + 0.5) * (Math.PI / 12) - phase;
          const a = (spot.row + 0.5) * (Math.PI / 12);
          const n = [Math.cos(a) * Math.sin(o), Math.sin(a), Math.cos(a) * Math.cos(o)];
          expect(n[0] * aim[0] + n[1] * aim[1] + n[2] * aim[2]).toBeGreaterThan(0);
        }
      }
    }
  });

  it("throws squarish spots, one per facet, never wider than tall by much at the front", () => {
    for (const spot of ballSpots(SPARKLE_BALL, lamp, 0.4, VIEW)) {
      expect(spot.width).toBeLessThanOrEqual(spot.height * 3);
      expect(spot.height).toBeLessThanOrEqual(spot.width * 6);
      expect(Math.abs(spot.rotation)).toBeLessThan(0.35);
    }
    const spots = ballSpots(SPARKLE_BALL, lamp, 0.4, VIEW);
    const facets = spots.map(spot => `${spot.row}/${spot.column}`);
    expect(new Set(facets).size).toBe(spots.length);
  });

  it("lines the spots up in rows, one y for each facet row, whatever the lamp", () => {
    for (const aim of [lamp, lampDirection(0.6, 0.2), lampDirection(-0.9, -0.3)]) {
      const rows = new Map<number, Set<number>>();
      for (const spot of ballSpots(SPARKLE_BALL, aim, 2.1, VIEW)) {
        rows.set(spot.row, (rows.get(spot.row) ?? new Set()).add(Number(spot.y.toFixed(6))));
      }
      expect(rows.size).toBeGreaterThan(3);
      for (const ys of rows.values()) expect(ys.size).toBe(1);
    }
  });

  it("keeps rows in order down the stage and lets the lamp nudge them all together", () => {
    const rowY = (aim: ReturnType<typeof lampDirection>) => {
      const ys = new Map<number, number>();
      for (const spot of ballSpots(SPARKLE_BALL, aim, 0.7, VIEW)) ys.set(spot.row, spot.y);
      return ys;
    };
    const a = rowY(lamp);
    const rows = [...a.keys()].sort((p, q) => p - q);
    // A higher facet row (more latitude) lands higher up: a smaller y.
    for (let i = 1; i < rows.length; i += 1) expect(a.get(rows[i])).toBeLessThan(a.get(rows[i - 1])!);
    const b = rowY(lampDirection(0.3, 0.1));
    const shared = rows.filter(row => b.has(row));
    const shifts = shared.map(row => b.get(row)! - a.get(row)!);
    shifts.forEach(shift => expect(shift).toBeCloseTo(shifts[0], 6));
  });

  it("never throws a spot over the ball", () => {
    for (const phase of [0, 0.4, 1.3, 2.9, 5.5]) {
      for (const aim of [lamp, lampDirection(0, 0), lampDirection(0.8, 0.5)]) {
        for (const look of [CALM_BALL, SPARKLE_BALL]) {
          for (const spot of ballSpots(look, aim, phase, VIEW)) {
            const gap = Math.hypot(spot.x - VIEW.width / 2, spot.y - VIEW.centreY) - 0.65 * Math.hypot(spot.width, spot.height);
            expect(gap).toBeGreaterThan(VIEW.radius);
          }
        }
      }
    }
  });

  it("turns clockwise, so its spots sweep the room right to left, slowly, in step with the ball", () => {
    const step = SPIN * 0.1; // a tenth of a second of turning
    const before = ballSpots(SPARKLE_BALL, lamp, 1, VIEW);
    const after = new Map(ballSpots(SPARKLE_BALL, lamp, 1 + step, VIEW).map(spot => [`${spot.row}/${spot.column}`, spot]));
    const moves = before.flatMap(spot => {
      const next = after.get(`${spot.row}/${spot.column}`);
      return next ? [next.x - spot.x] : [];
    });
    expect(SPIN).toBeGreaterThan(0);
    expect(moves.length).toBeGreaterThan(10);
    // Every spot that stays moves left, never more than the ball's own turn, magnified onto the wall.
    for (const move of moves) {
      expect(move).toBeLessThan(0);
      expect(-move).toBeLessThanOrEqual(VIEW.width * 0.62 * step + 1e-6);
    }
    const mean = moves.reduce((a, b) => a + b, 0) / moves.length;
    expect(-mean).toBeLessThan(VIEW.width * 0.05);
  });

  it("comes round to the same pattern after a full turn, instead of reshuffling", () => {
    const phase = 0.0005;
    const turned = phase + Math.PI * 2;
    expect(ballCells(SPARKLE_BALL, lamp, turned)).toEqual(ballCells(SPARKLE_BALL, lamp, phase));
    const before = ballSpots(SPARKLE_BALL, lamp, phase, VIEW);
    const after = ballSpots(SPARKLE_BALL, lamp, turned, VIEW);
    expect(after.length).toBe(before.length);
    after.forEach((spot, i) => expect(spot.x).toBeCloseTo(before[i].x, 6));
  });
});
