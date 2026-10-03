import { beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Routes, useLocation, type InitialEntry } from "react-router-dom";
import { renderWithProviders, screen, userEvent, within } from "../test/test-utils";
import QuizBuilder from "./QuizBuilder";

const mocks = vi.hoisted(() => ({ saveCustomQuiz: vi.fn(), fetchCustomQuiz: vi.fn(), bankFails: false }));
vi.mock("../data/questionBank", async (importOriginal) => {
  if (mocks.bankFails) throw new Error("chunk failed");
  return importOriginal();
});
vi.mock("../utils/customQuizzes", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/customQuizzes")>()),
  saveCustomQuiz: mocks.saveCustomQuiz,
  fetchCustomQuiz: mocks.fetchCustomQuiz,
}));

const ID = "AbCdEfGhIjKlMnOpQrSt";

const ShowLocation = () => {
  const location = useLocation();
  return <p>at {location.pathname} with {JSON.stringify(location.state)}</p>;
};

const renderBuilder = (entry: InitialEntry = "/quizzes/new") =>
  renderWithProviders(
    <Routes>
      <Route path="/quizzes/new" element={<QuizBuilder />} />
      <Route path="/quizzes/edit/:quizId" element={<QuizBuilder />} />
      <Route path="*" element={<ShowLocation />} />
    </Routes>,
    { initialEntries: [entry] },
  );

const questionList = () => screen.getByRole("radiogroup", { name: "Questions in this quiz" });

const writeQuestion = async (user: ReturnType<typeof userEvent.setup>, text: string, answers: string[], correct: string) => {
  await user.click(screen.getByRole("button", { name: "Write a question" }));
  // The editor takes focus to its first field.
  await vi.waitFor(() => expect(screen.getByLabelText("Question")).toHaveFocus());
  await user.type(screen.getByLabelText("Question"), text);
  for (const [index, answer] of answers.entries()) {
    if (index >= 2) await user.click(screen.getByRole("button", { name: "Add another answer" }));
    await user.type(screen.getByLabelText(`Answer ${index + 1}`), answer);
  }
  await user.click(screen.getByRole("radio", { name: correct }));
  await user.click(screen.getByRole("button", { name: "Add to the quiz" }));
  // Back in the quiz, focus is ready to write another (or, when the quiz
  // is full, to add from the bank).
  await vi.waitFor(() => expect(document.activeElement).toHaveAccessibleName(/Write a question|Add from the bank/));
};

describe("QuizBuilder", () => {
  it("says so when the bank can't load, and tries again", async () => {
    const user = userEvent.setup();
    mocks.bankFails = true;
    renderBuilder();
    await user.click(screen.getByRole("button", { name: "Add from the bank" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The question bank couldn't be loaded.");

    mocks.bankFails = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("group", { name: "Bank questions" })).toBeInTheDocument();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.saveCustomQuiz.mockResolvedValue(ID);
  });

  it("won't save an empty quiz, and says why", async () => {
    const user = userEvent.setup();
    renderBuilder();
    expect(screen.getByText(/No questions yet/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save quiz" }));

    // What's wrong with the name is said beside it, and focus goes there
    // once the note is on the page, so the note is read with it.
    const name = screen.getByLabelText("Name");
    await vi.waitFor(() => expect(name).toHaveFocus());
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveAccessibleDescription("Give the quiz a name.");
    expect(screen.getByRole("alert")).toHaveTextContent("Add at least one question.");
    expect(mocks.saveCustomQuiz).not.toHaveBeenCalled();
  });

  it("builds a quiz from the bank and your own question, and saves it", async () => {
    const user = userEvent.setup();
    renderBuilder();
    await user.type(screen.getByLabelText("Name"), "Jedward's Revenge");
    await user.selectOptions(screen.getByLabelText("Scoreboard break"), "3");

    await user.click(screen.getByRole("button", { name: "Add from the bank" }));
    await user.selectOptions(await screen.findByLabelText("Category"), "nordic");
    await user.selectOptions(screen.getByLabelText("Difficulty"), "easy");
    const bank = await screen.findByRole("group", { name: "Bank questions" });
    const melodi = within(bank).getByRole("button", { name: /Norway's national Eurovision selection/ });
    await user.click(melodi);
    expect(melodi).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/1 question in your quiz/)).toBeInTheDocument();
    // Tapping again takes it out; a third tap puts it back.
    await user.click(melodi);
    expect(melodi).toHaveAttribute("aria-pressed", "false");
    await user.click(melodi);
    await user.click(screen.getByRole("button", { name: "Use these questions" }));
    // Back where the bank was opened from.
    await vi.waitFor(() => expect(screen.getByRole("button", { name: "Add from the bank" })).toHaveFocus());

    await writeQuestion(user, "Who sang 'Lipstick'?", ["Bros", "Jedward", "Zig and Zag"], "Jedward");

    const rows = within(questionList()).getAllByRole("radio");
    expect(rows.map(row => row.textContent)).toEqual([
      expect.stringContaining("1. What is Norway's national Eurovision selection called?Bank · Nordic nights"),
      expect.stringContaining("2. Who sang 'Lipstick'?Yours"),
    ]);

    await user.click(screen.getByRole("button", { name: "Save quiz" }));

    expect(mocks.saveCustomQuiz).toHaveBeenCalledWith({
      title: "Jedward's Revenge",
      breakEvery: 3,
      questions: [
        expect.objectContaining({ id: "w-e-13", source: "bank" }),
        expect.objectContaining({ source: "custom", question: "Who sang 'Lipstick'?", options: ["Bros", "Jedward", "Zig and Zag"], correctAnswer: "Jedward" }),
      ],
    }, undefined);
    expect(await screen.findByText(
      `at /quizzes with {"picked":"c-${ID}","saved":{"id":"${ID}","title":"Jedward's Revenge","questionCount":2}}`,
    )).toBeInTheDocument();
  });

  it("checks a written question before adding it", async () => {
    const user = userEvent.setup();
    renderBuilder();
    await user.click(screen.getByRole("button", { name: "Write a question" }));
    await vi.waitFor(() => expect(screen.getByLabelText("Question")).toHaveFocus());
    await user.type(screen.getByLabelText("Answer 1"), "Same");
    await user.type(screen.getByLabelText("Answer 2"), "same");
    await user.click(screen.getByRole("button", { name: "Add to the quiz" }));

    // Each problem is said beside its field, and focus goes to the first.
    const question = screen.getByLabelText("Question");
    await vi.waitFor(() => expect(question).toHaveFocus());
    expect(question).toHaveAccessibleDescription("Write the question.");
    // The problems away from the focused field are announced together.
    expect(screen.getByRole("alert")).toHaveTextContent(
      "3 things to fix before this question can go in: Write the question. Two answers are the same. Mark which answer is correct.",
    );
    // The correct-answer note is the group's, so it's read once.
    expect(screen.getByRole("radio", { name: "Same" })).not.toHaveAccessibleDescription();
    expect(screen.getByLabelText("Answer 1")).toHaveAccessibleDescription("Two answers are the same.");
    expect(screen.getByLabelText("Answer 2")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("radiogroup", { name: "Correct answer" })).toHaveAccessibleDescription("Mark which answer is correct.");
    // The alert was said once; editing retires it while the notes stay.
    await user.type(screen.getByLabelText("Question"), "Who?");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Answer 1")).toHaveAccessibleDescription("Two answers are the same.");

    // Up to six answers, and back down to two.
    for (let i = 0; i < 4; i++) await user.click(screen.getByRole("button", { name: "Add another answer" }));
    expect(screen.queryByRole("button", { name: "Add another answer" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Answer 6" }));
    await user.click(screen.getByRole("button", { name: "Remove the last answer" }));
    expect(screen.getAllByRole("radio").every(radio => radio.getAttribute("aria-checked") === "false")).toBe(true);
    for (let i = 0; i < 3; i++) await user.click(screen.getByRole("button", { name: "Remove the last answer" }));
    expect(screen.queryByRole("button", { name: "Remove the last answer" })).not.toBeInTheDocument();

    await user.click(screen.getByText("Back to your quiz"));
    expect(screen.getByText(/No questions yet/)).toBeInTheDocument();
  });

  it("reorders, edits and takes out questions", async () => {
    const user = userEvent.setup();
    renderBuilder();
    await writeQuestion(user, "First?", ["A", "B"], "A");
    await writeQuestion(user, "Second?", ["C", "D"], "D");

    await user.click(within(questionList()).getByRole("radio", { name: /Second\?/ }));
    // At the end, the move that can't be made stays put, disabled.
    expect(screen.getByRole("button", { name: "Move down" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Move up" }));
    expect(within(questionList()).getAllByRole("radio")[0]).toHaveTextContent("1. Second?");
    // Now at the top: focus moves to the move that's still possible.
    expect(screen.getByRole("button", { name: "Move up" })).toBeDisabled();
    await vi.waitFor(() => expect(screen.getByRole("button", { name: "Move down" })).toHaveFocus());

    await user.click(screen.getByRole("button", { name: "Edit this question" }));
    expect(screen.getByLabelText("Question")).toHaveValue("Second?");
    expect(screen.getByRole("radio", { name: "D" })).toHaveAttribute("aria-checked", "true");
    await user.clear(screen.getByLabelText("Question"));
    await user.type(screen.getByLabelText("Question"), "Second, edited?");
    await user.click(screen.getByRole("button", { name: "Keep these changes" }));
    expect(within(questionList()).getAllByRole("radio")[0]).toHaveTextContent("1. Second, edited?");
    // Back on the question it edited, picked, with focus where it left.
    expect(within(questionList()).getAllByRole("radio")[0]).toHaveAttribute("aria-checked", "true");
    await vi.waitFor(() => expect(screen.getByRole("button", { name: "Edit this question" })).toHaveFocus());
    // Space or a click on the picked question keeps it picked.
    within(questionList()).getAllByRole("radio")[0].focus();
    await user.keyboard(" ");
    expect(within(questionList()).getAllByRole("radio")[0]).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("group", { name: "Question 1" })).toBeInTheDocument();

    await user.click(within(questionList()).getByRole("radio", { name: /First\?/ }));
    // Taking a question out asks first, and keeping it changes nothing.
    await user.click(screen.getByRole("button", { name: "Remove this question" }));
    expect(screen.getByRole("button", { name: "Yes, remove it" })).toHaveAccessibleDescription("Take question 2 out of this quiz?");
    await user.click(screen.getByRole("button", { name: "Keep it" }));
    expect(within(questionList()).getAllByRole("radio")).toHaveLength(2);
    // An open question isn't still waiting to be removed after editing it.
    await user.click(screen.getByRole("button", { name: "Remove this question" }));
    await user.click(screen.getByRole("button", { name: "Edit this question" }));
    await user.click(screen.getByRole("button", { name: "Back to your quiz" }));
    expect(screen.queryByRole("button", { name: "Yes, remove it" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove this question" }));
    await user.click(screen.getByRole("button", { name: "Yes, remove it" }));
    expect(within(questionList()).getAllByRole("radio")).toHaveLength(1);
    // Focus goes back to the list's tab stop.
    await vi.waitFor(() => expect(within(questionList()).getAllByRole("radio")[0]).toHaveFocus());
  });

  it("starts from a premade quiz, where an edited bank question becomes yours", async () => {
    const user = userEvent.setup();
    renderBuilder({ pathname: "/quizzes/new", state: { fromKey: "t-quick-fire" } });

    expect(await screen.findByDisplayValue("Quick Fire (my version)")).toBeInTheDocument();
    expect(screen.getByLabelText("Scoreboard break")).toHaveValue("0");
    const rows = within(questionList()).getAllByRole("radio");
    expect(rows).toHaveLength(10);

    // Opened and kept without a change, it stays the bank's.
    await user.click(rows[0]);
    await user.click(screen.getByRole("button", { name: "Edit this question" }));
    await user.click(screen.getByRole("button", { name: "Keep these changes" }));
    expect(within(questionList()).getAllByRole("radio")[0]).toHaveTextContent("Bank ·");

    await user.click(within(questionList()).getAllByRole("radio")[0]);
    await user.click(screen.getByRole("button", { name: "Edit this question" }));
    await user.type(screen.getByLabelText("Question"), " Really?");
    await user.click(screen.getByRole("button", { name: "Keep these changes" }));
    expect(within(questionList()).getAllByRole("radio")[0]).toHaveTextContent("Really?Yours");
  });

  it("says so when no bank question matches the filters", async () => {
    const user = userEvent.setup();
    renderBuilder();
    await user.click(screen.getByRole("button", { name: "Add from the bank" }));
    const category = await screen.findByLabelText("Category");
    await screen.findByRole("group", { name: "Bank questions" });
    // The bank has no hard spectacle questions.
    await user.selectOptions(category, "spectacle");
    await user.selectOptions(screen.getByLabelText("Difficulty"), "hard");
    expect(screen.queryByRole("group", { name: "Bank questions" })).not.toBeInTheDocument();
    expect(screen.getByText(/No questions match that category and difficulty/)).toBeInTheDocument();
  });

  it("moves through the questions with the arrow keys", async () => {
    const user = userEvent.setup();
    renderBuilder();
    await writeQuestion(user, "First?", ["A", "B"], "A");
    await writeQuestion(user, "Second?", ["C", "D"], "D");

    const [first, second] = within(questionList()).getAllByRole("radio");
    expect(first).toHaveAttribute("tabindex", "0");
    expect(second).toHaveAttribute("tabindex", "-1");
    first.focus();
    await user.keyboard("{ArrowDown}");
    expect(second).toHaveFocus();
    expect(second).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("group", { name: "Question 2" })).toBeInTheDocument();
  });

  it("edits a saved quiz, saving the new version in its place", async () => {
    const user = userEvent.setup();
    mocks.fetchCustomQuiz.mockResolvedValue({
      id: ID,
      title: "Mine",
      breakEvery: 4,
      questions: [{ id: "q1", question: "Who?", options: ["A", "B"], correctAnswer: "A", source: "custom" }],
    });
    renderBuilder(`/quizzes/edit/${ID}`);

    expect(await screen.findByDisplayValue("Mine")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Edit quiz" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save quiz" }));
    expect(mocks.saveCustomQuiz).toHaveBeenCalledWith(expect.objectContaining({ title: "Mine", breakEvery: 4 }), ID);
  });

  it("starts empty when the quiz to edit can't be loaded, and then doesn't replace it", async () => {
    const user = userEvent.setup();
    mocks.fetchCustomQuiz.mockResolvedValue(null);
    renderBuilder(`/quizzes/edit/${ID}`);
    expect(await screen.findByText(/That quiz couldn.t be loaded/)).toHaveAttribute("role", "status");
    expect(screen.getByText(/No questions yet/)).toBeInTheDocument();
    // The notice has had its say once they try to save.
    await user.click(screen.getByRole("button", { name: "Save quiz" }));
    expect(screen.queryByText(/That quiz couldn.t be loaded/)).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Name"), "Fresh");
    await writeQuestion(user, "Q?", ["A", "B"], "A");
    await user.click(screen.getByRole("button", { name: "Save quiz" }));
    expect(mocks.saveCustomQuiz).toHaveBeenCalledWith(expect.objectContaining({ title: "Fresh" }), undefined);
  });

  it("says so when saving fails, and lets you try again", async () => {
    const user = userEvent.setup();
    mocks.saveCustomQuiz.mockRejectedValueOnce(new Error("offline"));
    renderBuilder();
    await user.type(screen.getByLabelText("Name"), "Offline quiz");
    await writeQuestion(user, "Q?", ["A", "B"], "A");

    await user.click(screen.getByRole("button", { name: "Save quiz" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("couldn't be saved");

    await user.click(screen.getByRole("button", { name: "Save quiz" }));
    expect(await screen.findByText(/at \/quizzes/)).toBeInTheDocument();
  });

  it("leaves for the library", async () => {
    const user = userEvent.setup();
    renderBuilder();
    await user.click(screen.getByText("Back to the quiz library"));
    expect(screen.getByText("at /quizzes with null")).toBeInTheDocument();
  });
});
