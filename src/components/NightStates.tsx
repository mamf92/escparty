import { useNavigate } from "react-router-dom";
import { CalmNote } from "./CalmPage";
import { Control, Ground, Pane } from "../design";

/*
 * The error states every party night screen shares (#233,
 * docs/design/design-system.md, "States"): what happened in a note, then a
 * control for the way out. Like PartyStates, for nights.
 */

/** No night has this code: say so, and offer another go at the code. */
export const NightNotFound = ({ code }: { code: string | undefined }) => {
    const navigate = useNavigate();
    return (
        <>
            <CalmNote role="alert">
                {code ? `No party night with the code ${code}.` : "That link has no party night code in it."} Check the code with the host.
            </CalmNote>
            <Ground>
                <Pane>
                    <Control onClick={() => navigate("/join")}>Back to Join</Control>
                </Pane>
            </Ground>
        </>
    );
};

/**
 * The night couldn't be reached: a listener failed, and Firestore doesn't
 * restart one that has. "Try again" attaches them afresh (useNightData's
 * retry), keeping whatever the screen already shows.
 */
export const NightError = ({ error, onRetry }: { error: string; onRetry: () => void }) => (
    <>
        <CalmNote role="alert">{error}</CalmNote>
        <Ground>
            <Pane>
                <Control onClick={onRetry}>Try again</Control>
            </Pane>
        </Ground>
    </>
);
