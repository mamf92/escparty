import { beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Routes, useLocation } from "react-router-dom";
import { renderWithProviders, screen, userEvent, waitFor, within } from "../test/test-utils";
import PartyRoom from "./PartyRoom";
import { makeBallot, makeParty } from "../test/partyFixtures";
import type { PartyData } from "../hooks/usePartyData";
import { PARTY_NAMES } from "../utils/partyNames";
import { readPartyIdentity, savePartyIdentity } from "../utils/partySession";

const mocks = vi.hoisted(() => ({ data: {} as PartyData, saveBallot: vi.fn(), joinParty: vi.fn() }));
vi.mock("../hooks/usePartyData", () => ({ usePartyData: () => mocks.data }));
vi.mock("../utils/partyFirestore", () => ({
    saveBallot: mocks.saveBallot,
    joinParty: mocks.joinParty,
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
        mocks.joinParty.mockResolvedValue(true);
        vi.stubGlobal("matchMedia", (query: string) => ({ matches: true, media: query, addEventListener: () => {}, removeEventListener: () => {} }));
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
        await userEvent.setup().click(screen.getByRole("tab", { name: "Room" }));
        expect(screen.getByText(/^No ratings yet/)).toHaveClass("is-static");
        expect(screen.getByText("0 guests at the party.")).toHaveAttribute("aria-live", "polite");
    });

    it("lets a new guest join by landing on a name on the reel, and claims it", async () => {
        const user = userEvent.setup();
        renderRoom();
        expect(screen.getByText(/the awards name who rated most alike/)).toBeInTheDocument();
        expect(screen.queryByLabelText("Your name at the party")).not.toBeInTheDocument();
        // Nothing is picked until the reel has landed.
        expect(screen.getByRole("button", { name: "Join the party" })).toBeDisabled();
        await user.click(screen.getByRole("button", { name: "Next name" }));
        await user.click(screen.getByRole("button", { name: "Join the party" }));
        expect(screen.getByText(`Party ABBA · you're ${PARTY_NAMES[0]}`)).toBeInTheDocument();
        expect(readPartyIdentity("ABBA")).toMatchObject({ name: PARTY_NAMES[0], isHost: false });
        // The name is claimed, with the empty ballot, before the guest is in.
        expect(mocks.joinParty).toHaveBeenCalledWith("ABBA", readPartyIdentity("ABBA")!.guestId, PARTY_NAMES[0]);
    });

    it("asks for another spin when someone claimed the name first, and keeps it off the reel", async () => {
        const user = userEvent.setup();
        mocks.joinParty.mockResolvedValueOnce(false);
        renderRoom();
        await user.click(screen.getByRole("button", { name: "Next name" }));
        await user.click(screen.getByRole("button", { name: "Join the party" }));
        expect(await screen.findByText(`${PARTY_NAMES[0]} was just taken. Spin again.`)).toHaveAttribute("role", "status");
        expect(readPartyIdentity("ABBA")).toBeNull();
        expect(screen.getByRole("button", { name: "Join the party" })).toBeDisabled();
        await user.click(screen.getByRole("button", { name: "Next name" }));
        expect(screen.queryByText(/was just taken/)).not.toBeInTheDocument();
        // The refused name stays off the reel, even before its ballot arrives.
        expect(screen.getByRole("spinbutton")).toHaveAttribute("aria-valuemax", String(PARTY_NAMES.length - 1));
        await user.click(screen.getByRole("button", { name: "Join the party" }));
        const second = mocks.joinParty.mock.calls[1][2];
        expect(second).not.toBe(PARTY_NAMES[0]);
        expect(readPartyIdentity("ABBA")).toMatchObject({ name: second });
    });

    it("says so when the join can't reach the party, and lets the guest press Join again", async () => {
        const user = userEvent.setup();
        vi.spyOn(console, "error").mockImplementation(() => {});
        mocks.joinParty.mockRejectedValueOnce(Object.assign(new Error("offline"), { code: "deadline-exceeded" }));
        const { unmount } = renderRoom();
        await user.click(screen.getByRole("button", { name: "Next name" }));
        await user.click(screen.getByRole("button", { name: "Join the party" }));
        expect(await screen.findByRole("alert")).toHaveTextContent(`You couldn't join as ${PARTY_NAMES[0]} just now.`);
        expect(readPartyIdentity("ABBA")).toBeNull();
        // The name stays locked until the join lands, also after a reload: the first try may still arrive.
        expect(screen.getByRole("spinbutton")).toHaveAttribute("aria-disabled", "true");
        unmount();
        renderRoom();
        expect(screen.getByText(`You were joining as ${PARTY_NAMES[0]}. Press Join to finish.`)).toHaveAttribute("role", "status");
        await user.click(screen.getByRole("button", { name: "Join the party" }));
        expect(readPartyIdentity("ABBA")).toMatchObject({ name: PARTY_NAMES[0] });
        // The retry uses the same guest id, so it finds a claim the first try made.
        expect(mocks.joinParty.mock.calls[1][1]).toBe(mocks.joinParty.mock.calls[0][1]);
        expect(readPartyIdentity("ABBA")!.guestId).toBe(mocks.joinParty.mock.calls[0][1]);
    });

    it("frees the reel when a join is refused for a reason other than the name", async () => {
        const user = userEvent.setup();
        vi.spyOn(console, "error").mockImplementation(() => {});
        mocks.joinParty.mockRejectedValueOnce(Object.assign(new Error("denied"), { code: "permission-denied" }));
        renderRoom();
        await user.click(screen.getByRole("button", { name: "Next name" }));
        await user.click(screen.getByRole("button", { name: "Join the party" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("You couldn't join just now. Spin again or try in a moment.");
        expect(screen.getByRole("spinbutton")).not.toHaveAttribute("aria-disabled");
        expect(localStorage.getItem("escparty.party.ABBA.joining")).toBeNull();
        await user.click(screen.getByRole("button", { name: "Next name" }));
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("keeps Join off, with a note, until the taken names have arrived", async () => {
        const user = userEvent.setup();
        mocks.data = { party: makeParty(), ballots: undefined, error: null, retry: vi.fn() };
        renderRoom();
        await user.click(screen.getByRole("button", { name: "Next name" }));
        expect(screen.getByRole("button", { name: "Join the party" })).toBeDisabled();
        expect(screen.getByText("Checking which names are taken…")).toHaveAttribute("role", "status");
    });

    it("shows the error and a retry instead of the reel when the ballots can't be listened to, and keeps Join off", async () => {
        const user = userEvent.setup();
        const retry = vi.fn();
        mocks.data = { party: makeParty(), ballots: undefined, error: "The party couldn't be reached.", retry };
        renderRoom();
        expect(screen.getByRole("alert")).toHaveTextContent("The party couldn't be reached.");
        expect(screen.queryByRole("button", { name: "Next name" })).not.toBeInTheDocument();
        expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Join the party" })).toBeDisabled();
        expect(screen.queryByText("Checking which names are taken…")).not.toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Try again" }));
        expect(retry).toHaveBeenCalledOnce();
    });

    it("stops joining on a listener error even with ballots already on screen, since they may be stale", () => {
        mocks.data = { party: makeParty(), ballots: [], error: "The party couldn't be reached.", retry: vi.fn() };
        renderRoom();
        expect(screen.getByRole("alert")).toHaveTextContent("The party couldn't be reached.");
        expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Join the party" })).toBeDisabled();
    });

    it("turns the reel off too until the taken names have arrived", () => {
        mocks.data = { party: makeParty(), ballots: undefined, error: null, retry: vi.fn() };
        renderRoom();
        for (const name of ["Previous name", "Next name", "Spin for a name"]) {
            expect(screen.getByRole("button", { name })).toBeDisabled();
        }
    });

    it("lets go of a landed name that a ballots update takes, and says so", async () => {
        const user = userEvent.setup();
        mocks.data = { party: makeParty(), ballots: [], error: null, retry: vi.fn() };
        const view = renderRoom();
        await user.click(screen.getByRole("button", { name: "Next name" }));
        expect(screen.getByRole("button", { name: "Join the party" })).toBeEnabled();
        mocks.data = { ...mocks.data, ballots: [makeBallot("g9", PARTY_NAMES[0], [])] };
        view.rerender(<Routes><Route path="/party/:code" element={<PartyRoom />} /></Routes>);
        expect(screen.getByText(`${PARTY_NAMES[0]} was just taken. Spin again.`)).toHaveAttribute("role", "status");
        expect(screen.getByRole("button", { name: "Join the party" })).toBeDisabled();
        expect(screen.queryByText(`You're ${PARTY_NAMES[0]}.`)).not.toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Next name" }));
        expect(screen.getByText(`You're ${PARTY_NAMES[1]}.`)).toBeInTheDocument();
        expect(screen.queryByText(/was just taken/)).not.toBeInTheDocument();
    });

    it("shows a guest the same numbered name the lists give them", () => {
        savePartyIdentity("ABBA", { guestId: "g2", name: "Jedward", isHost: false });
        mocks.data = {
            party: makeParty(),
            ballots: [makeBallot("g1", "Jedward", []), makeBallot("g2", "Jedward", [])],
            error: null,
            retry: vi.fn(),
        };
        renderRoom();
        expect(screen.getByText("Party ABBA · you're Jedward 2")).toBeInTheDocument();
        expect(readPartyIdentity("ABBA")!.name).toBe("Jedward");
    });

    it("offers only the names nobody at the party has", async () => {
        const user = userEvent.setup();
        mocks.data = {
            party: makeParty(),
            ballots: [makeBallot("g9", PARTY_NAMES[0].toUpperCase(), []), makeBallot("g8", ` ${PARTY_NAMES[1]} `, [])],
            error: null,
            retry: vi.fn(),
        };
        renderRoom();
        await user.click(screen.getByRole("button", { name: "Next name" }));
        expect(screen.getByText(`You're ${PARTY_NAMES[2]}.`)).toBeInTheDocument();
    });

    it("tells two guests with one name apart in the room's lists", async () => {
        const user = userEvent.setup();
        savePartyIdentity("ABBA", { guestId: "g1", name: "Lordi", isHost: false });
        mocks.data = {
            party: makeParty({ results: { places: { se: 1, no: 2, fi: 3, ie: 4 } } }),
            ballots: [makeBallot("g1", "Lordi", [12, 10, 8, 6]), makeBallot("g3", "Netta", [6, 8, 10, 12]), makeBallot("g2", "Lordi", [8, 12, 6, 10])],
            error: null,
            retry: vi.fn(),
        };
        renderRoom();
        await user.click(screen.getByRole("tab", { name: "Room" }));
        const list = screen.getByRole("list", { name: "Closest to the real result" });
        expect(within(list).getByText(/Lordi$/)).toBeInTheDocument();
        expect(within(list).getByText(/Lordi 2$/)).toBeInTheDocument();
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
        // On the first act there is nothing before it: no button, not a disabled one.
        expect(screen.queryByRole("button", { name: "Previous act" })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Bonus points" })).toBeInTheDocument();

        const points = screen.getByRole("spinbutton", { name: "Points for Sweden" });
        expect(points).toHaveAttribute("aria-valuetext", "Not rated");
        expect(points).not.toHaveAttribute("aria-valuenow");
        expect(screen.getByRole("table", { name: "Your ratings for Sweden" })).toBeInTheDocument();
        points.focus();
        await user.keyboard("{End}");
        expect(points).toHaveAttribute("aria-valuenow", "12");
        expect(points).toHaveAttribute("aria-valuetext", "12 of 12");
        // Chosen is pressed in.
        expect(points).toHaveClass("is-chosen");
        expect(screen.getByRole("tab", { name: "Rate" })).toHaveAttribute("aria-selected", "true");
        expect(screen.getByRole("tab", { name: "Rate" })).toHaveClass("is-chosen");
        await user.click(screen.getByRole("button", { name: /Wind machine/ }));
        expect(screen.getByText("Your score for Sweden: 11")).toHaveAttribute("role", "status");

        await user.click(screen.getByRole("button", { name: "Next act" }));
        expect(screen.getByRole("spinbutton", { name: "Points for Norway" })).toBeInTheDocument();
        // Focus stays in the page, on the new act's header.
        expect(screen.getByText("🇳🇴 Norway")).toHaveFocus();
        expect(readPartyIdentity("ABBA")?.actId).toBe("no");
        await user.selectOptions(screen.getByLabelText("Jump to an act"), "3");
        // The last act's next step moves on to the ranking.
        expect(screen.queryByRole("button", { name: "Next act" })).not.toBeInTheDocument();
        expect(screen.getByRole("option", { name: "1. Sweden ✓" })).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Previous act" }));
        expect(screen.getByRole("spinbutton", { name: "Points for Finland" })).toBeInTheDocument();
    });

    it("scrolls to the party bonuses from the bonus points button", async () => {
        const user = userEvent.setup();
        savePartyIdentity("ABBA", guest);
        mocks.data = { party: makeParty({ bonuses: true }), ballots: [], error: null, retry: vi.fn() };
        const scroll = vi.fn();
        HTMLElement.prototype.scrollIntoView = scroll;
        renderRoom();
        await user.click(screen.getByRole("button", { name: "Bonus points" }));
        expect(scroll).toHaveBeenCalled();
        expect(screen.getByRole("heading", { name: "Party bonuses" })).toHaveFocus();
    });

    it("has no bonus points button when the party has no bonuses", () => {
        savePartyIdentity("ABBA", guest);
        renderRoom();
        expect(screen.queryByRole("button", { name: "Bonus points" })).not.toBeInTheDocument();
    });

    it("ends on See your ranking, which opens the ranking tab", async () => {
        const user = userEvent.setup();
        savePartyIdentity("ABBA", { ...guest, actId: "ie" });
        renderRoom();
        await user.click(screen.getByRole("button", { name: "See your ranking" }));
        expect(screen.getByRole("tab", { name: "Ranking" })).toHaveAttribute("aria-selected", "true");
        expect(screen.getByRole("tab", { name: "Ranking" })).toHaveFocus();
    });

    it("moves between the tabs with the arrow keys, one tab stop for the tablist", async () => {
        const user = userEvent.setup();
        savePartyIdentity("ABBA", guest);
        renderRoom();
        const rate = screen.getByRole("tab", { name: "Rate" });
        expect(rate).toHaveAttribute("tabindex", "0");
        expect(screen.getByRole("tab", { name: "Room" })).toHaveAttribute("tabindex", "-1");
        expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", rate.id);

        rate.focus();
        await user.keyboard("{ArrowRight}");
        const ranking = screen.getByRole("tab", { name: "Ranking" });
        expect(ranking).toHaveFocus();
        expect(ranking).toHaveAttribute("aria-selected", "true");
        expect(ranking).toHaveClass("is-chosen");
        expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", ranking.id);
        await user.keyboard("{ArrowLeft}{ArrowLeft}");
        expect(screen.getByRole("tab", { name: "Room" })).toHaveFocus();
    });

    it("stays on the same act when the host reorders the lineup", () => {
        savePartyIdentity("ABBA", { ...guest, actId: "fi" });
        const { unmount } = renderRoom();
        expect(screen.getByRole("spinbutton", { name: "Points for Finland" })).toBeInTheDocument();
        unmount();
        const [se, no, fi, ie] = makeParty().acts;
        mocks.data = { party: makeParty({ acts: [fi, se, no, ie] }), ballots: [], error: null, retry: vi.fn() };
        renderRoom();
        expect(screen.getByRole("spinbutton", { name: "Points for Finland" })).toBeInTheDocument();
        expect(screen.getByText("1 of 4")).toBeInTheDocument();
    });

    it("shows your ranking, and how close it came", async () => {
        const user = userEvent.setup();
        savePartyIdentity("ABBA", guest);
        renderRoom();
        await user.click(screen.getByRole("tab", { name: "Ranking" }));
        expect(screen.getByText("Rate an act and your ranking starts here.")).toBeInTheDocument();
        await user.click(screen.getByRole("tab", { name: "Rate" }));
        screen.getByRole("spinbutton", { name: "Points for Sweden" }).focus();
        await user.keyboard("{Home}{ArrowUp>5/}");
        await user.click(screen.getByRole("button", { name: "Next act" }));
        screen.getByRole("spinbutton", { name: "Points for Norway" }).focus();
        await user.keyboard("{End}");
        await user.click(screen.getByRole("tab", { name: "Ranking" }));
        const ranking = screen.getByRole("list", { name: "Your ranking" });
        expect(within(ranking).getAllByRole("listitem").map(item => item.textContent)).toEqual(["1st 🇳🇴 Norway10", "2nd 🇸🇪 Sweden5"]);

        mocks.data = { party: makeParty({ results: { places: { se: 1, no: 2 } } }), ballots: [], error: null, retry: vi.fn() };
        await user.click(screen.getByRole("tab", { name: "Rate" }));
        await user.click(screen.getByRole("tab", { name: "Ranking" }));
        expect(screen.getByRole("status")).toHaveTextContent("16 closeness points over 2 acts");
        expect(screen.getByText("Really came 1st")).toBeInTheDocument();
    });

    it("shows a semi's picks and qualifiers", async () => {
        const user = userEvent.setup();
        savePartyIdentity("ABBA", guest);
        localStorage.setItem("escparty.party.ABBA.ballot", JSON.stringify({ ratings: { se: { points: 12 }, no: { points: 3 } }, bonuses: {}, savedAt: 1 }));
        mocks.data = { party: makeParty({ kind: "semi", qualifiers: 2, results: { qualifiers: ["se"] } }), ballots: [], error: null, retry: vi.fn() };
        renderRoom();
        await user.click(screen.getByRole("tab", { name: "Ranking" }));
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
        await user.click(screen.getByRole("tab", { name: "Room" }));
        expect(screen.getByText("1 guest at the party.")).toBeInTheDocument();
        expect(screen.queryByText(/No ratings yet/)).not.toBeInTheDocument();
        expect(screen.getByText(/couldn't be reached/)).toBeInTheDocument();
        expect(screen.getAllByText("1 rating")).toHaveLength(2);
        unmount();

        mocks.data = { party: makeParty({ results: { places: { no: 1, se: 2 } } }), ballots, error: null, retry: vi.fn() };
        renderRoom();
        await user.click(screen.getByRole("tab", { name: "Room" }));
        expect(screen.getByText("2 guests at the party.")).toBeInTheDocument();
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
        await user.click(screen.getByRole("tab", { name: "Room" }));
        expect(screen.queryByText(/Lordi/)).not.toBeInTheDocument();
        expect(screen.getByRole("status")).toHaveTextContent("You're 2nd of 2 closest to the real result.");
        unmount();
        mocks.data = { ...mocks.data, ballots: [ballots[1]] };
        renderRoom();
        await user.click(screen.getByRole("tab", { name: "Room" }));
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

    describe("in a party night", () => {
        beforeEach(() => {
            mocks.data = { party: makeParty({ nightCode: "NITE" }), ballots: [], error: null, retry: vi.fn() };
        });

        it("has a way back to the night in place of leaving the party, whoever is here", async () => {
            const user = userEvent.setup();
            const { unmount } = renderRoom();
            // Before joining as well: the night is where a guest is from.
            expect(screen.queryByRole("button", { name: "Leave the party" })).not.toBeInTheDocument();
            unmount();
            savePartyIdentity("ABBA", guest);
            renderRoom();
            await user.click(screen.getByRole("button", { name: "Back to the party night" }));
            expect(screen.getByText("at /n/NITE")).toBeInTheDocument();
        });

        it("joins with the name from the night card, with no name step, and saves the ballot", async () => {
            savePartyIdentity("ABBA", guest);
            renderRoom();
            expect(screen.getByText("Party ABBA · you're Jedward")).toBeInTheDocument();
            expect(screen.queryByRole("spinbutton", { name: "Your name" })).not.toBeInTheDocument();
            await waitFor(() => expect(mocks.saveBallot).toHaveBeenCalled());
            expect(mocks.joinParty).toHaveBeenCalledWith("ABBA", "g1", "Jedward");
            expect(mocks.saveBallot).toHaveBeenCalledWith("ABBA", expect.objectContaining({ guestId: "g1", name: "Jedward" }));
        });

        it("keeps the ratings on the phone when the name turns out to be someone else's", async () => {
            vi.spyOn(console, "error").mockImplementation(() => {});
            mocks.joinParty.mockResolvedValue(false);
            savePartyIdentity("ABBA", guest);
            renderRoom();
            await waitFor(() => expect(mocks.joinParty).toHaveBeenCalled());
            expect(await screen.findByText(/^Offline: your ratings are kept on this phone/)).toBeInTheDocument();
            expect(mocks.saveBallot).not.toHaveBeenCalled();
        });
    });
});

it("says when the room has no ratings yet", async () => {
    localStorage.clear();
    savePartyIdentity("ABBA", guest);
    mocks.data = { party: makeParty(), ballots: [], error: null, retry: vi.fn() };
    renderRoom();
    await userEvent.setup().click(screen.getByRole("tab", { name: "Room" }));
    expect(screen.getByText(/No ratings yet/)).toBeInTheDocument();
    expect(screen.getByText("0 guests at the party.")).toBeInTheDocument();
});
