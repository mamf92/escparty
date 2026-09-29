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
});
