import type { CSSProperties } from "react";

/*
 * Where the stars sit, in percent of the frame, with their size, delay and
 * colour. Fixed rather than random so a screenshot is the same every time.
 */
const STARS: readonly [number, number, number, number, string][] = [
  [6, 4, 12, 0, "#fff3c4"], [88, 7, 9, 1.1, "#ffd1ef"], [18, 22, 7, 2.2, "#c8f7ff"],
  [94, 31, 13, 0.6, "#fff3c4"], [3, 46, 9, 1.7, "#ffd1ef"], [91, 55, 7, 2.6, "#fff3c4"],
  [8, 71, 11, 0.3, "#c8f7ff"], [86, 79, 10, 1.4, "#fff3c4"], [14, 92, 8, 2.0, "#ffd1ef"],
  [70, 95, 12, 0.9, "#fff3c4"], [50, 2, 8, 1.9, "#ffd1ef"], [40, 97, 7, 2.4, "#c8f7ff"],
];

/**
 * Sparkle's glitter: decorative stars behind the screen's content, hidden from assistive
 * tech and from the pointer, shown only in Sparkle and only twinkling when
 * the system allows motion (sparkle.css).
 */
export const Sparkles = () => (
  <div className="esc-sparkles" aria-hidden="true">
    {STARS.map(([left, top, size, delay, glint], index) => (
      <i
        key={index}
        style={{
          left: `${left}%`,
          top: `${top}%`,
          "--size": `${size}px`,
          "--delay": `${delay}s`,
          "--dur": `${2.4 + (index % 4) * 0.5}s`,
          "--glint": glint,
        } as CSSProperties}
      />
    ))}
  </div>
);

export default Sparkles;
