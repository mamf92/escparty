import { beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { renderWithProviders, screen, userEvent, waitFor } from "../test/test-utils";
import PartySetup from "./PartySetup";
import { CONTESTS_2027 } from "../data/contests2027";
import { PARTY_BONUSES } from "../utils/partyModel";
import { PARTY_NAMES } from "../utils/partyNames";
import { readPartyIdentity } from "../utils/partySession";

const mocks = vi.hoisted(() => ({ createParty: vi.fn(), fetchContest: vi.fn(), saveBallot: vi.fn() }));
vi.mock("../utils/partyFirestore", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../utils/partyFirestore")>()),
    createParty: mocks.createParty,
    fetchContest: mocks.fetchContest,
    saveBallot: mocks.saveBallot,
}));

const ShowLocation = () => <p>at {useLocation().pathname}</p>;
const SystemBack = () => {
    const navigate = useNavigate();
    return (
        <>
            <button onClick={() => navigate(-1)}>System back</button>
            <button onClick={() => navigate(1)}>System forward</button>
        </>
    );
};
const renderSetup = () =>
    renderWithProviders(
        <>
        <SystemBack />
        <Routes>
            <Route path="/party/new" element={<PartySetup />} />
            <Route path="*" element={<ShowLocation />} />
        </Routes>
        </>,
        { initialEntries: ["/party", "/party/new"] },
    );

type User = ReturnType<typeof userEvent.setup>;
const step = (n: number) => expect(screen.getByText(`Step ${n} of 5`)).toBeInTheDocument();
const question = (name: string) => expect(screen.getByRole("heading", { level: 2, name })).toBeInTheDocument();

/** Switch on the wind machine on step 3. */
const windOn = (user: User) => user.click(screen.getByRole("switch", { name: /Wind machine/ }));

/** Walk steps 1 to 4 with the wind machine on and the first name, landing on the last screen. */
const reachStart = async (user: User, sheet: RegExp = /Jury/) => {
    await user.click(screen.getByRole("radio", { name: /Grand final/ }));
    await user.click(screen.getByRole("radio", { name: sheet }));
    await windOn(user);
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Next name" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
};

describe("PartySetup", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.stubGlobal("matchMedia", (query: string) => ({ matches: true, media: query, addEventListener: () => {}, removeEventListener: () => {} }));
        mocks.fetchContest.mockImplementation(async (id: string) => CONTESTS_2027.find(contest => contest.id === id));
        mocks.createParty.mockResolvedValue("ABBA");
        mocks.saveBallot.mockResolvedValue(undefined);
    });

    it("asks one big question at a time, with nothing picked", () => {
        renderSetup();
        step(1);
        question("Which show?");
        expect(screen.getAllByRole("radio")).toHaveLength(CONTESTS_2027.length);
        for (const radio of screen.getAllByRole("radio")) expect(radio).toHaveAttribute("aria-checked", "false");
        expect(screen.queryByText("How does everyone rate?")).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Start the party" })).not.toBeInTheDocument();
    });

    it("shows each show as a card: date, name without the prefix, acts and how many go through", () => {
        renderSetup();
        const cards = screen.getAllByRole("radio");
        expect(cards[0]).toHaveTextContent(/11 May/);
        expect(cards[0]).toHaveTextContent("Semi-final 1");
        expect(cards[0]).not.toHaveTextContent("Burgas 2027");
        expect(cards[0]).toHaveTextContent(/\d+ acts · \d+ go through/);
        expect(cards[cards.length - 1]).toHaveTextContent(/every act ranked/);
        for (const card of cards) expect(card).toHaveClass("esc-choice-card");
    });

    it("moves the pick with the arrow keys, one tab stop", async () => {
        renderSetup();
        const cards = screen.getAllByRole("radio");
        expect(cards.map(card => card.tabIndex)).toEqual([0, -1, -1]);
        cards[0].focus();
        await userEvent.setup().keyboard("{ArrowDown}");
        step(2);
    });

    it("shows the sheets as cards with a category count, list and blurb", async () => {
        renderSetup();
        await userEvent.setup().click(screen.getByRole("radio", { name: /Grand final/ }));
        const jury = screen.getByRole("radio", { name: /Jury/ });
        expect(jury).toHaveTextContent("5 categories");
        expect(screen.getByRole("radio", { name: /Douze/ })).toHaveTextContent("1 category");
        expect(screen.getByRole("radio", { name: /Douze/ })).toHaveTextContent("1 to 12");
        expect(screen.getByRole("radio", { name: /Make our own/ })).toHaveTextContent("Up to 6");
    });

    it("moves on as soon as a show is tapped", async () => {
        renderSetup();
        await userEvent.setup().click(screen.getByRole("radio", { name: /Semi-final 2/ }));
        step(2);
        question("How does everyone rate?");
        for (const radio of screen.getAllByRole("radio")) expect(radio).toHaveAttribute("aria-checked", "false");
        expect(screen.getByRole("heading", { level: 2 })).toHaveFocus();
    });

    it("moves on when a premade sheet is tapped, with every bonus off", async () => {
        const user = userEvent.setup();
        renderSetup();
        await user.click(screen.getByRole("radio", { name: /Grand final/ }));
        await user.click(screen.getByRole("radio", { name: /Jury/ }));
        step(3);
        question("Add bonus points?");
        expect(screen.getAllByRole("switch")).toHaveLength(PARTY_BONUSES.length + 1);
        for (const toggle of screen.getAllByRole("switch")) {
            expect(toggle).toHaveAttribute("aria-checked", "false");
            expect(toggle).toHaveTextContent("Off");
        }
        expect(screen.getByRole("switch", { name: /Wind machine \+1/ })).toBeInTheDocument();
        expect(screen.queryByLabelText("Bonus name")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
    });

    it("flips a bonus on and off, saying so in words", async () => {
        const user = userEvent.setup();
        renderSetup();
        await user.click(screen.getByRole("radio", { name: /Grand final/ }));
        await user.click(screen.getByRole("radio", { name: /Jury/ }));
        const wind = screen.getByRole("switch", { name: /Wind machine/ });
        await user.click(wind);
        expect(wind).toHaveAttribute("aria-checked", "true");
        expect(wind).toHaveTextContent("On");
        await user.click(wind);
        expect(wind).toHaveAttribute("aria-checked", "false");
    });

    it("continues with no bonuses at all, and starts a party without any", async () => {
        const user = userEvent.setup();
        renderSetup();
        await user.click(screen.getByRole("radio", { name: /Grand final/ }));
        await user.click(screen.getByRole("radio", { name: /Jury/ }));
        await user.click(screen.getByRole("button", { name: "Continue" }));
        step(4);
        question("Who are you tonight?");
        await user.click(screen.getByRole("button", { name: "Next name" }));
        await user.click(screen.getByRole("button", { name: "Continue" }));
        expect(screen.getByRole("list", { name: "Your party" })).toHaveTextContent("Party bonusesNone");
        await user.click(screen.getByRole("button", { name: "Start the party" }));
        const party = mocks.createParty.mock.calls[0][0];
        expect(party.bonuses).toBe(false);
        expect(party.template).not.toHaveProperty("bonuses");
    });

    it("asks for a name and 1 to 5 points when the host's own bonus is on", async () => {
        const user = userEvent.setup();
        renderSetup();
        await user.click(screen.getByRole("radio", { name: /Grand final/ }));
        await user.click(screen.getByRole("radio", { name: /Jury/ }));
        await user.click(screen.getByRole("switch", { name: /Add your own/ }));
        await user.click(screen.getByRole("button", { name: "Continue" }));
        step(3);
        expect(screen.getByRole("alert")).toHaveTextContent("Name your bonus.");
        expect(screen.getByRole("alert").nextElementSibling).toBe(screen.getByRole("button", { name: "Continue" }));
        expect(screen.getByLabelText("Bonus name")).toHaveAttribute("aria-invalid", "true");

        await user.type(screen.getByLabelText("Bonus name"), "  Glitter cannon ");
        await user.selectOptions(screen.getByLabelText("Points it adds"), "3");
        await windOn(user);
        await user.click(screen.getByRole("button", { name: "Continue" }));
        step(4);
        await user.click(screen.getByRole("button", { name: "Next name" }));
        await user.click(screen.getByRole("button", { name: "Continue" }));
        expect(screen.getByRole("list", { name: "Your party" })).toHaveTextContent("Wind machine +1 · Glitter cannon +3");
        await user.click(screen.getByRole("button", { name: "Start the party" }));
        const party = mocks.createParty.mock.calls[0][0];
        expect(party).toMatchObject({ bonuses: true, showNames: true });
        expect(party.template.bonuses).toEqual([
            { id: "wind", label: "Wind machine", points: 1 },
            { id: "own", label: "Glitter cannon", points: 3 },
        ]);
    });

    it("won't show the summary by going forward while the own bonus has no name", async () => {
        const user = userEvent.setup();
        renderSetup();
        await reachStart(user);
        await user.click(screen.getByRole("button", { name: "System back" }));
        await user.click(screen.getByRole("button", { name: "System back" }));
        step(3);
        await user.click(screen.getByRole("switch", { name: /Add your own/ }));
        await user.click(screen.getByRole("button", { name: "System forward" }));
        step(3);
        expect(screen.queryByRole("button", { name: "Start the party" })).not.toBeInTheDocument();
    });

    it("ignores the own bonus's fields while it's off", async () => {
        const user = userEvent.setup();
        renderSetup();
        await user.click(screen.getByRole("radio", { name: /Grand final/ }));
        await user.click(screen.getByRole("radio", { name: /Jury/ }));
        const own = screen.getByRole("switch", { name: /Add your own/ });
        await user.click(own);
        await user.type(screen.getByLabelText("Bonus name"), "Confetti");
        await user.click(own);
        await user.click(screen.getByRole("button", { name: "Continue" }));
        step(4);
    });

    it("has no question about names in the awards", async () => {
        const user = userEvent.setup();
        renderSetup();
        await reachStart(user);
        expect(screen.queryByText(/names in the awards/i)).not.toBeInTheDocument();
        expect(screen.getByText(/stay as they are, so everyone rates the same way/)).toBeInTheDocument();
    });

    it("picks the name from the reel only, with no text field", async () => {
        const user = userEvent.setup();
        renderSetup();
        await user.click(screen.getByRole("radio", { name: /Grand final/ }));
        await user.click(screen.getByRole("radio", { name: /Jury/ }));
        await user.click(screen.getByRole("button", { name: "Continue" }));
        expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
        await user.click(screen.getByRole("button", { name: "Next name" }));
        await user.click(screen.getByRole("button", { name: "Continue" }));
        step(5);
        question("Ready to start?");
    });

    it("starts a final with the jury sheet, and makes you the host", async () => {
        const user = userEvent.setup();
        renderSetup();
        await reachStart(user);
        const summary = screen.getByRole("list", { name: "Your party" });
        expect(summary).toHaveTextContent("Grand final");
        expect(summary).toHaveTextContent(PARTY_NAMES[0]);
        await user.click(screen.getByRole("button", { name: "Start the party" }));

        expect(screen.getByText("at /party/ABBA")).toBeInTheDocument();
        const party = mocks.createParty.mock.calls[0][0];
        expect(party).toMatchObject({ contestId: "burgas-2027-final", kind: "final", qualifiers: 0, bonuses: true, showNames: true });
        expect(party.template.id).toBe("jury");
        expect(party.template.bonuses).toEqual([{ id: "wind", label: "Wind machine", points: 1 }]);
        expect(readPartyIdentity("ABBA")).toEqual({ guestId: party.hostId, name: PARTY_NAMES[0], isHost: true });
        // The host's empty ballot is written by the room when it opens, not here.
        expect(mocks.saveBallot).not.toHaveBeenCalled();
    });

    it("sets up a semi with our own categories and no bonuses", async () => {
        const user = userEvent.setup();
        renderSetup();
        await user.click(screen.getByRole("radio", { name: /Semi-final 2/ }));
        await user.click(screen.getByRole("radio", { name: /Make our own/ }));
        // Our own sheet isn't the whole answer: it stays here and has a Continue.
        step(2);
        await user.click(screen.getByRole("button", { name: "Continue" }));
        step(2);
        expect(screen.getByRole("alert")).toHaveTextContent("Name every category.");
        expect(screen.getByRole("alert").nextElementSibling).toBe(screen.getByRole("button", { name: "Continue" }));
        expect(screen.getByLabelText("Category 1")).toHaveAttribute("aria-invalid", "true");
        expect(screen.getByLabelText("Category 1")).toHaveAccessibleDescription("Name every category.");

        await user.type(screen.getByLabelText("Category 1"), "Hair height");
        await user.selectOptions(screen.getByLabelText("Scale for category 1"), "5");
        await user.click(screen.getByRole("button", { name: "Add a category" }));
        await user.type(screen.getByLabelText("Category 2"), "Key changes");
        await user.click(screen.getByRole("button", { name: "Add a category" }));
        await user.click(screen.getByRole("button", { name: "Remove the last one" }));
        await user.click(screen.getByRole("button", { name: "Continue" }));
        step(3);
        await user.click(screen.getByRole("button", { name: "Continue" }));
        await user.click(screen.getByRole("button", { name: "Previous name" }));
        await user.click(screen.getByRole("button", { name: "Continue" }));
        await user.click(screen.getByRole("button", { name: "Start the party" }));

        const party = mocks.createParty.mock.calls[0][0];
        expect(party).toMatchObject({ contestId: "burgas-2027-semi-2", kind: "semi", qualifiers: 10, bonuses: false, showNames: true });
        expect(party.template.categories.map((category: { label: string; max: number }) => [category.label, category.max]))
            .toEqual([["Hair height", 5], ["Key changes", 10]]);
        expect(readPartyIdentity("ABBA")?.name).toBe(PARTY_NAMES[PARTY_NAMES.length - 1]);
    });

    it("goes back a step keeping every answer", async () => {
        const user = userEvent.setup();
        renderSetup();
        await user.click(screen.getByRole("radio", { name: /Semi-final 1/ }));
        await user.click(screen.getByRole("radio", { name: /Make our own/ }));
        await user.type(screen.getByLabelText("Category 1"), "Hair height");
        await user.click(screen.getByRole("button", { name: "Continue" }));
        await windOn(user);

        await user.click(screen.getByRole("button", { name: "Back to How does everyone rate?" }));
        step(2);
        expect(screen.getByRole("radio", { name: /Make our own/ })).toHaveAttribute("aria-checked", "true");
        expect(screen.getByLabelText("Category 1")).toHaveValue("Hair height");

        await user.click(screen.getByRole("button", { name: "Back to Which show?" }));
        step(1);
        expect(screen.getByRole("radio", { name: /Semi-final 1/ })).toHaveAttribute("aria-checked", "true");
        expect(screen.getByRole("heading", { level: 2 })).toHaveFocus();

        await user.click(screen.getByRole("radio", { name: /Semi-final 1/ }));
        await user.click(screen.getByRole("button", { name: "Continue" }));
        expect(screen.getByRole("switch", { name: /Wind machine/ })).toHaveAttribute("aria-checked", "true");
    });

    it("keeps each step in history, so the system back gesture keeps every answer", async () => {
        const user = userEvent.setup();
        renderSetup();
        await user.click(screen.getByRole("radio", { name: /Semi-final 1/ }));
        await user.click(screen.getByRole("radio", { name: /Jury/ }));
        step(3);
        await user.click(screen.getByRole("button", { name: "System back" }));
        step(2);
        expect(screen.getByRole("radio", { name: /Jury/ })).toHaveAttribute("aria-checked", "true");
        await user.click(screen.getByRole("button", { name: "System back" }));
        step(1);
        expect(screen.getByRole("radio", { name: /Semi-final 1/ })).toHaveAttribute("aria-checked", "true");
        expect(screen.queryByText(/^at /)).not.toBeInTheDocument();
    });

    it("never shows a step the answers before it haven't reached", () => {
        renderWithProviders(
            <Routes><Route path="/party/new" element={<PartySetup />} /></Routes>,
            { initialEntries: ["/party/new?step=4"] },
        );
        step(1);
    });

    it("keeps Continue off while the reel spins, so the spin isn't thrown away", async () => {
        vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {} }));
        const user = userEvent.setup();
        renderSetup();
        await user.click(screen.getByRole("radio", { name: /Grand final/ }));
        await user.click(screen.getByRole("radio", { name: /Jury/ }));
        await user.click(screen.getByRole("button", { name: "Continue" }));
        await user.click(screen.getByRole("button", { name: "Next name" }));
        expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
        await user.click(screen.getByRole("button", { name: "Spin again" }));
        expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
        await waitFor(() => expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled(), { timeout: 15000 });
    }, 20000);

    it("says so when the party can't be created, and can try again", async () => {
        const user = userEvent.setup();
        mocks.createParty.mockRejectedValueOnce(new Error("offline"));
        renderSetup();
        await reachStart(user, /Douze Points/);
        await user.click(screen.getByRole("button", { name: "Start the party" }));
        expect(screen.getByRole("alert")).toHaveTextContent("couldn't be created");
        mocks.fetchContest.mockResolvedValueOnce(undefined);
        await user.click(screen.getByRole("button", { name: "Start the party" }));
        expect(mocks.createParty).toHaveBeenCalledTimes(1);
        await user.click(screen.getByRole("button", { name: "Start the party" }));
        expect(screen.getByText("at /party/ABBA")).toBeInTheDocument();
    });

    it("goes back to the scoreboard party from the first question", async () => {
        renderSetup();
        await userEvent.setup().click(screen.getByRole("button", { name: "Back to the scoreboard party" }));
        expect(screen.getByText("at /party")).toBeInTheDocument();
    });
});
