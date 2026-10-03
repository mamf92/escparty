import type { ReactNode } from "react";
import { Ground, Pane, Row } from "../design";
import type { Player } from "../utils/roomsFirestore";
import { placePlayers, points, someoneLeads } from "../utils/finale";

/**
 * The room's standings as a list on the surface (docs/design/design-system.md,
 * "Row"): the mid-quiz break and the observer host's screen share it.
 *
 * Places and their order are the final results' (`placePlayers`): players
 * on the same score share a place, by name within it. Elevation carries
 * the rank: the leader (all of them, on a tie) and your own row stand
 * proud, everyone else rests; when nobody leads (two or more, all level),
 * only your own row does.
 */
export const Standings = ({ players, label, meId, detail, empty, live = false }: {
  players: readonly Player[];
  /** The list's accessible name, e.g. "Standings at the break". */
  label: string;
  /** This viewer's player ID: their row says "(you)" and stands proud. */
  meId?: string | null;
  /** A second line under a player's row, e.g. whether they're ready. */
  detail?: (player: Player) => ReactNode;
  /** The information row shown when there's nobody to rank yet. */
  empty: string;
  /**
   * Announce changes politely. For a list that settles while the screen is
   * up (the break); leave it off where a status note already says what
   * changed (the host's view), or every score write is read out.
   */
  live?: boolean;
}) => {
  const ranked = placePlayers(players);
  const leads = someoneLeads(ranked);
  return (
    <Ground>
      <Pane as="ol" aria-label={label} aria-live={live ? "polite" : undefined}>
        {ranked.length === 0 ? (
          <Row as="li">{empty}</Row>
        ) : ranked.map(({ player, place }) => {
          const mine = !!meId && player.id === meId;
          const extra = detail?.(player);
          return (
            <Row key={player.id} as="li" elevation={(leads && place === 1) || mine ? "high" : "rest"}>
              <span className="calm-row">
                <span>{place}. {player.name}{mine ? " (you)" : ""}</span>
                <span>{points(player.score)}</span>
              </span>
              {extra != null && <span className="calm-sub">{extra}</span>}
            </Row>
          );
        })}
      </Pane>
    </Ground>
  );
};
