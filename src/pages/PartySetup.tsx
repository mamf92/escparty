import { useEffect, useId, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { CalmLink, CalmNote, CalmPage } from "../components/CalmPage";
import { NamePicker } from "../components/NamePicker";
import { Control, Field, Ground, Pane, Row } from "../design";
import { CONTESTS_2027 } from "../data/contests2027";
import { PARTY_LIFETIME_DAYS, createParty, fetchContest } from "../utils/partyFirestore";
import {
    CATEGORY_LIMITS,
    PARTY_BONUSES,
    RATING_TEMPLATES,
    SCALE_CHOICES,
    categoryLabelProblem,
    categoryProblems,
    type RatingCategory,
    type RatingTemplate,
} from "../utils/partyModel";
import { savePartyIdentity } from "../utils/partySession";
import "./party-calm.css";

const CUSTOM = "custom";

const scaleLabel = (max: number) => `1 to ${max}`;

let categoryCounter = 0;
const newCategory = (): RatingCategory => ({ id: `c${Date.now().toString(36)}${(categoryCounter++).toString(36)}`, label: "", max: 10 });

/** The questions, in order. A step's heading is also the name of its way back. */
const STEPS = ["Which show?", "How does everyone rate?", "Any extras?", "Who are you tonight?", "Ready to start?"] as const;
const LAST = STEPS.length;

/** A yes/no question: two radios under the heading `labelId` names. */
const YesNo = ({ labelId, value, onChange }: { labelId: string; value: boolean | null; onChange: (value: boolean) => void }) => (
    <Ground>
        <Pane layout="split" role="radiogroup" aria-labelledby={labelId}>
            <Control role="radio" aria-checked={value === true} chosen={value === true} onClick={() => onChange(true)}>Yes</Control>
            <Control role="radio" aria-checked={value === false} chosen={value === false} onClick={() => onChange(false)}>No</Control>
        </Pane>
    </Ground>
);

const yesNo = (value: boolean | null) => (value === null ? "" : value ? "Yes" : "No");

/**
 * Set up a scoreboard party (#80, #81, #89) one question per screen (#208):
 * 1 which Burgas 2027 show, 2 how everyone rates (a premade sheet or your
 * own categories), 3 extras (party bonuses; whether the end-of-party awards
 * name names), 4 your name (spun from the Eurovision participants, never
 * typed), 5 start. Nothing starts picked. Tapping a choice moves on, except
 * where the screen needs more than one answer (our own categories; the two
 * extras), which has a Continue. Each step is a history entry (`?step=N`), so
 * the system back gesture and the footer Back do the same and keep every
 * answer; a fresh visit to /party/new has no step and starts at 1, and a
 * step is only shown once the answers before it are in. Everything is
 * fixed for the party once it starts, so every guest rates the same way.
 */
const PartySetup = () => {
    const navigate = useNavigate();
    const ids = useId();
    const [params, setParams] = useSearchParams();
    const [contestId, setContestId] = useState<string | null>(null);
    const [templateId, setTemplateId] = useState<string | null>(null);
    const [custom, setCustom] = useState<RatingCategory[]>(() => [newCategory()]);
    const [bonuses, setBonuses] = useState<boolean | null>(null);
    const [showNames, setShowNames] = useState<boolean | null>(null);
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
    // Problems are told once Continue has been tried, beside Continue.
    const sheetProblems = templateId === CUSTOM ? categoryProblems(custom) : [];
    // The step in the address, but never past the answers given so far (a
    // reload or a pasted link starts over at the first unanswered question).
    const reached = contestId === null ? 1
        : templateId === null || sheetProblems.length > 0 ? 2
        : bonuses === null || showNames === null ? 3
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
    const labelInvalid = (category: RatingCategory) => sheetProblemShown && categoryLabelProblem(category, custom) !== null;

    const setCategory = (index: number, change: Partial<RatingCategory>) =>
        setCustom(custom.map((category, i) => (i === index ? { ...category, ...change } : category)));

    const go = (to: number) => {
        setTried(false);
        setParams({ step: String(to) });
    };

    const create = async () => {
        if (!contest || !template || sheetProblems.length > 0 || bonuses === null || showNames === null || !name || creating) return;
        setCreating(true);
        setFailure(null);
        try {
            const fetched = await fetchContest(contest.id);
            if (!fetched) throw new Error(`No show ${contest.id}`);
            const hostId = uuidv4();
            const code = await createParty({
                hostId,
                title: fetched.title,
                contestId: fetched.id,
                kind: fetched.kind,
                qualifiers: fetched.kind === "semi" ? fetched.qualifiers ?? 10 : 0,
                acts: fetched.acts,
                template,
                bonuses,
                showNames,
            });
            savePartyIdentity(code, { guestId: hostId, name, isHost: true });
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

    const showChoices = (
        <Ground>
            <Pane role="radiogroup" aria-labelledby={`${ids}-q`}>
                {CONTESTS_2027.map(entry => (
                    <Control
                        key={entry.id}
                        block
                        role="radio"
                        aria-checked={contestId === entry.id}
                        chosen={contestId === entry.id}
                        onClick={() => {
                            setContestId(entry.id);
                            go(2);
                        }}
                    >
                        <span className="calm-row">
                            <span>{entry.title}</span>
                            <span className="calm-sub">{entry.acts.length} acts</span>
                        </span>
                        <span className="calm-sub">
                            {new Date(`${entry.date}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                            {entry.kind === "semi" ? ` · ${entry.qualifiers} go through` : " · every act ranked"}
                        </span>
                    </Control>
                ))}
            </Pane>
        </Ground>
    );

    const sheetChoices = (
        <>
            <Ground>
                <Pane role="radiogroup" aria-labelledby={`${ids}-q`}>
                    {[...RATING_TEMPLATES, { id: CUSTOM, name: "Make our own", blurb: "Up to six categories, each on its own scale.", categories: [] }].map(option => (
                        <Control
                            key={option.id}
                            block
                            role="radio"
                            aria-checked={templateId === option.id}
                            chosen={templateId === option.id}
                            onClick={() => {
                                setTemplateId(option.id);
                                // A premade sheet is the whole answer; our own needs its categories.
                                if (option.id !== CUSTOM) go(3);
                                else setTried(false);
                            }}
                        >
                            <span>{option.name}</span>
                            <span className="calm-sub">
                                {option.categories.length > 0 ? option.categories.map(category => category.label).join(" · ") : option.blurb}
                            </span>
                        </Control>
                    ))}
                </Pane>
            </Ground>

            {templateId === CUSTOM && (
                <>
                    <h3 className="esc-note">Your categories</h3>
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
            <h3 className="esc-heading esc-question esc-question-sub" id={`${ids}-bonuses`}>Party bonuses?</h3>
            <CalmNote>{PARTY_BONUSES.map(bonus => `${bonus.label} +${bonus.points}`).join(" · ")}</CalmNote>
            <YesNo labelId={`${ids}-bonuses`} value={bonuses} onChange={setBonuses} />
            <h3 className="esc-heading esc-question esc-question-sub" id={`${ids}-names`}>Name names in the awards?</h3>
            <CalmNote>
                Yes: everyone sees who rated like twins and who was toughest. No: the awards say &quot;two of you&quot; and &quot;one of you&quot;,
                and each guest is told which are theirs. The ratings themselves aren&apos;t secret from the party.
            </CalmNote>
            <YesNo labelId={`${ids}-names`} value={showNames} onChange={setShowNames} />
            <Ground>
                <Pane>
                    <Control elevation="high" disabled={bonuses === null || showNames === null} onClick={() => go(4)}>Continue</Control>
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
                    <Row as="li"><span className="calm-sub">Party bonuses</span><span>{yesNo(bonuses)}</span></Row>
                    <Row as="li"><span className="calm-sub">Names in the awards</span><span>{yesNo(showNames)}</span></Row>
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
            <CalmNote>The party and everyone&apos;s ratings are set to be deleted after {PARTY_LIFETIME_DAYS} days.</CalmNote>
        </>
    );

    return (
        <CalmPage
            title="Host a party"
            subtitle="This is fixed once the party starts."
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
