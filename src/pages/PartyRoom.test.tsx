import { beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Routes, useLocation } from "react-router-dom";
import { renderWithProviders, screen, userEvent, within } from "../test/test-utils";
import PartyRoom from "./PartyRoom";
import { makeBallot, makeParty } from "../test/partyFixtures";
import type { PartyData } from "../hooks/usePartyData";
import { readPartyIdentity, savePartyIdentity } from "../utils/partySession";

const mocks = vi.hoisted(() => ({ data: {} as PartyData, saveBallot: vi.fn() }));
vi.mock("../hooks/usePartyData", () => ({ usePartyData: () => mocks.data }));
vi.mock("../utils/partyFirestore", () => ({
    saveBallot: mocks.saveBallot,
    setPartyResults: vi.fn(),
    setPartyRevealed: vi.fn(),
    updatePartyActs: vi.fn(),
    fetchContest: vi.fn(),
}));

const ShowLocation = () => <p>at {useLocation().pathname}</p>;
const renderRoom = () =>
    renderWithProviders(
        <Routes>
            <Route path="/party/:code" element={<PartyRoom />} />
            <Route path="*" element={<ShowLocation />} />
        </Routes>,
        { initialEntries: ["/party/abba"] },
    );

const guest = { guestId: "g1", name: "Jedward", isHost: false };

describe("PartyRoom", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        mocks.saveBallot.mockResolvedValue(undefined);
        mocks.data = { party: makeParty(), ballots: [], error: null, retry: vi.fn() };
    });

    it("waits for the party, and says when there's none", () => {
        mocks.data = { party: undefined, ballots: undefined, error: null, retry: vi.fn() };
        const { unmount } = renderRoom();
        expect(screen.getByRole("status")).toHaveTextContent("Finding the party");
        unmount();
        mocks.data = { party: null, ballots: undefined, error: null, retry: vi.fn() };
        const { unmount: unmountMissing } = renderRoom();
        expect(screen.getByRole("alert")).toHaveTextContent("no party with the code ABBA");
        expect(screen.getByRole("button", { name: "Try another code" })).toBeInTheDocument();
        unmountMissing();
        mocks.data = { party: undefined, ballots: undefined, error: "The party couldn't be reached. Check your connection.", retry: vi.fn() };
        renderRoom();
        expect(screen.getByRole("alert")).toHaveTextContent("couldn't be reached");
        expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    });

    it("says what the room's standings wait for", async () => {
        savePartyIdentity("ABBA", guest);
        renderRoom();
        await userEvent.setup().click(screen.getByRole("tab", { name: "The room" }));
        expect(screen.getByText(/^No ratings yet/)).toHaveClass("is-static");
        expect(screen.getByText("0 guests are rating.")).toHaveAttribute("aria-live", "polite");
    });

    it("lets a new guest join with a name", async () => {
        const user = userEvent.setup();
        renderRoom();
        expect(screen.getByText(/the awards name who rated most alike/)).toBeInTheDocument();
        await user.clear(screen.getByLabelText("Your name at the party"));
        await user.click(screen.getByRole("button", { name: "Join the party" }));
        expect(screen.getByRole("alert")).toHaveTextContent("Give yourself a name.");
        expect(screen.getByLabelText("Your name at the party")).toHaveAccessibleDescription("Give yourself a name.");
        // Enter in the field joins.
        await user.type(screen.getByLabelText("Your name at the party"), "Lordi{Enter}");
        expect(screen.getByText("Party ABBA · you're Lordi")).toBeInTheDocument();
        expect(readPartyIdentity("ABBA")).toMatchObject({ name: "Lordi", isHost: false });
    });

    it("warns about anonymous awards on joining", () => {
        mocks.data = { party: makeParty({ showNames: false }), ballots: [], error: null, retry: vi.fn() };
        renderRoom();
        expect(screen.getByText(/only told which ones are yours/)).toBeInTheDocument();
    });

    it("rates acts one by one and remembers where you were", async () => {
        const user = userEvent.setup();
        savePartyIdentity("ABBA", guest);
        mocks.data = { party: makeParty({ bonuses: true }), ballots: [], error: null, retry: vi.fn() };
        renderRoom();
        expect(screen.getByText("🇸🇪 Sweden")).toBeInTheDocument();
        expect(screen.getByText("You haven't rated Sweden yet.")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Previous act" })).toBeDisabled();

        const scale = screen.getByRole("radiogroup", { name: "Points for Sweden" });
        await user.click(within(scale).getByRole("radio", { name: "12" }));
        expect(within(scale).getByRole("radio", { name: "12" })).toHaveAttribute("aria-checked", "true");
        // Chosen is pressed in, and said with aria-checked alone (no aria-pressed on a radio).
        expect(within(scale).getByRole("radio", { name: "12" })).toHaveClass("is-chosen");
        expect(within(scale).getByRole("radio", { name: "12" })).not.toHaveAttribute("aria-pressed");
        expect(screen.getByRole("tab", { name: "Rate" })).toHaveAttribute("aria-selected", "true");
        expect(screen.getByRole("tab", { name: "Rate" })).toHaveClass("is-chosen");
        await user.click(screen.getByRole("button", { name: /Wind machine/ }));
        expect(screen.getByText("Your score for Sweden: 11")).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Next act" }));
        expect(screen.getByRole("radiogroup", { name: "Points for Norway" })).toBeInTheDocument();
        expect(readPartyIdentity("ABBA")?.actId).toBe("no");
        await user.selectOptions(screen.getByLabelText("Jump to an act"), "3");
        expect(screen.getByRole("button", { name: "Next act" })).toBeDisabled();
        expect(screen.getByRole("option", { name: "1. Sweden ✓" })).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Previous act" }));
        expect(screen.getByRole("radiogroup", { name: "Points for Finland" })).toBeInTheDocument();
    });

    it("stays on the same act when the host reorders the lineup", () => {
        savePartyIdentity("ABBA", { ...guest, actId: "fi" });
        const { unmount } = renderRoom();
        expect(screen.getByRole("radiogroup", { name: "Points for Finland" })).toBeInTheDocument();
        unmount();
        const [se, no, fi, ie] = makeParty().acts;
        mocks.data = { party: makeParty({ acts: [fi, se, no, ie] }), ballots: [], error: null, retry: vi.fn() };
        renderRoom();
        expect(screen.getByRole("radiogroup", { name: "Points for Finland" })).toBeInTheDocument();
        expect(screen.getByText("1 of 4")).toBeInTheDocument();
    });

    it("shows your ranking, and how close it came", async () => {
        const user = userEvent.setup();
        savePartyIdentity("ABBA", guest);
        renderRoom();
        await user.click(screen.getByRole("tab", { name: "My ranking" }));
        expect(screen.getByText("Rate an act and your ranking starts here.")).toBeInTheDocument();
        await user.click(screen.getByRole("tab", { name: "Rate" }));
        await user.click(screen.getByRole("radio", { name: "6" }));
        await user.click(screen.getByRole("button", { name: "Next act" }));
        await user.click(screen.getByRole("radio", { name: "12" }));
        await user.click(screen.getByRole("tab", { name: "My ranking" }));
        const ranking = screen.getByRole("list", { name: "Your ranking" });
        expect(within(ranking).getAllByRole("listitem").map(item => item.textContent)).toEqual(["1st 🇳🇴 Norway10", "2nd 🇸🇪 Sweden5"]);

        mocks.data = { party: makeParty({ results: { places: { se: 1, no: 2 } } }), ballots: [], error: null, retry: vi.fn() };
        await user.click(screen.getByRole("tab", { name: "Rate" }));
        await user.click(screen.getByRole("tab", { name: "My ranking" }));
        expect(screen.getByRole("status")).toHaveTextContent("16 closeness points over 2 acts");
        expect(screen.getByText("Really came 1st")).toBeInTheDocument();
    });

    it("shows a semi's picks and qualifiers", async () => {
        const user = userEvent.setup();
        savePartyIdentity("ABBA", guest);
        localStorage.setItem("escparty.party.ABBA.ballot", JSON.stringify({ ratings: { se: { points: 12 }, no: { points: 3 } }, bonuses: {}, savedAt: 1 }));
        mocks.data = { party: makeParty({ kind: "semi", qualifiers: 2, results: { qualifiers: ["se"] } }), ballots: [], error: null, retry: vi.fn() };
        renderRoom();
        await user.click(screen.getByRole("tab", { name: "My ranking" }));
        expect(screen.getByRole("status")).toHaveTextContent("You called 1 of the 1 qualifiers so far: 12 points.");
        expect(screen.getByText("Went through")).toBeInTheDocument();
        expect(screen.getByText("Your top 2 are your picks to go through.")).toBeInTheDocument();
    });

    it("shows the room's standings and the closeness leaderboard", async () => {
        const user = userEvent.setup();
        savePartyIdentity("ABBA", guest);
        const ballots = [makeBallot("g1", "Jedward", [12, 6]), makeBallot("g2", "Lordi", [6, 12])];
        mocks.data = { party: makeParty(), ballots: [ballots[0]], error: "The party couldn't be reached. Check your connection.", retry: vi.fn() };
        const { unmount } = renderRoom();
        await user.click(screen.getByRole("tab", { name: "The room" }));
        expect(screen.getByText("1 guest is rating.")).toBeInTheDocument();
        expect(screen.queryByText(/No ratings yet/)).not.toBeInTheDocument();
        expect(screen.getByText(/couldn't be reached/)).toBeInTheDocument();
        expect(screen.getAllByText("1 rating")).toHaveLength(2);
        unmount();

        mocks.data = { party: makeParty({ results: { places: { no: 1, se: 2 } } }), ballots, error: null, retry: vi.fn() };
        renderRoom();
        await user.click(screen.getByRole("tab", { name: "The room" }));
        expect(screen.getByText("2 guests are rating.")).toBeInTheDocument();
        const board = screen.getByRole("list", { name: "Closest to the real result" });
        const rows = within(board).getAllByRole("listitem");
        expect(rows.map(item => item.textContent)).toEqual(["1st Lordi24", "2nd Jedward16That's you"]);
        // Your own row stands proud and says so; it isn't marked as a choice.
        expect(rows[1]).toHaveClass("is-high");
        expect(rows[1]).not.toHaveClass("is-chosen");
        expect(rows[0]).not.toHaveClass("is-high");
    });

    it("keeps the leaderboard to your own place when names are off", async () => {
        const user = userEvent.setup();
        savePartyIdentity("ABBA", guest);
        const ballots = [makeBallot("g1", "Jedward", [12, 6]), makeBallot("g2", "Lordi", [6, 12])];
        mocks.data = { party: makeParty({ showNames: false, results: { places: { no: 1, se: 2 } } }), ballots, error: null, retry: vi.fn() };
        const { unmount } = renderRoom();
        await user.click(screen.getByRole("tab", { name: "The room" }));
        expect(screen.queryByText(/Lordi/)).not.toBeInTheDocument();
        expect(screen.getByRole("status")).toHaveTextContent("You're 2nd of 2 closest to the real result.");
        unmount();
        mocks.data = { ...mocks.data, ballots: [ballots[1]] };
        renderRoom();
        await user.click(screen.getByRole("tab", { name: "The room" }));
        expect(screen.getByRole("status")).toHaveTextContent("Rate some acts to be in the running");
    });

    it("gives the host their tools and an awards preview", async () => {
        const user = userEvent.setup();
        savePartyIdentity("ABBA", { guestId: "host-1", name: "Martin", isHost: true });
        renderRoom();
        await user.click(screen.getByRole("tab", { name: "Host" }));
        expect(screen.getByRole("button", { name: "Copy the party link" })).toBeInTheDocument();
        await user.click(screen.getByRole("tab", { name: "Rate" }));
        await user.click(screen.getByRole("button", { name: "Preview the awards" }));
        expect(screen.getByText("at /party/ABBA/awards")).toBeInTheDocument();
    });

    it("opens the awards for guests once revealed, and the big screen", async () => {
        const user = userEvent.setup();
        savePartyIdentity("ABBA", guest);
        const { unmount } = renderRoom();
        expect(screen.queryByRole("tab", { name: "Host" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /awards/ })).not.toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Open the big screen" }));
        expect(screen.getByText("at /party/ABBA/screen")).toBeInTheDocument();
        unmount();
        mocks.data = { party: makeParty({ revealed: true }), ballots: [], error: null, retry: vi.fn() };
        renderRoom();
        await user.click(screen.getByRole("button", { name: "See the awards" }));
        expect(screen.getByText("at /party/ABBA/awards")).toBeInTheDocument();
    });

    it("leaves the party", async () => {
        renderRoom();
        await userEvent.setup().click(screen.getByRole("button", { name: "Leave the party" }));
        expect(screen.getByText("at /party")).toBeInTheDocument();
    });
});

it("says when the room has no ratings yet", async () => {
    localStorage.clear();
    savePartyIdentity("ABBA", guest);
    mocks.data = { party: makeParty(), ballots: [], error: null, retry: vi.fn() };
    renderRoom();
    await userEvent.setup().click(screen.getByRole("tab", { name: "The room" }));
    expect(screen.getByText(/No ratings yet/)).toBeInTheDocument();
    expect(screen.getByText("0 guests are rating.")).toBeInTheDocument();
});
