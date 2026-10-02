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
        // Clearing asks first, with the safe answer focused.
        mocks.setPartyResults.mockClear();
        await user.click(screen.getByRole("button", { name: "Clear the result" }));
        const keep = screen.getByRole("button", { name: "Keep the result" });
        expect(keep).toHaveFocus();
        expect(keep).toHaveAccessibleDescription(/^Clear the whole result\?/);
        await user.click(keep);
        expect(mocks.setPartyResults).not.toHaveBeenCalled();
        // Answering hands focus back to the button that asked.
        expect(screen.getByRole("button", { name: "Clear the result" })).toHaveFocus();
        await user.click(screen.getByRole("button", { name: "Clear the result" }));
        await user.click(screen.getByRole("button", { name: "Yes, clear it" }));
        expect(mocks.setPartyResults).toHaveBeenLastCalledWith("ABBA", {});
        expect(screen.getByRole("button", { name: "Clear the result" })).toBeInTheDocument();
        // Once the cleared result lands, carry on from who came 1st.
        rerender(<PartyHostTools party={makeParty()} ballots={[]} />);
        expect(within(screen.getByLabelText("Who came 1st")).getAllByRole("button")[0]).toHaveFocus();

        // A result emptied elsewhere while the question is open closes it.
        rerender(<PartyHostTools party={makeParty({ results: { places: { fi: 1 } } })} ballots={[]} />);
        await user.click(screen.getByRole("button", { name: "Clear the result" }));
        rerender(<PartyHostTools party={makeParty()} ballots={[]} />);
        rerender(<PartyHostTools party={makeParty({ results: { places: { fi: 1 } } })} ballots={[]} />);
        expect(screen.queryByRole("button", { name: "Keep the result" })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Clear the result" })).toBeInTheDocument();

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

    it("refills the fields from a newer lineup instead of saving old ones over it", async () => {
        const user = userEvent.setup();
        const { rerender } = renderTools(makeParty());
        expect(screen.getByLabelText("Artist")).toHaveValue("Loreen");
        const real = [{ ...fixtureActs[0], artist: "The real artist" }, ...fixtureActs.slice(1)];
        rerender(<PartyHostTools party={makeParty({ acts: real })} ballots={[]} />);
        expect(screen.getByLabelText("Artist")).toHaveValue("The real artist");
        await user.click(screen.getByRole("button", { name: "Save Sweden" }));
        expect(mocks.updatePartyActs).toHaveBeenLastCalledWith("ABBA", real);

        // The picked act left the lineup: back to the first act, with its own details.
        await user.selectOptions(screen.getByLabelText("Act"), "ie");
        rerender(<PartyHostTools party={makeParty({ acts: real.slice(0, 3) })} ballots={[]} />);
        expect(screen.getByLabelText("Act")).toHaveValue("se");
        expect(screen.getByLabelText("Artist")).toHaveValue("The real artist");
    });

    it("ignores places and qualifiers of acts that left the lineup", () => {
        const { unmount } = renderTools(makeParty({ acts: fixtureActs.slice(0, 3), results: { places: { ie: 1, fi: 2 } } }));
        expect(screen.getByText("So far: 1st Finland.")).toBeInTheDocument();
        expect(screen.getByText("The real result: tap who came 2nd.")).toBeInTheDocument();
        unmount();
        renderTools(makeParty({ kind: "semi", qualifiers: 1, acts: fixtureActs.slice(0, 3), results: { qualifiers: ["ie"] } }));
        expect(screen.getByText(/\(0 of 1\)/)).toBeInTheDocument();
        expect(within(screen.getByLabelText("Who goes through")).getByRole("button", { name: /Sweden/ })).toBeEnabled();
    });

    it("loads the latest lineup", async () => {
        const user = userEvent.setup();
        mocks.fetchContest.mockResolvedValueOnce({ acts: [fixtureActs[2]] }).mockResolvedValueOnce(undefined);
        renderTools(makeParty({ results: { places: { se: 1 } } }));
        // It replaces the running order, so it asks first.
        await user.click(screen.getByRole("button", { name: "Load the latest lineup" }));
        expect(screen.getByRole("button", { name: "Keep this lineup" })).toHaveFocus();
        expect(screen.getByRole("button", { name: "Keep this lineup" })).toHaveAccessibleDescription(/^Load the latest lineup\?/);
        await user.click(screen.getByRole("button", { name: "Keep this lineup" }));
        expect(mocks.fetchContest).not.toHaveBeenCalled();
        expect(screen.getByRole("button", { name: "Load the latest lineup" })).toHaveFocus();

        await user.click(screen.getByRole("button", { name: "Load the latest lineup" }));
        await user.click(screen.getByRole("button", { name: "Yes, load it" }));
        expect(mocks.fetchContest).toHaveBeenCalledWith("burgas-2027-final");
        expect(mocks.updatePartyActs).toHaveBeenLastCalledWith("ABBA", [fixtureActs[2]], { places: { se: 1 } });
        expect(screen.getByRole("status")).toHaveTextContent("Loaded the latest lineup.");
        await user.click(screen.getByRole("button", { name: "Load the latest lineup" }));
        await user.click(screen.getByRole("button", { name: "Yes, load it" }));
        expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load the latest lineup.");
        expect(screen.getByRole("status")).toBeEmptyDOMElement();
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
        expect(screen.getByRole("alert")).toHaveTextContent("Couldn't change the awards.");
    });
});
