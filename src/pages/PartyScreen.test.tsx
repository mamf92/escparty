import { beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Routes, useLocation } from "react-router-dom";
import { renderWithProviders, screen, userEvent, within } from "../test/test-utils";
import PartyScreen from "./PartyScreen";
import { makeBallot, makeParty } from "../test/partyFixtures";
import type { PartyData } from "../hooks/usePartyData";

const mocks = vi.hoisted(() => ({ data: {} as PartyData, toDataURL: vi.fn() }));
vi.mock("../hooks/usePartyData", () => ({ usePartyData: () => mocks.data }));
vi.mock("qrcode", () => ({ toDataURL: mocks.toDataURL }));

const ShowLocation = () => <p>at {useLocation().pathname}</p>;
const renderScreen = (entry = "/party/abba/screen") =>
    renderWithProviders(
        <Routes>
            <Route path="/party/:code/screen" element={<PartyScreen />} />
            <Route path="/screen" element={<PartyScreen />} />
            <Route path="*" element={<ShowLocation />} />
        </Routes>,
        { initialEntries: [entry] },
    );

const ballots = [makeBallot("g1", "Jedward", [12, 6, 1]), makeBallot("g2", "Lordi", [6, 12, 1])];

describe("PartyScreen", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.toDataURL.mockResolvedValue("data:image/png;base64,QR");
        mocks.data = { party: makeParty(), ballots, error: null, retry: vi.fn() };
    });

    it("shows a QR code and the code to join", async () => {
        renderScreen();
        expect(await screen.findByRole("img", { name: "QR code to join party ABBA" })).toHaveAttribute("src", "data:image/png;base64,QR");
        expect(mocks.toDataURL.mock.calls[0][0]).toMatch(/#\/party\/ABBA$/);
        expect(screen.getByText("Party code").nextSibling).toHaveTextContent("ABBA");
        expect(screen.getByText("2 guests are rating.")).toBeInTheDocument();
    });

    it("lists the room's standings with the real result, never a guest's own", async () => {
        mocks.data = { party: makeParty({ showNames: false, results: { places: { no: 1 } } }), ballots: [ballots[0]], error: "offline", retry: vi.fn() };
        renderScreen();
        const standings = screen.getByRole("list", { name: "The room's standings" });
        expect(within(standings).getAllByRole("listitem").map(item => item.textContent)).toEqual([
            "1st 🇸🇪 Sweden10", "2nd 🇳🇴 Norway5Really 1st", "3rd 🇫🇮 Finland0.8",
        ]);
        expect(screen.getByText("1 guest is rating.")).toBeInTheDocument();
        expect(screen.queryByText(/Jedward/)).not.toBeInTheDocument();
        expect(screen.getByRole("alert")).toHaveTextContent("offline");
        await screen.findByRole("img");
    });

    it("says the ratings are on their way rather than showing an empty table", async () => {
        mocks.data = { party: makeParty(), ballots: undefined, error: null, retry: vi.fn() };
        renderScreen();
        expect(screen.getByRole("status")).toHaveTextContent("Counting the ratings…");
        expect(screen.queryByText(/No ratings yet/)).not.toBeInTheDocument();
        expect(screen.queryByText(/guests are rating/)).not.toBeInTheDocument();
        await screen.findByRole("img");
    });

    it("says what the standings wait for before anyone rates", async () => {
        mocks.data = { party: makeParty(), ballots: [], error: null, retry: vi.fn() };
        renderScreen();
        expect(screen.getByText(/^No ratings yet/)).toHaveClass("is-static");
        expect(screen.queryByRole("list")).not.toBeInTheDocument();
        expect(screen.getByText("0 guests are rating.")).toHaveAttribute("aria-live", "polite");
        // The QR code shrinks to fit a phone instead of spilling out of its row.
        expect(await screen.findByRole("img")).toHaveClass("party-qr");
    });

    it("names the closest guests only when the host chose names", async () => {
        mocks.data = { party: makeParty({ kind: "semi", qualifiers: 1, results: { qualifiers: ["no"] } }), ballots, error: null, retry: vi.fn() };
        renderScreen();
        expect(screen.getAllByText("Through")).toHaveLength(1);
        const board = screen.getByRole("list", { name: "Closest to the real result" });
        expect(within(board).getAllByRole("listitem").map(item => item.textContent)).toEqual(["1st Lordi12", "2nd Jedward0"]);
        await screen.findByRole("img");
    });

    it("waits for the party, says when there's none, and goes back", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        mocks.toDataURL.mockRejectedValue(new Error("no canvas"));
        mocks.data = { party: undefined, ballots: undefined, error: null, retry: vi.fn() };
        const { unmount } = renderScreen();
        expect(screen.getByRole("status")).toHaveTextContent("Finding the party");
        unmount();
        mocks.data = { party: null, ballots: undefined, error: null, retry: vi.fn() };
        renderScreen();
        expect(screen.getByRole("alert")).toHaveTextContent("no party with the code ABBA");
        expect(screen.getByRole("button", { name: "Try another code" })).toBeInTheDocument();
        await userEvent.setup().click(screen.getByRole("button", { name: "Back to my phone view" }));
        expect(screen.getByText("at /party/ABBA")).toBeInTheDocument();
        expect(console.error).toHaveBeenCalled();
    });

    it("goes to the party home without a code", async () => {
        mocks.data = { party: null, ballots: undefined, error: null, retry: vi.fn() };
        renderScreen("/screen");
        await userEvent.setup().click(screen.getByRole("button", { name: "Back to my phone view" }));
        expect(screen.getByText("at /party")).toBeInTheDocument();
        expect(mocks.toDataURL).not.toHaveBeenCalled();
    });
});
