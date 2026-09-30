import { describe, expect, it } from "vitest";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders, screen, userEvent } from "../test/test-utils";
import UnderDevelopment from "./UnderDevelopment";

describe("UnderDevelopment", () => {
  it("says the feature is coming and goes home", async () => {
    renderWithProviders(
      <Routes>
        <Route path="/quiz" element={<UnderDevelopment />} />
        <Route path="/" element={<p>home</p>} />
      </Routes>,
      { initialEntries: ["/quiz"] },
    );
    expect(screen.getByRole("heading")).toHaveTextContent("Feature Under Development");
    await userEvent.setup().click(screen.getByRole("button", { name: /Return to Home/ }));
    expect(screen.getByText("home")).toBeInTheDocument();
  });
});
