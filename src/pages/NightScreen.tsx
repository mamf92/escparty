import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toDataURL } from "qrcode";
import { CalmLink, CalmNote, CalmPage } from "../components/CalmPage";
import { NightScreenActivity } from "../components/NightScreenActivity";
import { NightError, NightNotFound } from "../components/NightStates";
import { Control, Ground, Pane, Row } from "../design";
import { useNightData } from "../hooks/useNightData";
import { nightLink } from "../utils/joinCode";
import "./party-calm.css";

/**
 * A party night's big screen for the TV (#233): a QR code and the code to
 * join, the night's title, how many are here, and the newest activity in
 * full (#238). It shows no guest names of the night, like the scoreboard
 * party's screen, so it is safe on a wall; a quiz names its own players.
 * A night that has moved on points at its new screen; one that is over says
 * so.
 */
const NightScreen = () => {
    const navigate = useNavigate();
    const code = useParams().code?.toUpperCase();
    const { night, guests, error, retry } = useNightData(code);
    const [qr, setQr] = useState<string | null>(null);
    const link = code ? nightLink(code) : "";

    useEffect(() => {
        if (!link) return;
        let live = true;
        toDataURL(link, { margin: 1, width: 320 })
            .then(url => live && setQr(url))
            .catch(err => console.error("Couldn't draw the QR code:", err));
        return () => {
            live = false;
        };
    }, [link]);

    const back = <CalmLink onClick={() => navigate(code ? `/n/${code}` : "/join")}>Back to my phone view</CalmLink>;

    if (night === undefined) {
        return (
            <CalmPage title="Party night" className="calm-screen" footer={back}>
                {error ? <NightError error={error} onRetry={retry} /> : <CalmNote role="status">Finding the party…</CalmNote>}
            </CalmPage>
        );
    }
    if (night === null) {
        // No night to go back to: back to Join instead.
        return (
            <CalmPage title="Party night" className="calm-screen" footer={<CalmLink onClick={() => navigate("/join")}>Back to Join</CalmLink>}>
                <NightNotFound code={code} />
            </CalmPage>
        );
    }
    if (night.movedTo) {
        const next = night.movedTo;
        return (
            <CalmPage
                title={night.title}
                className="calm-screen"
                footer={back}
                actions={(
                    <Ground>
                        <Pane>
                            <Control elevation="high" onClick={() => navigate(`/n/${next}/screen`)}>Show {next} on this screen</Control>
                        </Pane>
                    </Ground>
                )}
            >
                <CalmNote role="status">The party moved to {next}.</CalmNote>
            </CalmPage>
        );
    }

    return (
        <CalmPage
            title={night.title}
            subtitle={night.closed ? "This party night is over." : "Scan the code with your phone to join the party"}
            className="calm-screen"
            footer={back}
        >
            {!night.closed && (
                <Ground>
                    <Pane>
                        <Row>
                            {qr && <img className="party-qr" src={qr} alt={`QR code to join party night ${night.code}`} width={240} height={240} />}
                            <span className="calm-row">
                                <span>Party night code</span>
                                <span className="esc-selectable">{night.code}</span>
                            </span>
                            <span className="calm-sub party-link esc-selectable">{link}</span>
                        </Row>
                    </Pane>
                </Ground>
            )}
            {error && <NightError error={error} onRetry={retry} />}
            {/* Until the roster arrives, say nothing: a count of zero would claim nobody came. */}
            {guests !== undefined && (
                <CalmNote aria-live="polite">{guests.length === 1 ? "1 guest at the party." : `${guests.length} guests at the party.`}</CalmNote>
            )}
            <NightScreenActivity activities={night.activities} />
        </CalmPage>
    );
};

export default NightScreen;
