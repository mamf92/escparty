import { beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { renderWithProviders, screen, userEvent, waitFor, within } from "../test/test-utils";
import NightHome from "./NightHome";
import { makeNight } from "../test/nightFixtures";
import type { NightData } from "../hooks/useNightData";
import { lastNightCode, readNightIdentity, readPendingNightJoin, saveNightIdentity, savePendingNightJoin } from "../utils/nightSession";

const mocks = vi.hoisted(() => ({
    data: {} as NightData,
    joinNight: vi.fn(),
    leaveNight: vi.fn(),
    fetchNightGuest: vi.fn(),
    closeNight: vi.fn(),
    createNight: vi.fn(),
    moveNight: vi.fn(),
    leaveActivities: vi.fn(),
    toDataURL: vi.fn(),
}));
vi.mock("../hooks/useNightData", () => ({ useNightData: () => mocks.data }));
// The cards follow their rooms and parties; a quiz in its lobby will do for these tests.
vi.mock("../hooks/useRoom", () => ({ useRoom: () => ({ id: "LENA", hostId: "host-1", started: false, phase: "lobby", players: [] }) }));
vi.mock("../hooks/usePartyData", () => ({ usePartyData: () => ({ party: null, ballots: undefined, error: null, retry: vi.fn() }) }));
vi.mock("../utils/nightsFirestore", () => ({
    joinNight: mocks.joinNight,
    leaveNight: mocks.leaveNight,
    fetchNightGuest: mocks.fetchNightGuest,
    closeNight: mocks.closeNight,
    createNight: mocks.createNight,
    moveNight: mocks.moveNight,
}));
vi.mock("../utils/nightActivities", async importOriginal => ({
    ...(await importOriginal<typeof import("../utils/nightActivities")>()),
    leaveNightActivities: mocks.leaveActivities,
}));
vi.mock("qrcode", () => ({ toDataURL: mocks.toDataURL }));

const ShowLocation = () => {
    const location = useLocation();
    return (
        <>
            <p>at {location.pathname}</p>
            <p data-testid="state">{JSON.stringify(location.state)}</p>
        </>
    );
};
const shownState = () => JSON.parse(screen.getByTestId("state").textContent ?? "null");
// A new element each time, so a rerender really renders (the hook is mocked, so only a parent update reaches the page).
const ui = () => (
    <Routes>
        <Route path="/n/LENA" element={<ShowLocation />} />
        <Route path="/n/NEWW" element={<ShowLocation />} />
        <Route path="/n/:code" element={<NightHome />} />
        <Route path="*" element={<ShowLocation />} />
    </Routes>
);
const renderHome = (entry = "/n/abba") => renderWithProviders(ui(), { initialEntries: [entry] });

const host = { id: "host-1", name: "Loreen" };
const me = { guestId: "g-me", name: "Lordi" };
const roster = [host, { id: "g-me", name: "Lordi" }, { id: "g-3", name: "Netta" }];
const data = (change: Partial<NightData> = {}): NightData => ({ night: makeNight(), guests: roster, error: null, retry: vi.fn(), ...change });

const joinButton = () => screen.getByRole("button", { name: /^(Join the party|Joining…)$/ });
const spin = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole("button", { name: "Next name" }));

describe("NightHome", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.stubGlobal("matchMedia", (query: string) => ({ matches: true, media: query, addEventListener: () => {}, removeEventListener: () => {} }));
        mocks.data = data();
        mocks.joinNight.mockResolvedValue(true);
        mocks.leaveNight.mockResolvedValue(undefined);
        mocks.closeNight.mockResolvedValue(undefined);
        mocks.createNight.mockResolvedValue("NEWW");
        mocks.moveNight.mockResolvedValue(undefined);
        mocks.leaveActivities.mockResolvedValue(undefined);
        mocks.fetchNightGuest.mockResolvedValue({ id: "g-me", name: "Lordi" });
        mocks.toDataURL.mockResolvedValue("data:image/png;base64,QR");
    });

    describe("before there is a night to show", () => {
        it("covers the screen with the loader while the night loads", async () => {
            mocks.data = data({ night: undefined, guests: undefined });
            renderHome();
            // The status region is mounted empty and filled afterwards, for screen readers.
            await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Finding the party…"));
        });

        it("says there is no night with the code, and goes back to Join", async () => {
            mocks.data = data({ night: null, guests: undefined });
            renderHome();
            expect(screen.getByRole("alert")).toHaveTextContent("No party night with the code ABBA");
            await userEvent.setup().click(screen.getAllByRole("button", { name: "Back to Join" })[0]);
            expect(screen.getByText("at /join")).toBeInTheDocument();
        });

        it("says the night couldn't be reached, and tries again", async () => {
            const retry = vi.fn();
            mocks.data = data({ night: undefined, guests: undefined, error: "The party night couldn't be reached.", retry });
            renderHome();
            expect(screen.getByRole("alert")).toHaveTextContent("couldn't be reached");
            await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }));
            expect(retry).toHaveBeenCalledTimes(1);
        });
    });

    describe("joining", () => {
        it("offers the reel without the names already here, and a Join that waits for a name", async () => {
            const user = userEvent.setup();
            renderHome();
            expect(screen.getByRole("heading", { level: 1, name: "Party night" })).toBeInTheDocument();
            expect(joinButton()).toBeDisabled();
            expect(joinButton()).toHaveClass("is-high");
            await spin(user);
            // Loreen, Netta and Lordi are here; the first name left on the reel is Käärijä.
            const reel = screen.getByRole("spinbutton", { name: "Your name" });
            expect(reel).toHaveAttribute("aria-valuetext", "Käärijä");
            expect(reel).toHaveAttribute("aria-valuemax", String(35 - 2));
        });

        it("joins as the landed name and shows the night, remembering this device", async () => {
            const user = userEvent.setup();
            renderHome();
            await spin(user);
            await user.click(joinButton());
            const [code, guestId, name] = mocks.joinNight.mock.calls[0];
            expect(code).toBe("ABBA");
            expect(name).toBe("Käärijä");
            expect(readNightIdentity("ABBA")).toEqual({ guestId, name: "Käärijä" });
            expect(lastNightCode()).toBe("ABBA");
            expect(readPendingNightJoin("ABBA")).toBeNull();
            expect(await screen.findByText("You're Käärijä")).toBeInTheDocument();
        });

        it("says a name was just taken, keeps it off the reel and joins with the next", async () => {
            mocks.joinNight.mockResolvedValueOnce(false);
            const user = userEvent.setup();
            renderHome();
            await spin(user);
            await user.click(joinButton());
            expect(await screen.findByText("Käärijä was just taken. Spin again.")).toBeInTheDocument();
            expect(readNightIdentity("ABBA")).toBeNull();
            expect(readPendingNightJoin("ABBA")).toBeNull();
            expect(screen.getByRole("spinbutton", { name: "Your name" })).toHaveAttribute("aria-valuetext", "No name yet");
            await spin(user);
            expect(screen.getByRole("spinbutton", { name: "Your name" })).not.toHaveAttribute("aria-valuetext", "Käärijä");
            await user.click(joinButton());
            expect(mocks.joinNight.mock.calls[1][2]).not.toBe("Käärijä");
            expect(await screen.findByText(/^You're /)).toBeInTheDocument();
        });

        it("keeps the same guest id and name when the party can't be reached, and retries with them", async () => {
            mocks.joinNight.mockRejectedValueOnce(Object.assign(new Error("slow"), { code: "deadline-exceeded" }));
            const user = userEvent.setup();
            renderHome();
            await spin(user);
            await user.click(joinButton());
            expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't reach the party, try again");
            const first = mocks.joinNight.mock.calls[0];
            expect(readPendingNightJoin("ABBA")).toEqual({ guestId: first[1], name: first[2] });
            expect(readNightIdentity("ABBA")).toBeNull();

            await user.click(joinButton());
            expect(mocks.joinNight).toHaveBeenLastCalledWith("ABBA", first[1], first[2]);
            expect(await screen.findByText(`You're ${first[2]}`)).toBeInTheDocument();
            expect(readPendingNightJoin("ABBA")).toBeNull();
        });

        it("picks up a join that was sent before a reload, with its own id and name", async () => {
            savePendingNightJoin("ABBA", { guestId: "g-late", name: "Hatari" });
            const user = userEvent.setup();
            renderHome();
            expect(screen.getByText("You were joining as Hatari. Press Join to finish.")).toBeInTheDocument();
            await user.click(joinButton());
            expect(mocks.joinNight).toHaveBeenCalledWith("ABBA", "g-late", "Hatari");
            expect(await screen.findByText("You're Hatari")).toBeInTheDocument();
        });

        it("says so when the join is refused for another reason, and lets any name be tried", async () => {
            mocks.joinNight.mockRejectedValueOnce(Object.assign(new Error("no"), { code: "permission-denied" }));
            const user = userEvent.setup();
            renderHome();
            await spin(user);
            await user.click(joinButton());
            expect(await screen.findByRole("alert")).toHaveTextContent("couldn't join just now");
            expect(readPendingNightJoin("ABBA")).toBeNull();
        });

        it("doesn't let a guest join before the taken names are known, or when the roster is unreachable", async () => {
            mocks.data = data({ guests: undefined });
            const { unmount } = renderHome();
            expect(screen.getByText("Checking which names are taken…")).toBeInTheDocument();
            expect(screen.getByRole("button", { name: "Next name" })).toBeDisabled();
            unmount();
            mocks.data = data({ error: "The party night couldn't be reached." });
            renderHome();
            expect(screen.getByRole("alert")).toHaveTextContent("couldn't be reached");
            expect(joinButton()).toBeDisabled();
        });

        it("says a closed night is over, with no way to join", () => {
            mocks.data = data({ night: makeNight({ closed: true }) });
            renderHome();
            expect(screen.getByText("This party night is over.")).toBeInTheDocument();
            expect(screen.queryByRole("button", { name: "Join the party" })).not.toBeInTheDocument();
            expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
        });

        it("sends a guest of a moved night on to the new one", async () => {
            mocks.data = data({ night: makeNight({ closed: true, movedTo: "LENA" }) });
            renderHome();
            expect(screen.getByText("The party moved to LENA.")).toBeInTheDocument();
            const button = screen.getByRole("button", { name: "Join LENA" });
            expect(button).toHaveClass("is-high");
            await userEvent.setup().click(button);
            expect(screen.getByText("at /n/LENA")).toBeInTheDocument();
        });

        it("starts clean when the same route moves from one night to the next", async () => {
            saveNightIdentity("ABBA", me);
            const Hop = () => {
                const navigate = useNavigate();
                return <button onClick={() => navigate("/n/LENA")}>Hop</button>;
            };
            const view = renderWithProviders(
                <>
                    <Hop />
                    <Routes><Route path="/n/:code" element={<NightHome />} /></Routes>
                </>,
                { initialEntries: ["/n/ABBA"] },
            );
            await screen.findByText("You're Lordi");
            mocks.data = data({ night: makeNight({ code: "LENA" }), guests: [host] });
            await userEvent.setup().click(screen.getByRole("button", { name: "Hop" }));
            // ABBA's identity is not LENA's: the same page shows LENA's join view.
            expect(await screen.findByRole("spinbutton", { name: "Your name" })).toBeInTheDocument();
            expect(screen.queryByText("You're Lordi")).not.toBeInTheDocument();
            view.unmount();
        });

        it("leads a guest of a moved night on even when this device was in it", async () => {
            saveNightIdentity("ABBA", me);
            mocks.data = data({ night: makeNight({ closed: true, movedTo: "LENA" }) });
            renderHome();
            await userEvent.setup().click(await screen.findByRole("button", { name: "Join LENA" }));
            expect(screen.getByText("at /n/LENA")).toBeInTheDocument();
        });
    });

    describe("a stored identity", () => {
        beforeEach(() => saveNightIdentity("ABBA", me));

        it("shows the night: title, code, what's on, and who's here with you and the host marked", async () => {
            renderHome();
            expect(await screen.findByRole("heading", { level: 1, name: "Party night" })).toBeInTheDocument();
            expect(screen.getByText("You're Lordi")).toBeInTheDocument();
            expect(screen.getByText("Party night code A B B A")).toBeInTheDocument();
            expect(screen.getByText("Nothing on yet. The host will start a quiz or a scoreboard soon.")).toBeInTheDocument();
            const rows = within(screen.getByRole("list", { name: "Who's here" })).getAllByRole("listitem");
            expect(rows.map(row => row.textContent)).toEqual(["Loreenhost", "Lordiyou", "Netta"]);
            // Your own row stands proud; the black button count is zero here.
            expect(rows[1]).toHaveClass("is-high");
            expect(screen.queryByRole("button", { name: "Open the TV screen" })).not.toBeInTheDocument();
        });

        it("marks you as the host when you are, and says so once in the row", async () => {
            saveNightIdentity("ABBA", { guestId: "host-1", name: "Loreen" });
            mocks.fetchNightGuest.mockResolvedValue(host);
            renderHome();
            const rows = within(await screen.findByRole("list", { name: "Who's here" })).getAllByRole("listitem");
            expect(rows[0]).toHaveTextContent("Loreenyou · host");
        });

        it("lists what's on", async () => {
            mocks.data = data({ night: makeNight({ activities: [{ kind: "quiz", code: "LENA", title: "Eurovision trivia" }] }) });
            renderHome();
            const list = await screen.findByRole("list", { name: "Now on" });
            expect(list).toHaveTextContent("QuizEurovision trivia");
            expect(within(list).getByRole("button", { name: "Join the quiz" })).toBeInTheDocument();
            expect(screen.queryByText(/Nothing on yet/)).not.toBeInTheDocument();
        });

        it("opens the QR code for the night's link, and puts focus back on close", async () => {
            const user = userEvent.setup();
            renderHome();
            const open = await screen.findByRole("button", { name: "Show QR code" });
            await user.click(open);
            expect(screen.getByRole("dialog", { name: "Scan to join" })).toBeInTheDocument();
            await waitFor(() => expect(mocks.toDataURL).toHaveBeenCalled());
            expect(mocks.toDataURL.mock.calls[0][0]).toMatch(/#\/n\/ABBA$/);
            await user.click(screen.getByRole("button", { name: "Close" }));
            expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
            await waitFor(() => expect(open).toHaveFocus());
        });

        it("says when the connection to the night fails, with a retry", async () => {
            const retry = vi.fn();
            mocks.data = data({ error: "The party night couldn't be reached.", retry });
            renderHome();
            await screen.findByText("You're Lordi");
            await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }));
            expect(retry).toHaveBeenCalled();
        });

        it("says a closed night is over, but still shows it to a guest who is in it", async () => {
            mocks.data = data({ night: makeNight({ closed: true }) });
            renderHome();
            expect(await screen.findByText("This party night is over.")).toBeInTheDocument();
            expect(screen.getByRole("list", { name: "Who's here" })).toBeInTheDocument();
        });

        it("is the join view if the roster doesn't have this guest any more", async () => {
            mocks.fetchNightGuest.mockResolvedValue(null);
            renderHome();
            expect(await screen.findByRole("spinbutton", { name: "Your name" })).toBeInTheDocument();
            expect(readNightIdentity("ABBA")).toBeNull();
            expect(lastNightCode()).toBeNull();
        });

        it("stays joined when the guest list can't be checked", async () => {
            mocks.fetchNightGuest.mockRejectedValue(new Error("offline"));
            renderHome();
            expect(await screen.findByText("You're Lordi")).toBeInTheDocument();
        });

        it("goes to the join view when the roster no longer has them after it did", async () => {
            const view = renderHome();
            await screen.findByText("You're Lordi");
            mocks.data = data({ guests: [host, roster[2]] });
            view.rerender(ui());
            expect(await screen.findByRole("spinbutton", { name: "Your name" })).toBeInTheDocument();
            expect(readNightIdentity("ABBA")).toBeNull();
        });

        it("doesn't mistake a roster that never had them yet for a removal", async () => {
            mocks.data = data({ guests: [host] });
            renderHome();
            expect(await screen.findByText("You're Lordi")).toBeInTheDocument();
        });
    });

    describe("leaving", () => {
        beforeEach(() => saveNightIdentity("ABBA", me));

        it("asks first, then frees the name, forgets the device and goes home", async () => {
            const user = userEvent.setup();
            renderHome();
            await user.click(await screen.findByRole("button", { name: "Leave the party" }));
            expect(screen.getByText("Leave the party night? Your name is freed and you'd join again as someone new.")).toBeInTheDocument();
            expect(screen.getByRole("button", { name: "Stay at the party" })).toHaveFocus();
            expect(mocks.leaveNight).not.toHaveBeenCalled();
            await user.click(screen.getByRole("button", { name: "Leave the party" }));
            expect(mocks.leaveNight).toHaveBeenCalledWith("ABBA", "g-me", "Lordi");
            expect(await screen.findByText("at /")).toBeInTheDocument();
            expect(readNightIdentity("ABBA")).toBeNull();
            expect(lastNightCode()).toBeNull();
        });

        it("stays when asked to, with focus back on Leave", async () => {
            const user = userEvent.setup();
            renderHome();
            await user.click(await screen.findByRole("button", { name: "Leave the party" }));
            await user.click(screen.getByRole("button", { name: "Stay at the party" }));
            expect(screen.queryByText(/Leave the party night\?/)).not.toBeInTheDocument();
            await waitFor(() => expect(screen.getByRole("button", { name: "Leave the party" })).toHaveFocus());
            expect(mocks.leaveNight).not.toHaveBeenCalled();
        });

        it("says it didn't work and lets the guest try again, still on the night", async () => {
            mocks.leaveNight.mockRejectedValueOnce(new Error("offline"));
            const user = userEvent.setup();
            renderHome();
            await user.click(await screen.findByRole("button", { name: "Leave the party" }));
            await user.click(screen.getByRole("button", { name: "Leave the party" }));
            expect(await screen.findByRole("alert")).toHaveTextContent("couldn't leave just now");
            expect(readNightIdentity("ABBA")).not.toBeNull();
            await user.click(screen.getByRole("button", { name: "Leave the party" }));
            expect(await screen.findByText("at /")).toBeInTheDocument();
            expect(mocks.leaveNight).toHaveBeenCalledTimes(2);
        });

        it("can't be called back once the leave is on its way", async () => {
            let finish: () => void = () => {};
            mocks.leaveNight.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
            const user = userEvent.setup();
            renderHome();
            await user.click(await screen.findByRole("button", { name: "Leave the party" }));
            await user.click(screen.getByRole("button", { name: "Leave the party" }));
            await user.click(screen.getByRole("button", { name: "Stay at the party" }));
            expect(screen.getByRole("button", { name: "Leaving…" })).toBeInTheDocument();
            finish();
            expect(await screen.findByText("at /")).toBeInTheDocument();
        });

        it("gives up waiting on a leave that never answers (offline) and says so", async () => {
            vi.useFakeTimers({ shouldAdvanceTime: true });
            mocks.leaveNight.mockImplementationOnce(() => new Promise<void>(() => {}));
            const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
            renderHome();
            await user.click(await screen.findByRole("button", { name: "Leave the party" }));
            await user.click(screen.getByRole("button", { name: "Leave the party" }));
            await vi.advanceTimersByTimeAsync(10_000);
            expect(await screen.findByRole("alert")).toHaveTextContent("couldn't leave just now");
            expect(readNightIdentity("ABBA")).not.toBeNull();
            vi.useRealTimers();
        });

        it("tidies up behind the guest in the night's activities first, with what the night lists", async () => {
            const activities = [{ kind: "scoreboard" as const, code: "LENA", title: "Semi-final 1" }];
            mocks.data = data({ night: makeNight({ activities }) });
            const order: string[] = [];
            mocks.leaveActivities.mockImplementation(async () => { order.push("activities"); });
            mocks.leaveNight.mockImplementation(async () => { order.push("night"); });
            const user = userEvent.setup();
            renderHome();
            await user.click(await screen.findByRole("button", { name: "Leave the party" }));
            await user.click(screen.getByRole("button", { name: "Leave the party" }));
            expect(await screen.findByText("at /")).toBeInTheDocument();
            expect(mocks.leaveActivities).toHaveBeenCalledWith(activities, me);
            expect(order).toEqual(["activities", "night"]);
            expect(mocks.closeNight).not.toHaveBeenCalled();
        });

        it("tells the host that the night ends for everyone, and closes it before leaving", async () => {
            saveNightIdentity("ABBA", { guestId: "host-1", name: "Loreen" });
            mocks.fetchNightGuest.mockResolvedValue(host);
            const order: string[] = [];
            mocks.closeNight.mockImplementation(async () => { order.push("close"); });
            mocks.leaveNight.mockImplementation(async () => { order.push("leave"); });
            const user = userEvent.setup();
            renderHome();
            await user.click(await screen.findByRole("button", { name: "Leave the party" }));
            expect(screen.getByText(/It ends for everyone, and you can't get the host controls back/)).toBeInTheDocument();
            await user.click(screen.getByRole("button", { name: "Leave the party" }));
            expect(await screen.findByText("at /")).toBeInTheDocument();
            expect(order).toEqual(["close", "leave"]);
        });

        it("doesn't close a night that is over already when the host leaves", async () => {
            saveNightIdentity("ABBA", { guestId: "host-1", name: "Loreen" });
            mocks.fetchNightGuest.mockResolvedValue(host);
            mocks.data = data({ night: makeNight({ closed: true }) });
            const user = userEvent.setup();
            renderHome();
            await user.click(await screen.findByRole("button", { name: "Leave the party" }));
            await user.click(screen.getByRole("button", { name: "Leave the party" }));
            expect(await screen.findByText("at /")).toBeInTheDocument();
            expect(mocks.closeNight).not.toHaveBeenCalled();
        });

        it("keeps the host on the night when closing it fails, and leaves on the retry", async () => {
            saveNightIdentity("ABBA", { guestId: "host-1", name: "Loreen" });
            mocks.fetchNightGuest.mockResolvedValue(host);
            mocks.closeNight.mockRejectedValueOnce(new Error("offline"));
            const user = userEvent.setup();
            renderHome();
            await user.click(await screen.findByRole("button", { name: "Leave the party" }));
            await user.click(screen.getByRole("button", { name: "Leave the party" }));
            expect(await screen.findByRole("alert")).toHaveTextContent("couldn't leave just now");
            expect(mocks.leaveNight).not.toHaveBeenCalled();
            await user.click(screen.getByRole("button", { name: "Leave the party" }));
            expect(await screen.findByText("at /")).toBeInTheDocument();
        });

        it("doesn't flash the join view when the roster drops the guest during the leave", async () => {
            let finish: () => void = () => {};
            mocks.leaveNight.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
            const user = userEvent.setup();
            const view = renderHome();
            await user.click(await screen.findByRole("button", { name: "Leave the party" }));
            await user.click(screen.getByRole("button", { name: "Leave the party" }));
            mocks.data = data({ guests: [host, roster[2]] });
            view.rerender(ui());
            expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
            finish();
            expect(await screen.findByText("at /")).toBeInTheDocument();
        });
    });

    describe("the host", () => {
        it("opens the TV screen in a new tab", async () => {
            saveNightIdentity("ABBA", { guestId: "host-1", name: "Loreen" });
            mocks.fetchNightGuest.mockResolvedValue(host);
            const open = vi.spyOn(window, "open").mockReturnValue(null);
            renderHome();
            await userEvent.setup().click(await screen.findByRole("button", { name: "Open the TV screen" }));
            expect(open).toHaveBeenCalledWith(expect.stringMatching(/#\/n\/ABBA\/screen$/), "_blank", "noopener");
        });

        describe("starting something", () => {
            beforeEach(() => {
                saveNightIdentity("ABBA", { guestId: "host-1", name: "Loreen" });
                mocks.fetchNightGuest.mockResolvedValue(host);
            });

            it("offers a quiz and a scoreboard, as white buttons, to the host only", async () => {
                renderHome();
                expect(await screen.findByRole("heading", { level: 2, name: "Start something" })).toBeInTheDocument();
                for (const name of ["Start a quiz", "Start a scoreboard"]) {
                    expect(screen.getByRole("button", { name })).not.toHaveClass("is-high");
                }
                expect(document.querySelectorAll(".is-high.lycra:not(.is-static)")).toHaveLength(0);
            });

            it("doesn't offer them to a guest", async () => {
                saveNightIdentity("ABBA", me);
                renderHome();
                await screen.findByText("You're Lordi");
                expect(screen.queryByRole("heading", { name: "Start something" })).not.toBeInTheDocument();
                expect(screen.queryByRole("button", { name: "Start a quiz" })).not.toBeInTheDocument();
                expect(screen.queryByRole("heading", { name: "Host" })).not.toBeInTheDocument();
            });

            it("takes the host to hosting a quiz in this night", async () => {
                renderHome();
                await userEvent.setup().click(await screen.findByRole("button", { name: "Start a quiz" }));
                expect(screen.getByText("at /multiplayer")).toBeInTheDocument();
                expect(shownState()).toEqual({ step: "host", nightCode: "ABBA" });
            });

            it("takes the host to setting up a scoreboard in this night", async () => {
                renderHome();
                await userEvent.setup().click(await screen.findByRole("button", { name: "Start a scoreboard" }));
                expect(screen.getByText("at /party/new")).toBeInTheDocument();
                expect(shownState()).toEqual({ nightCode: "ABBA" });
            });

            it("offers nothing to start or to host once the night is over", async () => {
                mocks.data = data({ night: makeNight({ closed: true }) });
                renderHome();
                await screen.findByText("This party night is over.");
                expect(screen.queryByRole("button", { name: "Start a quiz" })).not.toBeInTheDocument();
                expect(screen.queryByRole("button", { name: "End the party night" })).not.toBeInTheDocument();
            });
        });

        describe("ending the night and starting over", () => {
            beforeEach(() => {
                saveNightIdentity("ABBA", { guestId: "host-1", name: "Loreen" });
                mocks.fetchNightGuest.mockResolvedValue(host);
            });

            it("asks first, then closes the night", async () => {
                const user = userEvent.setup();
                renderHome();
                await user.click(await screen.findByRole("button", { name: "End the party night" }));
                expect(screen.getByText(/^End the party night\? Nobody can join/)).toBeInTheDocument();
                expect(screen.getByRole("button", { name: "Keep the party going" })).toHaveFocus();
                expect(mocks.closeNight).not.toHaveBeenCalled();
                await user.click(screen.getByRole("button", { name: "End the party night" }));
                expect(mocks.closeNight).toHaveBeenCalledWith("ABBA");
                await waitFor(() => expect(screen.queryByText(/^End the party night\?/)).not.toBeInTheDocument());
            });

            it("keeps the night going when asked to, with focus back on the tool", async () => {
                const user = userEvent.setup();
                renderHome();
                await user.click(await screen.findByRole("button", { name: "End the party night" }));
                await user.click(screen.getByRole("button", { name: "Keep the party going" }));
                await waitFor(() => expect(screen.getByRole("button", { name: "End the party night" })).toHaveFocus());
                expect(mocks.closeNight).not.toHaveBeenCalled();
            });

            it("says when ending failed, and can try again", async () => {
                mocks.closeNight.mockRejectedValueOnce(new Error("offline"));
                const user = userEvent.setup();
                renderHome();
                await user.click(await screen.findByRole("button", { name: "End the party night" }));
                await user.click(screen.getByRole("button", { name: "End the party night" }));
                expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't end the party night just now");
                await user.click(screen.getByRole("button", { name: "End the party night" }));
                await waitFor(() => expect(mocks.closeNight).toHaveBeenCalledTimes(2));
                await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
            });

            it("asks first, then makes a night under the same title and the host's own id and name, moves the guests and opens it", async () => {
                mocks.data = data({ night: makeNight({ title: "Semi night" }) });
                const user = userEvent.setup();
                renderHome();
                await user.click(await screen.findByRole("button", { name: "Start over with a new code" }));
                expect(screen.getByText(/^Start over with a new code\? The guests are carried on/)).toBeInTheDocument();
                expect(mocks.createNight).not.toHaveBeenCalled();
                await user.click(screen.getByRole("button", { name: "Start over" }));
                expect(mocks.createNight).toHaveBeenCalledWith("Semi night", "host-1", "Loreen");
                expect(mocks.moveNight).toHaveBeenCalledWith("ABBA", "NEWW");
                expect(readNightIdentity("NEWW")).toEqual({ guestId: "host-1", name: "Loreen" });
                expect(lastNightCode()).toBe("NEWW");
                expect(await screen.findByText("at /n/NEWW")).toBeInTheDocument();
            });

            it("carries the guests to the night it already made when moving them failed the first time", async () => {
                mocks.moveNight.mockRejectedValueOnce(new Error("offline"));
                const user = userEvent.setup();
                renderHome();
                await user.click(await screen.findByRole("button", { name: "Start over with a new code" }));
                await user.click(screen.getByRole("button", { name: "Start over" }));
                expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't start over just now");
                expect(readNightIdentity("NEWW")).toBeNull();
                await user.click(screen.getByRole("button", { name: "Start over" }));
                expect(await screen.findByText("at /n/NEWW")).toBeInTheDocument();
                expect(mocks.createNight).toHaveBeenCalledTimes(1);
                expect(mocks.moveNight).toHaveBeenCalledTimes(2);
            });

            it("shows one question at a time: leaving closes a host question, and the other way round", async () => {
                const user = userEvent.setup();
                renderHome();
                await user.click(await screen.findByRole("button", { name: "End the party night" }));
                await user.click(screen.getByRole("button", { name: "Leave the party" }));
                expect(screen.queryByText(/^End the party night\?/)).not.toBeInTheDocument();
                expect(screen.getByText(/It ends for everyone/)).toBeInTheDocument();
                await user.click(screen.getByRole("button", { name: "Stay at the party" }));
                await user.click(await screen.findByRole("button", { name: "Start over with a new code" }));
                await user.click(screen.getByRole("button", { name: "Leave the party" }));
                expect(screen.queryByText(/^Start over with a new code\?/)).not.toBeInTheDocument();
            });
        });
    });
});
