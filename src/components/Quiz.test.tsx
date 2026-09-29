import { beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Routes } from "react-router-dom";
import { fireEvent } from "@testing-library/react";
import { renderWithProviders, screen, userEvent } from "../test/test-utils";
import { theme } from "../styles/theme";
import type { QuizQuestion } from "../utils/QuizDataProvider";

const QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    question: "Which country won in 1974?",
    options: ["Sweden", "Norway", "Ireland"],
    correctAnswer: "Sweden",
  },
];

vi.mock("../firebase", () => ({ db: {} }));
vi.mock("../utils/QuizDataProvider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/QuizDataProvider")>();
  return { ...actual, loadQuizData: vi.fn(async () => QUESTIONS) };
});

const renderSinglePlayerQuiz = () =>
  renderWithProviders(
    <Routes>
      <Route path="/quiz/:difficulty" element={<Quiz />} />
    </Routes>,
    { initialEntries: [{ pathname: "/quiz/easy", state: { multiplayer: false } } as unknown as string] },
  );

// Imported after the mocks above are registered.
const { default: Quiz } = await import("./Quiz");

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => { });
});

describe("Quiz answer selection (#22)", () => {
  it("doesn't reveal the correct answer before the answer is submitted", async () => {
    renderSinglePlayerQuiz();

    const correct = await screen.findByRole("button", { name: "Sweden" });
    const wrong = screen.getByRole("button", { name: "Norway" });
    const other = screen.getByRole("button", { name: "Ireland" });

    // Whichever option is picked, right or wrong, it looks the same, and
    // the unpicked ones all look alike. (Compared with each other rather
    // than against fixed colours: jsdom matches :hover rules regardless of
    // the pointer, so the absolute colours here are the hover ones.)
    const look = (element: HTMLElement) => getComputedStyle(element).background;

    fireEvent.click(wrong);
    const pickedLook = look(wrong);
    const unpickedLook = look(correct);
    expect(pickedLook).not.toBe(unpickedLook);
    expect(look(other)).toBe(unpickedLook);

    fireEvent.click(correct);
    expect(look(correct)).toBe(pickedLook);
    expect(look(wrong)).toBe(unpickedLook);
    expect(look(other)).toBe(unpickedLook);
  });

  it("marks right and wrong only once the answer is submitted", async () => {
    const user = userEvent.setup();
    renderSinglePlayerQuiz();

    await user.click(await screen.findByRole("button", { name: "Norway" }));
    await user.click(screen.getByRole("button", { name: "Submit Answer" }));

    expect(screen.getByRole("button", { name: "Sweden" })).toHaveStyle({ background: theme.colors.accentgreen });
    expect(screen.getByRole("button", { name: "Norway" })).toHaveStyle({ background: theme.colors.incorrectRed });
  });
});
