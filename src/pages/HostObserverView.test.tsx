import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Routes, useLocation } from "react-router-dom";
import { renderWithProviders, screen } from "../test/test-utils";
import HostObserverView, { MISSING_PLAYER_GRACE_MS } from "./HostObserverView";
import type { Room } from "../utils/roomsFirestore";

const mocks = vi.hoisted(() => ({ listenToRoom: vi.fn(), resumeAfterMidQuiz: vi.fn(), onRoom: (_room: unknown) => {} }));
vi.mock("../utils/roomsFirestore", () => ({ listenToRoom: mocks.listenToRoom, resumeAfterMidQuiz: mocks.resumeAfterMidQuiz }));

const ShowLocation = () => {
  const location = useLocation();
  return <p>at {location.pathname} with {JSON.stringify(location.state)}</p>;
};

const room = (change: Partial<Room> = {}): Room => ({
  id: "ABBA", hostId: "host", hostIsObserver: true, started: true, phase: "question", currentQuestionIndex: 2,
  createdAt: null as unknown as Room["createdAt"],
  players: [{ id: "host", name: "Host", score: 0 }, { id: "p2", name: "Loreen", score: 700 }, { id: "p3", name: "Lordi", score: 900 }],
  ...change,
});

const renderView = () =>
  renderWithProviders(
    <Routes>
      <Route path="/host-observer" element={<HostObserverView />} />
      <Route path="*" element={<ShowLocation />} />
    </Routes>,
    { initialEntries: [{ pathname: "/host-observer", state: { roomCode: "ABBA", playerId: "host", players: [] } }] },
  );

describe("HostObserverView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mocks.listenToRoom.mockImplementation((_code: string, onRoom: (room: Room | null) => void) => {
      mocks.onRoom = onRoom as (room: unknown) => void;
      return () => {};
    });
  });

  it("shows the players' standings, not the observing host", () => {
    renderView();
    act(() => mocks.onRoom(room()));
    const rows = screen.getAllByRole("row").slice(1).map(row => row.textContent);
    expect(rows).toEqual(["Lordi900", "Loreen700"]);
    expect(screen.getByRole("button", { name: "Continue Quiz" })).toBeDisabled();
  });

  it("follows the room to the results when the quiz is over (#21)", () => {
    renderView();
    act(() => mocks.onRoom(room({ phase: "results" })));
    expect(screen.getByText('at /results with {"multiplayer":true,"roomCode":"ABBA","playerId":"host","observer":true}')).toBeInTheDocument();
  });

  it("can go on without a player who never reaches the break, after a grace period (#65)", async () => {
    vi.useFakeTimers();
    try {
      mocks.resumeAfterMidQuiz.mockResolvedValue(true);
      renderView();
      act(() => mocks.onRoom(room({ phase: "mid-scoreboard", playersAtMidQuiz: ["p3"] })));
      expect(screen.getByText("Still waiting for Loreen.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Continue without them" })).toBeDisabled();
      act(() => vi.advanceTimersByTime(MISSING_PLAYER_GRACE_MS));
      const button = screen.getByRole("button", { name: "Continue without them" });
      expect(button).toBeEnabled();
      await act(async () => button.click());
      expect(mocks.resumeAfterMidQuiz).toHaveBeenCalledWith("ABBA");

      // The next break waits again.
      act(() => mocks.onRoom(room({ phase: "question", currentQuestionIndex: 5 })));
      act(() => mocks.onRoom(room({ phase: "mid-scoreboard", currentQuestionIndex: 9, playersAtMidQuiz: [] })));
      expect(screen.getByRole("button", { name: "Continue without them" })).toBeDisabled();
      act(() => mocks.onRoom(room({ phase: "mid-scoreboard", currentQuestionIndex: 9, playersAtMidQuiz: ["p2", "p3"] })));
      expect(screen.getByRole("button", { name: "Continue Quiz" })).toBeEnabled();
      expect(screen.queryByText(/Still waiting/)).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("says when there's no room to watch", () => {
    renderWithProviders(<HostObserverView />, { initialEntries: ["/host-observer"] });
    expect(screen.getByText("Unable to find this game. Please return to the lobby.")).toBeInTheDocument();
  });
});
