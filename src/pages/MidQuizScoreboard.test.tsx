import { act, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Routes, useLocation } from "react-router-dom";
import { renderWithProviders, screen, userEvent } from "../test/test-utils";
import MidQuizScoreboard from "./MidQuizScoreboard";
import type { Room } from "../utils/roomsFirestore";

const mocks = vi.hoisted(() => ({
  listenToRoom: vi.fn(),
  markPlayerAtMidQuiz: vi.fn(),
  resumeAfterMidQuiz: vi.fn(),
  unsubscribe: vi.fn(),
  onRoom: (_room: unknown) => {},
}));
vi.mock("../utils/roomsFirestore", () => ({
  listenToRoom: mocks.listenToRoom,
  markPlayerAtMidQuiz: mocks.markPlayerAtMidQuiz,
  resumeAfterMidQuiz: mocks.resumeAfterMidQuiz,
}));

const ShowLocation = () => {
  const location = useLocation();
  return <p>at {location.pathname} with {JSON.stringify(location.state)}</p>;
};
const renderBreak = (state?: unknown) =>
  renderWithProviders(
    <Routes>
      <Route path="/mid-quiz-scoreboard" element={<MidQuizScoreboard />} />
      <Route path="*" element={<ShowLocation />} />
    </Routes>,
    { initialEntries: [{ pathname: "/mid-quiz-scoreboard", state }] },
  );

/** The router state the page navigated to `path` with. */
const stateAt = (path: string) => {
  const text = screen.getByText(new RegExp(`^at ${path} with `)).textContent!;
  return JSON.parse(text.slice(`at ${path} with `.length));
};

const room = (change: Partial<Room> = {}): Room => ({
  id: "ABBA",
  hostId: "host",
  started: true,
  difficulty: "easy",
  phase: "mid-scoreboard",
  currentQuestionIndex: 5,
  createdAt: null as unknown as Room["createdAt"],
  players: [
    { id: "host", name: "Martin", score: 400 },
    { id: "p2", name: "Loreen", score: 700 },
  ],
  ...change,
});
const multiplayer = (playerId: string) => ({
  score: 300, currentQuestionIndex: 5, difficulty: "easy", multiplayer: true, roomCode: "ABBA", playerId,
});

describe("MidQuizScoreboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mocks.listenToRoom.mockImplementation((_code: string, onRoom: (room: Room | null) => void) => {
      mocks.onRoom = onRoom as (room: unknown) => void;
      return mocks.unsubscribe;
    });
  });

  it("lets a single player continue to the next question", async () => {
    renderBreak({ score: 800, currentQuestionIndex: 5, difficulty: "hard", multiplayer: false });
    expect(screen.getByRole("heading", { level: 1, name: "Scoreboard break" })).toBeInTheDocument();
    expect(screen.getByText("You have 800 points so far.")).toBeInTheDocument();
    // Single player has no room, so no standings either.
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(mocks.listenToRoom).not.toHaveBeenCalled();
    await userEvent.setup().click(screen.getByRole("button", { name: "Continue the quiz" }));
    expect(stateAt("/quiz/hard")).toMatchObject({ currentQuestionIndex: 5, score: 800, multiplayer: false });
  });

  it("shows a guest the room's standings and waits for the host", () => {
    renderBreak(multiplayer("p2"));
    act(() => mocks.onRoom(room()));
    const standings = screen.getByRole("list", { name: "Standings at the break" });
    expect(standings).toHaveAttribute("aria-live", "polite");
    const rows = within(standings).getAllByRole("listitem");
    expect(rows.map(row => row.textContent)).toEqual(["1. Loreen (you)700 points", "2. Martin400 points"]);
    // The leader (here also this player) stands proud; the rest sit at rest.
    expect(rows[0]).toHaveClass("is-high");
    expect(rows[1]).not.toHaveClass("is-high");
    // The room's copy of this player's score wins when it's higher.
    expect(screen.getByText("You have 700 points so far.")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Waiting for the host to continue…");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    // A playing host's room doesn't need ready marks.
    expect(mocks.markPlayerAtMidQuiz).not.toHaveBeenCalled();
  });

  it("marks a guest ready for an observer host, once, retrying a failed mark", async () => {
    vi.useFakeTimers();
    try {
      vi.spyOn(console, "error").mockImplementation(() => {});
      mocks.markPlayerAtMidQuiz.mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
      renderBreak(multiplayer("p2"));
      act(() => mocks.onRoom(room({ hostIsObserver: true })));
      expect(mocks.markPlayerAtMidQuiz).toHaveBeenCalledWith("ABBA", "p2");
      await act(async () => {});
      act(() => mocks.onRoom(room({ hostIsObserver: true })));
      expect(mocks.markPlayerAtMidQuiz).toHaveBeenCalledTimes(1);
      await act(async () => vi.advanceTimersByTime(2000));
      expect(mocks.markPlayerAtMidQuiz).toHaveBeenCalledTimes(2);
      act(() => mocks.onRoom(room({ hostIsObserver: true })));
      expect(mocks.markPlayerAtMidQuiz).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops retrying a failed mark once the page closes", async () => {
    vi.useFakeTimers();
    try {
      vi.spyOn(console, "error").mockImplementation(() => {});
      mocks.markPlayerAtMidQuiz.mockRejectedValue(new Error("offline"));
      const { unmount } = renderBreak(multiplayer("p2"));
      act(() => mocks.onRoom(room({ hostIsObserver: true })));
      await act(async () => {});
      unmount();
      await act(async () => vi.advanceTimersByTime(5000));
      expect(mocks.markPlayerAtMidQuiz).toHaveBeenCalledTimes(1);
      expect(mocks.unsubscribe).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("doesn't go anywhere after closing on a room that's gone", async () => {
    vi.useFakeTimers();
    try {
      const { unmount } = renderBreak(multiplayer("p2"));
      act(() => mocks.onRoom(null));
      unmount();
      await act(async () => vi.advanceTimersByTime(2000));
      expect(screen.queryByText(/at \/multiplayer/)).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("doesn't mark a later break this player hasn't reached", () => {
    renderBreak(multiplayer("p2"));
    // Router state says this is the break before question 5; the room is
    // already at the next one.
    act(() => mocks.onRoom(room({ hostIsObserver: true, currentQuestionIndex: 10 })));
    expect(mocks.markPlayerAtMidQuiz).not.toHaveBeenCalled();
  });

  it("lets the playing host resume the room, then everyone follows it back", async () => {
    mocks.resumeAfterMidQuiz.mockResolvedValue(true);
    renderBreak(multiplayer("host"));
    act(() => mocks.onRoom(room()));
    await userEvent.setup().click(screen.getByRole("button", { name: "Continue the quiz" }));
    expect(mocks.resumeAfterMidQuiz).toHaveBeenCalledWith("ABBA");
    act(() => mocks.onRoom(room({ phase: "question", currentQuestionIndex: 5 })));
    expect(stateAt("/quiz/easy")).toMatchObject({ currentQuestionIndex: 5, score: 400, multiplayer: true, roomCode: "ABBA", playerId: "host" });
  });

  it("picks the break up from the room when opened without router state", () => {
    sessionStorage.setItem("multiplayerGame", JSON.stringify({ multiplayer: true, roomCode: "ABBA", playerId: "p2", difficulty: "easy" }));
    renderBreak();
    act(() => mocks.onRoom(room({ currentQuestionIndex: 10 })));
    expect(screen.getByText("Waiting for the host to continue…")).toBeInTheDocument();
    act(() => mocks.onRoom(room({ phase: "results", currentQuestionIndex: 14 })));
    expect(screen.getByText(/at \/quiz\/easy/)).toBeInTheDocument();
  });

  it("sends an observer host on to its own screen", () => {
    renderBreak(multiplayer("host"));
    act(() => mocks.onRoom(room({ hostIsObserver: true })));
    expect(screen.getByText(/at \/host-observer/)).toBeInTheDocument();
  });

  it("says when the stored game can't be read", () => {
    sessionStorage.setItem("multiplayerGame", "{broken");
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderBreak();
    expect(screen.getByRole("alert")).toHaveTextContent("This tab lost track of your game. Join it again from multiplayer.");
    expect(screen.getByRole("heading", { level: 1, name: "Scoreboard break" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to multiplayer" })).toBeInTheDocument();
  });

  it("says when the room is from an older version", () => {
    renderBreak(multiplayer("p2"));
    act(() => mocks.onRoom(room({ phase: undefined })));
    expect(screen.getByText(/older version of the app/)).toBeInTheDocument();
  });

  it("goes back to the multiplayer page when the room is gone", async () => {
    vi.useFakeTimers();
    try {
      renderBreak(multiplayer("p2"));
      act(() => mocks.onRoom(null));
      expect(screen.getByRole("alert")).toHaveTextContent("This game has closed. Taking you back to multiplayer…");
      await act(async () => vi.advanceTimersByTime(2000));
      expect(screen.getByText(/at \/multiplayer/)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
  it("says the scores are on their way before the room's first snapshot", () => {
    renderBreak({ ...multiplayer("p2"), players: [] });
    expect(screen.getByText("Fetching the scores…")).toHaveAttribute("role", "status");
    act(() => mocks.onRoom(room()));
    expect(screen.queryByText("Fetching the scores…")).not.toBeInTheDocument();
  });

  it("shares first place on a tie and raises this player's own row", () => {
    renderBreak(multiplayer("p3"));
    act(() => mocks.onRoom(room({ players: [
      { id: "host", name: "Martin", score: 700 },
      { id: "p2", name: "Loreen", score: 700 },
      { id: "p3", name: "Lordi", score: 1 },
    ] })));
    const rows = screen.getAllByRole("listitem");
    expect(rows.map(row => row.textContent)).toEqual(["1. Martin700 points", "1. Loreen700 points", "3. Lordi (you)1 point"]);
    expect(rows.map(row => row.classList.contains("is-high"))).toEqual([true, true, true]);
  });

  it("says why the host's Continue failed, as an alert", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.resumeAfterMidQuiz.mockRejectedValue(new Error("offline"));
    renderBreak(multiplayer("host"));
    act(() => mocks.onRoom(room()));
    await userEvent.setup().click(screen.getByRole("button", { name: "Continue the quiz" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't continue the quiz. Check your connection and try again.");
  });
});
