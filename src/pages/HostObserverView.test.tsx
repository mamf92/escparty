import { act, within } from "@testing-library/react";
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
    expect(screen.getByRole("heading", { level: 1, name: "The host's view" })).toBeInTheDocument();
    const rows = within(screen.getByRole("list", { name: "Standings" })).getAllByRole("listitem");
    // No ready marks outside a break.
    expect(rows.map(row => row.textContent)).toEqual(["1. Lordi900 points", "2. Loreen700 points"]);
    expect(rows[0]).toHaveClass("is-high");
    const button = screen.getByRole("button", { name: "Continue the quiz" });
    expect(button).toBeDisabled();
    // Why, as text tied to the control rather than a tooltip.
    expect(button).toHaveAccessibleDescription("The players are answering. Continue opens at the next scoreboard break.");
    expect(button).not.toHaveAttribute("title");
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
      expect(screen.getByRole("status")).toHaveTextContent("1 of 2 ready. Still waiting for Loreen.");
      expect(screen.getAllByRole("listitem").map(row => row.textContent)).toEqual(["1. Lordi900 pointsReady", "2. Loreen700 pointsOn the way"]);
      expect(screen.getByRole("button", { name: "Continue without them" })).toBeDisabled();
      act(() => vi.advanceTimersByTime(MISSING_PLAYER_GRACE_MS));
      const button = screen.getByRole("button", { name: "Continue without them" });
      expect(button).toBeEnabled();
      expect(screen.getByRole("status")).toHaveTextContent("1 of 2 ready. Still waiting for Loreen. You can go on without them.");
      await act(async () => button.click());
      expect(mocks.resumeAfterMidQuiz).toHaveBeenCalledWith("ABBA");

      // The next break waits again.
      act(() => mocks.onRoom(room({ phase: "question", currentQuestionIndex: 5 })));
      act(() => mocks.onRoom(room({ phase: "mid-scoreboard", currentQuestionIndex: 9, playersAtMidQuiz: [] })));
      expect(screen.getByRole("button", { name: "Continue without them" })).toBeDisabled();
      act(() => mocks.onRoom(room({ phase: "mid-scoreboard", currentQuestionIndex: 9, playersAtMidQuiz: ["p2", "p3"] })));
      expect(screen.getByRole("button", { name: "Continue the quiz" })).toBeEnabled();
      expect(screen.queryByText(/Still waiting/)).not.toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent("Everyone's at the break. Continue when you're ready.");
    } finally {
      vi.useRealTimers();
    }
  });

  it("says when there's no room to watch", () => {
    renderWithProviders(<HostObserverView />, { initialEntries: ["/host-observer"] });
    expect(screen.getByRole("alert")).toHaveTextContent("This tab lost track of the game. Find it again from multiplayer.");
    expect(screen.getByRole("button", { name: "Back to multiplayer" })).toBeInTheDocument();
  });
  it("says it's connecting until the room's first snapshot", () => {
    renderView();
    expect(screen.getByRole("status")).toHaveTextContent("Connecting to the room…");
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue the quiz" })).toBeDisabled();
  });

  it("shows an empty room as a row, not an empty list", () => {
    renderView();
    act(() => mocks.onRoom(room({ players: [{ id: "host", name: "Host", score: 0 }] })));
    expect(screen.getByRole("listitem")).toHaveTextContent("Nobody's playing in this room yet.");
  });

  it("says why a Continue failed, as an alert", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.resumeAfterMidQuiz.mockRejectedValue(new Error("offline"));
    renderView();
    act(() => mocks.onRoom(room({ phase: "mid-scoreboard", playersAtMidQuiz: ["p2", "p3"] })));
    await act(async () => screen.getByRole("button", { name: "Continue the quiz" }).click());
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't continue the quiz. Check your connection and try again.");
  });

  it("goes back to the multiplayer page when the room is gone", async () => {
    vi.useFakeTimers();
    try {
      renderView();
      act(() => mocks.onRoom(null));
      expect(screen.getByRole("alert")).toHaveTextContent("This game has closed. Taking you back to multiplayer…");
      await act(async () => vi.advanceTimersByTime(2000));
      expect(screen.getByText(/at \/multiplayer/)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
