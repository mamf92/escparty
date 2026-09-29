import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { CalmLink, CalmNote, CalmPage } from "../components/CalmPage";
import { customQuizKey, saveCustomQuiz } from "../utils/customQuizzes";
import { loadQuizForEditing } from "../utils/quizCatalog";
import type { QuizDifficulty } from "../utils/QuizDataProvider";
import {
    BREAK_CHOICES,
    CATEGORY_LABELS,
    DEFAULT_BREAK_EVERY,
    DIFFICULTY_LABELS,
    QUESTION_LIMITS,
    QUIZ_LIMITS,
    isBreakAfter,
    questionProblems,
    quizProblems,
    type AnyQuestion,
    type BankQuestion,
    type BreakEvery,
    type QuestionCategory,
} from "../utils/quizModel";

type Mode = "assemble" | "bank" | "write";

interface Draft {
    /** The index of the question being edited, or null for a new one. */
    index: number | null;
    question: string;
    options: string[];
    /** Which option is correct, by position. */
    correct: number | null;
}

const emptyDraft = (): Draft => ({ index: null, question: "", options: ["", ""], correct: null });

const breakLabel = (breakEvery: BreakEvery) =>
    breakEvery === 0 ? "Never" : `After every ${breakEvery} questions`;

const sourceLabel = (question: AnyQuestion) =>
    question.source === "bank" ? `Bank · ${CATEGORY_LABELS[question.category]}` : "Yours";

let customCounter = 0;
const newCustomId = () => `mine-${Date.now().toString(36)}-${(customCounter++).toString(36)}`;

/**
 * Build a quiz (#73-#76): name it, pick questions from the bank, write your
 * own, put them in order, choose when the scoreboard break comes, and save
 * it to host or play. Starts empty, from a premade quiz (`state.fromKey`),
 * or from a saved quiz to edit (`/quizzes/edit/:quizId`), which saves as a
 * new quiz in its place.
 *
 * Three views on the Calm surface: the quiz being assembled, the bank
 * picker, and the question editor. Each list is a pane of controls, picked
 * then acted on, the same as the quiz library.
 */
const QuizBuilder = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { quizId } = useParams<{ quizId?: string }>();
    const fromKey = quizId ? customQuizKey(quizId) : (location.state as { fromKey?: string } | null)?.fromKey;

    const [title, setTitle] = useState("");
    const [breakEvery, setBreakEvery] = useState<BreakEvery>(DEFAULT_BREAK_EVERY);
    const [questions, setQuestions] = useState<AnyQuestion[]>([]);
    const [selected, setSelected] = useState<number | null>(null);
    const [mode, setMode] = useState<Mode>("assemble");
    const [draft, setDraft] = useState<Draft>(emptyDraft);
    const [draftTried, setDraftTried] = useState(false);
    const [saveTried, setSaveTried] = useState(false);
    const [saving, setSaving] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const [loadingFrom, setLoadingFrom] = useState(!!fromKey);
    // Only a quiz that actually loaded is replaced in "my quizzes" on save.
    const [editingLoaded, setEditingLoaded] = useState(false);
    const [bankFailed, setBankFailed] = useState(false);

    const [bank, setBank] = useState<BankQuestion[] | null>(null);
    const [category, setCategory] = useState<QuestionCategory | "all">("all");
    const [difficulty, setDifficulty] = useState<QuizDifficulty | "all">("all");

    // Start from a premade or saved quiz.
    useEffect(() => {
        if (!fromKey) return;
        let current = true;
        loadQuizForEditing(fromKey)
            .then(start => {
                if (!current) return;
                setTitle(quizId ? start.title : `${start.title} (my version)`.slice(0, QUIZ_LIMITS.maxTitleLength));
                setBreakEvery(start.breakEvery);
                setQuestions(start.questions);
                setEditingLoaded(!!quizId);
            })
            .catch(() => current && setNotice("That quiz couldn't be loaded, so you're starting from scratch."))
            .finally(() => current && setLoadingFrom(false));
        return () => {
            current = false;
        };
    }, [fromKey, quizId]);

    // The bank loads the first time the picker opens.
    useEffect(() => {
        if (mode !== "bank" || bank || bankFailed) return;
        import("../data/questionBank")
            .then(module => setBank(module.BANK_QUESTIONS))
            .catch(error => {
                console.error("Couldn't load the question bank:", error);
                setBankFailed(true);
            });
    }, [mode, bank, bankFailed]);

    const inQuiz = useMemo(() => new Set(questions.map(question => question.id)), [questions]);
    const full = questions.length >= QUIZ_LIMITS.maxQuestions;
    const problems = quizProblems({ title, questions, breakEvery });

    const move = (from: number, to: number) => {
        if (to < 0 || to >= questions.length) return;
        const next = [...questions];
        [next[from], next[to]] = [next[to], next[from]];
        setQuestions(next);
        setSelected(to);
    };

    const remove = (index: number) => {
        setQuestions(questions.filter((_, i) => i !== index));
        setSelected(null);
    };

    const toggleBankQuestion = (question: BankQuestion) => {
        if (inQuiz.has(question.id)) {
            setQuestions(questions.filter(existing => existing.id !== question.id));
        } else if (!full) {
            setQuestions([...questions, question]);
        }
        setSelected(null);
    };

    const openEditor = (index: number | null) => {
        if (index === null) {
            setDraft(emptyDraft());
        } else {
            const question = questions[index];
            setDraft({
                index,
                question: question.question,
                options: [...question.options],
                correct: question.options.indexOf(question.correctAnswer),
            });
        }
        setDraftTried(false);
        setMode("write");
    };

    const draftQuestion = {
        question: draft.question,
        options: draft.options,
        correctAnswer: draft.correct === null ? "" : draft.options[draft.correct] ?? "",
    };
    const draftProblems = questionProblems(draftQuestion);

    const saveDraft = () => {
        setDraftTried(true);
        if (draftProblems.length > 0) return;
        const trimmed = {
            question: draftQuestion.question.trim(),
            options: draftQuestion.options.map(option => option.trim()),
            correctAnswer: draftQuestion.correctAnswer.trim(),
        };
        if (draft.index === null) {
            setQuestions([...questions, { id: newCustomId(), source: "custom", ...trimmed }]);
        } else {
            // A changed bank question becomes the host's own; an unchanged
            // one stays the bank's, so the picker still shows it as added.
            setQuestions(questions.map((question, i) => {
                if (i !== draft.index) return question;
                const unchanged = question.question === trimmed.question &&
                    question.correctAnswer === trimmed.correctAnswer &&
                    question.options.join("\u0000") === trimmed.options.join("\u0000");
                if (unchanged) return question;
                return { id: question.source === "custom" ? question.id : newCustomId(), source: "custom", ...trimmed };
            }));
        }
        setSelected(null);
        setMode("assemble");
    };

    const setOption = (index: number, value: string) =>
        setDraft({ ...draft, options: draft.options.map((option, i) => (i === index ? value : option)) });

    const removeLastOption = () => {
        const last = draft.options.length - 1;
        setDraft({ ...draft, options: draft.options.slice(0, last), correct: draft.correct === last ? null : draft.correct });
    };

    const saveQuiz = async () => {
        setSaveTried(true);
        if (problems.length > 0 || saving) return;
        setSaving(true);
        setNotice(null);
        try {
            const id = await saveCustomQuiz({ title, breakEvery, questions }, editingLoaded ? quizId : undefined);
            // The library lists it from this device's storage; the state
            // carries it too, in case this browser couldn't store the list.
            navigate("/quizzes", {
                state: { picked: customQuizKey(id), saved: { id, title: title.trim(), questionCount: questions.length } },
            });
        } catch (error) {
            console.error("Couldn't save the quiz:", error);
            setNotice("The quiz couldn't be saved. Check your connection and try again.");
            setSaving(false);
        }
    };

    if (mode === "bank") {
        const shown = (bank ?? []).filter(question =>
            (category === "all" || question.category === category) &&
            (difficulty === "all" || question.difficulty === difficulty));
        return (
            <CalmPage
                title="Question bank"
                subtitle={`${questions.length} ${questions.length === 1 ? "question" : "questions"} in your quiz. Tap to add or take out.`}
                footer={<CalmLink type="button" onClick={() => setMode("assemble")}>Back to your quiz</CalmLink>}
            >
                <div className="calm-ground">
                    <div className="lycra-pane">
                        <label>
                            <span className="calm-label">Category</span>
                            <select className="lycra-field" value={category} onChange={event => setCategory(event.target.value as QuestionCategory | "all")}>
                                <option value="all">All categories</option>
                                {Object.entries(CATEGORY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                            </select>
                        </label>
                        <label>
                            <span className="calm-label">Difficulty</span>
                            <select className="lycra-field" value={difficulty} onChange={event => setDifficulty(event.target.value as QuizDifficulty | "all")}>
                                <option value="all">Any difficulty</option>
                                {Object.entries(DIFFICULTY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                            </select>
                        </label>
                    </div>
                </div>
                {bankFailed ? (
                    <>
                        <CalmNote role="alert">The question bank couldn't be loaded.</CalmNote>
                        <div className="calm-ground">
                            <div className="lycra-pane">
                                <button type="button" className="lycra" onClick={() => setBankFailed(false)}>Try again</button>
                            </div>
                        </div>
                    </>
                ) : !bank ? (
                    <CalmNote>Loading the bank…</CalmNote>
                ) : (
                    <div className="calm-ground">
                        <div className="lycra-pane" role="group" aria-label="Bank questions">
                            {shown.map(question => (
                                <button
                                    key={question.id}
                                    type="button"
                                    aria-pressed={inQuiz.has(question.id)}
                                    disabled={full && !inQuiz.has(question.id)}
                                    className={`lycra is-block${inQuiz.has(question.id) ? " is-chosen" : ""}`}
                                    onClick={() => toggleBankQuestion(question)}
                                >
                                    <span>{question.question}</span>
                                    <span className="calm-sub">{DIFFICULTY_LABELS[question.difficulty]} · {question.correctAnswer}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                {full && <CalmNote>That's the most a quiz can hold ({QUIZ_LIMITS.maxQuestions}).</CalmNote>}
                <div className="calm-ground">
                    <div className="lycra-pane">
                        <button type="button" className="lycra" onClick={() => setMode("assemble")}>Done</button>
                    </div>
                </div>
            </CalmPage>
        );
    }

    if (mode === "write") {
        return (
            <CalmPage
                title={draft.index === null ? "Write a question" : "Edit question"}
                subtitle="Two to six answers, and tap the one that's right."
                footer={<CalmLink type="button" onClick={() => setMode("assemble")}>Back to your quiz</CalmLink>}
            >
                <div className="calm-ground">
                    <div className="lycra-pane">
                        <label>
                            <span className="calm-label">Question</span>
                            <textarea
                                className="lycra-field"
                                value={draft.question}
                                maxLength={QUESTION_LIMITS.maxQuestionLength}
                                placeholder="Which act sang in wolf masks?"
                                onChange={event => setDraft({ ...draft, question: event.target.value })}
                            />
                        </label>
                        {draft.options.map((option, index) => (
                            <label key={index}>
                                <span className="calm-label">Answer {index + 1}</span>
                                <input
                                    className="lycra-field"
                                    value={option}
                                    maxLength={QUESTION_LIMITS.maxOptionLength}
                                    onChange={event => setOption(index, event.target.value)}
                                />
                            </label>
                        ))}
                    </div>
                </div>
                <CalmNote>Which answer is correct?</CalmNote>
                <div className="calm-ground">
                    <div className="lycra-pane" role="radiogroup" aria-label="Correct answer">
                        {draft.options.map((option, index) => (
                            <button
                                key={index}
                                type="button"
                                role="radio"
                                aria-checked={draft.correct === index}
                                className={`lycra is-block${draft.correct === index ? " is-chosen" : ""}`}
                                onClick={() => setDraft({ ...draft, correct: index })}
                            >
                                {option.trim() || `Answer ${index + 1}`}
                            </button>
                        ))}
                    </div>
                </div>
                {draftTried && draftProblems.length > 0 && (
                    <CalmNote role="alert">{draftProblems.join(" ")}</CalmNote>
                )}
                <div className="calm-ground">
                    <div className="lycra-pane">
                        {draft.options.length < QUESTION_LIMITS.maxOptions && (
                            <button type="button" className="lycra" onClick={() => setDraft({ ...draft, options: [...draft.options, ""] })}>
                                Add another answer
                            </button>
                        )}
                        {draft.options.length > QUESTION_LIMITS.minOptions && (
                            <button type="button" className="lycra" onClick={removeLastOption}>Remove the last answer</button>
                        )}
                        <button type="button" className="lycra" onClick={saveDraft}>
                            {draft.index === null ? "Add to the quiz" : "Keep these changes"}
                        </button>
                    </div>
                </div>
            </CalmPage>
        );
    }

    const picked = selected === null ? null : questions[selected] ?? null;
    return (
        <CalmPage
            title={quizId ? "Edit quiz" : "Build a quiz"}
            subtitle="Mix questions from the bank with your own, then save it to host or play."
            footer={<CalmLink type="button" onClick={() => navigate("/quizzes")}>Back to the quiz library</CalmLink>}
        >
            {notice && <CalmNote role="status">{notice}</CalmNote>}
            <div className="calm-ground">
                <div className="lycra-pane">
                    <label>
                        <span className="calm-label">Name</span>
                        <input
                            className="lycra-field"
                            value={title}
                            maxLength={QUIZ_LIMITS.maxTitleLength}
                            placeholder="Jedward's Revenge"
                            onChange={event => setTitle(event.target.value)}
                        />
                    </label>
                    <label>
                        <span className="calm-label">Scoreboard break</span>
                        <select
                            className="lycra-field"
                            value={breakEvery}
                            onChange={event => setBreakEvery(Number(event.target.value) as BreakEvery)}
                        >
                            {BREAK_CHOICES.map(choice => <option key={choice} value={choice}>{breakLabel(choice)}</option>)}
                        </select>
                    </label>
                </div>
            </div>

            {loadingFrom ? (
                <CalmNote>Loading the quiz…</CalmNote>
            ) : questions.length === 0 ? (
                <CalmNote>No questions yet. Add some from the bank or write your own.</CalmNote>
            ) : (
                <div className="calm-ground">
                    <div className="lycra-pane" role="radiogroup" aria-label="Questions in this quiz">
                        {questions.map((question, index) => (
                            <button
                                key={question.id}
                                type="button"
                                role="radio"
                                aria-checked={selected === index}
                                className={`lycra is-block${selected === index ? " is-chosen" : ""}`}
                                onClick={() => setSelected(selected === index ? null : index)}
                            >
                                <span>{index + 1}. {question.question}</span>
                                <span className="calm-sub">
                                    {sourceLabel(question)}
                                    {isBreakAfter(index, questions.length, breakEvery) ? " · Scoreboard after this one" : ""}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {picked && selected !== null && (
                <div className="calm-ground">
                    <div className="lycra-pane" aria-label={`Question ${selected + 1}`}>
                        {selected > 0 && (
                            <button type="button" className="lycra" onClick={() => move(selected, selected - 1)}>Move up</button>
                        )}
                        {selected < questions.length - 1 && (
                            <button type="button" className="lycra" onClick={() => move(selected, selected + 1)}>Move down</button>
                        )}
                        <button type="button" className="lycra" onClick={() => openEditor(selected)}>Edit</button>
                        <button type="button" className="lycra" onClick={() => remove(selected)}>Take out</button>
                    </div>
                </div>
            )}

            {saveTried && problems.length > 0 && <CalmNote role="alert">{problems.join(" ")}</CalmNote>}
            <div className="calm-ground">
                <div className="lycra-pane">
                    <button type="button" className="lycra" onClick={() => setMode("bank")}>Add from the bank</button>
                    <button type="button" className="lycra" disabled={full} onClick={() => openEditor(null)}>Write a question</button>
                    <button type="button" className="lycra" disabled={saving || loadingFrom} onClick={saveQuiz}>
                        {saving ? "Saving…" : "Save quiz"}
                    </button>
                </div>
            </div>
        </CalmPage>
    );
};

export default QuizBuilder;
