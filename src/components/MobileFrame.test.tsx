import { describe, expect, it } from "vitest";
import { Route, Routes, useLocation } from "react-router-dom";
import { renderWithProviders, screen, userEvent } from "../test/test-utils";
import MobileFrame from "./MobileFrame";

const Here = () => <p>at {useLocation().pathname}</p>;
const renderAt = (path: string) =>
  renderWithProviders(
    <MobileFrame>
      <Routes>
        <Route path="*" element={<Here />} />
      </Routes>
    </MobileFrame>,
    { initialEntries: [path] },
  );

describe("MobileFrame", () => {
  it("renders the page inside the phone frame", () => {
    renderWithProviders(<MobileFrame><p>Douze points</p></MobileFrame>);
    expect(screen.getByText("Douze points")).toBeInTheDocument();
  });

  it("has an app bar with the brand and the Sparkle mode switch, on the themed screen", () => {
    const { container } = renderWithProviders(<MobileFrame><p>Douze points</p></MobileFrame>);
    const bar = screen.getByRole("banner");
    expect(bar).toHaveTextContent("ESCParty");
    expect(screen.getByRole("switch", { name: "Sparkle mode" })).toBeInTheDocument();
    expect(screen.getByText("Douze points").closest(".esc-app")).not.toBeNull();
    expect(container.querySelector(".esc-stage")).toHaveAttribute("aria-hidden", "true");
  });

  it("makes the brand a link home that goes straight there from an ordinary screen", async () => {
    renderAt("/join");
    const brand = screen.getByRole("link", { name: "ESCParty" });
    expect(brand).toHaveAttribute("href", "/");
    await userEvent.setup().click(brand);
    expect(screen.getByText("at /")).toBeInTheDocument();
    expect(screen.queryByText(/Go back to ESCParty/)).not.toBeInTheDocument();
  });

  it.each(["/quiz/easy", "/lobby", "/mid-quiz-scoreboard", "/host-observer", "/party/ABBA"])(
    "asks before the brand leaves %s, and Stay here keeps the game",
    async (path) => {
      renderAt(path);
      const user = userEvent.setup();
      await user.click(screen.getByRole("link", { name: "ESCParty" }));
      expect(screen.getByText(/Go back to ESCParty\?/)).toBeInTheDocument();
      expect(screen.getByText(`at ${path}`)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Stay here" })).toHaveFocus();

      await user.click(screen.getByRole("button", { name: "Stay here" }));
      expect(screen.queryByText(/Go back to ESCParty\?/)).not.toBeInTheDocument();
      expect(screen.getByRole("link", { name: "ESCParty" })).toHaveFocus();
      expect(screen.getByText(`at ${path}`)).toBeInTheDocument();
    },
  );

  it("goes home once the leave is confirmed", async () => {
    renderAt("/quiz/hard");
    const user = userEvent.setup();
    await user.click(screen.getByRole("link", { name: "ESCParty" }));
    await user.click(screen.getByRole("button", { name: "Go to ESCParty" }));
    expect(screen.getByText("at /")).toBeInTheDocument();
    expect(screen.queryByText(/Go back to ESCParty\?/)).not.toBeInTheDocument();
  });

  it.each(["/party/new", "/party", "/results", "/host", "/quiz"])("does not ask on %s", async (path) => {
    renderAt(path);
    await userEvent.setup().click(screen.getByRole("link", { name: "ESCParty" }));
    expect(screen.getByText("at /")).toBeInTheDocument();
  });
});
