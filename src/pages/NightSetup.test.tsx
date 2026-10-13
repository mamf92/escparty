import { beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { renderWithProviders, screen, userEvent, waitFor } from "../test/test-utils";
import NightSetup from "./NightSetup";
import { readNightIdentity } from "../utils/nightSession";

const mocks = vi.hoisted(() => ({ createNight: vi.fn() }));
vi.mock("../utils/nightsFirestore", async importOriginal => ({
    ...(await importOriginal<typeof import("../utils/nightsFirestore")>()),
    createNight: mocks.createNight,
}));

const ShowLocation = () => <p>at {useLocation().pathname}</p>;
const Back = () => {
    const navigate = useNavigate();
    return <button onClick={() => navigate(-1)}>System back</button>;
};
const renderSetup = () =>
    renderWithProviders(
        <Routes>
            <Route path="/n/new" element={<NightSetup />} />
            <Route path="*" element={<ShowLocation />} />
        </Routes>,
        { initialEntries: ["/n/new"] },
    );

const start = () => screen.getByRole("button", { name: /^(Start the party night|Starting…)$/ });
const landOnName = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole("button", { name: "Next name" }));

describe("NightSetup", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.stubGlobal("matchMedia", (query: string) => ({ matches: true, media: query, addEventListener: () => {}, removeEventListener: () => {} }));
        mocks.createNight.mockResolvedValue("ABBA");
    });

    it("is a title field, the name reel and one black button that waits for a name", () => {
        renderSetup();
        expect(screen.getByRole("heading", { level: 1, name: "Host a party night" })).toBeInTheDocument();
        expect(screen.getByLabelText("Name of the night")).toHaveValue("Party night");
        expect(screen.getByLabelText("Name of the night")).toHaveAttribute("maxlength", "60");
        expect(screen.getByRole("spinbutton", { name: "Your name" })).toBeInTheDocument();
        expect(start()).toBeDisabled();
        expect(start()).toHaveClass("is-high");
    });

    it("creates the night, remembers the host and lands on its home", async () => {
        const user = userEvent.setup();
        renderSetup();
        await user.clear(screen.getByLabelText("Name of the night"));
        await user.type(screen.getByLabelText("Name of the night"), "  Semi night ");
        await landOnName(user);
        await user.click(start());
        await waitFor(() => expect(screen.getByText("at /n/ABBA")).toBeInTheDocument());
        const [title, hostId, hostName] = mocks.createNight.mock.calls[0];
        expect(title).toBe("Semi night");
        expect(hostId).toMatch(/^[0-9a-f-]{36}$/);
        expect(hostName).toBeTruthy();
        expect(readNightIdentity("ABBA")).toEqual({ guestId: hostId, name: hostName, isHost: true });
    });

    it("replaces the setup in the history, so Back doesn't make another night", async () => {
        const user = userEvent.setup();
        renderWithProviders(
            <Routes>
                <Route path="/host" element={<p>at host</p>} />
                <Route path="/n/new" element={<NightSetup />} />
                <Route path="/n/:code" element={<Back />} />
            </Routes>,
            { initialEntries: ["/host", "/n/new"] },
        );
        await landOnName(user);
        await user.click(start());
        await user.click(await screen.findByRole("button", { name: "System back" }));
        expect(screen.getByText("at host")).toBeInTheDocument();
    });

    it("asks for a title instead of creating a night without one", async () => {
        const user = userEvent.setup();
        renderSetup();
        await landOnName(user);
        await user.clear(screen.getByLabelText("Name of the night"));
        await user.click(start());
        expect(screen.getByRole("alert")).toHaveTextContent("Give the night a name");
        expect(screen.getByLabelText("Name of the night")).toHaveAttribute("aria-invalid", "true");
        expect(mocks.createNight).not.toHaveBeenCalled();
    });

    it("says it didn't work and lets the host try again", async () => {
        mocks.createNight.mockRejectedValueOnce(new Error("offline"));
        const user = userEvent.setup();
        renderSetup();
        await landOnName(user);
        await user.click(start());
        expect(await screen.findByRole("alert")).toHaveTextContent("couldn't be started");
        expect(readNightIdentity("ABBA")).toBeNull();
        await user.click(start());
        await waitFor(() => expect(screen.getByText("at /n/ABBA")).toBeInTheDocument());
        expect(mocks.createNight).toHaveBeenCalledTimes(2);
    });

    it("makes one night however often Start is pressed", async () => {
        let finish: (code: string) => void = () => {};
        mocks.createNight.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
        const user = userEvent.setup();
        renderSetup();
        await landOnName(user);
        const button = start();
        await user.click(button);
        await user.click(button);
        expect(button).toHaveTextContent("Starting…");
        expect(mocks.createNight).toHaveBeenCalledTimes(1);
        finish("ABBA");
        await screen.findByText("at /n/ABBA");
    });

    it("goes back to hosting", async () => {
        await userEvent.setup().click((renderSetup(), screen.getByRole("button", { name: "Back to hosting" })));
        expect(screen.getByText("at /host")).toBeInTheDocument();
    });

    it("the Enter key in the title field starts the night once a name is picked", async () => {
        const user = userEvent.setup();
        renderSetup();
        await landOnName(user);
        await user.type(screen.getByLabelText("Name of the night"), "{Enter}");
        await screen.findByText("at /n/ABBA");
    });
});
