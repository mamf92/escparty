import { describe, expect, it, vi } from "vitest";
import { Route, Routes, useLocation } from "react-router-dom";
import { renderWithProviders, screen, userEvent } from "../test/test-utils";
import { NightError, NightNotFound } from "./NightStates";

const ShowLocation = () => <p>at {useLocation().pathname}</p>;

describe("NightNotFound", () => {
    it("names the code and goes back to Join", async () => {
        renderWithProviders(
            <Routes>
                <Route path="/" element={<NightNotFound code="ABBA" />} />
                <Route path="*" element={<ShowLocation />} />
            </Routes>,
        );
        expect(screen.getByRole("alert")).toHaveTextContent("No party night with the code ABBA.");
        await userEvent.setup().click(screen.getByRole("button", { name: "Back to Join" }));
        expect(screen.getByText("at /join")).toBeInTheDocument();
    });

    it("says so when the link has no code", () => {
        renderWithProviders(<NightNotFound code={undefined} />);
        expect(screen.getByRole("alert")).toHaveTextContent("no party night code");
    });
});

describe("NightError", () => {
    it("says what happened and retries", async () => {
        const onRetry = vi.fn();
        renderWithProviders(<NightError error="Offline." onRetry={onRetry} />);
        expect(screen.getByRole("alert")).toHaveTextContent("Offline.");
        await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }));
        expect(onRetry).toHaveBeenCalledTimes(1);
    });
});
