import { describe, expect, it } from "vitest";
import { renderWithProviders, screen } from "../test/test-utils";
import MobileFrame from "./MobileFrame";

describe("MobileFrame", () => {
  it("renders the page inside the phone frame", () => {
    renderWithProviders(<MobileFrame><p>Douze points</p></MobileFrame>);
    expect(screen.getByText("Douze points")).toBeInTheDocument();
  });
});
