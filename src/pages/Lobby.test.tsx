import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Routes, useLocation } from "react-router-dom";
import { renderWithProviders, screen, userEvent, within } from "../test/test-utils";
import Lobby from "./Lobby";
import type { Room } from "../utils/roomsFirestore";

const mocks = vi.hoisted(() => ({
  listenToRoom: vi.fn(),
  startGame: vi.fn(),
  setPlayerReady: vi.fn(),
  removePlayerFromRoom: vi.fn(),
  setRoomQuiz: vi.fn(),
  onRoom: (_room: unknown) => {},
  QuizPickRefused: class QuizPickRefused extends Error {},
}));
vi.mock("../utils/roomsFirestore", () => ({
  listenToRoom: mocks.listenToRoom,
  startGame: mocks.startGame,
  setPlayerReady: mocks.setPlayerReady,
  removePlayerFromRoom: mocks.removePlayerFromRoom,
  QuizPickRefused: mocks.QuizPickRefused,
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
const players = () => Array.from(screen.getByRole("list", { name: "Players" }).querySelectorAll(".calm-row")).map(row => row.textContent);

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
      expect(screen.getByRole("alert")).toHaveTextContent("This tab isn't in a game yet");
      expect(screen.getByRole("button", { name: "Join or host a game" })).toBeInTheDocument();
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

    await user.click(screen.getByRole("button", { name: "I'm ready", pressed: false }));
    expect(mocks.setPlayerReady).toHaveBeenCalledWith("ABBA", "p2", true);
    act(() => mocks.onRoom(room({ readyPlayers: ["p2"] })));
    expect(screen.getByRole("status")).toHaveTextContent("Waiting for the host to start.");
    // Ready holds the sink; the label stays put and aria-pressed says it.
    await user.click(screen.getByRole("button", { name: "I'm ready", pressed: true }));
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
    mocks.setRoomQuiz.mockRejectedValueOnce(new Error("offline")).mockRejectedValueOnce(new mocks.QuizPickRefused("Failed to set difficulty: denied"));
    renderLobby();
    act(() => mocks.onRoom(room()));
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Classic: Easy" }));
    expect(screen.getByRole("alert")).toHaveTextContent("That quiz couldn't be loaded");
    await user.click(screen.getByRole("button", { name: "Classic: Easy" }));
    expect(screen.getByRole("alert")).toHaveTextContent("This room wouldn't take the quiz");
    expect(screen.queryByText(/Failed to set difficulty/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Join or host a game" }));
    expect(screen.getByText(/at \/multiplayer/)).toBeInTheDocument();
  });

  it("goes on when a refused pick finds the room already has a quiz", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    as("host", "Martin");
    mocks.setRoomQuiz.mockRejectedValueOnce(new mocks.QuizPickRefused("Failed to set difficulty: denied"));
    renderLobby();
    act(() => mocks.onRoom(room()));
    await userEvent.setup().click(screen.getByRole("button", { name: "Classic: Easy" }));
    expect(screen.getByRole("alert")).toHaveTextContent("This room wouldn't take the quiz");
    // Another tab of this host picked first: the room has its quiz after all.
    act(() => mocks.onRoom(room({ difficulty: "easy" })));
    expect(screen.queryByText(/wouldn't take the quiz/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Start/ })).toBeInTheDocument();
  });

  it("lets the host pick again when the quiz write fails for another reason", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    as("host", "Martin");
    mocks.setRoomQuiz.mockRejectedValueOnce(new Error("Failed to set difficulty: unavailable", { cause: { code: "unavailable" } }));
    renderLobby();
    act(() => mocks.onRoom(room()));
    await userEvent.setup().click(screen.getByRole("button", { name: "Classic: Easy" }));
    expect(screen.getByRole("alert")).toHaveTextContent("That quiz couldn't be loaded");
    expect(screen.getByRole("button", { name: "Classic: Easy" })).toBeEnabled();
  });

  it("keeps a way back in the footer of every dead end", () => {
    as("p2", "Loreen");
    renderLobby();
    act(() => mocks.onRoom(null));
    expect(screen.getByRole("button", { name: "Leave the waiting room" })).toBeInTheDocument();
    act(() => mocks.onRoom(room({ players: [{ id: "host", name: "Martin", score: 0 }] })));
    expect(screen.getByRole("alert")).toHaveTextContent("The host took you out");
    expect(screen.getByRole("button", { name: "Back to join or host" })).toBeInTheDocument();
  });

  it("lets the host take a player out", async () => {
    const user = userEvent.setup();
    as("host", "Martin");
    mocks.removePlayerFromRoom.mockResolvedValue(undefined);
    renderLobby();
    act(() => mocks.onRoom(room({ difficulty: "easy" })));
    const takeOut = screen.getByRole("group", { name: /Pick who to take out/ });
    expect(within(takeOut).getAllByRole("button").map(button => button.textContent)).toEqual(["Loreen", "Lordi"]);
    await user.click(within(takeOut).getByRole("button", { name: "Lordi" }));
    expect(within(takeOut).getByRole("button", { name: "Lordi" })).toHaveAttribute("aria-pressed", "true");
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
    expect(screen.getByRole("alert")).toHaveTextContent("This game has closed");
    expect(screen.getByRole("button", { name: "Join or host a game" })).toBeInTheDocument();
  });

  it("raises your own row, never sinks the start, and labels its sections", () => {
    as("host", "Martin");
    renderLobby();
    act(() => mocks.onRoom(room({ difficulty: "easy", readyPlayers: ["p2", "p3"] })));
    const rows = within(screen.getByRole("list", { name: "Players" })).getAllByRole("listitem");
    expect(rows.map(row => row.classList.contains("is-high"))).toEqual([true, false, false]);
    expect(rows.some(row => row.classList.contains("is-chosen"))).toBe(false);
    const start = screen.getByRole("button", { name: "Start the show" });
    expect(start).not.toHaveClass("is-chosen");
    expect(start).not.toHaveAttribute("aria-pressed");
    expect(start).toHaveClass("is-high");
    expect(screen.getByRole("heading", { level: 2, name: "3 players" })).toHaveAttribute("aria-live", "polite");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("counts players as they come and go", () => {
    as("p2", "Loreen");
    renderLobby();
    act(() => mocks.onRoom(room()));
    expect(screen.getByRole("heading", { level: 2, name: "3 players" })).toBeInTheDocument();
    act(() => mocks.onRoom(room({ players: [{ id: "host", name: "Martin", score: 0 }, loreen] })));
    expect(screen.getByRole("heading", { level: 2, name: "2 players" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /Pick who to take out/ })).not.toBeInTheDocument();
  });

  it("gives the host a heading for the quiz picks", () => {
    as("host", "Martin");
    renderLobby();
    act(() => mocks.onRoom(room()));
    expect(within(screen.getByRole("group", { name: "Pick a quiz" })).getByRole("button", { name: "Classic: Easy" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Pick a quiz" })).toBeInTheDocument();
  });
});
