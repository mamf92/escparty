import { useNavigate } from "react-router-dom";
import { CalmNote } from "./CalmPage";
import { Control, Ground, Pane } from "../design";

/*
 * The error states every scoreboard party screen shares (#178,
 * docs/design/design-system.md section 6): what happened in a note, then a
 * control for the way out.
 */

/** No party has this code: say so, and offer another go at the code. */
export const PartyNotFound = ({ code }: { code: string | undefined }) => {
    const navigate = useNavigate();
    return (
        <>
            <CalmNote role="alert">
                {code ? `There's no party with the code ${code}.` : "That link has no party code in it."} Check the code with the host.
            </CalmNote>
            <Ground>
                <Pane>
                    <Control onClick={() => navigate("/party")}>Try another code</Control>
                </Pane>
            </Ground>
        </>
    );
};

/**
 * The party couldn't be reached: a listener failed, and Firestore doesn't
 * restart one that has. "Try again" attaches them afresh (usePartyData's
 * retry), keeping whatever the screen already shows.
 */
export const PartyError = ({ error, onRetry }: { error: string; onRetry: () => void }) => (
    <>
        <CalmNote role="alert">{error}</CalmNote>
        <Ground>
            <Pane>
                <Control onClick={onRetry}>Try again</Control>
            </Pane>
        </Ground>
    </>
);
