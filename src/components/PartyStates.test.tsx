import { describe, expect, it, vi } from "vitest";
import { Route, Routes, useLocation } from "react-router-dom";
import { renderWithProviders, screen, userEvent } from "../test/test-utils";
import { PartyError, PartyNotFound } from "./PartyStates";

const ShowLocation = () => <p>at {useLocation().pathname}</p>;

describe("PartyStates", () => {
    it("says there's no party with the code, and offers another go", async () => {
        renderWithProviders(
            <Routes>
                <Route path="/party/:code" element={<PartyNotFound code="ABBA" />} />
                <Route path="*" element={<ShowLocation />} />
            </Routes>,
            { initialEntries: ["/party/ABBA"] },
        );
        expect(screen.getByRole("alert")).toHaveTextContent("There's no party with the code ABBA. Check the code with the host.");
        await userEvent.setup().click(screen.getByRole("button", { name: "Try another code" }));
        expect(screen.getByText("at /party")).toBeInTheDocument();
    });

    it("says when a link has no code in it", () => {
        renderWithProviders(<PartyNotFound code={undefined} />);
        expect(screen.getByRole("alert")).toHaveTextContent("That link has no party code in it.");
    });

    it("says the party couldn't be reached, and tries again by reloading", async () => {
        const reload = vi.fn();
        vi.stubGlobal("location", { ...window.location, reload });
        try {
            renderWithProviders(<PartyError error="The party couldn't be reached. Check your connection." />);
            expect(screen.getByRole("alert")).toHaveTextContent("couldn't be reached");
            await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }));
            expect(reload).toHaveBeenCalled();
        } finally {
            vi.unstubAllGlobals();
        }
    });
});
