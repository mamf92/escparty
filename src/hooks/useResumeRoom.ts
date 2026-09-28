import { useCallback, useRef, useState } from "react";
import { resumeAfterMidQuiz } from "../utils/roomsFirestore";

/**
 * The host's Continue at a mid-quiz break (#63), shared by
 * MidQuizScoreboard and HostObserverView. Only the host can resume the
 * room, so a failure is a retryable message rather than a dead end, and a
 * second tap while a resume is in flight is ignored. Nobody navigates from
 * here: every page follows the room's phase once the resume lands.
 */
export const useResumeRoom = (roomCode: string | null) => {
    // A ref, not the state below: two taps in the same render would both
    // see `resuming === false`.
    const inFlightRef = useRef(false);
    const [resuming, setResuming] = useState(false);
    const [resumeError, setResumeError] = useState<string | null>(null);

    const resume = useCallback(async () => {
        if (!roomCode || inFlightRef.current) return;
        inFlightRef.current = true;
        setResuming(true);
        setResumeError(null);
        try {
            // False: the room wasn't in a break (another tab already
            // resumed it, or there's no break on). Say so rather than
            // looking like nothing happened.
            const resumed = await resumeAfterMidQuiz(roomCode);
            if (!resumed) {
                setResumeError("The quiz isn't at a break right now, so there's nothing to continue.");
            }
        } catch (err) {
            console.error("Error resuming the room after the mid-quiz break:", err);
            setResumeError("Couldn't continue the quiz. Check your connection and try again.");
        } finally {
            inFlightRef.current = false;
            setResuming(false);
        }
    }, [roomCode]);

    return { resume, resuming, resumeError };
};
