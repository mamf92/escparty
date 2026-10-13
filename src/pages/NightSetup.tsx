import { useId, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { CalmLink, CalmNote, CalmPage } from "../components/CalmPage";
import { NamePicker } from "../components/NamePicker";
import { Control, Field, Ground, Pane } from "../design";
import { createNight, NIGHT_LIFETIME_DAYS } from "../utils/nightsFirestore";
import { saveNightIdentity } from "../utils/nightSession";
import "./party-calm.css";

const DEFAULT_TITLE = "Party night";
const MAX_TITLE = 60;

/**
 * Host a party night (#233): one code for the whole evening. The host names
 * the night and spins a Eurovision legend to be on the reel, as at a
 * scoreboard party, and Start creates it (createNight, with the host as its
 * first guest) and lands on its home. The quizzes and scoreboards of the
 * evening are added from there, in a later step.
 */
const NightSetup = () => {
    const navigate = useNavigate();
    const titleId = useId();
    const [title, setTitle] = useState(DEFAULT_TITLE);
    const [name, setName] = useState<string | null>(null);
    const [spinning, setSpinning] = useState(false);
    const [tried, setTried] = useState(false);
    const [creating, setCreating] = useState(false);
    const [failure, setFailure] = useState<string | null>(null);
    // A second tap before the first create has settled must not make a second night.
    const busy = useRef(false);
    const trimmed = title.trim();
    const titleProblem = trimmed.length === 0 ? "Give the night a name, up to 60 letters." : null;

    const create = async () => {
        if (busy.current) return;
        if (titleProblem || !name) {
            setTried(true);
            return;
        }
        busy.current = true;
        setCreating(true);
        setFailure(null);
        try {
            const hostId = uuidv4();
            const code = await createNight(trimmed, hostId, name);
            saveNightIdentity(code, { guestId: hostId, name, isHost: true });
            // Replace: Back from the night's home shouldn't land on a form that would make another.
            navigate(`/n/${code}`, { replace: true });
        } catch (error) {
            console.error("Couldn't create the party night:", error);
            setFailure("The party night couldn't be started. Check your connection and try again.");
            busy.current = false;
            setCreating(false);
        }
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        void create();
    };

    return (
        <CalmPage
            title="Host a party night"
            subtitle="One code for the whole evening. Guests join once and stay for every quiz and scoreboard."
            footer={<CalmLink onClick={() => navigate("/host")}>Back to hosting</CalmLink>}
            actions={(
                <Ground>
                    <Pane>
                        <Control elevation="high" disabled={creating || spinning || name === null} onClick={() => void create()}>
                            {creating ? "Starting…" : "Start the party night"}
                        </Control>
                    </Pane>
                </Ground>
            )}
        >
            <form onSubmit={submit} noValidate>
                <Ground>
                    <Pane>
                        <label className="calm-label" htmlFor={titleId}>Name of the night</label>
                        <Field
                            id={titleId}
                            value={title}
                            maxLength={MAX_TITLE}
                            autoComplete="off"
                            disabled={creating}
                            aria-invalid={tried && titleProblem !== null}
                            aria-describedby={tried && titleProblem ? `${titleId}-problem` : undefined}
                            onChange={event => setTitle(event.target.value)}
                        />
                        {tried && titleProblem && <CalmNote id={`${titleId}-problem`} role="alert">{titleProblem}</CalmNote>}
                    </Pane>
                </Ground>
            </form>
            <CalmNote>Spin the reel for a Eurovision legend to be tonight. You can&apos;t type your own.</CalmNote>
            <NamePicker value={name} onChange={setName} onSpinningChange={setSpinning} disabled={creating} />
            {failure && <CalmNote role="alert">{failure}</CalmNote>}
            <CalmNote>The night and its guests are set to be deleted after {NIGHT_LIFETIME_DAYS} days.</CalmNote>
        </CalmPage>
    );
};

export default NightSetup;
