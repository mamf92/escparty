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

const button = (name: string | RegExp) => screen.getByRole("button", { name });

const typeCode = async (user: ReturnType<typeof userEvent.setup>, code: string) => {
  await user.click(button(/^Join a game/));
  await user.type(screen.getByLabelText("Game code"), code);
};

describe("MultiplayerLobby", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("is a Calm page with one heading and a way home", async () => {
    const user = userEvent.setup();
    renderLobby();
    expect(screen.getByRole("heading", { level: 1, name: "Multiplayer quiz" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading")).toHaveLength(1);
    expect(document.querySelector(".calm-ground .lycra-pane > button.lycra")).not.toBeNull();
    await user.click(button("Back to ESCParty"));
    expect(screen.getByText("at /")).toBeInTheDocument();
  });

  it("creates a room with the quiz picked in the library", async () => {
    const user = userEvent.setup();
    renderLobby({ quizKey: "t-nordic-nights" });
    expect(screen.getByText("Hosting: Nordic Nights")).toBeInTheDocument();

    await user.click(button(/^Host a game/));
    await user.click(button(/^Host and play/));

    expect(createRoom).toHaveBeenCalledWith("ABBA", expect.any(String), "The host", false);
    expect(setRoomDifficulty).toHaveBeenCalledWith("ABBA", "t-nordic-nights", 5);
    expect(await screen.findByText("at /lobby")).toBeInTheDocument();
    expect(localStorage.getItem("isHost")).toBe("true");
  });

  it("ignores a key that names no quiz", async () => {
    const user = userEvent.setup();
    renderLobby({ quizKey: "t-gone" });
    expect(screen.queryByText(/Hosting:/)).not.toBeInTheDocument();

    await user.click(button(/^Host a game/));
    await user.click(button(/^Host only/));
    expect(createRoom).toHaveBeenCalledWith("ABBA", expect.any(String), expect.any(String), true);
    expect(setRoomDifficulty).not.toHaveBeenCalled();
  });

  it("says so in a note when the room can't be created, and lets the host try again", async () => {
    const user = userEvent.setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(createRoom).mockRejectedValueOnce(new Error("offline"));
    renderLobby();
    await user.click(button(/^Host a game/));
    await user.click(button(/^Host and play/));
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't set up the room. Check your connection and try again.");

    await user.click(button(/^Host and play/));
    expect(await screen.findByText("at /lobby")).toBeInTheDocument();
  });

  it("goes back from hosting to the choice", async () => {
    const user = userEvent.setup();
    renderLobby();
    await user.click(button(/^Host a game/));
    await user.click(button("Back to host or join"));
    expect(button(/^Join a game/)).toBeInTheDocument();
  });

  it("drops the picked quiz when joining someone else's room", async () => {
    const user = userEvent.setup();
    renderLobby({ quizKey: "t-nordic-nights" });
    await user.click(button(/^Join a game/));
    expect(screen.queryByText(/Hosting:/)).not.toBeInTheDocument();
  });

  it("asks for four letters beside the field and keeps what was typed", async () => {
    const user = userEvent.setup();
    renderLobby();
    await typeCode(user, "AB");
    await user.click(button("Join the game"));
    const field = screen.getByLabelText("Game code");
    expect(field).toHaveValue("AB");
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAccessibleDescription("A game code is four letters, like ABBA.");
    expect(joinRoom).not.toHaveBeenCalled();
  });

  it("joins with Enter", async () => {
    const user = userEvent.setup();
    renderLobby();
    await typeCode(user, "abba{Enter}");
    expect(joinRoom).toHaveBeenCalledWith("ABBA", expect.any(String), expect.any(String));
    expect(await screen.findByText("at /lobby")).toBeInTheDocument();
  });

  it("tells a guest when the game is full, without an alert", async () => {
    const user = userEvent.setup();
    const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(joinRoom).mockRejectedValueOnce(new Error("Failed to join room: The room is full (32 players)"));
    renderLobby();
    await typeCode(user, "ABBA");
    await user.click(button("Join the game"));
    expect(await screen.findByRole("alert")).toHaveTextContent("This game is full. Ask the host to start a new one.");
    expect(alert).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Game code")).toHaveValue("ABBA");
  });

  it("says when no open game has the code", async () => {
    const user = userEvent.setup();
    vi.mocked(joinRoom).mockResolvedValueOnce(false);
    renderLobby();
    await typeCode(user, "ABBA");
    await user.click(button("Join the game"));
    expect(await screen.findByRole("alert")).toHaveTextContent(/can't be joined/);
  });

  it("lets a player back into a game this device was in, as themselves (#65)", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm");
    localStorage.setItem("gameCode", "ABBA");
    localStorage.setItem("playerId", "p-loreen");
    localStorage.setItem("playerName", "Loreen");
    renderLobby();
    await typeCode(user, "ABBA");
    await user.click(button("Join the game"));
    expect(screen.getByText(/You were in this game as Loreen/)).toBeInTheDocument();
    expect(joinRoom).not.toHaveBeenCalled();

    await user.click(button("Rejoin as Loreen"));
    expect(confirm).not.toHaveBeenCalled();
    expect(joinRoom).toHaveBeenCalledWith("ABBA", "p-loreen", "Loreen");
    expect(screen.getByText("at /lobby")).toBeInTheDocument();
  });

  it("joins the same game as someone new when that's not you", async () => {
    const user = userEvent.setup();
    localStorage.setItem("gameCode", "ABBA");
    localStorage.setItem("playerId", "p-loreen");
    localStorage.setItem("playerName", "Loreen");
    renderLobby();
    await typeCode(user, "ABBA");
    await user.click(button("Join the game"));
    await user.click(button("Join as someone new"));
    expect(vi.mocked(joinRoom).mock.calls[0][1]).not.toBe("p-loreen");
    expect(localStorage.getItem("playerId")).not.toBe("p-loreen");
  });

  it("joins another game as someone new", async () => {
    const user = userEvent.setup();
    localStorage.setItem("gameCode", "ABBA");
    localStorage.setItem("playerId", "p-loreen");
    localStorage.setItem("playerName", "Loreen");
    renderLobby();
    await typeCode(user, "EFGH");
    await user.click(button("Join the game"));
    const [code, id] = vi.mocked(joinRoom).mock.calls[0];
    expect(code).toBe("EFGH");
    expect(id).not.toBe("p-loreen");
    expect(localStorage.getItem("gameCode")).toBe("EFGH");
  });
});
