import { beforeEach, describe, expect, it, vi } from "vitest";
import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { renderWithProviders, screen, userEvent } from "../test/test-utils";
import { loadQuizData, type QuizQuestion } from "../utils/QuizDataProvider";
import { ScoreWriteRejected, type Room } from "../utils/roomsFirestore";
import Quiz from "./Quiz";

const QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    question: "Which country won in 1974?",
    options: ["Sweden", "Norway", "Ireland"],
    correctAnswer: "Sweden",
  },
];

const mocks = vi.hoisted(() => ({
  listenToRoom: vi.fn(),
  updatePlayerScore: vi.fn(),
  advanceQuestion: vi.fn(),
}));

vi.mock("../firebase", () => ({ db: {} }));
vi.mock("../utils/roomsFirestore", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/roomsFirestore")>()),
  ...mocks,
}));
vi.mock("../utils/QuizDataProvider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/QuizDataProvider")>();
  return { ...actual, loadQuizData: vi.fn(async () => QUESTIONS) };
});

vi.mock("../utils/customQuizzes", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/customQuizzes")>()),
  // Every saved quiz in these tests has since been deleted.
  fetchCustomQuiz: vi.fn(async () => null),
}));

const renderQuiz = (state: Record<string, unknown>, pathname = "/quiz/easy") =>
  renderWithProviders(
    <Routes>
      <Route path="/quiz/:difficulty" element={<Quiz />} />
    </Routes>,
    { initialEntries: [{ pathname, state }] },
  );

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => { });
  vi.spyOn(console, "error").mockImplementation(() => { });
  sessionStorage.clear();
});

describe("Quiz answer selection (#22)", () => {
  it("doesn't reveal the correct answer before the answer is submitted", async () => {
    const user = userEvent.setup();
    renderQuiz({ multiplayer: false });

    const correct = await screen.findByRole("button", { name: "Sweden" });
    const wrong = screen.getByRole("button", { name: "Norway" });
    const other = screen.getByRole("button", { name: "Ireland" });

    // Whichever option is picked, right or wrong, it's only chosen (sunk),
    // and nothing is marked yet.
    await user.click(wrong);
    expect(wrong).toHaveAttribute("aria-pressed", "true");
    expect(wrong).toHaveClass("is-chosen");
    expect(correct).toHaveAttribute("aria-pressed", "false");
    expect(other).toHaveAttribute("aria-pressed", "false");

    await user.click(correct);
    expect(correct).toHaveClass("is-chosen");
    expect(wrong).not.toHaveClass("is-chosen");
    expect(document.querySelector(".calm-marker")).toBeNull();
  });

  it("marks right and wrong only once the answer is submitted, with a glyph and in words", async () => {
    const user = userEvent.setup();
    renderQuiz({ multiplayer: false });

    await user.click(await screen.findByRole("button", { name: "Norway" }));
    await user.click(screen.getByRole("button", { name: "Lock in my answer" }));

    const marker = (name: string) => screen.getByRole("button", { name }).querySelector(".calm-marker")?.getAttribute("data-marker");
    expect(marker("Sweden")).toBe("correct");
    expect(marker("Norway")).toBe("wrong");
    expect(marker("Ireland")).toBeUndefined();
    expect(screen.getByRole("status")).toHaveTextContent("Nul points this time. The answer was Sweden.");
    expect(screen.getByRole("button", { name: /^Results in \d+s$/ })).toBeDisabled();
  });

  it("says the points for a right answer", async () => {
    const user = userEvent.setup();
    renderQuiz({ multiplayer: false });

    await user.click(await screen.findByRole("button", { name: "Sweden" }));
    await user.click(screen.getByRole("button", { name: "Lock in my answer" }));

    expect(screen.getByRole("status")).toHaveTextContent(/^Douze points! That's right: \+\d+ points\.$/);
  });

  it("keeps a keyboard player's focus on the question once locking in disables the button", async () => {
    const user = userEvent.setup();
    renderQuiz({ multiplayer: false });

    await user.click(await screen.findByRole("button", { name: "Sweden" }));
    screen.getByRole("button", { name: "Lock in my answer" }).focus();
    await user.keyboard("{Enter}");

    expect(screen.getByRole("heading", { level: 2, name: "Which country won in 1974?" })).toHaveFocus();
  });
});

describe("Quiz screen (#171)", () => {
  it("names the quiz and the question, with the clock as text", async () => {
    renderQuiz({ multiplayer: false });
    expect(await screen.findByRole("heading", { level: 1, name: "Classic: Easy" })).toBeInTheDocument();
    expect(screen.getByText("Question 1 of 1")).toBeInTheDocument();
    expect(screen.getByRole("timer")).toHaveTextContent(/^\d+ seconds? left$/);
    expect(screen.getByRole("group", { name: "Answers" })).toBeInTheDocument();
  });

  it("asks before leaving the quiz", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <Routes>
        <Route path="/quiz/:difficulty" element={<Quiz />} />
        <Route path="/" element={<p>home</p>} />
      </Routes>,
      { initialEntries: [{ pathname: "/quiz/easy", state: { multiplayer: false } }] },
    );

    await user.click(await screen.findByRole("button", { name: "Leave the quiz" }));
    expect(screen.getByRole("button", { name: "Keep playing" })).toHaveAccessibleDescription(/This run won't be saved\./);
    await user.click(screen.getByRole("button", { name: "Keep playing" }));
    expect(screen.queryByRole("button", { name: "Keep playing" })).not.toBeInTheDocument();
    expect(screen.queryByText("home")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Leave the quiz" }));
    await user.click(screen.getByRole("button", { name: "Leave the quiz" }));
    expect(await screen.findByText("home")).toBeInTheDocument();
  });
});

describe("Quiz sources (#72)", () => {
  it("plays a premade quiz from the bank", async () => {
    renderQuiz({ multiplayer: false }, "/quiz/t-quick-fire");
    // Quick Fire opens with the douze points question.
    expect(await screen.findByRole("heading", { name: "How many points is the famous 'douze points'?" })).toBeInTheDocument();
  });

  it("says it can't find a quiz this build doesn't know, with the way back", async () => {
    renderQuiz({ multiplayer: false }, "/quiz/t-no-such-quiz");
    expect(await screen.findByRole("alert")).toHaveTextContent("We can't find that quiz.");
    expect(screen.getByRole("heading", { level: 1, name: "Quiz unavailable" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to the quiz library" })).toBeInTheDocument();
  });
});

describe("Quiz unavailable (#171)", () => {
  it("says a deleted custom quiz can't be found, rather than blaming the connection", async () => {
    renderQuiz({ multiplayer: false }, "/quiz/c-abcdefghij0123456789");
    expect(await screen.findByRole("alert")).toHaveTextContent("We can't find that quiz. The link may be wrong, or the quiz was deleted or emptied.");
  });

  it("in a room, points to rejoining rather than the quiz library it can't offer", async () => {
    mocks.listenToRoom.mockImplementation(() => () => { });
    vi.mocked(loadQuizData).mockRejectedValueOnce(new Error("offline"));
    renderQuiz({ multiplayer: true, roomCode: "ABCD", playerId: "ghost" });
    expect(await screen.findByRole("alert")).toHaveTextContent("reload the page to rejoin the game");
    expect(screen.queryByText(/library/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to the game menu" })).toBeInTheDocument();
  });

  it("goes to the game menu once when the room closes, even if the player takes the button first", async () => {
    mocks.listenToRoom.mockImplementation((_code: string, callback: (room: Room | null) => void) => {
      callback(null);
      return () => { };
    });
    const visits: string[] = [];
    const Menu = () => {
      const { key } = useLocation();
      useEffect(() => { visits.push(key); }, [key]);
      return <p>menu</p>;
    };
    // Fake timeouts that still pass in real time, so the 2s redirect can be
    // stepped past instead of waited out.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"], shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderWithProviders(
        <Routes>
          <Route path="/quiz/:difficulty" element={<Quiz />} />
          <Route path="/multiplayer" element={<Menu />} />
        </Routes>,
        { initialEntries: [{ pathname: "/quiz/easy", state: { multiplayer: true, roomCode: "ABCD", playerId: "p1" } }] },
      );

      await user.click(await screen.findByRole("button", { name: "Back to the game menu" }));
      expect(await screen.findByText("menu")).toBeInTheDocument();
      // Past the 2s the closed-room message waits before taking the player back itself.
      await vi.advanceTimersByTimeAsync(2300);
      expect(visits).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("Quiz multiplayer score writes (#131)", () => {
  const givenRoom = () => {
    const room: Room = {
      id: "ABCD",
      hostId: "host",
      started: true,
      difficulty: "easy",
      createdAt: null as unknown as Room["createdAt"],
      players: [{ id: "host", name: "Loreen", score: 0 }],
      phase: "question",
      currentQuestionIndex: 0,
      phaseStartedAt: { toMillis: () => Date.now() } as unknown as Room["phaseStartedAt"],
    };
    mocks.listenToRoom.mockImplementation((_code: string, callback: (room: Room) => void) => {
      callback(room);
      return () => { };
    });
  };

  const answerCorrectly = async () => {
    const user = userEvent.setup();
    renderQuiz({ multiplayer: true, roomCode: "ABCD", playerId: "ghost" });
    await user.click(await screen.findByRole("button", { name: "Sweden" }));
    await user.click(screen.getByRole("button", { name: "Lock in my answer" }));
  };

  it("says a question settled before a refresh is closed, without claiming it was answered", async () => {
    givenRoom();
    sessionStorage.setItem("answeredQuestion:ABCD", "0");
    renderQuiz({ multiplayer: true, roomCode: "ABCD", playerId: "host" });
    expect(await screen.findByText("This question closed for you before you came back. The answer was Sweden.")).toBeInTheDocument();
    expect(screen.queryByText(/You answered/)).not.toBeInTheDocument();
  });

  it("tells the player once when the room doesn't know them, without retrying", async () => {
    givenRoom();
    mocks.updatePlayerScore.mockRejectedValue(
      new ScoreWriteRejected("unknown-player", "Failed to update score: Room ABCD has no player ghost"),
    );

    await answerCorrectly();

    expect(await screen.findByRole("alert")).toHaveTextContent("isn't being saved to this room");
    expect(mocks.updatePlayerScore).toHaveBeenCalledTimes(1);
  });

  it("says once when the game had already finished, without retrying (#142)", async () => {
    givenRoom();
    mocks.updatePlayerScore.mockRejectedValue(new ScoreWriteRejected("finished", "Failed to update score: Room ABCD has finished"));

    await answerCorrectly();

    expect(await screen.findByRole("alert")).toHaveTextContent("The game had already finished");
    expect(mocks.updatePlayerScore).toHaveBeenCalledTimes(1);
    // The verdict doesn't promise the points the alert says didn't count.
    expect(screen.getByRole("status")).toHaveTextContent("That's right, but the points didn't reach the room.");
    expect(screen.queryByText(/Douze points/)).not.toBeInTheDocument();
  });

  it("keeps a refused answer's verdict to its own question", async () => {
    vi.mocked(loadQuizData).mockResolvedValueOnce([
      ...QUESTIONS,
      { id: 2, question: "Which country won in 1988?", options: ["Switzerland", "UK"], correctAnswer: "Switzerland" },
    ]);
    let send: (room: Room) => void = () => { };
    const room: Room = {
      id: "ABCD",
      hostId: "host",
      started: true,
      difficulty: "easy",
      createdAt: null as unknown as Room["createdAt"],
      players: [{ id: "host", name: "Loreen", score: 0 }],
      phase: "question",
      currentQuestionIndex: 0,
      phaseStartedAt: { toMillis: () => Date.now() } as unknown as Room["phaseStartedAt"],
    };
    mocks.listenToRoom.mockImplementation((_code: string, callback: (room: Room) => void) => {
      send = callback;
      callback(room);
      return () => { };
    });
    mocks.updatePlayerScore
      .mockRejectedValueOnce(new ScoreWriteRejected("unknown-player", "Failed to update score: no player ghost"))
      // The next write is still in flight when the verdict shows.
      .mockReturnValueOnce(new Promise(() => { }));

    await answerCorrectly();
    expect(await screen.findByText("That's right, but the points didn't reach the room.")).toBeInTheDocument();

    // The next question's verdict isn't the last one's refusal.
    const startedAt = Date.now();
    send({ ...room, currentQuestionIndex: 1, phaseStartedAt: { toMillis: () => startedAt } as unknown as Room["phaseStartedAt"] });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Switzerland" }));
    await user.click(screen.getByRole("button", { name: "Lock in my answer" }));
    await vi.waitFor(() => expect(mocks.updatePlayerScore).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/^Douze points! That's right/)).toBeInTheDocument();
    expect(screen.queryByText(/didn't reach the room/)).not.toBeInTheDocument();
  });

  it("adds the answer's points to the room's score when the room already holds more", async () => {
    givenRoom();
    mocks.updatePlayerScore
      .mockRejectedValueOnce(
        new ScoreWriteRejected("lower-score", "Failed to update score: Refusing to lower score", 4000),
      )
      .mockResolvedValueOnce(undefined);

    await answerCorrectly();

    await vi.waitFor(() => expect(mocks.updatePlayerScore).toHaveBeenCalledTimes(2));
    const [, , firstScore] = mocks.updatePlayerScore.mock.calls[0];
    const [, , secondScore] = mocks.updatePlayerScore.mock.calls[1];
    expect(secondScore).toBe(4000 + firstScore);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("Quiz solo clock (#160)", () => {
  // Unreadable history (hand-edited or from an old build) must not stop the
  // run being saved: it's read through readScoreHistory, which skips it.
  it.each([
    ["an empty history", null],
    ["an unreadable history", "{not json"],
  ])("times out an unanswered question, shows feedback, then saves the run once, from %s", async (_, stored) => {
    // Only the clock and intervals: React schedules its own work on setTimeout.
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    try {
      if (stored === null) localStorage.removeItem("quizScores");
      else localStorage.setItem("quizScores", stored);
      renderWithProviders(
        <Routes>
          <Route path="/quiz/:difficulty" element={<Quiz />} />
          <Route path="/results" element={<p>results</p>} />
        </Routes>,
        { initialEntries: [{ pathname: "/quiz/easy", state: { multiplayer: false } }] },
      );
      await vi.waitFor(() => expect(screen.getByRole("heading", { name: "Which country won in 1974?" })).toBeInTheDocument());

      const start = Date.now();
      // Ten seconds with no answer: the question locks with feedback.
      await vi.advanceTimersByTimeAsync(10_200);
      expect(screen.getByRole("button", { name: /^Results in \d+s$/ })).toBeInTheDocument();
      expect(screen.queryByText("results")).not.toBeInTheDocument();

      // Five seconds of feedback, then the results, saved once. The clock
      // steps until the results show, since React starts the feedback
      // countdown on its own schedule; its deadline was fixed at time's up.
      await vi.waitFor(async () => {
        await vi.advanceTimersByTimeAsync(250);
        expect(screen.getByText("results")).toBeInTheDocument();
      }, { timeout: 5_000 });
      expect(Date.now() - start).toBeGreaterThanOrEqual(15_000);
      expect(JSON.parse(localStorage.getItem("quizScores") ?? "[]")).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
