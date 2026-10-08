import { beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { renderWithProviders, screen, userEvent, waitFor } from "../test/test-utils";
import PartySetup from "./PartySetup";
import { CONTESTS_2027 } from "../data/contests2027";
import { PARTY_NAMES } from "../utils/partyNames";
import { readPartyIdentity } from "../utils/partySession";

const mocks = vi.hoisted(() => ({ createParty: vi.fn(), fetchContest: vi.fn() }));
vi.mock("../utils/partyFirestore", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../utils/partyFirestore")>()),
    createParty: mocks.createParty,
    fetchContest: mocks.fetchContest,
}));

const ShowLocation = () => <p>at {useLocation().pathname}</p>;
const SystemBack = () => {
    const navigate = useNavigate();
    return <button onClick={() => navigate(-1)}>System back</button>;
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

/** Answer both extras on step 3: the first radio of each pair is Yes. */
const answerExtras = async (user: User, answer: "Yes" | "No") => {
    await user.click(screen.getAllByRole("radio", { name: answer })[0]);
    await user.click(screen.getAllByRole("radio", { name: answer })[1]);
};

/** Walk steps 1 to 4 with yes to both extras and the first name, landing on the last screen. */
const reachStart = async (user: User, sheet: RegExp = /Jury/) => {
    await user.click(screen.getByRole("radio", { name: /Grand final/ }));
    await user.click(screen.getByRole("radio", { name: sheet }));
    await answerExtras(user, "Yes");
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

    it("moves on as soon as a show is tapped", async () => {
        renderSetup();
        await userEvent.setup().click(screen.getByRole("radio", { name: /Semi-final 2/ }));
        step(2);
        question("How does everyone rate?");
        for (const radio of screen.getAllByRole("radio")) expect(radio).toHaveAttribute("aria-checked", "false");
        expect(screen.getByRole("heading", { level: 2 })).toHaveFocus();
    });

    it("moves on when a premade sheet is tapped, and leaves the extras unanswered", async () => {
        const user = userEvent.setup();
        renderSetup();
        await user.click(screen.getByRole("radio", { name: /Grand final/ }));
        await user.click(screen.getByRole("radio", { name: /Jury/ }));
        step(3);
        question("Any extras?");
        for (const radio of screen.getAllByRole("radio")) expect(radio).toHaveAttribute("aria-checked", "false");
        expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    });

    it("needs both extras answered before it continues", async () => {
        const user = userEvent.setup();
        renderSetup();
        await user.click(screen.getByRole("radio", { name: /Grand final/ }));
        await user.click(screen.getByRole("radio", { name: /Jury/ }));
        const [bonusYes] = screen.getAllByRole("radio", { name: "Yes" });
        await user.click(bonusYes);
        expect(bonusYes).toHaveAttribute("aria-checked", "true");
        expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
        await user.click(screen.getAllByRole("radio", { name: "No" })[1]);
        await user.click(screen.getByRole("button", { name: "Continue" }));
        step(4);
        question("Who are you tonight?");
    });

    it("picks the name from the reel only, with no text field", async () => {
        const user = userEvent.setup();
        renderSetup();
        await user.click(screen.getByRole("radio", { name: /Grand final/ }));
        await user.click(screen.getByRole("radio", { name: /Jury/ }));
        await answerExtras(user, "Yes");
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
        expect(readPartyIdentity("ABBA")).toEqual({ guestId: party.hostId, name: PARTY_NAMES[0], isHost: true });
    });

    it("sets up a semi with our own categories, no bonuses and anonymous awards", async () => {
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
        await answerExtras(user, "No");
        await user.click(screen.getByRole("button", { name: "Continue" }));
        await user.click(screen.getByRole("button", { name: "Previous name" }));
        await user.click(screen.getByRole("button", { name: "Continue" }));
        await user.click(screen.getByRole("button", { name: "Start the party" }));

        const party = mocks.createParty.mock.calls[0][0];
        expect(party).toMatchObject({ contestId: "burgas-2027-semi-2", kind: "semi", qualifiers: 10, bonuses: false, showNames: false });
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
        await user.click(screen.getAllByRole("radio", { name: "Yes" })[0]);

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
        expect(screen.getAllByRole("radio", { name: "Yes" })[0]).toHaveAttribute("aria-checked", "true");
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
        await answerExtras(user, "Yes");
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
