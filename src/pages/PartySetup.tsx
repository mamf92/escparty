import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { CalmLink, CalmNote, CalmPage } from "../components/CalmPage";
import { CONTESTS_2027 } from "../data/contests2027";
import { PARTY_LIFETIME_DAYS, createParty, fetchContest } from "../utils/partyFirestore";
import {
    CATEGORY_LIMITS,
    PARTY_BONUSES,
    RATING_TEMPLATES,
    SCALE_CHOICES,
    categoryProblems,
    type RatingCategory,
    type RatingTemplate,
} from "../utils/partyModel";
import { savePartyIdentity } from "../utils/partySession";
import { randomPartyName } from "../utils/partyNames";

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
    const problems = [
        ...(templateId === CUSTOM ? categoryProblems(custom) : []),
        ...(name.trim() ? [] : ["Give yourself a name."]),
    ];

    const setCategory = (index: number, change: Partial<RatingCategory>) =>
        setCustom(custom.map((category, i) => (i === index ? { ...category, ...change } : category)));

    const create = async () => {
        setTried(true);
        if (problems.length > 0 || creating) return;
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

    return (
        <CalmPage
            title="Host a party"
            subtitle="Pick the show and how everyone rates. This is fixed once the party starts."
            footer={<CalmLink type="button" onClick={() => navigate("/party")}>Back</CalmLink>}
        >
            <CalmNote>Which show?</CalmNote>
            <div className="calm-ground">
                <div className="lycra-pane" role="radiogroup" aria-label="Show">
                    {CONTESTS_2027.map(contest => (
                        <button
                            key={contest.id}
                            type="button"
                            role="radio"
                            aria-checked={contestId === contest.id}
                            className={`lycra is-block${contestId === contest.id ? " is-chosen" : ""}`}
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
                        </button>
                    ))}
                </div>
            </div>
            <CalmNote>The running order is a guess until the real one is announced; the host can edit it any time.</CalmNote>

            <CalmNote>How does everyone rate?</CalmNote>
            <div className="calm-ground">
                <div className="lycra-pane" role="radiogroup" aria-label="Rating sheet">
                    {[...RATING_TEMPLATES, { id: CUSTOM, name: "Make our own", blurb: "Up to six categories, each on its own scale.", categories: [] }].map(option => (
                        <button
                            key={option.id}
                            type="button"
                            role="radio"
                            aria-checked={templateId === option.id}
                            className={`lycra is-block${templateId === option.id ? " is-chosen" : ""}`}
                            onClick={() => setTemplateId(option.id)}
                        >
                            <span>{option.name}</span>
                            <span className="calm-sub">
                                {option.categories.length > 0 ? option.categories.map(category => category.label).join(" · ") : option.blurb}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {templateId === CUSTOM && (
                <>
                    <div className="calm-ground">
                        <div className="lycra-pane">
                            {custom.map((category, index) => (
                                <label key={category.id}>
                                    <span className="calm-label">Category {index + 1}</span>
                                    <input
                                        className="lycra-field"
                                        value={category.label}
                                        maxLength={CATEGORY_LIMITS.maxLabel}
                                        placeholder={index === 0 ? "Hair height" : "Costume changes"}
                                        onChange={event => setCategory(index, { label: event.target.value })}
                                    />
                                    <select
                                        className="lycra-field"
                                        aria-label={`Scale for category ${index + 1}`}
                                        value={category.max}
                                        onChange={event => setCategory(index, { max: Number(event.target.value) as RatingCategory["max"] })}
                                    >
                                        {SCALE_CHOICES.map(max => <option key={max} value={max}>{scaleLabel(max)}</option>)}
                                    </select>
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className="calm-ground">
                        <div className="lycra-pane">
                            {custom.length < CATEGORY_LIMITS.max && (
                                <button type="button" className="lycra" onClick={() => setCustom([...custom, newCategory()])}>
                                    Add a category
                                </button>
                            )}
                            {custom.length > CATEGORY_LIMITS.min && (
                                <button type="button" className="lycra" onClick={() => setCustom(custom.slice(0, -1))}>
                                    Remove the last one
                                </button>
                            )}
                        </div>
                    </div>
                </>
            )}

            <div className="calm-ground">
                <div className="lycra-pane">
                    <button
                        type="button"
                        aria-pressed={bonuses}
                        className={`lycra is-block${bonuses ? " is-chosen" : ""}`}
                        onClick={() => setBonuses(!bonuses)}
                    >
                        <span>Party bonuses {bonuses ? "on" : "off"}</span>
                        <span className="calm-sub">{PARTY_BONUSES.map(bonus => `${bonus.label} +${bonus.points}`).join(" · ")}</span>
                    </button>
                    <button
                        type="button"
                        aria-pressed={showNames}
                        className={`lycra is-block${showNames ? " is-chosen" : ""}`}
                        onClick={() => setShowNames(!showNames)}
                    >
                        <span>{showNames ? "Name names in the awards" : "Keep the awards anonymous"}</span>
                        <span className="calm-sub">
                            {showNames
                                ? "Everyone sees who rated like twins and who was toughest."
                                : "The awards say \"two of you\" and \"one of you\", and each guest is told which are theirs. It keeps the fun friendly; the ratings themselves aren't secret from the party."}
                        </span>
                    </button>
                </div>
            </div>

            <div className="calm-ground">
                <div className="lycra-pane">
                    <label>
                        <span className="calm-label">Your name at the party</span>
                        <input className="lycra-field" value={name} maxLength={40} onChange={event => setName(event.target.value)} />
                    </label>
                </div>
            </div>

            {tried && problems.length > 0 && <CalmNote role="alert">{problems.join(" ")}</CalmNote>}
            {failure && <CalmNote role="status">{failure}</CalmNote>}
            <div className="calm-ground">
                <div className="lycra-pane">
                    <button type="button" className="lycra" disabled={creating} onClick={create}>
                        {creating ? "Starting…" : "Start the party"}
                    </button>
                </div>
            </div>
            <CalmNote>The party and everyone's ratings are set to be deleted after {PARTY_LIFETIME_DAYS} days.</CalmNote>
        </CalmPage>
    );
};

export default PartySetup;
