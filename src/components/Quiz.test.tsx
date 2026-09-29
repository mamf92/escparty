import { beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Routes } from "react-router-dom";
import { fireEvent } from "@testing-library/react";
import { renderWithProviders, screen, userEvent } from "../test/test-utils";
import { theme } from "../styles/theme";
import type { QuizQuestion } from "../utils/QuizDataProvider";
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

const renderQuiz = (state: Record<string, unknown>) =>
  renderWithProviders(
    <Routes>
      <Route path="/quiz/:difficulty" element={<Quiz />} />
    </Routes>,
    { initialEntries: [{ pathname: "/quiz/easy", state }] },
  );

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => { });
  vi.spyOn(console, "error").mockImplementation(() => { });
  sessionStorage.clear();
});

describe("Quiz answer selection (#22)", () => {
  it("doesn't reveal the correct answer before the answer is submitted", async () => {
    renderQuiz({ multiplayer: false });

    const correct = await screen.findByRole("button", { name: "Sweden" });
    const wrong = screen.getByRole("button", { name: "Norway" });
    const other = screen.getByRole("button", { name: "Ireland" });

    // Whichever option is picked, right or wrong, it looks the same, and
    // the unpicked ones all look alike. (Compared with each other rather
    // than against fixed colours: jsdom matches :hover rules regardless of
    // the pointer, so the absolute colours here are the hover ones. fireEvent
    // rather than user-event for the same reason.)
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
    renderQuiz({ multiplayer: false });

    await user.click(await screen.findByRole("button", { name: "Norway" }));
    await user.click(screen.getByRole("button", { name: "Submit Answer" }));

    expect(screen.getByRole("button", { name: "Sweden" })).toHaveStyle({ background: theme.colors.accentgreen });
    expect(screen.getByRole("button", { name: "Norway" })).toHaveStyle({ background: theme.colors.incorrectRed });
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
    await user.click(screen.getByRole("button", { name: "Submit Answer" }));
  };

  it("tells the player once when the room doesn't know them, without retrying", async () => {
    givenRoom();
    mocks.updatePlayerScore.mockRejectedValue(
      new ScoreWriteRejected("unknown-player", "Failed to update score: Room ABCD has no player ghost"),
    );

    await answerCorrectly();

    expect(await screen.findByRole("alert")).toHaveTextContent("isn't being saved to this room");
    expect(mocks.updatePlayerScore).toHaveBeenCalledTimes(1);
  });

  it("doesn't warn when the room already has a higher score for the player", async () => {
    givenRoom();
    mocks.updatePlayerScore.mockRejectedValue(
      new ScoreWriteRejected("lower-score", "Failed to update score: Refusing to lower score"),
    );

    await answerCorrectly();

    await vi.waitFor(() => expect(mocks.updatePlayerScore).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
