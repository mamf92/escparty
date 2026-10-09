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

  it("makes spots aimed more directly at the viewer brighter, for the same facet look", () => {
    const spots = ballSpots(SPARKLE_BALL, lampDirection(0, 0), 0.4, VIEW).filter(spot => spot.glare === 0);
    expect(spots.length).toBeGreaterThan(8);
    const sorted = [...spots].sort((a, b) => a.directness - b.directness);
    const low = sorted.slice(0, 4);
    const high = sorted.slice(-4);
    const mean = (list: typeof spots) => list.reduce((sum, spot) => sum + spot.alpha, 0) / list.length;
    expect(high[0].directness).toBeGreaterThan(low[3].directness);
    expect(mean(high)).toBeGreaterThan(mean(low));
    // Calm keeps its single spot colour and strength, so only the aim differs there too.
    const calm = ballSpots(CALM_BALL, lamp, 0, VIEW);
    const best = calm.reduce((a, b) => (b.directness > a.directness ? b : a));
    const worst = calm.reduce((a, b) => (b.directness < a.directness ? b : a));
    expect(best.alpha).toBeGreaterThan(worst.alpha);
  });

  it("shows light in front of the ball only over its disc, brightest where it faces the viewer", () => {
    const all = [0, 0.4, 1.3, 2.9].flatMap(phase => ballSpots(SPARKLE_BALL, lampDirection(0, 0), phase, VIEW));
    const glare = all.filter(spot => spot.glare > 0);
    expect(glare.length).toBeGreaterThan(0);
    for (const spot of glare) expect(Math.hypot(spot.x - VIEW.width / 2, spot.y - VIEW.centreY)).toBeLessThan(VIEW.radius);
    // The brightest glare comes from the facets facing the viewer most directly.
    const sorted = [...glare].sort((a, b) => a.directness - b.directness);
    expect(sorted.at(-1)!.alpha).toBeGreaterThan(sorted[0].alpha);
    // Calm, at its resting lamp, keeps its glare faint.
    const calm = Array.from({ length: 48 }, (_, i) => ballSpots(CALM_BALL, lamp, (i * Math.PI) / 24, VIEW)).flat().filter(spot => spot.glare > 0);
    expect(calm.length).toBeGreaterThan(0);
    for (const spot of calm) expect(spot.alpha).toBeLessThan(0.45);
    expect(CALM_BALL.glare).toBeLessThan(SPARKLE_BALL.glare);
  });

  it("fades glare in and out as a spot crosses the ball's edge, never jumping in one frame", () => {
    // One frame at 60fps; a little over a facet's width of turn sees spots cross the edge.
    const step = SPIN / 60;
    let jump = 0;
    let crossed = 0;
    for (const aim of [lamp, lampDirection(0, 0), lampDirection(0.3, -0.2)]) {
      let before = new Map(ballSpots(SPARKLE_BALL, aim, 0, VIEW).map(spot => [`${spot.row}/${spot.column}`, spot]));
      for (let phase = step; phase < 0.6; phase += step) {
        const now = ballSpots(SPARKLE_BALL, aim, phase, VIEW);
        for (const spot of now) {
          const was = before.get(`${spot.row}/${spot.column}`);
          if (!was) continue;
          if ((spot.glare > 0) !== (was.glare > 0)) crossed += 1;
          jump = Math.max(jump, Math.abs(spot.glare - was.glare), Math.abs(spot.alpha - was.alpha));
        }
        before = new Map(now.map(spot => [`${spot.row}/${spot.column}`, spot]));
      }
    }
    expect(crossed).toBeGreaterThan(0);
    expect(jump).toBeLessThan(0.08);
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
