import type { ReactNode } from "react";
import { Ground, Pane, Row } from "../design";
import type { Player } from "../utils/roomsFirestore";

/** "1 point", "700 points". */
const points = (score: number) => (score === 1 ? "1 point" : `${score} points`);

/**
 * Players in order, highest score first, each with their place. Players on
 * the same score share a place (two on 900 are both 1st; the next is 3rd).
 */
const rankPlayers = (players: readonly Player[]) => {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  return sorted.map(player => ({
    player,
    place: sorted.findIndex(other => other.score === player.score) + 1,
  }));
};

/**
 * The room's standings as a list on the surface (docs/design/design-system.md,
 * "Row"): the mid-quiz break and the observer host's screen share it.
 *
 * Elevation carries the rank: the leader (all of them, on a tie) and your
 * own row stand proud, everyone else rests. The list is a polite live
 * region, since the scores and the ready marks change on their own.
 */
export const Standings = ({ players, label, meId, detail, empty }: {
  players: readonly Player[];
  /** The list's accessible name, e.g. "Standings at the break". */
  label: string;
  /** This viewer's player ID: their row says "(you)" and stands proud. */
  meId?: string | null;
  /** A second line under a player's row, e.g. whether they're ready. */
  detail?: (player: Player) => ReactNode;
  /** The information row shown when there's nobody to rank yet. */
  empty: string;
}) => {
  const ranked = rankPlayers(players);
  return (
    <Ground>
      <Pane as="ol" aria-label={label} aria-live="polite">
        {ranked.length === 0 ? (
          <Row as="li">{empty}</Row>
        ) : ranked.map(({ player, place }) => {
          const mine = !!meId && player.id === meId;
          const extra = detail?.(player);
          return (
            <Row key={player.id} as="li" elevation={place === 1 || mine ? "high" : "rest"}>
              <span className="calm-row">
                <span>{place}. {player.name}{mine ? " (you)" : ""}</span>
                <span>{points(player.score)}</span>
              </span>
              {extra && <span className="calm-sub">{extra}</span>}
            </Row>
          );
        })}
      </Pane>
    </Ground>
  );
};
