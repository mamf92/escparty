import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Routes, useLocation } from "react-router-dom";
import { renderWithProviders, screen, userEvent, waitFor, within } from "../test/test-utils";
import QuizResults from "./QuizResults";
import type { Room } from "../utils/roomsFirestore";

const mocks = vi.hoisted(() => ({
  listenToRoom: vi.fn(),
  createRoom: vi.fn(),
  setNextRoom: vi.fn(),
  setRevealStep: vi.fn(),
  joinRoom: vi.fn(),
  onRoom: (_room: unknown) => {},
}));
vi.mock("../utils/roomsFirestore", () => ({
  listenToRoom: mocks.listenToRoom,
  createRoom: mocks.createRoom,
  setNextRoom: mocks.setNextRoom,
  setRevealStep: mocks.setRevealStep,
  joinRoom: mocks.joinRoom,
  generateRoomCode: () => "NEXT",
}));

const ShowLocation = () => <p>at {useLocation().pathname}</p>;
const renderResults = (state?: unknown) =>
  renderWithProviders(
    <Routes>
      <Route path="/results" element={<QuizResults />} />
      <Route path="*" element={<ShowLocation />} />
    </Routes>,
    { initialEntries: [{ pathname: "/results", state }] },
  );

const room = (change: Partial<Room> = {}): Room => ({
  id: "ABBA",
  hostId: "host",
  started: true,
  createdAt: null as unknown as Room["createdAt"],
  phase: "results",
  players: [
    { id: "host", name: "Martin", score: 900 },
    { id: "p2", name: "Loreen", score: 1200 },
    { id: "p3", name: "Lordi", score: 400 },
    { id: "p4", name: "Käärijä", score: 700 },
    { id: "p5", name: "Jedward", score: 100 },
  ],
  ...change,
});

const standings = () => within(screen.getByRole("list", { name: "Final standings" })).getAllByRole("listitem").map(item => item.textContent);

describe("QuizResults", () => {
  beforeEach(async () => {
    // Let an earlier test's deferred unmount clear run before storing anything.
    await new Promise(resolve => setTimeout(resolve, 0));
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    let latest: Room | null = null;
    mocks.listenToRoom.mockImplementation((_code: string, onRoom: (room: Room | null) => void) => {
      mocks.onRoom = (next: unknown) => {
        latest = next as Room | null;
        onRoom(latest);
      };
      return () => {};
    });
    // The room echoes the host's write back to every listener, as Firestore does.
    mocks.setRevealStep.mockImplementation(async (_code: string, step: number) => {
      act(() => mocks.onRoom({ ...latest, revealStep: step }));
    });
  });

  it("shows a solo score and past scores", async () => {
    localStorage.setItem("quizScores", JSON.stringify([{ score: 12, total: 15, date: "2026-05-16T00:00:00Z" }]));
    renderResults({ score: 9, multiplayer: false });
    expect(screen.getByText("9 points")).toBeInTheDocument();
    expect(screen.getByText("Your best is still 12 points.")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Your past scores" })).toHaveTextContent("12 points · 15 questions");
    expect(screen.getByRole("heading", { level: 2, name: "Your past scores" })).toBeInTheDocument();
    // Your score stands proud as information, not as something picked.
    const scored = screen.getByText("9 points").parentElement!;
    expect(scored).toHaveClass("is-static", "is-high");
    expect(scored).not.toHaveClass("is-chosen");
    await userEvent.setup().click(screen.getByRole("button", { name: "Play another quiz" }));
    expect(screen.getByText("at /quizzes")).toBeInTheDocument();
  });

  it("survives unreadable solo history", async () => {
    localStorage.setItem("quizScores", "{broken");
    renderResults({ score: 3 });
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "See the scoreboard" }));
    expect(screen.getByText("at /scoreboard")).toBeInTheDocument();
  });

  it("skips broken past scores and shows a run missing its details", () => {
    localStorage.setItem("quizScores", JSON.stringify([null, { score: "x" }, { score: 6 }]));
    renderResults({ score: 3 });
    expect(screen.getByText("Your best is still 6 points.")).toBeInTheDocument();
    const past = screen.getByRole("list", { name: "Your past scores" });
    expect(past.querySelectorAll("li")).toHaveLength(1);
    expect(past).toHaveTextContent("Unknown date");
    expect(past).toHaveTextContent("6 points");
    expect(past).not.toHaveTextContent("undefined");
  });

  it("reveals the standings from the bottom, podium one place at a time", async () => {
    const user = userEvent.setup();
    renderResults({ score: 850, multiplayer: true, roomCode: "ABBA", playerId: "p4" });
    expect(screen.getByRole("status")).toHaveTextContent("Collecting the final scores");
    act(() => mocks.onRoom(room({ hostId: "p4" })));
    expect(screen.getByText("You scored 850 points.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();

    expect(screen.getByRole("status")).toHaveTextContent("5 players are on the scoreboard.");

    await user.click(screen.getByRole("button", { name: "Start the reveal" }));
    expect(standings()).toEqual(["4. Lordi400 points", "5. Jedward100 points"]);
    // Each reveal is said out loud, not only drawn.
    expect(screen.getByRole("status")).toHaveTextContent("On the board: place 4, Lordi, 400 points; place 5, Jedward, 100 points.");
    await user.click(screen.getByRole("button", { name: "Reveal 3rd place" }));
    expect(standings()[0]).toBe("Huit points3. Käärijä (you)700 points");
    expect(screen.getByRole("status")).toHaveTextContent("On the board: place 3, Käärijä, 700 points.");
    await user.click(screen.getByRole("button", { name: "Reveal 2nd place" }));
    await user.click(screen.getByRole("button", { name: "Reveal the winner" }));
    expect(standings()[0]).toBe("Douze points1. Loreen1200 points");
    expect(screen.getByRole("status")).toHaveTextContent("Loreen wins with 1200 points!");
    expect(screen.queryByRole("button", { name: "Show everything" })).not.toBeInTheDocument();
  });

  describe("who reveals (#207)", () => {
    it("gives guests a disco ball and no reveal buttons until the host starts", async () => {
      renderResults({ score: 850, multiplayer: true, roomCode: "ABBA", playerId: "p4" });
      // Before the room arrives nobody is told to wait for anything.
      expect(screen.queryByText("Wait to see who won…")).not.toBeInTheDocument();
      act(() => mocks.onRoom(room()));
      await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Wait to see who won…"));
      expect(screen.queryByRole("list")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /reveal|Show everything/i })).not.toBeInTheDocument();
      expect(mocks.setRevealStep).not.toHaveBeenCalled();
    });

    it("follows the room's step: rows appear for a guest as the host taps, with no buttons of its own", () => {
      renderResults({ score: 850, multiplayer: true, roomCode: "ABBA", playerId: "p4" });
      act(() => mocks.onRoom(room()));
      act(() => mocks.onRoom(room({ revealStep: 1 })));
      expect(screen.queryByText("Wait to see who won…")).not.toBeInTheDocument();
      expect(standings()).toEqual(["4. Lordi400 points", "5. Jedward100 points"]);
      expect(screen.getByRole("status")).toHaveTextContent("On the board: place 4, Lordi, 400 points; place 5, Jedward, 100 points.");
      expect(screen.queryByRole("button", { name: /reveal|Show everything/i })).not.toBeInTheDocument();
      act(() => mocks.onRoom(room({ revealStep: 2 })));
      expect(standings()[0]).toBe("Huit points3. Käärijä (you)700 points");
      act(() => mocks.onRoom(room({ revealStep: 4 })));
      expect(standings()).toHaveLength(5);
      expect(screen.getByRole("status")).toHaveTextContent("Loreen wins with 1200 points!");
    });

    it("shows a guest who arrives late what the host has already revealed", () => {
      renderResults({ multiplayer: true, roomCode: "ABBA", playerId: "p4" });
      act(() => mocks.onRoom(room({ revealStep: 3 })));
      expect(standings()).toHaveLength(4);
      expect(screen.queryByText("Wait to see who won…")).not.toBeInTheDocument();
    });

    it("makes guests wait when the host only observes", async () => {
      renderResults({ multiplayer: true, roomCode: "ABBA", playerId: "p2" });
      act(() => mocks.onRoom(room({ hostIsObserver: true })));
      await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Wait to see who won…"));
    });

    it("lets the host write each step to the room", async () => {
      const user = userEvent.setup();
      renderResults({ score: 0, multiplayer: true, roomCode: "ABBA", playerId: "host", observer: true });
      act(() => mocks.onRoom(room({ hostIsObserver: true })));
      expect(screen.queryByText("Wait to see who won…")).not.toBeInTheDocument();
      expect(screen.queryByRole("list")).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Start the reveal" }));
      expect(mocks.setRevealStep).toHaveBeenLastCalledWith("ABBA", 1);
      expect(standings()).toEqual(["4. Jedward100 points"]);
      await user.click(screen.getByRole("button", { name: /^Reveal / }));
      expect(mocks.setRevealStep).toHaveBeenLastCalledWith("ABBA", 2);
    });

    it("says when the host's tap didn't reach the room, and lets them try again", async () => {
      const user = userEvent.setup();
      vi.spyOn(console, "error").mockImplementation(() => {});
      mocks.setRevealStep.mockRejectedValueOnce(new Error("offline"));
      renderResults({ multiplayer: true, roomCode: "ABBA", playerId: "host" });
      act(() => mocks.onRoom(room()));
      await user.click(screen.getByRole("button", { name: "Start the reveal" }));
      expect(screen.getByRole("alert")).toHaveTextContent("Couldn't reveal that. Try again.");
      expect(screen.queryByRole("list")).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Start the reveal" }));
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(standings().length).toBeGreaterThan(0);
    });

    it("lets anyone reveal what they hold when the room is gone, on their own phone", async () => {
      renderResults({ multiplayer: true, roomCode: "ABBA", playerId: "p4" });
      act(() => mocks.onRoom(room()));
      act(() => mocks.onRoom(null));
      await userEvent.setup().click(screen.getByRole("button", { name: "Start the reveal" }));
      expect(mocks.setRevealStep).not.toHaveBeenCalled();
      expect(standings()).toHaveLength(2);
    });
  });

  it("raises first place and your own row, and picks none of them", async () => {
    renderResults({ score: 850, multiplayer: true, roomCode: "ABBA", playerId: "p4" });
    act(() => mocks.onRoom(room({ hostId: "p4" })));
    expect(screen.getByRole("heading", { level: 1, name: "The results are in" })).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Show everything" }));
    const rows = within(screen.getByRole("list", { name: "Final standings" })).getAllByRole("listitem");
    expect(rows.map(row => row.classList.contains("is-high"))).toEqual([true, false, true, false, false]);
    expect(rows.some(row => row.classList.contains("is-chosen"))).toBe(false);
  });

  it("raises only your own row when everyone is level, and says 1 point", async () => {
    const level = [
      { id: "host", name: "Martin", score: 1 },
      { id: "p2", name: "Loreen", score: 1 },
      { id: "p3", name: "Lordi", score: 1 },
    ];
    renderResults({ score: 1, multiplayer: true, roomCode: "ABBA", playerId: "p2" });
    act(() => mocks.onRoom(room({ players: level, hostId: "p2" })));
    expect(screen.getByText("You scored 1 point.")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Start the reveal" }));
    const rows = within(screen.getByRole("list", { name: "Final standings" })).getAllByRole("listitem");
    expect(rows.map(row => row.textContent)).toEqual(["Douze points1. Lordi1 point", "Douze points1. Loreen (you)1 point", "Douze points1. Martin1 point"]);
    expect(rows.map(row => row.classList.contains("is-high"))).toEqual([false, true, false]);
  });

  it("leaves no empty status note once the room has gone with nobody to show", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderResults({ score: 0, multiplayer: true, roomCode: "ABBA", playerId: "p2" });
    act(() => mocks.onRoom(null));
    expect(screen.getByRole("alert")).toHaveTextContent("The game room no longer exists.");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("can skip straight to everything, and leaves on purpose", async () => {
    const user = userEvent.setup();
    sessionStorage.setItem("multiplayerGame", JSON.stringify({ multiplayer: true, roomCode: "ABBA", playerId: "p2" }));
    renderResults();
    act(() => mocks.onRoom(room({ hostId: "p2" })));
    await user.click(screen.getByRole("button", { name: "Show everything" }));
    expect(mocks.setRevealStep).toHaveBeenCalledWith("ABBA", 4);
    expect(standings()).toHaveLength(5);
    // A reload here would still find the room.
    expect(sessionStorage.getItem("multiplayerGame")).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Back to ESCParty" }));
    expect(screen.getByText("at /")).toBeInTheDocument();
    expect(sessionStorage.getItem("multiplayerGame")).toBeNull();
  });

  it("says when the room is gone", () => {
    renderResults({ multiplayer: true, roomCode: "ABBA", playerId: "p2" });
    act(() => mocks.onRoom(null));
    expect(screen.getByRole("alert")).toHaveTextContent("no longer exists");
    expect(screen.getAllByRole("button", { name: "Join or host another game" })).toHaveLength(1);
  });

  it("raises the next round once everyone is showing", async () => {
    renderResults({ multiplayer: true, roomCode: "ABBA", playerId: "host" });
    act(() => mocks.onRoom(room()));
    const playAgain = screen.getByRole("button", { name: "Play again with everyone" });
    expect(playAgain).not.toHaveClass("is-high");
    await userEvent.setup().click(screen.getByRole("button", { name: "Show everything" }));
    expect(screen.getByRole("button", { name: "Play again with everyone" })).toHaveClass("is-high");
  });

  it("offers the host no next round once the room is gone", () => {
    renderResults({ multiplayer: true, roomCode: "ABBA", playerId: "host" });
    act(() => mocks.onRoom(room()));
    expect(screen.getByRole("button", { name: "Play again with everyone" })).toBeInTheDocument();
    act(() => mocks.onRoom(null));
    expect(screen.getByRole("alert")).toHaveTextContent("no longer exists");
    expect(screen.queryByRole("button", { name: "Play again with everyone" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Join or host another game" })).toBeInTheDocument();
  });

  it("keeps one status line through the whole reveal", async () => {
    renderResults({ multiplayer: true, roomCode: "ABBA", playerId: "host" });
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Collecting the final scores");
    act(() => mocks.onRoom(room()));
    expect(screen.getByRole("status")).toBe(status);
    expect(status).toHaveTextContent("5 players are on the scoreboard.");
    await userEvent.setup().click(screen.getByRole("button", { name: "Show everything" }));
    expect(screen.getByRole("status")).toBe(status);
  });

  it("gives the next round back when the room comes back", () => {
    renderResults({ multiplayer: true, roomCode: "ABBA", playerId: "p2" });
    act(() => mocks.onRoom(null));
    expect(screen.getByRole("alert")).toHaveTextContent("no longer exists");
    act(() => mocks.onRoom(room({ nextRoomCode: "NEXT" })));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Join the next round" })).toBeInTheDocument();
  });

  it("still announces the reveal after the room has gone", async () => {
    renderResults({ multiplayer: true, roomCode: "ABBA", playerId: "p2" });
    act(() => mocks.onRoom(room()));
    act(() => mocks.onRoom(null));
    await userEvent.setup().click(screen.getByRole("button", { name: "Show everything" }));
    expect(screen.getByRole("status")).toHaveTextContent(/wins with/);
  });

  it("offers a way out when the room goes after the scores came in", async () => {
    renderResults({ multiplayer: true, roomCode: "ABBA", playerId: "p2" });
    act(() => mocks.onRoom(room()));
    act(() => mocks.onRoom(null));
    expect(screen.getByRole("alert")).toHaveTextContent("no longer exists");
    await userEvent.setup().click(screen.getByRole("button", { name: "Join or host another game" }));
    expect(screen.getByText("at /multiplayer")).toBeInTheDocument();
  });

  it("lets the host start another round with everyone", async () => {
    const user = userEvent.setup();
    localStorage.setItem("playerName", "Martin");
    mocks.createRoom.mockResolvedValue(undefined);
    mocks.setNextRoom.mockResolvedValue(undefined);
    renderResults({ multiplayer: true, roomCode: "ABBA", playerId: "host", observer: true });
    act(() => mocks.onRoom(room({ hostIsObserver: true })));
    expect(screen.queryByText(/You scored/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show everything" }));
    expect(standings()).toHaveLength(4);

    await user.click(screen.getByRole("button", { name: "Play again with everyone" }));
    expect(mocks.createRoom).toHaveBeenCalledWith("NEXT", "host", "Martin", true);
    expect(mocks.setNextRoom).toHaveBeenCalledWith("ABBA", "NEXT");
    expect(localStorage.getItem("gameCode")).toBe("NEXT");
    expect(screen.getByText("at /lobby")).toBeInTheDocument();
  });

  it("says when the next round can't be started", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.createRoom.mockRejectedValue(new Error("offline"));
    renderResults({ multiplayer: true, roomCode: "ABBA", playerId: "host" });
    act(() => mocks.onRoom(room()));
    await userEvent.setup().click(screen.getByRole("button", { name: "Play again with everyone" }));
    expect(screen.getByText("Couldn't start the next round. Try again.")).toBeInTheDocument();
  });

  it("retries the next round without making a second room", async () => {
    const user = userEvent.setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    localStorage.setItem("playerName", "Someone else");
    mocks.createRoom.mockResolvedValue(undefined);
    mocks.setNextRoom.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(undefined);
    renderResults({ multiplayer: true, roomCode: "ABBA", playerId: "host" });
    // No buttons for the next round until the room says who hosts it.
    expect(screen.queryByRole("button", { name: "Play again with everyone" })).not.toBeInTheDocument();
    act(() => mocks.onRoom(room()));
    const again = screen.getByRole("button", { name: "Play again with everyone" });
    await user.click(again);
    expect(screen.getByText("Couldn't start the next round. Try again.")).toBeInTheDocument();
    await user.click(again);
    expect(mocks.createRoom).toHaveBeenCalledTimes(1);
    // The host's name in this room, not this device's last-used one.
    expect(mocks.createRoom).toHaveBeenCalledWith("NEXT", "host", "Martin", false);
    expect(mocks.setNextRoom).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem("playerId")).toBe("host");
    expect(localStorage.getItem("playerName")).toBe("Martin");
    expect(localStorage.getItem("isHost")).toBe("true");
    expect(screen.getByText("at /lobby")).toBeInTheDocument();
  });

  it("ignores a second tap while the next round is starting", async () => {
    const user = userEvent.setup();
    let finish = () => {};
    mocks.createRoom.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
    mocks.setNextRoom.mockResolvedValue(undefined);
    renderResults({ multiplayer: true, roomCode: "ABBA", playerId: "host" });
    act(() => mocks.onRoom(room()));
    const again = screen.getByRole("button", { name: "Play again with everyone" });
    await user.click(again);
    expect(again).toBeDisabled();
    await act(async () => finish());
    expect(mocks.createRoom).toHaveBeenCalledTimes(1);
    expect(screen.getByText("at /lobby")).toBeInTheDocument();
  });

  it("takes the host back to the next round's lobby", async () => {
    renderResults({ multiplayer: true, roomCode: "ABBA", playerId: "host" });
    act(() => mocks.onRoom(room({ nextRoomCode: "NEXT" })));
    expect(screen.getByText("You've started another round.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Play again with everyone" })).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Back to the next round's lobby" }));
    expect(mocks.joinRoom).not.toHaveBeenCalled();
    expect(localStorage.getItem("gameCode")).toBe("NEXT");
    expect(localStorage.getItem("isHost")).toBe("true");
    expect(screen.getByText("at /lobby")).toBeInTheDocument();
  });

  it("forgets the game once the page is left any other way", async () => {
    sessionStorage.setItem("multiplayerGame", JSON.stringify({ multiplayer: true, roomCode: "ABBA", playerId: "p2" }));
    const { unmount } = renderResults();
    unmount();
    expect(sessionStorage.getItem("multiplayerGame")).not.toBeNull();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(sessionStorage.getItem("multiplayerGame")).toBeNull();
  });

  it("lets a guest follow the host into the next round", async () => {
    const user = userEvent.setup();
    localStorage.setItem("playerName", "Loreen");
    mocks.joinRoom.mockResolvedValueOnce(false).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(true);
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderResults({ multiplayer: true, roomCode: "ABBA", playerId: "p2" });
    act(() => mocks.onRoom(room({ nextRoomCode: "NEXT" })));
    expect(screen.getByText("The host has started another round.")).toBeInTheDocument();
    const join = () => user.click(screen.getByRole("button", { name: "Join the next round" }));

    await join();
    expect(screen.getByText("That round isn't open any more: it has started or is gone.")).toBeInTheDocument();
    await join();
    expect(screen.getByText("Couldn't join the next round. Try again.")).toBeInTheDocument();
    await join();
    expect(mocks.joinRoom).toHaveBeenLastCalledWith("NEXT", "p2", "Loreen");
    expect(localStorage.getItem("gameCode")).toBe("NEXT");
    expect(localStorage.getItem("isHost")).toBe("false");
    expect(localStorage.getItem("playerId")).toBe("p2");
    expect(screen.getByText("at /lobby")).toBeInTheDocument();
  });

  it("goes home", async () => {
    renderResults({ multiplayer: true, roomCode: "ABBA", playerId: "p2" });
    await userEvent.setup().click(screen.getByRole("button", { name: "Back to ESCParty" }));
    expect(screen.getByText("at /")).toBeInTheDocument();
  });
});
