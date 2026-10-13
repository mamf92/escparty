/**
 * What a party night does with its activities on this device's behalf (#235,
 * #236): numbering the next quiz, and tidying up behind a guest who leaves.
 */
import type { NightActivity } from "./nightsFirestore";
import type { NightIdentity } from "./nightSession";
import { fetchBallot, leaveParty } from "./partyFirestore";
import { clearPartyIdentity } from "./partySession";
import { getRoom, removePlayerFromRoom, type Room } from "./roomsFirestore";

/**
 * What the night's next quiz is called: "Quiz" the first time, then "Quiz 2",
 * "Quiz 3"… The quiz itself is picked in its waiting room, so the list names
 * the order they were played in rather than a quiz that may still change.
 */
export const nextQuizTitle = (activities: readonly NightActivity[]): string => {
    const quizzes = activities.filter(activity => activity.kind === "quiz").length;
    return quizzes === 0 ? "Quiz" : `Quiz ${quizzes + 1}`;
};

/** Where a quiz room is, for a card or the TV: waiting for players, being played, or done. */
export type QuizStage = "lobby" | "running" | "results";

export const quizStage = (room: Room): QuizStage =>
    room.phase === "results" ? "results" : room.started || (room.phase ?? "lobby") !== "lobby" ? "running" : "lobby";

/**
 * Best effort, before a guest leaves the night: out of every scoreboard
 * where they have a ballot (their name is free again, and the party's
 * stored identity goes), and out of every quiz still in its lobby that lists
 * them, unless they are its host. A started quiz keeps its players, as a
 * quiz always has. One failure never blocks the rest, or the leave itself:
 * they are logged, since the guest is leaving all the same.
 */
export const leaveNightActivities = async (activities: readonly NightActivity[], identity: NightIdentity): Promise<void> => {
    await Promise.all(activities.map(async activity => {
        try {
            if (activity.kind === "scoreboard") {
                const ballot = await fetchBallot(activity.code, identity.guestId);
                if (ballot) await leaveParty(activity.code, identity.guestId, ballot.name);
                clearPartyIdentity(activity.code);
                return;
            }
            const room = await getRoom(activity.code);
            if (!room || room.hostId === identity.guestId || quizStage(room) !== "lobby") return;
            const self = room.players.find(player => player.id === identity.guestId);
            if (self) await removePlayerFromRoom(activity.code, self);
        } catch (error) {
            console.error(`Couldn't tidy up after leaving ${activity.title}:`, error);
        }
    }));
};
