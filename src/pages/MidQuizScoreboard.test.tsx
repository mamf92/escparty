import { act } from "@testing-library/react";
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
    expect(screen.getByText("You scored 800 so far!")).toBeInTheDocument();
    expect(mocks.listenToRoom).not.toHaveBeenCalled();
    await userEvent.setup().click(screen.getByRole("button", { name: "Continue Quiz" }));
    expect(stateAt("/quiz/hard")).toMatchObject({ currentQuestionIndex: 5, score: 800, multiplayer: false });
  });

  it("shows a guest the room's standings and waits for the host", () => {
    renderBreak(multiplayer("p2"));
    act(() => mocks.onRoom(room()));
    const rows = screen.getAllByRole("row").slice(1).map(row => row.textContent);
    expect(rows).toEqual(["Loreen (You)700", "Martin400"]);
    // The room's copy of this player's score wins when it's higher.
    expect(screen.getByText("You scored 700 so far!")).toBeInTheDocument();
    expect(screen.getByText("Waiting for the host to continue...")).toBeInTheDocument();
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
    await userEvent.setup().click(screen.getByRole("button", { name: "Continue Quiz" }));
    expect(mocks.resumeAfterMidQuiz).toHaveBeenCalledWith("ABBA");
    act(() => mocks.onRoom(room({ phase: "question", currentQuestionIndex: 5 })));
    expect(stateAt("/quiz/easy")).toMatchObject({ currentQuestionIndex: 5, score: 400, multiplayer: true, roomCode: "ABBA", playerId: "host" });
  });

  it("picks the break up from the room when opened without router state", () => {
    sessionStorage.setItem("multiplayerGame", JSON.stringify({ multiplayer: true, roomCode: "ABBA", playerId: "p2", difficulty: "easy" }));
    renderBreak();
    act(() => mocks.onRoom(room({ currentQuestionIndex: 10 })));
    expect(screen.getByText("Waiting for the host to continue...")).toBeInTheDocument();
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
    expect(screen.getByText("Unable to retrieve game data. Please return to the lobby.")).toBeInTheDocument();
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
      expect(screen.getByText("Game room no longer exists")).toBeInTheDocument();
      await act(async () => vi.advanceTimersByTime(2000));
      expect(screen.getByText(/at \/multiplayer/)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
