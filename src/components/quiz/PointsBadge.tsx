/**
 * The player's points so far, as a pill beside "Question N of M": a small
 * "Points" label and the value big in the display font, on the dark tile
 * material. Quiz-local for now; it can give way to a shared badge later.
 *
 * Screen readers get one plain sentence instead of the label and the number
 * as two fragments.
 */
export const PointsBadge = ({ points }: {
  /** The points to show. */
  points: number;
}) => (
  <p className="quiz-points-badge">
    <span className="quiz-points-label" aria-hidden="true">Points</span>
    <span className="quiz-points-value" aria-hidden="true">{points}</span>
    <span className="esc-visually-hidden">Points so far: {points}</span>
  </p>
);
