import { describe, expect, it } from "vitest";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders, screen, userEvent } from "../test/test-utils";
import { theme } from "../styles/theme";
import Home from "./Home";

// Smoke test for the test harness itself as much as for Home: it proves a
// real page renders under styled-components' ThemeProvider and a router, and
// that user-event can drive it. Keep it cheap — per-page behaviour belongs in
// that page's own test file.
describe("Home", () => {
  it("renders the title and the three entry points", () => {
    renderWithProviders(<Home />);

    expect(screen.getByRole("heading", { name: /esc party/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Multiplayer quiz" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Single-player quiz" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create quiz" })).toBeInTheDocument();
  });

  it("resolves theme values in styled-components", () => {
    renderWithProviders(<Home />);

    // A styled block that reads `theme.colors.*` throws without a
    // ThemeProvider, so this failing means the harness, not Home, is broken.
    expect(screen.getByRole("heading", { name: /esc party/i })).toHaveStyle({
      color: theme.colors.white,
    });
  });

  it("navigates to the multiplayer lobby", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/multiplayer" element={<h1>Multiplayer lobby</h1>} />
      </Routes>,
    );

    await user.click(screen.getByRole("button", { name: "Multiplayer quiz" }));

    expect(screen.getByRole("heading", { name: "Multiplayer lobby" })).toBeInTheDocument();
  });
});
