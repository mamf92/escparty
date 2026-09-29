import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Routes, useLocation } from "react-router-dom";
import { renderWithProviders, screen, userEvent } from "../test/test-utils";
import Lobby from "./Lobby";
import type { Room } from "../utils/roomsFirestore";

const mocks = vi.hoisted(() => ({
  listenToRoom: vi.fn(),
  startGame: vi.fn(),
  setPlayerReady: vi.fn(),
  removePlayerFromRoom: vi.fn(),
  setRoomQuiz: vi.fn(),
  onRoom: (_room: unknown) => {},
}));
vi.mock("../utils/roomsFirestore", () => ({
  listenToRoom: mocks.listenToRoom,
  startGame: mocks.startGame,
  setPlayerReady: mocks.setPlayerReady,
  removePlayerFromRoom: mocks.removePlayerFromRoom,
}));
vi.mock("../utils/quizCatalog", async (original) => ({
  ...(await original<typeof import("../utils/quizCatalog")>()),
  setRoomQuiz: mocks.setRoomQuiz,
}));

const ShowLocation = () => {
  const location = useLocation();
  return <p>at {location.pathname} with {JSON.stringify(location.state)}</p>;
};
const renderLobby = () =>
  renderWithProviders(
    <Routes>
      <Route path="/lobby" element={<Lobby />} />
      <Route path="*" element={<ShowLocation />} />
    </Routes>,
    { initialEntries: ["/lobby"] },
  );

const loreen = { id: "p2", name: "Loreen", score: 0 };
const lordi = { id: "p3", name: "Lordi", score: 0 };
const room = (change: Partial<Room> = {}): Room => ({
  id: "ABBA",
  hostId: "host",
  started: false,
  phase: "lobby",
  createdAt: null as unknown as Room["createdAt"],
  players: [{ id: "host", name: "Martin", score: 0 }, loreen, lordi],
  ...change,
});
const as = (playerId: string, name: string) => {
  localStorage.setItem("gameCode", "ABBA");
  localStorage.setItem("playerId", playerId);
  localStorage.setItem("playerName", name);
};
const players = () => Array.from(screen.getByRole("group", { name: "Players" }).querySelectorAll(".calm-row")).map(row => row.textContent);

describe("Lobby", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    mocks.listenToRoom.mockImplementation((_code: string, onRoom: (room: Room | null) => void) => {
      mocks.onRoom = onRoom as (room: unknown) => void;
      return () => {};
    });
  });

  it("sends a tab without a game back to the multiplayer page", async () => {
    vi.useFakeTimers();
    try {
      renderLobby();
      expect(screen.getByRole("alert")).toHaveTextContent("Missing game data");
      await act(async () => vi.advanceTimersByTime(2000));
      expect(screen.getByText(/at \/multiplayer/)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("lets a guest say they're ready, and take it back", async () => {
    const user = userEvent.setup();
    as("p2", "Loreen");
    mocks.setPlayerReady.mockResolvedValue(undefined);
    renderLobby();
    expect(screen.getByRole("status")).toHaveTextContent("Opening the waiting room");
    act(() => mocks.onRoom(room()));
    expect(players()).toEqual(["MartinHost", "Loreen (you)Getting ready", "LordiGetting ready"]);
    expect(screen.getByText("Quiz: the host is picking")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Start/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "I'm ready" }));
    expect(mocks.setPlayerReady).toHaveBeenCalledWith("ABBA", "p2", true);
    act(() => mocks.onRoom(room({ readyPlayers: ["p2"] })));
    expect(screen.getByText("Waiting for the host to start.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "I'm ready (tap to undo)" }));
    expect(mocks.setPlayerReady).toHaveBeenLastCalledWith("ABBA", "p2", false);
  });

  it("says when a ready tap doesn't go through", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    as("p2", "Loreen");
    mocks.setPlayerReady.mockRejectedValue(new Error("offline"));
    renderLobby();
    act(() => mocks.onRoom(room()));
    await userEvent.setup().click(screen.getByRole("button", { name: "I'm ready" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't change whether you're ready. Try again.");
  });

  it("lets the host pick a quiz, then start once everyone is ready", async () => {
    const user = userEvent.setup();
    as("host", "Martin");
    mocks.setRoomQuiz.mockResolvedValue(undefined);
    mocks.startGame.mockResolvedValue(undefined);
    renderLobby();
    act(() => mocks.onRoom(room()));
    await user.click(screen.getByRole("button", { name: "Classic: Easy" }));
    expect(mocks.setRoomQuiz).toHaveBeenCalledWith("ABBA", "easy");

    act(() => mocks.onRoom(room({ difficulty: "easy", readyPlayers: ["p2"] })));
    expect(screen.getByText("Waiting for Lordi to be ready.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start anyway" })).toBeInTheDocument();

    act(() => mocks.onRoom(room({ difficulty: "easy", readyPlayers: ["p2", "p3"] })));
    expect(screen.getByText("All 2 guests are ready.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Start the show" }));
    expect(mocks.startGame).toHaveBeenCalledWith("ABBA");
  });

  it("says when a quiz can't be loaded", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    as("host", "Martin");
    mocks.setRoomQuiz.mockRejectedValueOnce(new Error("offline")).mockRejectedValueOnce(new Error("Failed to set difficulty: denied"));
    renderLobby();
    act(() => mocks.onRoom(room()));
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Classic: Easy" }));
    expect(screen.getByRole("alert")).toHaveTextContent("That quiz couldn't be loaded");
    await user.click(screen.getByRole("button", { name: "Classic: Easy" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Failed to set difficulty");
  });

  it("lets the host take a player out", async () => {
    const user = userEvent.setup();
    as("host", "Martin");
    mocks.removePlayerFromRoom.mockResolvedValue(undefined);
    renderLobby();
    act(() => mocks.onRoom(room({ difficulty: "easy" })));
    await user.click(screen.getByRole("button", { name: "LordiGetting ready" }));
    await user.click(screen.getByRole("button", { name: "Take Lordi out of the game" }));
    expect(mocks.removePlayerFromRoom).toHaveBeenCalledWith("ABBA", lordi);
    expect(screen.queryByRole("button", { name: /Take Lordi/ })).not.toBeInTheDocument();
  });

  it("takes a guest who leaves out of the room", async () => {
    as("p2", "Loreen");
    mocks.removePlayerFromRoom.mockRejectedValueOnce(new Error("offline"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderLobby();
    act(() => mocks.onRoom(room({ readyPlayers: ["p2"] })));
    await userEvent.setup().click(screen.getByRole("button", { name: "Leave the waiting room" }));
    expect(mocks.removePlayerFromRoom).toHaveBeenCalledWith("ABBA", loreen);
    // Leaves even when that write fails.
    expect(screen.getByText(/at \/multiplayer/)).toBeInTheDocument();
  });

  it("lets the host leave without touching the room", async () => {
    as("host", "Martin");
    renderLobby();
    act(() => mocks.onRoom(room()));
    await userEvent.setup().click(screen.getByRole("button", { name: "Leave the waiting room" }));
    expect(mocks.removePlayerFromRoom).not.toHaveBeenCalled();
    expect(screen.getByText(/at \/multiplayer/)).toBeInTheDocument();
  });

  it("tells a player the host took them out", async () => {
    as("p3", "Lordi");
    renderLobby();
    act(() => mocks.onRoom(room({ players: [{ id: "host", name: "Martin", score: 0 }, loreen] })));
    expect(screen.getByRole("alert")).toHaveTextContent("The host took you out of this game");
    await userEvent.setup().click(screen.getByRole("button", { name: "Join a game" }));
    expect(screen.getByText(/at \/multiplayer/)).toBeInTheDocument();
  });

  it("keeps an observer host from starting an empty room", () => {
    as("host", "Martin");
    renderLobby();
    act(() => mocks.onRoom(room({ hostIsObserver: true, difficulty: "easy", players: [{ id: "host", name: "Martin", score: 0 }] })));
    expect(screen.getByText(/Nobody has joined yet/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Start/ })).not.toBeInTheDocument();
  });

  it("follows the room into the quiz when it starts", () => {
    as("p2", "Loreen");
    renderLobby();
    act(() => mocks.onRoom(room({ started: true, difficulty: "easy", phase: "question" })));
    expect(screen.getByText('at /quiz/easy with {"multiplayer":true,"roomCode":"ABBA","playerId":"p2"}')).toBeInTheDocument();
    expect(JSON.parse(sessionStorage.getItem("multiplayerGame")!)).toMatchObject({ roomCode: "ABBA", playerId: "p2", difficulty: "easy" });
  });

  it("sends an observer host to its own screen", () => {
    as("host", "Martin");
    renderLobby();
    act(() => mocks.onRoom(room({ hostIsObserver: true, started: true, difficulty: "easy", phase: "question" })));
    expect(screen.getByText(/at \/host-observer/)).toBeInTheDocument();
  });

  it("says when the room is gone", () => {
    as("p2", "Loreen");
    renderLobby();
    act(() => mocks.onRoom(null));
    expect(screen.getByRole("alert")).toHaveTextContent("Game not found");
  });
});
