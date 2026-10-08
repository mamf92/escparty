import { Route, Routes, useNavigate } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent } from "../test/test-utils";
import Quiz from "./Quiz";

vi.mock("../firebase", () => ({ db: {} }));
vi.mock("../utils/QuizDataProvider", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/QuizDataProvider")>()),
  loadQuizData: vi.fn(async () => [
    { id: 1, question: "Which country won in 1974?", options: ["Sweden", "Norway", "Ireland"], correctAnswer: "Sweden" },
  ]),
}));

const GoBack =() => {
  const navigate = useNavigate();
  return <button onClick={() => navigate(-1)}>browser back</button>;
};

describe("Quiz and the browser's Back button", () => {
  afterEach(() => vi.useRealTimers());

  it("replaces the quiz with the results, so Back can't re-enter a finished quiz", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    renderWithProviders(
      <Routes>
        <Route path="/select-difficulty" element={<p>pick a difficulty</p>} />
        <Route path="/quiz/:difficulty" element={<Quiz />} />
        <Route path="/results" element={<><p>results</p><GoBack /></>} />
      </Routes>,
      {
        initialEntries: ["/select-difficulty", { pathname: "/quiz/easy", state: { multiplayer: false } }],
        initialIndex: 1,
      },
    );
    await vi.waitFor(() => expect(screen.getByRole("heading", { name: "Which country won in 1974?" })).toBeInTheDocument());
    // Let every question run out: the last one ends the quiz.
    await vi.waitFor(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
      expect(screen.getByText("results")).toBeInTheDocument();
    }, { timeout: 60_000 });
    vi.useRealTimers();
    await userEvent.setup().click(screen.getByRole("button", { name: "browser back" }));
    expect(screen.getByText("pick a difficulty")).toBeInTheDocument();
  });
});
