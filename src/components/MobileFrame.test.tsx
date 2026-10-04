import { describe, expect, it } from "vitest";
import { renderWithProviders, screen } from "../test/test-utils";
import MobileFrame from "./MobileFrame";

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
    // The brand isn't a way out: mid-game screens own their exits.
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Douze points").closest(".esc-app")).not.toBeNull();
    expect(container.querySelector(".esc-stage")).toHaveAttribute("aria-hidden", "true");
  });
});
