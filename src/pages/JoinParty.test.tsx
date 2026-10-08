import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Routes, useLocation } from "react-router-dom";
import { renderWithProviders, screen, userEvent } from "../test/test-utils";
import JoinParty from "./JoinParty";
import { findGame } from "../utils/joinCode";
import { savePartyIdentity } from "../utils/partySession";

vi.mock("../utils/joinCode", async importOriginal => ({
  ...(await importOriginal<typeof import("../utils/joinCode")>()),
  findGame: vi.fn(),
}));

// The camera itself is QrScanner's own test; here a button stands in for a scan.
vi.mock("../components/QrScanner", () => ({
  QrScanner: ({ onScan }: { onScan: (text: string) => boolean }) => (
    <>
      <button type="button" onClick={() => onScan("https://example.com/")}>Scan a stray code</button>
      <button type="button" onClick={() => onScan("https://escparty.app/#/party/dana")}>Scan the party code</button>
    </>
  ),
}));

const ShowLocation = () => {
  const location = useLocation();
  return <p>at {location.pathname} {JSON.stringify(location.state)}</p>;
};

const renderJoin = () =>
  renderWithProviders(
    <Routes>
      <Route path="/join" element={<JoinParty />} />
      <Route path="*" element={<ShowLocation />} />
    </Routes>,
    { initialEntries: ["/join"] },
  );

const field = () => screen.getByLabelText("Party code");

describe("JoinParty", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("covers the screen with the disco ball loader while the code is checked", async () => {
    const user = userEvent.setup();
    let found: (kind: "quiz") => void = () => {};
    vi.mocked(findGame).mockImplementationOnce(() => new Promise(resolve => { found = resolve as typeof found; }));
    renderJoin();
    expect(screen.queryByRole("status")).toBeNull();
    await user.type(field(), "ABBA");
    expect(await screen.findByRole("status")).toHaveTextContent("Finding the party…");
    expect(screen.getByRole("status").querySelector("canvas.esc-loader-ball")).not.toBeNull();
    await act(async () => found("quiz"));
    expect(await screen.findByText(/^at \/multiplayer/)).toBeInTheDocument();
    expect(screen.queryByText("Finding the party…")).toBeNull();
  });

  it("is one card with the code field and the scan button", () => {
    renderJoin();
    expect(screen.getByRole("heading", { level: 1, name: "Join a party" })).toBeInTheDocument();
    const pane = field().closest(".lycra-pane");
    expect(pane).not.toBeNull();
    expect(screen.getByRole("button", { name: "Scan the QR code" }).parentElement).toBe(pane);
    expect(screen.queryByRole("button", { name: /Back to party/ })).not.toBeInTheDocument();
  });

  it("sends a quiz room's code to the multiplayer page as soon as the fourth letter is in", async () => {
    vi.mocked(findGame).mockResolvedValue("quiz");
    const user = userEvent.setup();
    renderJoin();
    await user.type(field(), "ab-b");
    expect(field()).toHaveValue("ABB");
    expect(findGame).not.toHaveBeenCalled();
    await user.type(field(), "a");
    expect(findGame).toHaveBeenCalledWith("ABBA");
    expect(await screen.findByText('at /multiplayer {"joinCode":"ABBA"}')).toBeInTheDocument();
  });

  it("opens a scoreboard party's code", async () => {
    vi.mocked(findGame).mockResolvedValue("party");
    renderJoin();
    await userEvent.setup().type(field(), "LENA");
    expect(await screen.findByText(/at \/party\/LENA/)).toBeInTheDocument();
  });

  it("says when nothing has the code, and tries again once it's changed", async () => {
    vi.mocked(findGame).mockResolvedValue(null);
    const user = userEvent.setup();
    renderJoin();
    await user.type(field(), "ZZZZ");
    expect(await screen.findByRole("alert")).toHaveTextContent("Nothing is on with that code");
    expect(field()).toHaveAttribute("aria-invalid", "true");
    expect(field()).toHaveAccessibleDescription(/Check the four letters/);

    vi.mocked(findGame).mockResolvedValue("party");
    await user.type(field(), "{Backspace}Y");
    expect(await screen.findByText(/at \/party\/ZZZY/)).toBeInTheDocument();
  });

  it("says when the code couldn't be checked", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(findGame).mockRejectedValue(new Error("offline"));
    renderJoin();
    await userEvent.setup().type(field(), "ABBA");
    expect(await screen.findByRole("alert")).toHaveTextContent("Check your connection");
  });

  it("explains a short code sent with Enter", async () => {
    renderJoin();
    await userEvent.setup().type(field(), "AB{Enter}");
    expect(screen.getByRole("alert")).toHaveTextContent("A code is four letters, like ABBA.");
    expect(findGame).not.toHaveBeenCalled();
  });

  it("joins the code in a scanned QR code, and keeps scanning past a stray one", async () => {
    vi.mocked(findGame).mockResolvedValue("party");
    const user = userEvent.setup();
    renderJoin();
    await user.click(screen.getByRole("button", { name: "Scan the QR code" }));
    await user.click(screen.getByRole("button", { name: "Scan a stray code" }));
    expect(findGame).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Stop scanning" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Scan the party code" }));
    expect(findGame).toHaveBeenCalledWith("DANA");
    expect(await screen.findByText(/at \/party\/DANA/)).toBeInTheDocument();
  });

  it("closes the camera with Stop scanning", async () => {
    const user = userEvent.setup();
    renderJoin();
    await user.click(screen.getByRole("button", { name: "Scan the QR code" }));
    await user.click(screen.getByRole("button", { name: "Stop scanning" }));
    expect(screen.queryByRole("button", { name: "Scan the party code" })).not.toBeInTheDocument();
  });

  it("offers a way back to the party this device was in", async () => {
    savePartyIdentity("ABBA", { guestId: "g1", name: "Loreen", isHost: false });
    renderJoin();
    await userEvent.setup().click(screen.getByRole("button", { name: "Back to party ABBA" }));
    expect(screen.getByText(/at \/party\/ABBA/)).toBeInTheDocument();
  });
});
