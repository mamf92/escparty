import { beforeEach, describe, expect, it } from "vitest";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders, screen, userEvent, within } from "../test/test-utils";
import Home from "./Home";
import { saveNightIdentity } from "../utils/nightSession";

const DESTINATIONS = [
  ["Host a party", "/host"],
  ["Join a party", "/join"],
  ["Play a quiz solo", "/select-difficulty"],
] as const;

// Also a smoke test for the harness: a real page renders under the
// providers and a router, and user-event can drive it.
describe("Home", () => {
  beforeEach(() => localStorage.clear());

  it("is the hero page: the welcome title and two ways in, on the design system", () => {
    renderWithProviders(<Home />);

    expect(screen.getByRole("heading", { level: 1, name: "Welcome to ESCParty" })).toBeInTheDocument();
    // calm-hero floats the big disco ball over the page (stage.css).
    expect(document.querySelector(".calm-page.calm-hero")).not.toBeNull();
    const group = screen.getByRole("group", { name: "Where to start" });
    expect(group).toHaveClass("lycra-pane");
    expect(group.closest(".calm-ground")).not.toBeNull();

    const buttons = within(group).getAllByRole("button");
    expect(buttons.map(button => button.textContent)).toEqual(["Host a party", "Join a party"]);
    for (const button of buttons) {
      expect(button).toHaveClass("lycra");
      // Controls are direct children of their pane, with no wrappers.
      expect(button.parentElement).toBe(group);
    }
    // Hosting is the next step: the one black button.
    expect(buttons.filter(button => button.classList.contains("is-high"))).toEqual([buttons[0]]);
    // Solo play is the quiet link, not a third button.
    expect(screen.getByRole("button", { name: "Play a quiz solo" })).toHaveClass("esc-link");
  });

  it.each(DESTINATIONS)("%s goes to %s", async (label, path) => {
    const user = userEvent.setup();
    renderWithProviders(
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path={path} element={<p>Arrived at {path}</p>} />
      </Routes>,
    );

    await user.click(screen.getByRole("button", { name: label }));

    expect(screen.getByText(`Arrived at ${path}`)).toBeInTheDocument();
  });

  it("offers a white way back to the last party night, and no second black button", async () => {
    saveNightIdentity("ABBA", { guestId: "g1", name: "Lordi", isHost: false });
    const user = userEvent.setup();
    renderWithProviders(
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/n/ABBA" element={<p>Arrived at the night</p>} />
      </Routes>,
    );
    const buttons = within(screen.getByRole("group", { name: "Where to start" })).getAllByRole("button");
    expect(buttons.map(button => button.textContent)).toEqual(["Host a party", "Join a party", "Back to your party night"]);
    expect(buttons.filter(button => button.classList.contains("is-high"))).toHaveLength(1);
    await user.click(buttons[2]);
    expect(screen.getByText("Arrived at the night")).toBeInTheDocument();
  });
});
