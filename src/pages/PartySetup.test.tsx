import { beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Routes, useLocation } from "react-router-dom";
import { renderWithProviders, screen, userEvent } from "../test/test-utils";
import PartySetup from "./PartySetup";
import { CONTESTS_2027 } from "../data/contests2027";
import { readPartyIdentity } from "../utils/partySession";

const mocks = vi.hoisted(() => ({ createParty: vi.fn(), fetchContest: vi.fn() }));
vi.mock("../utils/partyFirestore", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../utils/partyFirestore")>()),
    createParty: mocks.createParty,
    fetchContest: mocks.fetchContest,
}));

const ShowLocation = () => <p>at {useLocation().pathname}</p>;
const renderSetup = () =>
    renderWithProviders(
        <Routes>
            <Route path="/party/new" element={<PartySetup />} />
            <Route path="*" element={<ShowLocation />} />
        </Routes>,
        { initialEntries: ["/party/new"] },
    );

describe("PartySetup", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        vi.spyOn(console, "error").mockImplementation(() => {});
        mocks.fetchContest.mockImplementation(async (id: string) => CONTESTS_2027.find(contest => contest.id === id));
        mocks.createParty.mockResolvedValue("ABBA");
    });

    it("starts a final with the jury sheet by default, and makes you the host", async () => {
        const user = userEvent.setup();
        renderSetup();
        expect(screen.getByRole("radio", { name: /Grand final/ })).toHaveAttribute("aria-checked", "true");
        await user.clear(screen.getByLabelText("Your name at the party"));
        await user.type(screen.getByLabelText("Your name at the party"), "Martin");
        await user.click(screen.getByRole("button", { name: "Start the party" }));

        expect(screen.getByText("at /party/ABBA")).toBeInTheDocument();
        const party = mocks.createParty.mock.calls[0][0];
        expect(party).toMatchObject({ contestId: "burgas-2027-final", kind: "final", qualifiers: 0, bonuses: true, showNames: true });
        expect(party.template.id).toBe("jury");
        expect(readPartyIdentity("ABBA")).toEqual({ guestId: party.hostId, name: "Martin", isHost: true });
    });

    it("sets up a semi with our own categories, no bonuses and anonymous awards", async () => {
        const user = userEvent.setup();
        renderSetup();
        await user.click(screen.getByRole("radio", { name: /Semi-final 2/ }));
        await user.click(screen.getByRole("radio", { name: /Make our own/ }));
        await user.click(screen.getByRole("button", { name: "Start the party" }));
        expect(screen.getByRole("alert")).toHaveTextContent("Name every category.");

        await user.type(screen.getByLabelText("Category 1"), "Hair height");
        await user.selectOptions(screen.getByLabelText("Scale for category 1"), "5");
        await user.click(screen.getByRole("button", { name: "Add a category" }));
        await user.type(screen.getByLabelText("Category 2"), "Key changes");
        await user.click(screen.getByRole("button", { name: "Add a category" }));
        await user.click(screen.getByRole("button", { name: "Remove the last one" }));
        await user.click(screen.getByRole("button", { name: /Party bonuses on/ }));
        await user.click(screen.getByRole("button", { name: /Name names/ }));
        expect(screen.getByRole("button", { name: /Keep the awards anonymous/ })).toHaveAttribute("aria-pressed", "false");
        await user.click(screen.getByRole("button", { name: "Start the party" }));

        const party = mocks.createParty.mock.calls[0][0];
        expect(party).toMatchObject({ contestId: "burgas-2027-semi-2", kind: "semi", qualifiers: 10, bonuses: false, showNames: false });
        expect(party.template.categories.map((category: { label: string; max: number }) => [category.label, category.max]))
            .toEqual([["Hair height", 5], ["Key changes", 10]]);
    });

    it("needs a name", async () => {
        const user = userEvent.setup();
        renderSetup();
        await user.clear(screen.getByLabelText("Your name at the party"));
        await user.click(screen.getByRole("button", { name: "Start the party" }));
        expect(screen.getByRole("alert")).toHaveTextContent("Give yourself a name.");
        expect(mocks.createParty).not.toHaveBeenCalled();
    });

    it("says so when the party can't be created, and can try again", async () => {
        const user = userEvent.setup();
        mocks.createParty.mockRejectedValueOnce(new Error("offline"));
        renderSetup();
        await user.click(screen.getByRole("radio", { name: /Douze Points/ }));
        await user.click(screen.getByRole("button", { name: "Start the party" }));
        expect(screen.getByRole("status")).toHaveTextContent("couldn't be created");
        mocks.fetchContest.mockResolvedValueOnce(undefined);
        await user.click(screen.getByRole("button", { name: "Start the party" }));
        expect(mocks.createParty).toHaveBeenCalledTimes(1);
        await user.click(screen.getByRole("button", { name: "Start the party" }));
        expect(screen.getByText("at /party/ABBA")).toBeInTheDocument();
    });

    it("goes back", async () => {
        renderSetup();
        await userEvent.setup().click(screen.getByRole("button", { name: "Back" }));
        expect(screen.getByText("at /party")).toBeInTheDocument();
    });
});
