import { beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Routes, useLocation } from "react-router-dom";
import { renderWithProviders, screen, userEvent, within } from "../test/test-utils";
import NightScreen from "./NightScreen";
import { makeNight } from "../test/nightFixtures";
import type { NightData } from "../hooks/useNightData";

const mocks = vi.hoisted(() => ({ data: {} as NightData, toDataURL: vi.fn() }));
vi.mock("../hooks/useNightData", () => ({ useNightData: () => mocks.data }));
vi.mock("qrcode", () => ({ toDataURL: mocks.toDataURL }));

const ShowLocation = () => <p>at {useLocation().pathname}</p>;
const renderScreen = (entry = "/n/abba/screen") =>
    renderWithProviders(
        <Routes>
            <Route path="/n/:code/screen" element={<NightScreen />} />
            <Route path="/n/LENA/screen" element={<ShowLocation />} />
            <Route path="/screen" element={<NightScreen />} />
            <Route path="*" element={<ShowLocation />} />
        </Routes>,
        { initialEntries: [entry] },
    );

const guests = [{ id: "host-1", name: "Loreen" }, { id: "g2", name: "Lordi" }];

describe("NightScreen", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, "error").mockImplementation(() => {});
        mocks.toDataURL.mockResolvedValue("data:image/png;base64,QR");
        mocks.data = { night: makeNight({ title: "Semi night" }), guests, error: null, retry: vi.fn() };
    });

    it("shows a QR code for the night's link, the code, the title and how many are here", async () => {
        renderScreen();
        expect(screen.getByRole("heading", { level: 1, name: "Semi night" })).toBeInTheDocument();
        expect(await screen.findByRole("img", { name: "QR code to join party night ABBA" })).toHaveAttribute("src", "data:image/png;base64,QR");
        expect(mocks.toDataURL.mock.calls[0][0]).toMatch(/#\/n\/ABBA$/);
        expect(screen.getByText("Party night code").nextSibling).toHaveTextContent("ABBA");
        expect(screen.getByText("2 guests at the party.")).toHaveAttribute("aria-live", "polite");
        // Nobody's name goes on the wall.
        expect(screen.queryByText(/Lordi|Loreen/)).not.toBeInTheDocument();
    });

    it("says nothing is on yet, or lists what is", async () => {
        const { unmount } = renderScreen();
        expect(screen.getByText(/^Nothing on yet/)).toBeInTheDocument();
        await screen.findByRole("img");
        unmount();
        mocks.data = { ...mocks.data, night: makeNight({ activities: [{ kind: "scoreboard", code: "LENA", title: "Semi-final 1" }] }) };
        renderScreen();
        expect(within(screen.getByRole("list", { name: "Now on" })).getByRole("listitem")).toHaveTextContent("ScoreboardSemi-final 1");
        await screen.findByRole("img");
    });

    it("counts one guest in the singular, and waits for the roster rather than claiming nobody came", async () => {
        mocks.data = { ...mocks.data, guests: [guests[0]] };
        const { unmount } = renderScreen();
        expect(screen.getByText("1 guest at the party.")).toBeInTheDocument();
        await screen.findByRole("img");
        unmount();
        mocks.data = { ...mocks.data, guests: undefined };
        renderScreen();
        expect(screen.queryByText(/guests? at the party/)).not.toBeInTheDocument();
        await screen.findByRole("img");
    });

    it("says the night is over, without a code to scan", () => {
        mocks.data = { ...mocks.data, night: makeNight({ closed: true }) };
        renderScreen();
        expect(screen.getByText("This party night is over.")).toBeInTheDocument();
        expect(screen.queryByText("Party night code")).not.toBeInTheDocument();
    });

    it("says the party moved, and shows the new night's screen on a tap", async () => {
        mocks.data = { ...mocks.data, night: makeNight({ closed: true, movedTo: "LENA" }) };
        renderScreen();
        expect(screen.getByText("The party moved to LENA.")).toBeInTheDocument();
        await userEvent.setup().click(screen.getByRole("button", { name: "Show LENA on this screen" }));
        expect(screen.getByText("at /n/LENA/screen")).toBeInTheDocument();
    });

    it("waits for the night, reports a failed connection with a retry", async () => {
        const retry = vi.fn();
        mocks.data = { night: undefined, guests: undefined, error: null, retry };
        const { unmount } = renderScreen();
        expect(screen.getByRole("status")).toHaveTextContent("Finding the party");
        unmount();
        mocks.data = { night: undefined, guests: undefined, error: "Couldn't be reached.", retry };
        renderScreen();
        await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }));
        expect(retry).toHaveBeenCalled();
    });

    it("says there is no such night and goes back to Join", async () => {
        mocks.data = { night: null, guests: undefined, error: null, retry: vi.fn() };
        renderScreen();
        expect(screen.getByRole("alert")).toHaveTextContent("No party night with the code ABBA");
        await userEvent.setup().click(screen.getAllByRole("button", { name: "Back to Join" })[0]);
        expect(screen.getByText("at /join")).toBeInTheDocument();
    });

    it("goes back to the phone view, or to Join without a code", async () => {
        const user = userEvent.setup();
        const { unmount } = renderScreen();
        await user.click(screen.getByRole("button", { name: "Back to my phone view" }));
        expect(screen.getByText("at /n/ABBA")).toBeInTheDocument();
        unmount();
        mocks.data = { night: undefined, guests: undefined, error: null, retry: vi.fn() };
        renderScreen("/screen");
        await user.click(screen.getByRole("button", { name: "Back to my phone view" }));
        expect(screen.getByText("at /join")).toBeInTheDocument();
        expect(mocks.toDataURL).toHaveBeenCalledTimes(1);
    });

    it("logs a QR code it couldn't draw and shows the code anyway", async () => {
        mocks.toDataURL.mockRejectedValue(new Error("no canvas"));
        renderScreen();
        await vi.waitFor(() => expect(console.error).toHaveBeenCalled());
        expect(screen.queryByRole("img")).not.toBeInTheDocument();
        expect(screen.getByText("Party night code").nextSibling).toHaveTextContent("ABBA");
    });
});
