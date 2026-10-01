import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Sparkles } from "./Sparkles";

describe("Sparkles", () => {
  it("is decoration only: hidden from assistive tech, with no text", () => {
    const { container } = render(<Sparkles />);
    const layer = container.querySelector(".esc-sparkles");
    expect(layer).toHaveAttribute("aria-hidden", "true");
    expect(layer?.textContent).toBe("");
    expect(layer?.querySelectorAll("i").length).toBeGreaterThan(0);
  });
});
