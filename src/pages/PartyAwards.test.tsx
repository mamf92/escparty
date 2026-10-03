import { beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Routes, useLocation } from "react-router-dom";
import { renderWithProviders, screen, userEvent, within } from "../test/test-utils";
import PartyAwards from "./PartyAwards";
import { makeBallot, makeParty } from "../test/partyFixtures";
import type { PartyData } from "../hooks/usePartyData";
import { savePartyIdentity } from "../utils/partySession";

const mocks = vi.hoisted(() => ({ data: {} as PartyData }));
vi.mock("../hooks/usePartyData", () => ({ usePartyData: () => mocks.data }));

const ShowLocation = () => <p>at {useLocation().pathname}</p>;
const renderAwards = (entry = "/party/abba/awards") =>
    renderWithProviders(
        <Routes>
            <Route path="/party/:code/awards" element={<PartyAwards />} />
            <Route path="/awards" element={<PartyAwards />} />
            <Route path="*" element={<ShowLocation />} />
        </Routes>,
        { initialEntries: [entry] },
    );

// Jedward and Lordi rate alike; Käärijä is their opposite.
const ballots = [
    makeBallot("g1", "Jedward", [12, 9, 5, 1]),
    makeBallot("g2", "Lordi", [11, 8, 6, 2]),
    makeBallot("g3", "Käärijä", [1, 4, 8, 12]),
];
const card = () => screen.getByText(/^The two of you|^The |^Easiest|^Closest|^The most/, { selector: ".calm-label" }).parentElement!;

describe("PartyAwards", () => {
    beforeEach(() => {
        localStorage.clear();
        savePartyIdentity("ABBA", { guestId: "g1", name: "Jedward", isHost: false });
        mocks.data = { party: makeParty({ revealed: true }), ballots, error: null, retry: vi.fn() };
    });

    it("waits for the party and says when there's none", () => {
        mocks.data = { party: makeParty(), ballots: undefined, error: null, retry: vi.fn() };
        const { unmount } = renderAwards();
        expect(screen.getByRole("status")).toHaveTextContent("Counting the votes");
        unmount();
        mocks.data = { party: null, ballots: undefined, error: null, retry: vi.fn() };
        const { unmount: unmountMissing } = renderAwards();
        expect(screen.getByRole("alert")).toHaveTextContent("no party with the code ABBA");
        expect(screen.getByRole("button", { name: "Try another code" })).toBeInTheDocument();
        // No party to go back to: the footer goes to the start, not the same missing code.
        expect(screen.queryByRole("button", { name: "Back to the party" })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Back to the scoreboard party" })).toBeInTheDocument();
        unmountMissing();
        mocks.data = { party: undefined, ballots: undefined, error: "The party couldn't be reached.", retry: vi.fn() };
        renderAwards();
        expect(screen.getByRole("alert")).toHaveTextContent("couldn't be reached");
        expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    });

    it("keeps guests out until the host opens them", async () => {
        mocks.data = { party: makeParty(), ballots, error: null, retry: vi.fn() };
        renderAwards();
        expect(screen.getByRole("status")).toHaveTextContent("hasn't opened the awards");
        await userEvent.setup().click(screen.getByRole("button", { name: "Back to the party" }));
        expect(screen.getByText("at /party/ABBA")).toBeInTheDocument();
    });

    it("offers a retry when the connection drops after the awards are up", async () => {
        const retry = vi.fn();
        mocks.data = { party: makeParty({ revealed: true }), ballots, error: "The party couldn't be reached. Check your connection.", retry };
        renderAwards();
        expect(screen.getByText("The Jedward Twins")).toBeInTheDocument();
        expect(screen.getByRole("alert")).toHaveTextContent("couldn't be reached");
        await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }));
        expect(retry).toHaveBeenCalled();
    });

    it("lets the host preview them", () => {
        savePartyIdentity("ABBA", { guestId: "host-1", name: "Martin", isHost: true });
        mocks.data = { party: makeParty(), ballots, error: null, retry: vi.fn() };
        renderAwards();
        expect(screen.getByText(/Only you can see these/)).toBeInTheDocument();
        expect(screen.getByText("The Jedward Twins")).toBeInTheDocument();
    });

    it("steps through the awards, naming names and telling you which are yours", async () => {
        const user = userEvent.setup();
        renderAwards();
        expect(card()).toHaveTextContent("The Jedward Twins");
        expect(card()).toHaveTextContent("Jedward & Lordi (that's you!)");
        // Paging moves no focus, so the award itself is read out.
        expect(card().closest("[aria-live]")).toHaveAttribute("aria-live", "polite");
        // Your own award stands proud: raised, not marked as a choice.
        expect(card()).toHaveClass("is-high");
        expect(card()).not.toHaveClass("is-chosen");
        expect(screen.getByRole("button", { name: "Previous award" })).toBeDisabled();
        await user.click(screen.getByRole("button", { name: "Next award" }));
        expect(card()).toHaveTextContent("Lordi & Salvador Sobral");
        await user.click(screen.getByRole("button", { name: "Previous award" }));
        expect(card()).toHaveTextContent("The Jedward Twins");
        while (!screen.getByRole("button", { name: "Next award" }).hasAttribute("disabled")) {
            await user.click(screen.getByRole("button", { name: "Next award" }));
        }
        expect(screen.queryByRole("list")).not.toBeInTheDocument();
    });

    it("keeps names out when the host chose anonymous awards", () => {
        mocks.data = { party: makeParty({ revealed: true, showNames: false }), ballots, error: null, retry: vi.fn() };
        renderAwards();
        expect(card()).toHaveTextContent("You and one other guest");
        expect(card()).not.toHaveTextContent("Lordi");
    });

    it("ends with who came closest, anonymously when names are off", async () => {
        const user = userEvent.setup();
        const results = { places: { se: 1, no: 2, fi: 3, ie: 4 } };
        mocks.data = { party: makeParty({ revealed: true, results }), ballots, error: null, retry: vi.fn() };
        const { unmount } = renderAwards();
        const pages = Number(screen.getByText(/^1 of \d+$/).textContent!.split(" of ")[1]);
        for (let page = 1; page < pages - 1; page++) await user.click(screen.getByRole("button", { name: "Next award" }));
        // The last award's Next is named for where it goes, and it's read out.
        await user.click(screen.getByRole("button", { name: "Closest to the result" }));
        expect(screen.getByRole("list", { name: "Closest to the real result" }).closest("[aria-live]")).toHaveAttribute("aria-live", "polite");
        expect(screen.getByRole("button", { name: "Next award" })).toBeDisabled();
        const board = screen.getByRole("list", { name: "Closest to the real result" });
        expect(within(board).getAllByRole("listitem")[0]).toHaveTextContent("1st Jedward48");
        unmount();

        mocks.data = { party: makeParty({ revealed: true, showNames: false, results }), ballots, error: null, retry: vi.fn() };
        renderAwards();
        for (let page = 1; page < pages - 1; page++) await user.click(screen.getByRole("button", { name: "Next award" }));
        await user.click(screen.getByRole("button", { name: "Closest to the result" }));
        const anonymous = screen.getByRole("list", { name: "Closest to the real result" });
        expect(within(anonymous).getAllByRole("listitem").map(item => item.textContent)).toEqual(["1st You48"]);
        expect(screen.getByText(/Out of 3 guests/)).toBeInTheDocument();
    });

    it("says when there isn't enough to go on", async () => {
        mocks.data = { party: makeParty({ revealed: true }), ballots: [ballots[0]], error: null, retry: vi.fn() };
        renderAwards("/awards");
        expect(screen.getByText(/^Not enough ratings for awards yet/)).toHaveClass("is-static");
        await userEvent.setup().click(screen.getByRole("button", { name: "Back to the party" }));
        expect(screen.getByText("at /party")).toBeInTheDocument();
    });
});
