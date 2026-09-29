import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent, within } from "../test/test-utils";
import PartyHostTools from "./PartyHostTools";
import { fixtureActs, makeBallot, makeParty } from "../test/partyFixtures";
import type { Party } from "../utils/partyFirestore";

const mocks = vi.hoisted(() => ({
    setPartyResults: vi.fn(),
    setPartyRevealed: vi.fn(),
    updatePartyActs: vi.fn(),
    fetchContest: vi.fn(),
}));
vi.mock("../utils/partyFirestore", () => mocks);

const renderTools = (party: Party, ballots = [makeBallot("g", "Jedward", [1])]) =>
    renderWithProviders(<PartyHostTools party={party} ballots={ballots} />);

describe("PartyHostTools", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, "error").mockImplementation(() => {});
        for (const write of [mocks.setPartyResults, mocks.setPartyRevealed, mocks.updatePartyActs]) write.mockResolvedValue(undefined);
    });

    it("shares the party", async () => {
        const user = userEvent.setup();
        renderTools(makeParty(), []);
        expect(screen.getByText(/code ABBA\. 0 guests so far/)).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Copy the party link" }));
        expect(await navigator.clipboard.readText()).toMatch(/#\/party\/ABBA$/);
        expect(screen.getByRole("status")).toHaveTextContent("The link is copied.");

        vi.spyOn(navigator.clipboard, "writeText").mockRejectedValueOnce(new Error("denied"));
        await user.click(screen.getByRole("button", { name: "Copy the party link" }));
        expect(screen.getByRole("status")).toHaveTextContent(/Share this link: .*#\/party\/ABBA/);
    });

    it("taps in a final's result from the top, with undo and clear", async () => {
        const user = userEvent.setup();
        const { rerender } = renderTools(makeParty());
        expect(screen.getByText(/1 guest so far/)).toBeInTheDocument();
        expect(screen.getByText("The real result: tap who came 1st.")).toBeInTheDocument();
        await user.click(within(screen.getByLabelText("Who came 1st")).getByRole("button", { name: /Finland/ }));
        expect(mocks.setPartyResults).toHaveBeenLastCalledWith("ABBA", { places: { fi: 1 } });

        rerender(<PartyHostTools party={makeParty({ results: { places: { fi: 1, se: 2 } } })} ballots={[]} />);
        expect(screen.getByText("So far: 1st Finland, 2nd Sweden.")).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Undo Sweden" }));
        expect(mocks.setPartyResults).toHaveBeenLastCalledWith("ABBA", { places: { fi: 1 } });
        await user.click(screen.getByRole("button", { name: "Clear the result" }));
        expect(mocks.setPartyResults).toHaveBeenLastCalledWith("ABBA", {});

        rerender(<PartyHostTools party={makeParty({ results: { places: { fi: 1, se: 2, no: 3, ie: 4 } } })} ballots={[]} />);
        expect(screen.getByText("The real result is in.")).toBeInTheDocument();
    });

    it("ticks a semi's qualifiers, up to how many go through", async () => {
        const user = userEvent.setup();
        const { rerender } = renderTools(makeParty({ kind: "semi", qualifiers: 2 }));
        const through = () => within(screen.getByLabelText("Who goes through"));
        await user.click(through().getByRole("button", { name: /Norway/ }));
        expect(mocks.setPartyResults).toHaveBeenLastCalledWith("ABBA", { qualifiers: ["no"] });

        rerender(<PartyHostTools party={makeParty({ kind: "semi", qualifiers: 2, results: { qualifiers: ["no", "ie"] } })} ballots={[]} />);
        expect(screen.getByText(/\(2 of 2\)/)).toBeInTheDocument();
        expect(through().getByRole("button", { name: /Sweden/ })).toBeDisabled();
        expect(through().getByRole("button", { name: /Norway/ })).toHaveAttribute("aria-pressed", "true");
        await user.click(through().getByRole("button", { name: /Norway/ }));
        expect(mocks.setPartyResults).toHaveBeenLastCalledWith("ABBA", { qualifiers: ["ie"] });
    });

    it("edits the running order", async () => {
        const user = userEvent.setup();
        renderTools(makeParty());
        expect(screen.getByRole("button", { name: "Move earlier" })).toBeDisabled();
        await user.click(screen.getByRole("button", { name: "Move later" }));
        expect(mocks.updatePartyActs).toHaveBeenLastCalledWith("ABBA", [fixtureActs[1], fixtureActs[0], fixtureActs[2], fixtureActs[3]]);

        await user.selectOptions(screen.getByLabelText("Act"), "ie");
        expect(screen.getByLabelText("Artist")).toHaveValue("Jedward");
        expect(screen.getByRole("button", { name: "Move later" })).toBeDisabled();
        await user.click(screen.getByRole("button", { name: "Move earlier" }));
        expect(mocks.updatePartyActs).toHaveBeenLastCalledWith("ABBA", [fixtureActs[0], fixtureActs[1], fixtureActs[3], fixtureActs[2]]);

        await user.clear(screen.getByLabelText("Artist"));
        await user.type(screen.getByLabelText("Artist"), "John & Edward");
        await user.clear(screen.getByLabelText("Song"));
        await user.click(screen.getByRole("button", { name: "Save Ireland" }));
        expect(mocks.updatePartyActs).toHaveBeenLastCalledWith("ABBA", [
            ...fixtureActs.slice(0, 3),
            { ...fixtureActs[3], artist: "John & Edward", song: "Lipstick" },
        ]);
        expect(screen.getByRole("status")).toHaveTextContent("Saved Ireland.");
    });

    it("loads the latest lineup", async () => {
        const user = userEvent.setup();
        mocks.fetchContest.mockResolvedValueOnce({ acts: [fixtureActs[2]] }).mockResolvedValueOnce(undefined);
        renderTools(makeParty());
        await user.click(screen.getByRole("button", { name: "Load the latest lineup" }));
        expect(mocks.fetchContest).toHaveBeenCalledWith("burgas-2027-final");
        expect(mocks.updatePartyActs).toHaveBeenLastCalledWith("ABBA", [fixtureActs[2]]);
        expect(screen.getByRole("status")).toHaveTextContent("Loaded the latest lineup.");
        await user.click(screen.getByRole("button", { name: "Load the latest lineup" }));
        expect(screen.getByRole("status")).toHaveTextContent("Couldn't load the latest lineup.");
    });

    it("opens and hides the awards, ignoring taps while a write is in flight", async () => {
        const user = userEvent.setup();
        let finish = () => {};
        mocks.setPartyRevealed.mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));
        const { rerender } = renderTools(makeParty());
        await user.click(screen.getByRole("button", { name: "Open the awards for everyone" }));
        expect(screen.getByRole("button", { name: "Open the awards for everyone" })).toBeDisabled();
        finish();
        await vi.waitFor(() => expect(screen.getByRole("button", { name: "Open the awards for everyone" })).toBeEnabled());
        expect(mocks.setPartyRevealed).toHaveBeenCalledWith("ABBA", true);

        rerender(<PartyHostTools party={makeParty({ revealed: true })} ballots={[]} />);
        mocks.setPartyRevealed.mockRejectedValueOnce(new Error("offline"));
        await user.click(screen.getByRole("button", { name: "Hide the awards again" }));
        expect(screen.getByRole("status")).toHaveTextContent("Couldn't change the awards.");
    });
});
