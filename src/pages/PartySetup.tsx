import { useEffect, useId, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { CalmLink, CalmNote, CalmPage } from "../components/CalmPage";
import { NamePicker } from "../components/NamePicker";
import { ChoiceCard, ChoiceGrid, Control, Field, Ground, Pane, Row } from "../design";
import { CONTESTS_2027 } from "../data/contests2027";
import { PARTY_LIFETIME_DAYS, createParty, fetchContest } from "../utils/partyFirestore";
import {
    BONUS_LIMITS,
    CATEGORY_LIMITS,
    OWN_BONUS_ID,
    PARTY_BONUSES,
    RATING_TEMPLATES,
    SCALE_CHOICES,
    categoryLabelProblem,
    bonusProblems,
    categoryProblems,
    type BonusCategory,
    type RatingCategory,
    type RatingTemplate,
} from "../utils/partyModel";
import { radioGroupKeys, radioTabIndex } from "../utils/radioGroupKeys";
import { savePartyIdentity } from "../utils/partySession";
import "./party-calm.css";

const CUSTOM = "custom";

const scaleLabel = (max: number) => `1 to ${max}`;

let categoryCounter = 0;
const newCategory = (): RatingCategory => ({ id: `c${Date.now().toString(36)}${(categoryCounter++).toString(36)}`, label: "", max: 10 });

/** The questions, in order. A step's heading is also the name of its way back. */
const STEPS = ["Which show?", "How does everyone rate?", "Add bonus points?", "Who are you tonight?", "Ready to start?"] as const;
const LAST = STEPS.length;

/** A bonus as the summary and the screen say it: "Wind machine +1". */
const bonusText = (bonus: BonusCategory) => `${bonus.label} +${bonus.points}`;

/** A switch tile: the bonus on the left, its points and a plain On or Off on the right. */
const BonusSwitch = ({ label, points, on, onToggle }: { label: string; points?: number; on: boolean; onToggle: () => void }) => (
    <Control role="switch" aria-checked={on} chosen={on} onClick={onToggle}>
        <span className="calm-row">
            <span>{label}</span>{" "}
            <span className="calm-sub">{points !== undefined ? `+${points} · ` : ""}{on ? "On" : "Off"}</span>
        </span>
    </Control>
);

/**
 * Set up a scoreboard party (#80, #81, #89) one question per screen (#208):
 * 1 which Burgas 2027 show, 2 how everyone rates (a premade sheet or your
 * own categories), 3 bonus points (a list of switches, all off to begin with,
 * and one of the host's own), 4 your name (spun from the Eurovision
 * participants, never typed), 5 start. Nothing starts picked. Tapping a
 * choice moves on, except where the screen needs more than one answer (our
 * own categories; the bonuses), which has a Continue. The chosen bonuses go
 * in `template.bonuses` (the rules fix a party's top-level keys), and
 * `bonuses` says whether there are any. New parties always name names in the
 * awards (`showNames: true`; older parties may have chosen otherwise). Each step is a history entry (`?step=N`), so
 * the system back gesture and the footer Back do the same and keep every
 * answer; a fresh visit to /party/new has no step and starts at 1, and a
 * step is only shown once the answers before it are in. The show, the sheet
 * and the bonuses are fixed once the party starts, so every guest rates the
 * same way (the summary says so).
 */
const PartySetup = () => {
    const navigate = useNavigate();
    const ids = useId();
    const [params, setParams] = useSearchParams();
    const [contestId, setContestId] = useState<string | null>(null);
    const [templateId, setTemplateId] = useState<string | null>(null);
    const [custom, setCustom] = useState<RatingCategory[]>(() => [newCategory()]);
    const [picked, setPicked] = useState<string[]>([]);
    const [ownOn, setOwnOn] = useState(false);
    const [ownLabel, setOwnLabel] = useState("");
    const [ownPoints, setOwnPoints] = useState(1);
    const [bonusesDone, setBonusesDone] = useState(false);
    const [name, setName] = useState<string | null>(null);
    const [tried, setTried] = useState(false);
    const [creating, setCreating] = useState(false);
    const [failure, setFailure] = useState<string | null>(null);
    const [spinning, setSpinning] = useState(false);
    const heading = useRef<HTMLHeadingElement>(null);

    const contest = CONTESTS_2027.find(entry => entry.id === contestId);
    const template: RatingTemplate | undefined = templateId === CUSTOM
        ? { id: CUSTOM, name: "Our own sheet", blurb: "Categories made up for this party.", categories: custom.map(category => ({ ...category, label: category.label.trim() })) }
        : RATING_TEMPLATES.find(entry => entry.id === templateId);
    const ownProblems = ownOn ? bonusProblems({ label: ownLabel, points: ownPoints }) : [];
    const chosenBonuses: BonusCategory[] = [
        ...PARTY_BONUSES.filter(bonus => picked.includes(bonus.id)),
        ...(ownOn && ownProblems.length === 0 ? [{ id: OWN_BONUS_ID, label: ownLabel.trim(), points: ownPoints }] : []),
    ];
    // Problems are told once Continue has been tried, beside Continue.
    const sheetProblems = templateId === CUSTOM ? categoryProblems(custom) : [];
    // The step in the address, but never past the answers given so far (a
    // reload or a pasted link starts over at the first unanswered question).
    const reached = contestId === null ? 1
        : templateId === null || sheetProblems.length > 0 ? 2
        : !bonusesDone ? 3
        : ownProblems.length > 0 ? 3
        : name === null ? 4
        : LAST;
    const step = Math.min(Math.max(Math.trunc(Number(params.get("step"))) || 1, 1), reached);

    // A new question is read out: focus lands on its heading, not on the
    // spot where the last control was. (Compared to the previous step, so
    // StrictMode's second effect run doesn't count as a change.)
    const previousStep = useRef(step);
    useEffect(() => {
        if (previousStep.current === step) return;
        previousStep.current = step;
        heading.current?.focus();
    }, [step]);
    const sheetProblemShown = tried && sheetProblems.length > 0;
    // Which category names the problem is about: blank, too long or repeated.
    const ownProblemShown = tried && ownProblems.length > 0;
    const labelInvalid = (category: RatingCategory) => sheetProblemShown && categoryLabelProblem(category, custom) !== null;

    const setCategory = (index: number, change: Partial<RatingCategory>) =>
        setCustom(custom.map((category, i) => (i === index ? { ...category, ...change } : category)));

    const go = (to: number) => {
        setTried(false);
        setParams({ step: String(to) });
    };

    const create = async () => {
        if (!contest || !template || sheetProblems.length > 0 || !bonusesDone || ownProblems.length > 0 || !name || creating) return;
        setCreating(true);
        setFailure(null);
        try {
            const fetched = await fetchContest(contest.id);
            if (!fetched) throw new Error(`No show ${contest.id}`);
            const hostId = uuidv4();
            const withBonuses: RatingTemplate = chosenBonuses.length > 0 ? { ...template, bonuses: chosenBonuses } : template;
            const code = await createParty({
                hostId,
                title: fetched.title,
                contestId: fetched.id,
                kind: fetched.kind,
                qualifiers: fetched.kind === "semi" ? fetched.qualifiers ?? 10 : 0,
                acts: fetched.acts,
                template: withBonuses,
                bonuses: chosenBonuses.length > 0,
                showNames: true,
            });
            savePartyIdentity(code, { guestId: hostId, name, isHost: true });
            // PartyRoom's useOwnBallot writes the host's empty ballot (the name claim) when it opens.
            navigate(`/party/${code}`);
        } catch (error) {
            console.error("Couldn't create the party:", error);
            setFailure("The party couldn't be created. Check your connection and try again.");
            setCreating(false);
        }
    };

    const continueFromSheet = () => {
        if (sheetProblems.length > 0) {
            setTried(true);
            return;
        }
        go(3);
    };

    const continueFromBonuses = () => {
        if (ownProblems.length > 0) {
            setTried(true);
            return;
        }
        setBonusesDone(true);
        go(4);
    };

    const toggleBonus = (id: string) => setPicked(picked.includes(id) ? picked.filter(other => other !== id) : [...picked, id]);

    const contestIndex = CONTESTS_2027.findIndex(entry => entry.id === contestId);
    const pickContest = (id: string) => {
        setContestId(id);
        go(2);
    };
    const showChoices = (
        <Ground>
            <ChoiceGrid columns={1} role="radiogroup" aria-labelledby={`${ids}-q`}>
                {CONTESTS_2027.map((entry, index) => (
                    <ChoiceCard
                        key={entry.id}
                        role="radio"
                        aria-checked={contestId === entry.id}
                        tabIndex={radioTabIndex(index, contestIndex >= 0 ? contestIndex : null)}
                        chosen={contestId === entry.id}
                        tag={new Date(`${entry.date}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}
                        title={entry.title.replace(/^Burgas 2027 · /, "")}
                        meta={`${entry.acts.length} acts · ${entry.kind === "semi" ? `${entry.qualifiers} go through` : "every act ranked"}`}
                        onClick={() => pickContest(entry.id)}
                        onKeyDown={event => radioGroupKeys(event, index, CONTESTS_2027.length, next => pickContest(CONTESTS_2027[next].id))}
                    />
                ))}
            </ChoiceGrid>
        </Ground>
    );

    const sheetOptions = [...RATING_TEMPLATES, { id: CUSTOM, name: "Make our own", blurb: "Up to six categories, each on its own scale.", categories: [] as RatingCategory[] }];
    const sheetIndex = sheetOptions.findIndex(option => option.id === templateId);
    const pickSheet = (id: string) => {
        setTemplateId(id);
        // A premade sheet is the whole answer; our own needs its categories.
        if (id !== CUSTOM) go(3);
        else setTried(false);
    };
    const sheetChoices = (
        <>
            <Ground>
                <ChoiceGrid role="radiogroup" aria-labelledby={`${ids}-q`}>
                    {sheetOptions.map((option, index) => (
                        <ChoiceCard
                            key={option.id}
                            role="radio"
                            aria-checked={templateId === option.id}
                            tabIndex={radioTabIndex(index, sheetIndex >= 0 ? sheetIndex : null)}
                            chosen={templateId === option.id}
                            tag={option.categories.length === 0 ? `Up to ${CATEGORY_LIMITS.max}` : `${option.categories.length} ${option.categories.length === 1 ? "category" : "categories"}`}
                            title={option.name}
                            meta={option.id === "douze" ? scaleLabel(12) : option.categories.map(category => category.label).join(" · ") || undefined}
                            sub={option.blurb}
                            onClick={() => pickSheet(option.id)}
                            onKeyDown={event => radioGroupKeys(event, index, sheetOptions.length, next => pickSheet(sheetOptions[next].id))}
                        />
                    ))}
                </ChoiceGrid>
            </Ground>

            {templateId === CUSTOM && (
                <>
                    <h3 className="esc-section">Your categories</h3>
                    <Ground>
                        <Pane>
                            {custom.map((category, index) => (
                                <div key={category.id}>
                                    <label className="calm-label" htmlFor={`${ids}-${category.id}`}>Category {index + 1}</label>
                                    <Field
                                        id={`${ids}-${category.id}`}
                                        value={category.label}
                                        maxLength={CATEGORY_LIMITS.maxLabel}
                                        placeholder={index === 0 ? "Hair height" : "Costume changes"}
                                        aria-invalid={labelInvalid(category)}
                                        aria-describedby={labelInvalid(category) ? `${ids}-sheet-problem` : undefined}
                                        onChange={event => setCategory(index, { label: event.target.value })}
                                    />
                                    <label className="calm-label party-label-gap" htmlFor={`${ids}-${category.id}-scale`}>
                                        Scale for category {index + 1}
                                    </label>
                                    <select
                                        id={`${ids}-${category.id}-scale`}
                                        className="lycra-field"
                                        value={category.max}
                                        onChange={event => setCategory(index, { max: Number(event.target.value) as RatingCategory["max"] })}
                                    >
                                        {SCALE_CHOICES.map(max => <option key={max} value={max}>{scaleLabel(max)}</option>)}
                                    </select>
                                </div>
                            ))}
                        </Pane>
                    </Ground>
                    <Ground>
                        <Pane>
                            {custom.length < CATEGORY_LIMITS.max && (
                                <Control onClick={() => setCustom([...custom, newCategory()])}>Add a category</Control>
                            )}
                            {custom.length > CATEGORY_LIMITS.min && (
                                <Control onClick={() => setCustom(custom.slice(0, -1))}>Remove the last one</Control>
                            )}
                        </Pane>
                    </Ground>
                    <Ground>
                        <Pane>
                            {/* Beside Continue, where the tap was; the fields it's about point here. */}
                            {sheetProblemShown && <CalmNote id={`${ids}-sheet-problem`} role="alert">{sheetProblems.join(" ")}</CalmNote>}
                            <Control elevation="high" onClick={continueFromSheet}>Continue</Control>
                        </Pane>
                    </Ground>
                </>
            )}
        </>
    );

    const extras = (
        <>
            <CalmNote>Switch on what counts tonight. Each one adds its points to an act&apos;s score when a guest ticks it. All off means no bonuses.</CalmNote>
            <Ground>
                <Pane role="group" aria-labelledby={`${ids}-q`}>
                    {PARTY_BONUSES.map(bonus => (
                        <BonusSwitch
                            key={bonus.id}
                            label={bonus.label}
                            points={bonus.points}
                            on={picked.includes(bonus.id)}
                            onToggle={() => toggleBonus(bonus.id)}
                        />
                    ))}
                </Pane>
            </Ground>
            <h3 className="esc-section" id={`${ids}-own`}>Your own bonus</h3>
            <Ground>
                <Pane className="is-card" role="group" aria-labelledby={`${ids}-own`}>
                    <BonusSwitch label="Add your own" on={ownOn} onToggle={() => { setOwnOn(!ownOn); setTried(false); }} />
                    {ownOn && (
                        <>
                            <div>
                                <label className="calm-label" htmlFor={`${ids}-own-name`}>Bonus name</label>
                                <Field
                                    id={`${ids}-own-name`}
                                    value={ownLabel}
                                    maxLength={BONUS_LIMITS.maxLabel}
                                    placeholder="Glitter cannon"
                                    aria-invalid={ownProblemShown}
                                    aria-describedby={ownProblemShown ? `${ids}-own-problem` : undefined}
                                    onChange={event => setOwnLabel(event.target.value)}
                                />
                            </div>
                            <div>
                                <label className="calm-label" htmlFor={`${ids}-own-points`}>Points it adds</label>
                                <select
                                    id={`${ids}-own-points`}
                                    className="lycra-field"
                                    value={ownPoints}
                                    onChange={event => setOwnPoints(Number(event.target.value))}
                                >
                                    {Array.from({ length: BONUS_LIMITS.maxPoints - BONUS_LIMITS.minPoints + 1 }, (_, i) => BONUS_LIMITS.minPoints + i).map(points => (
                                        <option key={points} value={points}>+{points}</option>
                                    ))}
                                </select>
                            </div>
                        </>
                    )}
                </Pane>
            </Ground>
            <Ground>
                <Pane>
                    {ownProblemShown && <CalmNote id={`${ids}-own-problem`} role="alert">{ownProblems.join(" ")}</CalmNote>}
                    <Control elevation="high" onClick={continueFromBonuses}>Continue</Control>
                </Pane>
            </Ground>
        </>
    );

    const namePicker = (
        <>
            <CalmNote>Spin the reel for a Eurovision legend to be tonight. You can&apos;t type your own.</CalmNote>
            <NamePicker value={name} onChange={setName} onSpinningChange={setSpinning} />
            <Ground>
                <Pane>
                    <Control elevation="high" disabled={name === null || spinning} onClick={() => go(5)}>Continue</Control>
                </Pane>
            </Ground>
        </>
    );

    const summary = (
        <>
            <Ground>
                <Pane as="ul" aria-label="Your party">
                    <Row as="li"><span className="calm-sub">Show</span><span>{contest?.title}</span></Row>
                    <Row as="li">
                        <span className="calm-sub">Rating</span>
                        <span>{template?.categories.map(category => category.label).join(" · ")}</span>
                    </Row>
                    <Row as="li">
                        <span className="calm-sub">Party bonuses</span>
                        <span>{chosenBonuses.length > 0 ? chosenBonuses.map(bonusText).join(" · ") : "None"}</span>
                    </Row>
                    <Row as="li"><span className="calm-sub">You are</span><span>{name}</span></Row>
                </Pane>
            </Ground>
            <Ground>
                <Pane>
                    <Control elevation="high" disabled={creating} onClick={() => void create()}>
                        {creating ? "Starting…" : "Start the party"}
                    </Control>
                </Pane>
            </Ground>
            {failure && <CalmNote role="alert">{failure}</CalmNote>}
            <CalmNote>Once the party starts, the show, the rating sheet and the bonuses stay as they are, so everyone rates the same way.</CalmNote>
            <CalmNote>The party and everyone&apos;s ratings are set to be deleted after {PARTY_LIFETIME_DAYS} days.</CalmNote>
        </>
    );

    return (
        <CalmPage
            title="Host a party"
            subtitle="Everyone rates each act on their phone, and the big screen shows the room's scoreboard."
            footer={step === 1
                ? <CalmLink onClick={() => navigate("/party")}>Back to the scoreboard party</CalmLink>
                : <CalmLink onClick={() => navigate(-1)}>Back to {STEPS[step - 2]}</CalmLink>}
        >
            <p className="esc-note">Step {step} of {LAST}</p>
            <h2 className="esc-heading esc-question" id={`${ids}-q`} ref={heading} tabIndex={-1}>{STEPS[step - 1]}</h2>
            {step === 1 && (
                <>
                    {showChoices}
                    <CalmNote>The running order is a guess until the real one is announced; the host can edit it any time.</CalmNote>
                </>
            )}
            {step === 2 && sheetChoices}
            {step === 3 && extras}
            {step === 4 && namePicker}
            {step === 5 && summary}
        </CalmPage>
    );
};

export default PartySetup;
