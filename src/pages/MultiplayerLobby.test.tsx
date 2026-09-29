import { beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Routes, useLocation } from "react-router-dom";
import { renderWithProviders, screen, userEvent } from "../test/test-utils";
import MultiplayerLobby from "./MultiplayerLobby";
import { createRoom, joinRoom, setRoomDifficulty } from "../utils/roomsFirestore";

vi.mock("../utils/roomsFirestore", () => ({
  createRoom: vi.fn(async () => undefined),
  setRoomDifficulty: vi.fn(async () => undefined),
  joinRoom: vi.fn(async () => true),
  getRoom: vi.fn(async () => null),
  generateRoomCode: () => "ABBA",
}));

const ShowLocation = () => {
  const location = useLocation();
  return <p>at {location.pathname}</p>;
};

const renderLobby = (state?: unknown) =>
  renderWithProviders(
    <Routes>
      <Route path="/multiplayer" element={<MultiplayerLobby />} />
      <Route path="*" element={<ShowLocation />} />
    </Routes>,
    { initialEntries: [{ pathname: "/multiplayer", state }] },
  );

describe("MultiplayerLobby", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("creates a room with the quiz picked in the library", async () => {
    const user = userEvent.setup();
    renderLobby({ quizKey: "t-nordic-nights" });
    expect(screen.getByText("Hosting: Nordic Nights")).toBeInTheDocument();

    await user.click(screen.getByText("Create game"));
    await user.click(screen.getByText("Host & Play"));

    expect(createRoom).toHaveBeenCalledWith("ABBA", expect.any(String), expect.any(String), false);
    expect(setRoomDifficulty).toHaveBeenCalledWith("ABBA", "t-nordic-nights", 5);
    expect(await screen.findByText("at /lobby")).toBeInTheDocument();
  });

  it("ignores a key that names no quiz", async () => {
    const user = userEvent.setup();
    renderLobby({ quizKey: "t-gone" });
    expect(screen.queryByText(/Hosting:/)).not.toBeInTheDocument();

    await user.click(screen.getByText("Create game"));
    await user.click(screen.getByText("Host Only"));
    expect(createRoom).toHaveBeenCalledWith("ABBA", expect.any(String), expect.any(String), true);
    expect(setRoomDifficulty).not.toHaveBeenCalled();
  });

  it("drops the picked quiz when joining someone else's room", async () => {
    const user = userEvent.setup();
    renderLobby({ quizKey: "t-nordic-nights" });
    await user.click(screen.getByText("Join game"));
    expect(screen.queryByText(/Hosting:/)).not.toBeInTheDocument();
  });

  it("tells a guest when the game is full", async () => {
    const user = userEvent.setup();
    const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(joinRoom).mockRejectedValueOnce(new Error("Failed to join room: The room is full (32 players)"));
    renderLobby();
    await user.click(screen.getByText("Join game"));
    await user.type(screen.getByPlaceholderText("code"), "ABBA");
    await user.click(screen.getByText("Join Game"));
    expect(alert).toHaveBeenCalledWith("This game is full. Ask the host to start a new one.");
  });

  it("lets a player back into a game this device was in, as themselves (#65)", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    localStorage.setItem("gameCode", "ABBA");
    localStorage.setItem("playerId", "p-loreen");
    localStorage.setItem("playerName", "Loreen");
    renderLobby();
    await user.click(screen.getByText("Join game"));
    await user.type(screen.getByPlaceholderText("code"), "ABBA");
    await user.click(screen.getByText("Join Game"));
    expect(confirm).toHaveBeenCalledWith("You were in this game as Loreen. Rejoin as Loreen? (Cancel joins as someone new.)");
    expect(joinRoom).toHaveBeenCalledWith("ABBA", "p-loreen", "Loreen");
    expect(screen.getByText("at /lobby")).toBeInTheDocument();
  });

  it("joins the same game as someone new when that's not you", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    localStorage.setItem("gameCode", "ABBA");
    localStorage.setItem("playerId", "p-loreen");
    localStorage.setItem("playerName", "Loreen");
    renderLobby();
    await user.click(screen.getByText("Join game"));
    await user.type(screen.getByPlaceholderText("code"), "ABBA");
    await user.click(screen.getByText("Join Game"));
    expect(vi.mocked(joinRoom).mock.calls[0][1]).not.toBe("p-loreen");
    expect(localStorage.getItem("playerId")).not.toBe("p-loreen");
  });

  it("joins another game as someone new", async () => {
    const user = userEvent.setup();
    localStorage.setItem("gameCode", "ABBA");
    localStorage.setItem("playerId", "p-loreen");
    localStorage.setItem("playerName", "Loreen");
    renderLobby();
    await user.click(screen.getByText("Join game"));
    await user.type(screen.getByPlaceholderText("code"), "EFGH");
    await user.click(screen.getByText("Join Game"));
    const [code, id] = vi.mocked(joinRoom).mock.calls[0];
    expect(code).toBe("EFGH");
    expect(id).not.toBe("p-loreen");
    expect(localStorage.getItem("gameCode")).toBe("EFGH");
  });
});
