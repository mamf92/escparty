import { beforeEach, describe, expect, it, vi } from "vitest";
import { useEffect } from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import { act, fireEvent } from "@testing-library/react";
import { renderWithProviders, screen, userEvent } from "../test/test-utils";
import { loadQuizData, type QuizQuestion } from "../utils/QuizDataProvider";
import { ScoreWriteRejected, type Room } from "../utils/roomsFirestore";
import { SOLO_VERDICT_MS } from "../utils/quizTiming";
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

describe("Quiz loading", () => {
  it("drops a quiz that finishes loading after the page moved on to another", async () => {
    let finishFirst: (questions: QuizQuestion[]) => void = () => { };
    vi.mocked(loadQuizData)
      .mockReturnValueOnce(new Promise(resolve => { finishFirst = resolve; }))
      .mockResolvedValueOnce(QUESTIONS);
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <Link to="/quiz/medium">Another quiz</Link>
        <Routes>
          <Route path="/quiz/:difficulty" element={<Quiz />} />
        </Routes>
      </>,
      { initialEntries: [{ pathname: "/quiz/easy", state: { multiplayer: false } }] },
    );

    await user.click(screen.getByRole("link", { name: "Another quiz" }));
    expect(await screen.findByRole("heading", { name: "Which country won in 1974?" })).toBeInTheDocument();

    // The first quiz arrives late: the page keeps the one it's on.
    finishFirst([{ id: 9, question: "A stale question?", options: ["Yes", "No"], correctAnswer: "Yes" }]);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(screen.queryByRole("heading", { name: "A stale question?" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Which country won in 1974?" })).toBeInTheDocument();
  });
});

describe("Quiz answer selection (#22)", () => {
  it("doesn't reveal the correct answer before an answer is tapped", async () => {
    renderQuiz({ multiplayer: false });

    await screen.findByRole("button", { name: "Sweden" });
    for (const name of ["Sweden", "Norway", "Ireland"]) {
      expect(screen.getByRole("button", { name })).toBeEnabled();
      expect(screen.getByRole("button", { name })).toHaveAttribute("aria-pressed", "false");
    }
    expect(document.querySelector(".calm-marker")).toBeNull();
    expect(screen.queryByRole("button", { name: /Lock in/ })).not.toBeInTheDocument();
  });

  it("takes a tap as the answer at once: marks right and wrong, with a glyph and in words", async () => {
    const user = userEvent.setup();
    renderQuiz({ multiplayer: false });

    await user.click(await screen.findByRole("button", { name: "Norway" }));

    const marker = (name: string) => screen.getByRole("button", { name }).querySelector(".calm-marker")?.getAttribute("data-marker");
    expect(marker("Sweden")).toBe("correct");
    expect(marker("Norway")).toBe("wrong");
    expect(marker("Ireland")).toBeUndefined();
    expect(screen.getByRole("status")).toHaveTextContent("Nope! The answer was Sweden.");
    for (const button of screen.getByRole("group", { name: "Answers" }).querySelectorAll("button")) expect(button).toBeDisabled();
    expect(screen.queryByRole("timer")).not.toBeInTheDocument();
  });

  it("says the points for a right answer", async () => {
    const user = userEvent.setup();
    renderQuiz({ multiplayer: false });

    await user.click(await screen.findByRole("button", { name: "Sweden" }));

    expect(screen.getByRole("status")).toHaveTextContent(/^Douze points! That's right: \+\d+ points\.$/);
  });

  it("shows the points so far, and adds the answer's points to them", async () => {
    const user = userEvent.setup();
    renderQuiz({ multiplayer: false, score: 500 });

    await screen.findByRole("button", { name: "Sweden" });
    expect(screen.getByText(/^Points \d/)).toHaveTextContent("Points 500");
    await user.click(screen.getByRole("button", { name: "Sweden" }));
    const total = Number(/(\d+)$/.exec(screen.getByText(/^Points \d/).textContent ?? "")?.[1]);
    expect(total).toBeGreaterThan(500);
  });

  it("answers once, however often the answers are tapped", async () => {
    renderQuiz({ multiplayer: false });

    const norway = await screen.findByRole("button", { name: "Norway" });
    const sweden = screen.getByRole("button", { name: "Sweden" });
    // Two taps before React re-renders: only the ref guard can stop the second.
    act(() => {
      fireEvent.click(norway);
      fireEvent.click(sweden);
    });
    expect(screen.getByRole("status")).toHaveTextContent("Nope! The answer was Sweden.");
    expect(screen.getByText(/^Points \d/)).toHaveTextContent("Points 0");
  });

  it("keeps a keyboard player's focus on the question once answering disables the answers", async () => {
    const user = userEvent.setup();
    renderQuiz({ multiplayer: false });

    (await screen.findByRole("button", { name: "Sweden" })).focus();
    await user.keyboard("{Enter}");

    expect(screen.getByRole("heading", { level: 2, name: "Which country won in 1974?" })).toHaveFocus();
  });
});

describe("Quiz screen (#171)", () => {
  it("names the quiz and the question, with the clock big and named in real seconds", async () => {
    renderQuiz({ multiplayer: false });
    expect(await screen.findByRole("heading", { level: 1, name: "Classic: Easy" })).toBeInTheDocument();
    expect(screen.getByText("Question 1 of 1")).toBeInTheDocument();
    // 10 seconds left reads 12 on the clock (the Eurovision count), but is said as 10.
    expect(screen.getByRole("timer")).toHaveAccessibleName(/^(10|9) seconds left$/);
    expect(screen.getByRole("timer")).toHaveTextContent(/^(12|10)$/);
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
  // A room whose question started `startedAgoMs` ago (answering closes at
  // 10s). `send` hands this client another snapshot of it.
  const givenRoom = (startedAgoMs = 0) => {
    const room: Room = {
      id: "ABCD",
      hostId: "host",
      started: true,
      difficulty: "easy",
      createdAt: null as unknown as Room["createdAt"],
      players: [{ id: "host", name: "Loreen", score: 0 }],
      phase: "question",
      currentQuestionIndex: 0,
      phaseStartedAt: { toMillis: () => Date.now() - startedAgoMs } as unknown as Room["phaseStartedAt"],
    };
    let send: (room: Room) => void = () => { };
    mocks.listenToRoom.mockImplementation((_code: string, callback: (room: Room) => void) => {
      send = callback;
      callback(room);
      return () => { };
    });
    // Answering closes for everyone: the room's question started 10.5s ago.
    const closeAnswering = (index = 0) => {
      const startedAt = Date.now() - 10_500;
      act(() => send({ ...room, currentQuestionIndex: index, phaseStartedAt: { toMillis: () => startedAt } as unknown as Room["phaseStartedAt"] }));
    };
    return { room, send: (next: Room) => send(next), closeAnswering };
  };

  const answerCorrectly = async () => {
    const user = userEvent.setup();
    renderQuiz({ multiplayer: true, roomCode: "ABCD", playerId: "ghost" });
    await user.click(await screen.findByRole("button", { name: "Sweden" }));
  };

  it("says a question settled before a refresh is closed, without claiming it was answered", async () => {
    givenRoom(11_000);
    sessionStorage.setItem("answeredQuestion:ABCD", "0");
    renderQuiz({ multiplayer: true, roomCode: "ABCD", playerId: "host" });
    expect(await screen.findByText("This question was already settled when you came back. The answer was Sweden.")).toBeInTheDocument();
    expect(screen.queryByText(/You answered/)).not.toBeInTheDocument();
  });

  describe("locking in and revealing (multiplayer)", () => {
    const markers = () => document.querySelectorAll(".calm-marker");

    it("locks an answer in without saying right or wrong, until answering closes for everyone", async () => {
      const { closeAnswering } = givenRoom();
      mocks.updatePlayerScore.mockResolvedValue(undefined);
      renderQuiz({ multiplayer: true, roomCode: "ABCD", playerId: "host", score: 500 });

      await userEvent.setup().click(await screen.findByRole("button", { name: "Sweden" }));

      // Locked in: the pick is pink and pressed, nothing is marked or said.
      expect(screen.getByRole("button", { name: "Sweden" })).toHaveClass("is-chosen");
      expect(screen.getByRole("button", { name: "Sweden" })).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("button", { name: "Norway" })).not.toHaveClass("is-chosen");
      for (const button of screen.getByRole("group", { name: "Answers" }).querySelectorAll("button")) expect(button).toBeDisabled();
      expect(markers()).toHaveLength(0);
      expect(screen.getByText("Answer locked in")).toBeInTheDocument();
      // Screen readers hear it from the status region.
      expect(screen.getByRole("status")).toHaveTextContent("Answer locked in.");
      expect(screen.queryByText(/Douze points/)).not.toBeInTheDocument();
      expect(screen.queryByText(/ in \d+s$/)).not.toBeInTheDocument();
      // The countdown carries on, with answering time (not the slot's) left.
      expect(screen.getByRole("timer")).toHaveAccessibleName(/^(10|9) seconds left$/);
      // Nothing is written to the room yet, and the badge is unchanged.
      await new Promise(resolve => setTimeout(resolve, 20));
      expect(mocks.updatePlayerScore).not.toHaveBeenCalled();
      expect(screen.getByText("Points 500")).toBeInTheDocument();

      // Answering closes: the verdict, the markers and the new total.
      closeAnswering();
      await vi.waitFor(() => expect(mocks.updatePlayerScore).toHaveBeenCalledTimes(1));
      await vi.waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/^Douze points! That's right: \+\d+ points\.$/));
      expect(markers()).toHaveLength(1);
      expect(screen.queryByText("Answer locked in")).not.toBeInTheDocument();
      expect(screen.queryByRole("timer")).not.toBeInTheDocument();
      expect(screen.getByText(/^Results in \d+s$/)).toBeInTheDocument();
      const total = Number(/(\d+)$/.exec(screen.getByText(/^Points \d/).textContent ?? "")?.[1]);
      expect(total).toBeGreaterThan(500);
    });

    it("reveals a wrong answer only once answering has closed", async () => {
      const { closeAnswering } = givenRoom();
      mocks.updatePlayerScore.mockResolvedValue(undefined);
      renderQuiz({ multiplayer: true, roomCode: "ABCD", playerId: "host" });

      await userEvent.setup().click(await screen.findByRole("button", { name: "Norway" }));
      expect(markers()).toHaveLength(0);
      expect(screen.getByRole("status")).toHaveTextContent("Answer locked in.");

      closeAnswering();
      await vi.waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Nope! The answer was Sweden."));
      expect(markers()).toHaveLength(2);
      expect(screen.getByText("Points 0")).toBeInTheDocument();
    });

    it("shows a refresh while answering is still open as locked in, then reveals it", async () => {
      const { closeAnswering } = givenRoom(4_000);
      sessionStorage.setItem("answeredQuestion:ABCD", "0");
      renderQuiz({ multiplayer: true, roomCode: "ABCD", playerId: "host" });

      expect(await screen.findByText("Answer locked in")).toBeInTheDocument();
      expect(markers()).toHaveLength(0);
      expect(screen.getByRole("status")).toHaveTextContent("Answer locked in.");

      closeAnswering();
      await vi.waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("This question was already settled when you came back."));
      expect(markers()).toHaveLength(1);
    });

    it("writes the score once answering closes, not at the tap", async () => {
      const { closeAnswering } = givenRoom();
      mocks.updatePlayerScore.mockResolvedValue(undefined);
      renderQuiz({ multiplayer: true, roomCode: "ABCD", playerId: "host", score: 500 });

      await userEvent.setup().click(await screen.findByRole("button", { name: "Sweden" }));
      await new Promise(resolve => setTimeout(resolve, 20));
      expect(mocks.updatePlayerScore).not.toHaveBeenCalled();

      closeAnswering();
      await vi.waitFor(() => expect(mocks.updatePlayerScore).toHaveBeenCalledTimes(1));
      await new Promise(resolve => setTimeout(resolve, 20));
      expect(mocks.updatePlayerScore).toHaveBeenCalledTimes(1);
      expect(mocks.updatePlayerScore.mock.calls[0][2]).toBeGreaterThan(500);
      expect(sessionStorage.getItem("pendingScore:ABCD")).toBeNull();
    });

    it("keeps the badge unchanged until the reveal, then raises it", async () => {
      const { closeAnswering } = givenRoom();
      mocks.updatePlayerScore.mockResolvedValue(undefined);
      renderQuiz({ multiplayer: true, roomCode: "ABCD", playerId: "host", score: 500 });

      await userEvent.setup().click(await screen.findByRole("button", { name: "Sweden" }));
      expect(screen.getByText("Points 500")).toBeInTheDocument();

      closeAnswering();
      await vi.waitFor(() => {
        const total = Number(/(\d+)$/.exec(screen.getByText(/^Points \d/).textContent ?? "")?.[1]);
        expect(total).toBeGreaterThan(500);
      });
    });

    it("still writes once after the reveal when the page is refreshed between the tap and the reveal", async () => {
      givenRoom();
      mocks.updatePlayerScore.mockResolvedValue(undefined);
      const first = renderQuiz({ multiplayer: true, roomCode: "ABCD", playerId: "host", score: 500 });
      await userEvent.setup().click(await screen.findByRole("button", { name: "Sweden" }));
      expect(JSON.parse(sessionStorage.getItem("pendingScore:ABCD") ?? "null")).toMatchObject({ index: 0 });
      first.unmount();

      // Reloaded with answering still open: locked in, nothing written.
      const { closeAnswering } = givenRoom(4_000);
      renderQuiz({ multiplayer: true, roomCode: "ABCD", playerId: "host" });
      expect(await screen.findByText("Answer locked in")).toBeInTheDocument();
      await new Promise(resolve => setTimeout(resolve, 20));
      expect(mocks.updatePlayerScore).not.toHaveBeenCalled();
      expect(screen.getByText("Points 0")).toBeInTheDocument();

      closeAnswering();
      await vi.waitFor(() => expect(mocks.updatePlayerScore).toHaveBeenCalledTimes(1));
      await vi.waitFor(() => expect(sessionStorage.getItem("pendingScore:ABCD")).toBeNull());
      expect(mocks.updatePlayerScore).toHaveBeenCalledTimes(1);
    });

    it("flushes a leftover answer once the room has moved past its question", async () => {
      givenRoom(11_000);
      mocks.updatePlayerScore.mockResolvedValue(undefined);
      sessionStorage.setItem("answeredQuestion:ABCD", "0");
      sessionStorage.setItem("pendingScore:ABCD", JSON.stringify({ index: 0, points: 300 }));
      renderQuiz({ multiplayer: true, roomCode: "ABCD", playerId: "host", score: 500 });

      await vi.waitFor(() => expect(mocks.updatePlayerScore).toHaveBeenCalledWith("ABCD", "host", 800));
    });

    it("never writes for a wrong answer", async () => {
      const { closeAnswering } = givenRoom();
      mocks.updatePlayerScore.mockResolvedValue(undefined);
      renderQuiz({ multiplayer: true, roomCode: "ABCD", playerId: "host", score: 500 });

      await userEvent.setup().click(await screen.findByRole("button", { name: "Norway" }));
      expect(sessionStorage.getItem("pendingScore:ABCD")).toBeNull();
      closeAnswering();
      await vi.waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Nope!"));
      await new Promise(resolve => setTimeout(resolve, 20));
      expect(mocks.updatePlayerScore).not.toHaveBeenCalled();
      expect(screen.getByText("Points 500")).toBeInTheDocument();
    });

    it("shows a failed write's alert only after the reveal, and keeps the badge at what the room holds", async () => {
      const { closeAnswering } = givenRoom();
      mocks.updatePlayerScore.mockRejectedValue(new ScoreWriteRejected("unknown-player", "no player"));
      renderQuiz({ multiplayer: true, roomCode: "ABCD", playerId: "host", score: 500 });

      await userEvent.setup().click(await screen.findByRole("button", { name: "Sweden" }));
      await new Promise(resolve => setTimeout(resolve, 20));
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();

      closeAnswering();
      expect(await screen.findByRole("alert")).toBeInTheDocument();
      expect(screen.getByText("Points 500")).toBeInTheDocument();
    });
  });

  it("scores a double tap once", async () => {
    const { closeAnswering } = givenRoom();
    mocks.updatePlayerScore.mockResolvedValue(undefined);
    renderQuiz({ multiplayer: true, roomCode: "ABCD", playerId: "host" });

    const sweden = await screen.findByRole("button", { name: "Sweden" });
    act(() => {
      fireEvent.click(sweden);
      fireEvent.click(sweden);
    });
    closeAnswering();

    await vi.waitFor(() => expect(mocks.updatePlayerScore).toHaveBeenCalledTimes(1));
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(mocks.updatePlayerScore).toHaveBeenCalledTimes(1);
  });

  it("takes no answer before the first room snapshot", async () => {
    mocks.listenToRoom.mockImplementation(() => () => { });
    renderQuiz({ multiplayer: true, roomCode: "ABCD", playerId: "host" });

    const sweden = await screen.findByRole("button", { name: "Sweden" });
    act(() => { fireEvent.click(sweden); });

    expect(mocks.updatePlayerScore).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("answeredQuestion:ABCD")).toBeNull();
    expect(screen.getByRole("button", { name: "Sweden" })).toBeEnabled();
  });

  it("marks the question answered at the tap, so a refresh can't score it twice", async () => {
    givenRoom();
    mocks.updatePlayerScore.mockResolvedValue(undefined);
    const first = renderQuiz({ multiplayer: true, roomCode: "ABCD", playerId: "host" });
    await userEvent.setup().click(await screen.findByRole("button", { name: "Sweden" }));
    expect(sessionStorage.getItem("answeredQuestion:ABCD")).toBe("0");
    first.unmount();
    // Back after answering has closed.
    givenRoom(11_000);

    renderQuiz({ multiplayer: true, roomCode: "ABCD", playerId: "host" });
    expect(await screen.findByText("This question was already settled when you came back. The answer was Sweden.")).toBeInTheDocument();
    for (const button of screen.getByRole("group", { name: "Answers" }).querySelectorAll("button")) expect(button).toBeDisabled();
    await vi.waitFor(() => expect(mocks.updatePlayerScore).toHaveBeenCalledTimes(1));
  });

  it("takes the points and the answered mark back when the room refuses the write", async () => {
    const { closeAnswering } = givenRoom();
    mocks.updatePlayerScore.mockRejectedValue(
      new ScoreWriteRejected("unknown-player", "Failed to update score: Room ABCD has no player ghost"),
    );
    renderQuiz({ multiplayer: true, roomCode: "ABCD", playerId: "ghost", score: 500 });

    await userEvent.setup().click(await screen.findByRole("button", { name: "Sweden" }));
    closeAnswering();

    expect(await screen.findByRole("alert")).toHaveTextContent("isn't being saved to this room");
    expect(screen.getByText(/^Points \d/)).toHaveTextContent("Points 500");
    expect(sessionStorage.getItem("answeredQuestion:ABCD")).toBeNull();
  });

  it("tells the player once when the room doesn't know them, without retrying", async () => {
    const { closeAnswering } = givenRoom();
    mocks.updatePlayerScore.mockRejectedValue(
      new ScoreWriteRejected("unknown-player", "Failed to update score: Room ABCD has no player ghost"),
    );

    await answerCorrectly();
    closeAnswering();

    expect(await screen.findByRole("alert")).toHaveTextContent("isn't being saved to this room");
    expect(mocks.updatePlayerScore).toHaveBeenCalledTimes(1);
  });

  it("says once when the game had already finished, without retrying (#142)", async () => {
    const { closeAnswering } = givenRoom();
    mocks.updatePlayerScore.mockRejectedValue(new ScoreWriteRejected("finished", "Failed to update score: Room ABCD has finished"));

    await answerCorrectly();
    closeAnswering();

    expect(await screen.findByRole("alert")).toHaveTextContent("The game had already finished");
    expect(mocks.updatePlayerScore).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("That's right, but the points didn't reach the room."));
    // The verdict doesn't promise the points the alert says didn't count.
    expect(screen.getByRole("status")).toHaveTextContent("That's right, but the points didn't reach the room.");
    expect(screen.queryByText(/Douze points/)).not.toBeInTheDocument();
  });

  it("keeps a refused answer's verdict to its own question", async () => {
    vi.mocked(loadQuizData).mockResolvedValueOnce([
      ...QUESTIONS,
      { id: 2, question: "Which country won in 1988?", options: ["Switzerland", "UK"], correctAnswer: "Switzerland" },
    ]);
    const { room, send, closeAnswering } = givenRoom();
    mocks.updatePlayerScore
      .mockRejectedValueOnce(new ScoreWriteRejected("unknown-player", "Failed to update score: no player ghost"))
      // The next write is still in flight when the verdict shows.
      .mockReturnValueOnce(new Promise(() => { }));

    await answerCorrectly();
    closeAnswering();
    expect(await screen.findByText("That's right, but the points didn't reach the room.")).toBeInTheDocument();

    // The next question's verdict isn't the last one's refusal.
    const startedAt = Date.now();
    send({ ...room, currentQuestionIndex: 1, phaseStartedAt: { toMillis: () => startedAt } as unknown as Room["phaseStartedAt"] });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Switzerland" }));
    closeAnswering(1);
    await vi.waitFor(() => expect(mocks.updatePlayerScore).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/^Douze points! That's right/)).toBeInTheDocument();
    expect(screen.queryByText(/didn't reach the room/)).not.toBeInTheDocument();
  });

  it("adds the answer's points to the room's score when the room already holds more", async () => {
    const { closeAnswering } = givenRoom();
    mocks.updatePlayerScore
      .mockRejectedValueOnce(
        new ScoreWriteRejected("lower-score", "Failed to update score: Refusing to lower score", 4000),
      )
      .mockResolvedValueOnce(undefined);

    await answerCorrectly();
    closeAnswering();

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
  ])("times out an unanswered question, shows the verdict, then saves the run once, from %s", async (_, stored) => {
    vi.useFakeTimers();
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

      // Ten seconds with no answer: the question locks with its verdict.
      await act(async () => { await vi.advanceTimersByTimeAsync(10_200); });
      expect(screen.getByRole("status")).toHaveTextContent("Time's up. The answer was Sweden.");
      expect(screen.queryByText("results")).not.toBeInTheDocument();

      // A moment of verdict (SOLO_VERDICT_MS), then the results, saved once.
      await act(async () => { await vi.advanceTimersByTimeAsync(SOLO_VERDICT_MS - 600); });
      expect(screen.queryByText("results")).not.toBeInTheDocument();
      await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
      expect(screen.getByText("results")).toBeInTheDocument();
      expect(JSON.parse(localStorage.getItem("quizScores") ?? "[]")).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("Quiz solo verdict (#160)", () => {
  it("shows the verdict for SOLO_VERDICT_MS before the next question", async () => {
    vi.useFakeTimers();
    try {
      renderWithProviders(
        <Routes>
          <Route path="/quiz/:difficulty" element={<Quiz />} />
          <Route path="/results" element={<p>results</p>} />
        </Routes>,
        { initialEntries: [{ pathname: "/quiz/easy", state: { multiplayer: false } }] },
      );
      await vi.waitFor(() => expect(screen.getByRole("button", { name: "Sweden" })).toBeInTheDocument());
      fireEvent.click(screen.getByRole("button", { name: "Sweden" }));
      expect(screen.getByRole("status")).toHaveTextContent("Douze points!");

      await act(async () => { await vi.advanceTimersByTimeAsync(SOLO_VERDICT_MS - 100); });
      expect(screen.queryByText("results")).not.toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent("Douze points!");

      await act(async () => { await vi.advanceTimersByTimeAsync(200); });
      expect(screen.getByText("results")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
