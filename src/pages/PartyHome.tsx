import { useId, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { CalmLink, CalmNote, CalmPage } from "../components/CalmPage";
import { Control, Field, Ground, Pane } from "../design";
import { lastPartyCode } from "../utils/partySession";

const CODE_PATTERN = /^[A-Z]{4}$/;

/**
 * The way into a scoreboard party (#79, #88): host one, join one with its
 * code, or open one's big screen on the TV. A device that was in a party
 * gets a way straight back.
 */
const PartyHome = () => {
    const navigate = useNavigate();
    const codeId = useId();
    const [code, setCode] = useState("");
    const [tried, setTried] = useState(false);
    const [previous] = useState(lastPartyCode);
    const valid = CODE_PATTERN.test(code);

    const go = (path: (code: string) => string) => {
        setTried(true);
        if (valid) navigate(path(code));
    };
    // Enter in the code field joins: the form's one submit, and its last control.
    const join = (event: FormEvent) => {
        event.preventDefault();
        go(value => `/party/${value}`);
    };

    return (
        <CalmPage
            title="Scoreboard party"
            subtitle="Rate every act of Burgas 2027 together, see who called the winner, and find out who in the room rated like twins."
            footer={<CalmLink onClick={() => navigate("/")}>Back to ESCParty</CalmLink>}
        >
            <Ground>
                <Pane>
                    {previous && (
                        <Control onClick={() => navigate(`/party/${previous}`)}>
                            Back to party {previous}
                        </Control>
                    )}
                    <Control onClick={() => navigate("/party/new")}>Host a party</Control>
                </Pane>
            </Ground>

            <h2 className="esc-note">Got a code from the host?</h2>
            <form onSubmit={join} noValidate>
                <Ground>
                    <Pane>
                        <div>
                            <label className="calm-label" htmlFor={codeId}>Party code</label>
                            <Field
                                id={codeId}
                                value={code}
                                maxLength={4}
                                autoCapitalize="characters"
                                autoComplete="off"
                                placeholder="ABBA"
                                aria-invalid={tried && !valid}
                                aria-describedby={tried && !valid ? `${codeId}-problem` : undefined}
                                onChange={event => setCode(event.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
                            />
                            {tried && !valid && <CalmNote id={`${codeId}-problem`} role="alert">A party code is four letters, like ABBA.</CalmNote>}
                        </div>
                        <Control onClick={() => go(value => `/party/${value}/screen`)}>Open the big screen</Control>
                        <Control type="submit" elevation="high">Join to rate</Control>
                    </Pane>
                </Ground>
            </form>
            <CalmNote>The big screen is for the TV: it shows the room's standings, never anyone's own ratings.</CalmNote>
        </CalmPage>
    );
};

export default PartyHome;
