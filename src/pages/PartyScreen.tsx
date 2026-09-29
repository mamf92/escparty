import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toDataURL } from "qrcode";
import { CalmLink, CalmNote, CalmPage } from "../components/CalmPage";
import { usePartyData } from "../hooks/usePartyData";
import { predictionLeaderboard, roomStandings } from "../utils/partyModel";
import { actIdsOf, formatScore, hasResults, ordinal, partyBonusList, partyLink, predictionsFor } from "../utils/partyResults";

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
    const { party, ballots, error } = usePartyData(code);
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

    const back = <CalmLink type="button" onClick={() => navigate(code ? `/party/${code}` : "/party")}>Back to my phone view</CalmLink>;

    if (party === undefined || party === null) {
        return (
            <CalmPage title="Scoreboard party" className="calm-screen" footer={back}>
                <CalmNote role={party === null ? "alert" : "status"}>
                    {party === null ? `There's no party with the code ${code}.` : error ?? "Finding the party…"}
                </CalmNote>
            </CalmPage>
        );
    }

    const all = ballots ?? [];
    const standings = roomStandings(all, actIdsOf(party), party.template.categories, partyBonusList(party));
    const byId = new Map(party.acts.map(act => [act.id, act]));
    const leaderboard = party.showNames && hasResults(party) ? predictionLeaderboard(all, predictionsFor(party, all)).slice(0, 3) : [];

    return (
        <CalmPage title={party.title} subtitle="Scan the code with your phone to rate along" className="calm-screen" footer={back}>
            <div className="calm-ground">
                <div className="lycra-pane">
                    <div className="lycra is-block is-static">
                        {qr && <img src={qr} alt={`QR code to join party ${party.code}`} width={240} height={240} style={{ alignSelf: "center" }} />}
                        <span className="calm-row">
                            <span>Party code</span>
                            <span>{party.code}</span>
                        </span>
                        <span className="calm-sub">{link}</span>
                    </div>
                </div>
            </div>
            <CalmNote>{all.length === 1 ? "1 guest is rating." : `${all.length} guests are rating.`}</CalmNote>
            {error && <CalmNote role="status">{error}</CalmNote>}

            {standings.length > 0 && (
                <div className="calm-ground">
                    <ol className="lycra-pane" aria-label="The room's standings">
                        {standings.slice(0, SCREEN_ROWS).map((standing, index) => {
                            const act = byId.get(standing.actId)!;
                            const real = party.results.places?.[act.id];
                            const through = party.results.qualifiers?.includes(act.id);
                            return (
                                <li key={act.id} className="lycra is-block is-static">
                                    <span className="calm-row">
                                        <span>{ordinal(index + 1)} {act.flag} {act.country}</span>
                                        <span>{formatScore(standing.average)}</span>
                                    </span>
                                    {(real || through) && <span className="calm-sub">{real ? `Really ${ordinal(real)}` : "Through"}</span>}
                                </li>
                            );
                        })}
                    </ol>
                </div>
            )}

            {leaderboard.length > 0 && (
                <>
                    <CalmNote>Closest to the real result</CalmNote>
                    <div className="calm-ground">
                        <ol className="lycra-pane" aria-label="Closest to the real result">
                            {leaderboard.map((row, index) => (
                                <li key={row.guestId} className="lycra is-block is-static">
                                    <span className="calm-row">
                                        <span>{ordinal(index + 1)} {row.name}</span>
                                        <span>{row.prediction.points}</span>
                                    </span>
                                </li>
                            ))}
                        </ol>
                    </div>
                </>
            )}
        </CalmPage>
    );
};

export default PartyScreen;
