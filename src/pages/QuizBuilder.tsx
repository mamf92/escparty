import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { CalmLink, CalmNote, CalmPage } from "../components/CalmPage";
import { Control, Field, Ground, Pane, Row } from "../design";
import { customQuizKey, saveCustomQuiz } from "../utils/customQuizzes";
import { loadQuizForEditing } from "../utils/quizCatalog";
import { focusSoon } from "../utils/focusSoon";
import { radioGroupKeys, radioTabIndex } from "../utils/radioGroupKeys";
import type { QuizDifficulty } from "../utils/QuizDataProvider";
import {
    BREAK_CHOICES,
    CATEGORY_LABELS,
    DEFAULT_BREAK_EVERY,
    DIFFICULTY_LABELS,
    QUESTION_LIMITS,
    QUIZ_LIMITS,
    badOptions,
    isBreakAfter,
    questionFieldProblems,
    quizFieldProblems,
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

/** The messages of the problems about one field. */
const messagesFor = <Field extends string>(problems: { field: Field; message: string }[], field: Field) =>
    problems.filter(problem => problem.field === field).map(problem => problem.message);

/**
 * Build a quiz (#73-#76): name it, pick questions from the bank, write your
 * own, put them in order, choose when the scoreboard break comes, and save
 * it to host or play. Starts empty, from a premade quiz (`state.fromKey`),
 * or from a saved quiz to edit (`/quizzes/edit/:quizId`), which saves as a
 * new quiz in its place.
 *
 * Three views on the design system's surface (#177): the quiz being
 * assembled, the bank picker, and the question editor. Each list is a pane
 * of controls, picked then acted on, the same as the quiz library. Fields
 * sit in the pane under their labels, and what's wrong with one is said
 * beside it.
 */
const QuizBuilder = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { quizId } = useParams<{ quizId?: string }>();
    const fromKey = quizId ? customQuizKey(quizId) : (location.state as { fromKey?: string } | null)?.fromKey;
    const ids = useId();
    const fieldId = (name: string) => `${ids}-${name}`;

    const [title, setTitle] = useState("");
    const [breakEvery, setBreakEvery] = useState<BreakEvery>(DEFAULT_BREAK_EVERY);
    const [questions, setQuestions] = useState<AnyQuestion[]>([]);
    const [selected, setSelected] = useState<number | null>(null);
    // Taking a question out asks first.
    const [confirmingRemove, setConfirmingRemove] = useState(false);
    const [mode, setMode] = useState<Mode>("assemble");
    const [draft, setDraft] = useState<Draft>(emptyDraft);
    const [draftTried, setDraftTried] = useState(false);
    const [saveTried, setSaveTried] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loadNotice, setLoadNotice] = useState<string | null>(null);
    const [saveFailed, setSaveFailed] = useState(false);
    const [loadingFrom, setLoadingFrom] = useState(!!fromKey);
    // Only a quiz that actually loaded is replaced in "my quizzes" on save.
    const [editingLoaded, setEditingLoaded] = useState(false);
    const [bankFailed, setBankFailed] = useState(false);

    const [bank, setBank] = useState<BankQuestion[] | null>(null);
    const [category, setCategory] = useState<QuestionCategory | "all">("all");
    const [difficulty, setDifficulty] = useState<QuizDifficulty | "all">("all");

    const nameRef = useRef<HTMLInputElement>(null);
    const questionRef = useRef<HTMLTextAreaElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const moveUpRef = useRef<HTMLButtonElement>(null);
    const moveDownRef = useRef<HTMLButtonElement>(null);
    const askRemoveRef = useRef<HTMLButtonElement>(null);
    const keepRef = useRef<HTMLButtonElement>(null);
    const answersRef = useRef<HTMLDivElement>(null);
    const correctRef = useRef<HTMLDivElement>(null);

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
            .catch(() => current && setLoadNotice("That quiz couldn't be loaded, so you're starting from scratch."))
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
    // Each problem is said beside the field it's about
    // (docs/design/design-system.md, "Forms").
    const quizFieldIssues = quizFieldProblems({ title, questions, breakEvery });
    const problems = quizFieldIssues.map(problem => problem.message);
    const nameProblems = saveTried ? messagesFor(quizFieldIssues, "name") : [];
    const quizWideProblems = saveTried
        ? quizFieldIssues.filter(problem => problem.field !== "name").map(problem => problem.message)
        : [];

    const select = (index: number | null) => {
        setSelected(index);
        setConfirmingRemove(false);
    };

    const move = (from: number, to: number) => {
        if (to < 0 || to >= questions.length) return;
        const next = [...questions];
        [next[from], next[to]] = [next[to], next[from]];
        setQuestions(next);
        select(to);
        // At an end the move just made is disabled, so keep focus on the
        // move that's still possible instead of dropping it.
        if (to === 0) focusSoon(() => moveDownRef.current);
        else if (to === questions.length - 1) focusSoon(() => moveUpRef.current);
    };

    const askToRemove = () => {
        setConfirmingRemove(true);
        focusSoon(() => keepRef.current);
    };

    const keep = () => {
        setConfirmingRemove(false);
        focusSoon(() => askRemoveRef.current);
    };

    const remove = (index: number) => {
        const left = questions.length - 1;
        setQuestions(questions.filter((_, i) => i !== index));
        select(null);
        // Back to the list's tab stop (nothing is picked now, so the first
        // question), or to adding one when the list is gone.
        focusSoon(() => left > 0
            ? listRef.current?.querySelector<HTMLElement>('[role="radio"][tabindex="0"]')
            : document.getElementById(fieldId("add-from-bank")));
    };

    const toggleBankQuestion = (question: BankQuestion) => {
        if (inQuiz.has(question.id)) {
            setQuestions(questions.filter(existing => existing.id !== question.id));
        } else if (!full) {
            setQuestions([...questions, question]);
        }
        select(null);
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
        setConfirmingRemove(false);
        setMode("write");
    };

    const draftQuestion = {
        question: draft.question,
        options: draft.options,
        correctAnswer: draft.correct === null ? "" : draft.options[draft.correct] ?? "",
    };
    const draftIssues = questionFieldProblems(draftQuestion);
    const draftProblems = draftIssues.map(problem => problem.message);
    const shownDraftIssues = draftTried ? draftIssues : [];
    const shownDraftProblems = shownDraftIssues.map(problem => problem.message);
    const questionTextProblems = messagesFor(shownDraftIssues, "question");
    const correctProblems = messagesFor(shownDraftIssues, "correct");
    const answerProblems = messagesFor(shownDraftIssues, "answers");
    const answersInvalid = answerProblems.length > 0 ? badOptions(draft.options) : draft.options.map(() => false);

    const saveDraft = () => {
        setDraftTried(true);
        if (draftProblems.length > 0) {
            // Take them to the first thing to fix once its note is on the
            // page, so the note is read with it.
            const firstBadAnswer = badOptions(draft.options).indexOf(true);
            const about = (field: string) => draftIssues.some(problem => problem.field === field);
            if (about("question")) focusSoon(() => questionRef.current);
            else if (about("answers") && firstBadAnswer >= 0) {
                focusSoon(() => answersRef.current?.querySelectorAll<HTMLElement>("input")[firstBadAnswer]);
            } else if (about("correct")) focusSoon(() => correctRef.current?.querySelector<HTMLElement>('[role="radio"]'));
            return;
        }
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
        select(null);
        setMode("assemble");
    };

    const setOption = (index: number, value: string) =>
        setDraft({ ...draft, options: draft.options.map((option, i) => (i === index ? value : option)) });

    const addOption = () => {
        const added = draft.options.length;
        setDraft({ ...draft, options: [...draft.options, ""] });
        // Straight into the new answer, ready to type.
        focusSoon(() => document.getElementById(fieldId(`answer-${added}`)));
    };

    const removeLastOption = () => {
        const last = draft.options.length - 1;
        setDraft({ ...draft, options: draft.options.slice(0, last), correct: draft.correct === last ? null : draft.correct });
        // At the fewest answers this move goes away; keep focus nearby.
        if (last <= QUESTION_LIMITS.minOptions) focusSoon(() => document.getElementById(fieldId("add-answer")));
    };

    const saveQuiz = async () => {
        setSaveTried(true);
        if (problems.length > 0) {
            if (quizFieldIssues.some(problem => problem.field === "name")) focusSoon(() => nameRef.current);
            return;
        }
        if (saving) return;
        setSaving(true);
        setSaveFailed(false);
        try {
            const id = await saveCustomQuiz({ title, breakEvery, questions }, editingLoaded ? quizId : undefined);
            // The library lists it from this device's storage; the state
            // carries it too, in case this browser couldn't store the list.
            navigate("/quizzes", {
                state: { picked: customQuizKey(id), saved: { id, title: title.trim(), questionCount: questions.length } },
            });
        } catch (error) {
            console.error("Couldn't save the quiz:", error);
            setSaveFailed(true);
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
                footer={<CalmLink onClick={() => setMode("assemble")}>Back to your quiz</CalmLink>}
            >
                <Ground>
                    <Pane>
                        <label className="calm-label" htmlFor={fieldId("category")}>Category</label>
                        <Field
                            as="select"
                            id={fieldId("category")}
                            value={category}
                            onChange={event => setCategory(event.target.value as QuestionCategory | "all")}
                        >
                            <option value="all">All categories</option>
                            {Object.entries(CATEGORY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                        </Field>
                        <label className="calm-label" htmlFor={fieldId("difficulty")}>Difficulty</label>
                        <Field
                            as="select"
                            id={fieldId("difficulty")}
                            value={difficulty}
                            onChange={event => setDifficulty(event.target.value as QuizDifficulty | "all")}
                        >
                            <option value="all">Any difficulty</option>
                            {Object.entries(DIFFICULTY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                        </Field>
                    </Pane>
                </Ground>
                {bankFailed ? (
                    <>
                        <CalmNote role="alert">The question bank couldn't be loaded. Check your connection and try again.</CalmNote>
                        <Ground>
                            <Pane>
                                <Control onClick={() => setBankFailed(false)}>Try again</Control>
                            </Pane>
                        </Ground>
                    </>
                ) : !bank ? (
                    <CalmNote role="status">Loading the bank…</CalmNote>
                ) : shown.length === 0 ? (
                    <Ground>
                        <Pane>
                            <Row>No questions match that category and difficulty. Try all categories or any difficulty.</Row>
                        </Pane>
                    </Ground>
                ) : (
                    <Ground>
                        <Pane role="group" aria-label="Bank questions">
                            {shown.map(question => (
                                <Control
                                    key={question.id}
                                    block
                                    chosen={inQuiz.has(question.id)}
                                    disabled={full && !inQuiz.has(question.id)}
                                    onClick={() => toggleBankQuestion(question)}
                                >
                                    <span>{question.question}</span>
                                    <span className="calm-sub">{DIFFICULTY_LABELS[question.difficulty]} · {question.correctAnswer}</span>
                                </Control>
                            ))}
                        </Pane>
                    </Ground>
                )}
                {full && <CalmNote>That's the most a quiz can hold ({QUIZ_LIMITS.maxQuestions}).</CalmNote>}
                <Ground>
                    <Pane>
                        <Control onClick={() => setMode("assemble")}>Use these questions</Control>
                    </Pane>
                </Ground>
            </CalmPage>
        );
    }

    if (mode === "write") {
        return (
            <CalmPage
                title={draft.index === null ? "Write a question" : "Edit question"}
                subtitle="Two to six answers, and tap the one that's right."
                footer={<CalmLink onClick={() => setMode("assemble")}>Back to your quiz</CalmLink>}
            >
                <Ground>
                    <Pane ref={answersRef}>
                        <label className="calm-label" htmlFor={fieldId("question")}>Question</label>
                        <Field
                            as="textarea"
                            ref={questionRef}
                            id={fieldId("question")}
                            value={draft.question}
                            maxLength={QUESTION_LIMITS.maxQuestionLength}
                            placeholder="Which act sang in wolf masks?"
                            aria-invalid={questionTextProblems.length > 0 || undefined}
                            aria-describedby={questionTextProblems.length > 0 ? fieldId("question-note") : undefined}
                            onChange={event => setDraft({ ...draft, question: event.target.value })}
                        />
                        {questionTextProblems.length > 0 && (
                            <p className="calm-sub" id={fieldId("question-note")}>{questionTextProblems.join(" ")}</p>
                        )}
                        {draft.options.flatMap((option, index) => [
                            <label key={`label-${index}`} className="calm-label" htmlFor={fieldId(`answer-${index}`)}>
                                Answer {index + 1}
                            </label>,
                            <Field
                                key={`field-${index}`}
                                id={fieldId(`answer-${index}`)}
                                value={option}
                                maxLength={QUESTION_LIMITS.maxOptionLength}
                                aria-invalid={answersInvalid[index] || undefined}
                                aria-describedby={answersInvalid[index] ? fieldId("answers-note") : undefined}
                                onChange={event => setOption(index, event.target.value)}
                            />,
                        ])}
                        {answerProblems.length > 0 && (
                            <p className="calm-sub" id={fieldId("answers-note")}>{answerProblems.join(" ")}</p>
                        )}
                    </Pane>
                </Ground>
                <CalmNote>Which answer is correct?</CalmNote>
                <Ground>
                    <Pane
                        ref={correctRef}
                        role="radiogroup"
                        aria-label="Correct answer"
                        aria-describedby={correctProblems.length > 0 ? fieldId("correct-note") : undefined}
                    >
                        {draft.options.map((option, index) => (
                            <Control
                                key={index}
                                block
                                role="radio"
                                aria-checked={draft.correct === index}
                                tabIndex={radioTabIndex(index, draft.correct)}
                                aria-describedby={correctProblems.length > 0 ? fieldId("correct-note") : undefined}
                                chosen={draft.correct === index}
                                onClick={() => setDraft({ ...draft, correct: index })}
                                onKeyDown={event => radioGroupKeys(event, index, draft.options.length, next => setDraft({ ...draft, correct: next }))}
                            >
                                {option.trim() || `Answer ${index + 1}`}
                            </Control>
                        ))}
                    </Pane>
                </Ground>
                {correctProblems.length > 0 && <CalmNote id={fieldId("correct-note")}>{correctProblems.join(" ")}</CalmNote>}
                {shownDraftProblems.length > 1 && (
                    <CalmNote role="alert">
                        {shownDraftProblems.length} things to fix before this question can go in: {shownDraftProblems.join(" ")}
                    </CalmNote>
                )}
                <Ground>
                    <Pane>
                        {draft.options.length < QUESTION_LIMITS.maxOptions && (
                            <Control id={fieldId("add-answer")} onClick={addOption}>Add another answer</Control>
                        )}
                        {draft.options.length > QUESTION_LIMITS.minOptions && (
                            <Control onClick={removeLastOption}>Remove the last answer</Control>
                        )}
                        <Control onClick={saveDraft}>
                            {draft.index === null ? "Add to the quiz" : "Keep these changes"}
                        </Control>
                    </Pane>
                </Ground>
            </CalmPage>
        );
    }

    const picked = selected === null ? null : questions[selected] ?? null;
    return (
        <CalmPage
            title={quizId ? "Edit quiz" : "Build a quiz"}
            subtitle="Mix questions from the bank with your own, then save it to host or play."
            footer={<CalmLink onClick={() => navigate("/quizzes")}>Back to the quiz library</CalmLink>}
        >
            {loadNotice && <CalmNote role="status">{loadNotice}</CalmNote>}
            <Ground>
                <Pane>
                    <label className="calm-label" htmlFor={fieldId("name")}>Name</label>
                    <Field
                        ref={nameRef}
                        id={fieldId("name")}
                        value={title}
                        maxLength={QUIZ_LIMITS.maxTitleLength}
                        placeholder="Jedward's Revenge"
                        aria-invalid={nameProblems.length > 0 || undefined}
                        aria-describedby={nameProblems.length > 0 ? fieldId("name-note") : undefined}
                        onChange={event => setTitle(event.target.value)}
                    />
                    {nameProblems.length > 0 && <p className="calm-sub" id={fieldId("name-note")}>{nameProblems.join(" ")}</p>}
                    <label className="calm-label" htmlFor={fieldId("break")}>Scoreboard break</label>
                    <Field
                        as="select"
                        id={fieldId("break")}
                        value={breakEvery}
                        onChange={event => setBreakEvery(Number(event.target.value) as BreakEvery)}
                    >
                        {BREAK_CHOICES.map(choice => <option key={choice} value={choice}>{breakLabel(choice)}</option>)}
                    </Field>
                </Pane>
            </Ground>

            {loadingFrom ? (
                <CalmNote role="status">Loading the quiz…</CalmNote>
            ) : questions.length === 0 ? (
                <Ground>
                    <Pane>
                        <Row>No questions yet. Add some from the bank or write your own.</Row>
                    </Pane>
                </Ground>
            ) : (
                <Ground>
                    <Pane ref={listRef} role="radiogroup" aria-label="Questions in this quiz">
                        {questions.map((question, index) => (
                            <Control
                                key={question.id}
                                block
                                role="radio"
                                aria-checked={selected === index}
                                tabIndex={radioTabIndex(index, selected)}
                                chosen={selected === index}
                                onClick={() => select(selected === index ? null : index)}
                                onKeyDown={event => radioGroupKeys(event, index, questions.length, select)}
                            >
                                <span>{index + 1}. {question.question}</span>
                                <span className="calm-sub">
                                    {sourceLabel(question)}
                                    {isBreakAfter(index, questions.length, breakEvery) ? " · Scoreboard after this one" : ""}
                                </span>
                            </Control>
                        ))}
                    </Pane>
                </Ground>
            )}

            {picked && selected !== null && (
                <Ground>
                    <Pane role="group" aria-label={`Question ${selected + 1}`}>
                        <Control ref={moveUpRef} disabled={selected === 0} onClick={() => move(selected, selected - 1)}>Move up</Control>
                        <Control ref={moveDownRef} disabled={selected === questions.length - 1} onClick={() => move(selected, selected + 1)}>Move down</Control>
                        <Control onClick={() => openEditor(selected)}>Edit this question</Control>
                        {confirmingRemove ? (
                            <>
                                <p className="calm-sub" id={fieldId("remove-note")}>
                                    Take question {selected + 1} out of this quiz?
                                </p>
                                <Control aria-describedby={fieldId("remove-note")} onClick={() => remove(selected)}>Yes, remove it</Control>
                                <Control ref={keepRef} onClick={keep}>Keep it</Control>
                            </>
                        ) : (
                            <Control ref={askRemoveRef} onClick={askToRemove}>Remove this question</Control>
                        )}
                    </Pane>
                </Ground>
            )}

            {quizWideProblems.length > 0 && <CalmNote role="alert">{quizWideProblems.join(" ")}</CalmNote>}
            {saveFailed && (
                <CalmNote role="alert">The quiz couldn't be saved. Check your connection and try again.</CalmNote>
            )}
            <Ground>
                <Pane>
                    <Control id={fieldId("add-from-bank")} onClick={() => setMode("bank")}>Add from the bank</Control>
                    <Control disabled={full} onClick={() => openEditor(null)}>Write a question</Control>
                    <Control disabled={saving || loadingFrom} onClick={saveQuiz}>
                        {saving ? "Saving…" : "Save quiz"}
                    </Control>
                </Pane>
            </Ground>
        </CalmPage>
    );
};

export default QuizBuilder;
