import { beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Routes, useLocation } from "react-router-dom";
import { act, fireEvent } from "@testing-library/react";
import { renderWithProviders, screen, userEvent } from "../test/test-utils";
import MultiplayerLobby from "./MultiplayerLobby";
import { createRoom, getRoom, joinRoom, JoinRejected, setRoomDifficulty } from "../utils/roomsFirestore";

vi.mock("../utils/roomsFirestore", () => ({
  JoinRejected: class JoinRejected extends Error {
    constructor(public readonly reason: string, message: string) {
      super(message);
    }
  },
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
    vi.mocked(getRoom).mockResolvedValue(null);
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
    // Focus goes back to the control that was pressed, for keyboard users.
    expect(button(/^Host and play/)).toHaveFocus();

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
    vi.mocked(joinRoom).mockRejectedValueOnce(new Error("Failed to join room: The room is full (32 players)", {
      cause: new JoinRejected("full", "The room is full (32 players)"),
    }));
    renderLobby();
    await typeCode(user, "ABBA");
    await user.click(button("Join the game"));
    expect(await screen.findByRole("alert")).toHaveTextContent("This game is full. Ask the host to start a new one.");
    expect(alert).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Game code")).toHaveValue("ABBA");
  });

  it("says when no game has the code", async () => {
    const user = userEvent.setup();
    vi.mocked(joinRoom).mockResolvedValueOnce(false);
    renderLobby();
    await typeCode(user, "ABBA");
    await user.click(button("Join the game"));
    expect(await screen.findByRole("alert")).toHaveTextContent("No game has that code.");
  });

  it("says when the game has already started", async () => {
    const user = userEvent.setup();
    vi.mocked(joinRoom).mockResolvedValueOnce(false);
    vi.mocked(getRoom).mockResolvedValue({ code: "ABBA", players: [] } as never);
    renderLobby();
    await typeCode(user, "ABBA");
    await user.click(button("Join the game"));
    expect(await screen.findByRole("alert")).toHaveTextContent("That game has already started.");
  });

  it("takes only letters in the code field", async () => {
    const user = userEvent.setup();
    renderLobby();
    await typeCode(user, "a1b-ba");
    expect(screen.getByLabelText("Game code")).toHaveValue("ABBA");
  });

  it("announces the room being set up and moves on when it is", async () => {
    const user = userEvent.setup();
    let finish = () => {};
    vi.mocked(createRoom).mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    renderLobby();
    await user.click(button(/^Host a game/));
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    await user.click(button(/^Host and play/));
    expect(screen.getByRole("status")).toHaveTextContent("Setting up the room…");
    finish();
    expect(await screen.findByText("at /lobby")).toBeInTheDocument();
  });

  it("keeps the way out open while a room is set up, and going back drops it", async () => {
    const user = userEvent.setup();
    let finish = () => {};
    vi.mocked(createRoom).mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    renderLobby();
    await user.click(button(/^Host a game/));
    await user.click(button(/^Host and play/));
    expect(button("Back to ESCParty")).toBeEnabled();
    await user.click(button("Back to host or join"));
    await act(async () => finish());
    expect(screen.queryByText("at /lobby")).not.toBeInTheDocument();
    expect(localStorage.getItem("gameCode")).toBeNull();

    // A fresh try goes through.
    await user.click(button(/^Host a game/));
    await user.click(button(/^Host and play/));
    expect(await screen.findByText("at /lobby")).toBeInTheDocument();
    expect(createRoom).toHaveBeenCalledTimes(2);
  });

  it("keeps the picked quiz when Join a game was a slip", async () => {
    const user = userEvent.setup();
    renderLobby({ quizKey: "t-nordic-nights" });
    await user.click(button(/^Join a game/));
    await user.click(button("Back to host or join"));
    expect(screen.getByText("Hosting: Nordic Nights")).toBeInTheDocument();
  });

  it("offers a host back in as the host", async () => {
    const user = userEvent.setup();
    localStorage.setItem("gameCode", "ABBA");
    localStorage.setItem("playerId", "p-host");
    localStorage.setItem("playerName", "The host");
    renderLobby();
    await typeCode(user, "ABBA");
    await user.click(button("Join the game"));
    expect(button("Rejoin as the host")).toHaveAccessibleDescription(/You were in this game as the host\./);
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
    expect(button("Rejoin as Loreen")).toHaveFocus();

    // Enter in the field waits for the choice instead of asking again.
    await user.type(screen.getByLabelText("Game code"), "{Enter}");
    expect(joinRoom).not.toHaveBeenCalled();
    // Another tab changing the stored game doesn't change who rejoins.
    localStorage.setItem("playerId", "p-other");

    await user.click(button("Rejoin as Loreen"));
    expect(confirm).not.toHaveBeenCalled();
    expect(joinRoom).toHaveBeenCalledWith("ABBA", "p-loreen", "Loreen");
    expect(screen.getByText("at /lobby")).toBeInTheDocument();
  });

  it("keeps the emoji out of the rejoin button", async () => {
    const user = userEvent.setup();
    localStorage.setItem("gameCode", "ABBA");
    localStorage.setItem("playerId", "p-dana");
    localStorage.setItem("playerName", "Dana International 🏳️‍🌈");
    renderLobby();
    await typeCode(user, "ABBA");
    await user.click(button("Join the game"));
    expect(screen.getByText(/You were in this game as Dana International 🏳️‍🌈/)).toBeInTheDocument();
    await user.click(button("Rejoin as Dana International"));
    expect(joinRoom).toHaveBeenCalledWith("ABBA", "p-dana", "Dana International 🏳️‍🌈");
  });

  it("drops every part of an emoji from the rejoin button", async () => {
    const user = userEvent.setup();
    localStorage.setItem("gameCode", "ABBA");
    localStorage.setItem("playerId", "p-x");
    localStorage.setItem("playerName", "Sam 👋🏽 Ryder 1️⃣ 🏴󠁧󠁢󠁥󠁮󠁧󠁿");
    renderLobby();
    await typeCode(user, "ABBA");
    await user.click(button("Join the game"));
    expect(button("Rejoin as Sam Ryder 1")).toBeInTheDocument();
  });

  it("takes a pasted code with a separator in it", async () => {
    const user = userEvent.setup();
    renderLobby();
    await user.click(button(/^Join a game/));
    await user.click(screen.getByLabelText("Game code"));
    await user.paste(" ab-ba ");
    expect(screen.getByLabelText("Game code")).toHaveValue("ABBA");
  });

  it("makes one room however fast the host button is tapped", async () => {
    const user = userEvent.setup();
    renderLobby();
    await user.click(button(/^Host a game/));
    const play = button(/^Host and play/);
    act(() => {
      fireEvent.click(play);
      fireEvent.click(play);
    });
    expect(await screen.findByText("at /lobby")).toBeInTheDocument();
    expect(createRoom).toHaveBeenCalledTimes(1);
  });

  it("keeps the stored game when the page is left while a room is made", async () => {
    const user = userEvent.setup();
    let finish = () => {};
    vi.mocked(createRoom).mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    localStorage.setItem("gameCode", "WXYZ");
    const { unmount } = renderLobby();
    await user.click(button(/^Host a game/));
    await user.click(button(/^Host and play/));
    unmount();
    await act(async () => finish());
    expect(localStorage.getItem("gameCode")).toBe("WXYZ");
  });

  it("remembers who joined when the page is left mid-join", async () => {
    const user = userEvent.setup();
    let finish = (_: boolean) => {};
    vi.mocked(joinRoom).mockImplementationOnce(() => new Promise<boolean>(resolve => { finish = resolve; }));
    const { unmount } = renderLobby();
    await typeCode(user, "ABBA");
    await user.click(button("Join the game"));
    await vi.waitFor(() => expect(joinRoom).toHaveBeenCalled());
    const [, id, name] = vi.mocked(joinRoom).mock.calls[0];
    unmount();
    await act(async () => finish(true));
    expect(localStorage.getItem("gameCode")).toBe("ABBA");
    expect(localStorage.getItem("playerId")).toBe(id);
    expect(localStorage.getItem("playerName")).toBe(name);
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
