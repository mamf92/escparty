import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalmLink, CalmNote, CalmPage } from "../components/CalmPage";
import { lastPartyCode } from "../utils/partySession";

const CODE_PATTERN = /^[A-Z]{4}$/;

/**
 * The way into a scoreboard party (#79, #88): host one, join one with its
 * code, or open one's big screen on the TV. A device that was in a party
 * gets a way straight back.
 */
const PartyHome = () => {
    const navigate = useNavigate();
    const [code, setCode] = useState("");
    const [tried, setTried] = useState(false);
    const [previous] = useState(lastPartyCode);
    const valid = CODE_PATTERN.test(code);

    const go = (path: (code: string) => string) => {
        setTried(true);
        if (valid) navigate(path(code));
    };

    return (
        <CalmPage
            title="Scoreboard party"
            subtitle="Rate every act of Burgas 2027 together, see who called the winner, and find out who in the room rated like twins."
            footer={<CalmLink type="button" onClick={() => navigate("/")}>Back to ESCParty</CalmLink>}
        >
            <div className="calm-ground">
                <div className="lycra-pane">
                    {previous && (
                        <button type="button" className="lycra" onClick={() => navigate(`/party/${previous}`)}>
                            Back to party {previous}
                        </button>
                    )}
                    <button type="button" className="lycra" onClick={() => navigate("/party/new")}>
                        Host a party
                    </button>
                </div>
            </div>

            <div className="calm-ground">
                <div className="lycra-pane">
                    <label>
                        <span className="calm-label">Party code</span>
                        <input
                            className="lycra-field"
                            value={code}
                            maxLength={4}
                            autoCapitalize="characters"
                            placeholder="ABBA"
                            onChange={event => setCode(event.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
                        />
                    </label>
                </div>
            </div>
            {tried && !valid && <CalmNote role="alert">A party code is four letters.</CalmNote>}
            <div className="calm-ground">
                <div className="lycra-pane">
                    <button type="button" className="lycra" onClick={() => go(value => `/party/${value}`)}>
                        Join to rate
                    </button>
                    <button type="button" className="lycra" onClick={() => go(value => `/party/${value}/screen`)}>
                        Open the big screen
                    </button>
                </div>
            </div>
            <CalmNote>The big screen is for the TV: it shows the room's standings, never anyone's own ratings.</CalmNote>
        </CalmPage>
    );
};

export default PartyHome;
