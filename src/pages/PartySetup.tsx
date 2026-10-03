import { useId, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { CalmLink, CalmNote, CalmPage } from "../components/CalmPage";
import { Control, Field, Ground, Pane } from "../design";
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
import { randomPartyName } from "../utils/partyNames";
import "./party-calm.css";

const CUSTOM = "custom";

const scaleLabel = (max: number) => `1 to ${max}`;

let categoryCounter = 0;
const newCategory = (): RatingCategory => ({ id: `c${Date.now().toString(36)}${(categoryCounter++).toString(36)}`, label: "", max: 10 });

/**
 * Set up a scoreboard party (#80, #81, #89): which Burgas 2027 show, how
 * everyone rates (a premade sheet or your own categories), whether the
 * party bonuses are on, and whether the end-of-party awards name names.
 * Everything here is fixed for the party once it starts, so every guest
 * rates the same way.
 */
const PartySetup = () => {
    const navigate = useNavigate();
    const ids = useId();
    const [contestId, setContestId] = useState(CONTESTS_2027[CONTESTS_2027.length - 1].id);
    const [templateId, setTemplateId] = useState(RATING_TEMPLATES[0].id);
    const [custom, setCustom] = useState<RatingCategory[]>(() => [newCategory()]);
    const [bonuses, setBonuses] = useState(true);
    const [showNames, setShowNames] = useState(true);
    const [name, setName] = useState(randomPartyName);
    const [tried, setTried] = useState(false);
    const [creating, setCreating] = useState(false);
    const [failure, setFailure] = useState<string | null>(null);

    const template: RatingTemplate = templateId === CUSTOM
        ? { id: CUSTOM, name: "Our own sheet", blurb: "Categories made up for this party.", categories: custom.map(category => ({ ...category, label: category.label.trim() })) }
        : RATING_TEMPLATES.find(entry => entry.id === templateId)!;
    // Problems are told once Start has been tried: the name's beside its
    // field, the categories' beside Start, so a tap on Start always shows why.
    const sheetProblems = templateId === CUSTOM ? categoryProblems(custom) : [];
    const nameMissing = tried && !name.trim();
    const sheetProblemShown = tried && sheetProblems.length > 0;
    // Which category names the problem is about: blank, too long or repeated.
    const labelInvalid = (category: RatingCategory) => sheetProblemShown && categoryLabelProblem(category, custom) !== null;

    const setCategory = (index: number, change: Partial<RatingCategory>) =>
        setCustom(custom.map((category, i) => (i === index ? { ...category, ...change } : category)));

    const create = async () => {
        setTried(true);
        if (sheetProblems.length > 0 || !name.trim() || creating) return;
        setCreating(true);
        setFailure(null);
        try {
            const contest = await fetchContest(contestId);
            if (!contest) throw new Error(`No show ${contestId}`);
            const hostId = uuidv4();
            const code = await createParty({
                hostId,
                title: contest.title,
                contestId: contest.id,
                kind: contest.kind,
                qualifiers: contest.kind === "semi" ? contest.qualifiers ?? 10 : 0,
                acts: contest.acts,
                template,
                bonuses,
                showNames,
            });
            savePartyIdentity(code, { guestId: hostId, name: name.trim(), isHost: true });
            navigate(`/party/${code}`);
        } catch (error) {
            console.error("Couldn't create the party:", error);
            setFailure("The party couldn't be created. Check your connection and try again.");
            setCreating(false);
        }
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        void create();
    };

    return (
        <CalmPage
            title="Host a party"
            subtitle="Pick the show and how everyone rates. This is fixed once the party starts."
            footer={<CalmLink onClick={() => navigate("/party")}>Back to the scoreboard party</CalmLink>}
        >
            <h2 className="esc-note" id={`${ids}-show`}>Which show?</h2>
            <Ground>
                <Pane role="radiogroup" aria-labelledby={`${ids}-show`}>
                    {CONTESTS_2027.map(contest => (
                        <Control
                            key={contest.id}
                            block
                            role="radio"
                            aria-checked={contestId === contest.id}
                            chosen={contestId === contest.id}
                            onClick={() => setContestId(contest.id)}
                        >
                            <span className="calm-row">
                                <span>{contest.title}</span>
                                <span className="calm-sub">{contest.acts.length} acts</span>
                            </span>
                            <span className="calm-sub">
                                {new Date(`${contest.date}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                                {contest.kind === "semi" ? ` · ${contest.qualifiers} go through` : " · every act ranked"}
                            </span>
                        </Control>
                    ))}
                </Pane>
            </Ground>
            <CalmNote>The running order is a guess until the real one is announced; the host can edit it any time.</CalmNote>

            <h2 className="esc-note" id={`${ids}-sheet`}>How does everyone rate?</h2>
            <Ground>
                <Pane role="radiogroup" aria-labelledby={`${ids}-sheet`}>
                    {[...RATING_TEMPLATES, { id: CUSTOM, name: "Make our own", blurb: "Up to six categories, each on its own scale.", categories: [] }].map(option => (
                        <Control
                            key={option.id}
                            block
                            role="radio"
                            aria-checked={templateId === option.id}
                            chosen={templateId === option.id}
                            onClick={() => setTemplateId(option.id)}
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
                    <h2 className="esc-note">Your categories</h2>
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
                </>
            )}

            <h2 className="esc-note">Extras</h2>
            <Ground>
                <Pane>
                    <Control block chosen={bonuses} onClick={() => setBonuses(!bonuses)}>
                        <span>Party bonuses</span>
                        <span className="calm-sub">
                            {bonuses ? "" : "Off: "}
                            {PARTY_BONUSES.map(bonus => `${bonus.label} +${bonus.points}`).join(" · ")}
                        </span>
                    </Control>
                    <Control block chosen={showNames} onClick={() => setShowNames(!showNames)}>
                        <span>Name names in the awards</span>
                        <span className="calm-sub">
                            {showNames
                                ? "Everyone sees who rated like twins and who was toughest."
                                : "Off: the awards say \"two of you\" and \"one of you\", and each guest is told which are theirs. It keeps the fun friendly; the ratings themselves aren't secret from the party."}
                        </span>
                    </Control>
                </Pane>
            </Ground>

            <h2 className="esc-note">And you?</h2>
            <form onSubmit={submit} noValidate>
                <Ground>
                    <Pane>
                        <div>
                            <label className="calm-label" htmlFor={`${ids}-name`}>Your name at the party</label>
                            <Field
                                id={`${ids}-name`}
                                value={name}
                                maxLength={40}
                                aria-invalid={nameMissing}
                                aria-describedby={nameMissing ? `${ids}-name-problem` : undefined}
                                onChange={event => setName(event.target.value)}
                            />
                            {nameMissing && <CalmNote id={`${ids}-name-problem`} role="alert">Give yourself a name.</CalmNote>}
                        </div>
                        {/* Beside Start, where the tap was; the fields it's about point here. */}
                        {sheetProblemShown && <CalmNote id={`${ids}-sheet-problem`} role="alert">{sheetProblems.join(" ")}</CalmNote>}
                        <Control type="submit" disabled={creating}>
                            {creating ? "Starting…" : "Start the party"}
                        </Control>
                    </Pane>
                </Ground>
            </form>
            {failure && <CalmNote role="alert">{failure}</CalmNote>}
            <CalmNote>The party and everyone's ratings are set to be deleted after {PARTY_LIFETIME_DAYS} days.</CalmNote>
        </CalmPage>
    );
};

export default PartySetup;
