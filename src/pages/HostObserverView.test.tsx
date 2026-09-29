import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Routes, useLocation } from "react-router-dom";
import { renderWithProviders, screen } from "../test/test-utils";
import HostObserverView from "./HostObserverView";
import type { Room } from "../utils/roomsFirestore";

const mocks = vi.hoisted(() => ({ listenToRoom: vi.fn(), onRoom: (_room: unknown) => {} }));
vi.mock("../utils/roomsFirestore", () => ({ listenToRoom: mocks.listenToRoom, resumeAfterMidQuiz: vi.fn() }));

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

  it("says when there's no room to watch", () => {
    renderWithProviders(<HostObserverView />, { initialEntries: ["/host-observer"] });
    expect(screen.getByText("Unable to find this game. Please return to the lobby.")).toBeInTheDocument();
  });
});
