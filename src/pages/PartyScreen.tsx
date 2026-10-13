import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toDataURL } from "qrcode";
import { CalmLink, CalmNote, CalmPage } from "../components/CalmPage";
import { PartyError, PartyNotFound } from "../components/PartyStates";
import { RoomStandings } from "../components/RoomStandings";
import { Ground, Pane, Row } from "../design";
import { usePartyData } from "../hooks/usePartyData";
import { predictionLeaderboard } from "../utils/partyModel";
import { withDistinctNames } from "../utils/partyNames";
import { hasResults, ordinal, partyLink, predictionsFor } from "../utils/partyResults";
import "./party-calm.css";

/** How many acts the TV lists: the top of the table, readable from the sofa. */
const SCREEN_ROWS = 10;

/**
 * The big screen for the TV (#84): a QR code and the code to join, then
 * the room's standings as the ratings come in, and the real result next to
 * them once the host enters it. It never shows one guest's own ratings;
 * guests' names only on the closest-to-the-result list, and only when the
 * host chose to name names (#89).
 */
const PartyScreen = () => {
    const navigate = useNavigate();
    const code = useParams().code?.toUpperCase();
    const { party, ballots, error, retry } = usePartyData(code);
    const [qr, setQr] = useState<string | null>(null);
    const link = code ? partyLink(code) : "";

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

    const all = useMemo(() => withDistinctNames(ballots ?? []), [ballots]);

    const back = <CalmLink onClick={() => navigate(code ? `/party/${code}` : "/party")}>Back to my phone view</CalmLink>;

    if (party === undefined) {
        return (
            <CalmPage title="Scoreboard party" className="calm-screen" footer={back}>
                {error ? <PartyError error={error} onRetry={retry} /> : <CalmNote role="status">Finding the party…</CalmNote>}
            </CalmPage>
        );
    }
    if (party === null) {
        // No party to go back to: back to the start instead.
        return (
            <CalmPage title="Scoreboard party" className="calm-screen" footer={<CalmLink onClick={() => navigate("/party")}>Back to the scoreboard party</CalmLink>}>
                <PartyNotFound code={code} />
            </CalmPage>
        );
    }

    const leaderboard = party.showNames && hasResults(party) ? predictionLeaderboard(all, predictionsFor(party, all)).slice(0, 3) : [];

    return (
        <CalmPage title={party.title} subtitle="Scan the code with your phone to rate along" className="calm-screen" footer={back}>
            <Ground>
                <Pane>
                    <Row>
                        {qr && <img className="party-qr" src={qr} alt={`QR code to join party ${party.code}`} width={240} height={240} />}
                        <span className="calm-row">
                            <span>Party code</span>
                            <span className="esc-selectable">{party.code}</span>
                        </span>
                        <span className="calm-sub party-link esc-selectable">{link}</span>
                    </Row>
                </Pane>
            </Ground>
            {error && <PartyError error={error} onRetry={retry} />}
            {/* Until the ratings arrive, say so: an empty table would claim nobody has rated. */}
            {ballots === undefined ? (
                !error && <CalmNote role="status">Counting the ratings…</CalmNote>
            ) : (
                <>
                    <CalmNote aria-live="polite">{all.length === 1 ? "1 guest at the party." : `${all.length} guests at the party.`}</CalmNote>

                    <h2 className="esc-section">The room's standings</h2>
                    <RoomStandings party={party} ballots={all} limit={SCREEN_ROWS} />
                </>
            )}

            {leaderboard.length > 0 && (
                <>
                    <h2 className="esc-section">Closest to the real result</h2>
                    <Ground>
                        <Pane as="ol" aria-label="Closest to the real result">
                            {leaderboard.map((row, index) => (
                                <Row as="li" key={row.guestId}>
                                    <span className="calm-row">
                                        <span>{ordinal(index + 1)} {row.name}</span>
                                        <span>{row.prediction.points}</span>
                                    </span>
                                </Row>
                            ))}
                        </Pane>
                    </Ground>
                </>
            )}
        </CalmPage>
    );
};

export default PartyScreen;
