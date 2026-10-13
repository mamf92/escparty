import { Ground, Pane, Row } from "../design";
import type { NightActivity, NightActivityKind } from "../utils/nightsFirestore";

const KIND_LABELS: Record<NightActivityKind, string> = { quiz: "Quiz", scoreboard: "Scoreboard" };

/**
 * The "Now on" section of a party night (#233): what has been added to the
 * evening so far, in the order it was added. For now each activity is an
 * information tile (what it is and what it's called); a later step turns
 * them into cards a guest can open, which is why this is its own component.
 * Used on the guests' phones and on the TV.
 */
export const NightActivities = ({ activities }: { activities: readonly NightActivity[] }) => (
    <>
        <h2 className="esc-section">Now on</h2>
        <Ground>
            {activities.length === 0 ? (
                <Pane>
                    <Row>Nothing on yet. The host will start a quiz or a scoreboard soon.</Row>
                </Pane>
            ) : (
                <Pane as="ul" aria-label="Now on">
                    {activities.map(activity => (
                        <Row as="li" key={`${activity.kind}-${activity.code}`}>
                            <span className="calm-sub">{KIND_LABELS[activity.kind]}</span>
                            <span>{activity.title}</span>
                        </Row>
                    ))}
                </Pane>
            )}
        </Ground>
    </>
);
