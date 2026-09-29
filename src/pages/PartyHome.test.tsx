import { beforeEach, describe, expect, it } from "vitest";
import { Route, Routes, useLocation } from "react-router-dom";
import { renderWithProviders, screen, userEvent } from "../test/test-utils";
import PartyHome from "./PartyHome";
import { savePartyIdentity } from "../utils/partySession";

const ShowLocation = () => <p>at {useLocation().pathname}</p>;
const renderHome = () =>
    renderWithProviders(
        <Routes>
            <Route path="/party" element={<PartyHome />} />
            <Route path="*" element={<ShowLocation />} />
        </Routes>,
        { initialEntries: ["/party"] },
    );

describe("PartyHome", () => {
    beforeEach(() => localStorage.clear());

    it("hosts a party", async () => {
        renderHome();
        expect(screen.queryByRole("button", { name: /Back to party/ })).not.toBeInTheDocument();
        await userEvent.setup().click(screen.getByRole("button", { name: "Host a party" }));
        expect(screen.getByText("at /party/new")).toBeInTheDocument();
    });

    it("joins with a four-letter code, tidied as it's typed", async () => {
        const user = userEvent.setup();
        renderHome();
        await user.click(screen.getByRole("button", { name: "Join to rate" }));
        expect(screen.getByRole("alert")).toHaveTextContent("four letters");
        await user.type(screen.getByLabelText("Party code"), "ab-ba");
        expect(screen.getByLabelText("Party code")).toHaveValue("ABBA");
        await user.click(screen.getByRole("button", { name: "Join to rate" }));
        expect(screen.getByText("at /party/ABBA")).toBeInTheDocument();
    });

    it("opens the big screen", async () => {
        const user = userEvent.setup();
        renderHome();
        await user.type(screen.getByLabelText("Party code"), "LORD");
        await user.click(screen.getByRole("button", { name: "Open the big screen" }));
        expect(screen.getByText("at /party/LORD/screen")).toBeInTheDocument();
    });

    it("goes back to the last party", async () => {
        savePartyIdentity("ABBA", { guestId: "g", name: "Jedward", isHost: false });
        renderHome();
        await userEvent.setup().click(screen.getByRole("button", { name: "Back to party ABBA" }));
        expect(screen.getByText("at /party/ABBA")).toBeInTheDocument();
    });

    it("goes back home", async () => {
        renderHome();
        await userEvent.setup().click(screen.getByRole("button", { name: "Back to ESCParty" }));
        expect(screen.getByText("at /")).toBeInTheDocument();
    });
});
