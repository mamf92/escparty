import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toDataURL } from "qrcode";
import { CalmLink, CalmNote, CalmPage } from "../components/CalmPage";
import { PartyError, PartyNotFound } from "../components/PartyStates";
import { Ground, Pane, Row } from "../design";
import { usePartyData } from "../hooks/usePartyData";
import { predictionLeaderboard, roomStandings } from "../utils/partyModel";
import { actIdsOf, formatScore, hasResults, ordinal, partyBonusList, partyLink, predictionsFor } from "../utils/partyResults";
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

    const all = ballots ?? [];
    const standings = roomStandings(all, actIdsOf(party), party.template.categories, partyBonusList(party));
    const byId = new Map(party.acts.map(act => [act.id, act]));
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
                    <CalmNote aria-live="polite">{all.length === 1 ? "1 guest is rating." : `${all.length} guests are rating.`}</CalmNote>

                    <h2 className="esc-section">The room's standings</h2>
                    <Ground>
                        {standings.length === 0 ? (
                            <Pane>
                                <Row>No ratings yet. The table fills up as soon as someone rates an act.</Row>
                            </Pane>
                        ) : (
                            <Pane as="ol" aria-label="The room's standings">
                                {standings.slice(0, SCREEN_ROWS).map((standing, index) => {
                                    const act = byId.get(standing.actId)!;
                                    const real = party.results.places?.[act.id];
                                    const through = party.results.qualifiers?.includes(act.id);
                                    return (
                                        <Row as="li" key={act.id}>
                                            <span className="calm-row">
                                                <span>{ordinal(index + 1)} {act.flag} {act.country}</span>
                                                <span>{formatScore(standing.average)}</span>
                                            </span>
                                            {(real || through) && <span className="calm-sub">{real ? `Really ${ordinal(real)}` : "Through"}</span>}
                                        </Row>
                                    );
                                })}
                            </Pane>
                        )}
                    </Ground>
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
