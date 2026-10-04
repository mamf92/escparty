import { afterEach, describe, expect, it } from "vitest";
import { renderWithProviders, screen, userEvent } from "../test/test-utils";
import { Stage } from "./Stage";
import { ThemeSwitch } from "./ThemeSwitch";

afterEach(() => localStorage.clear());

describe("Stage", () => {
  it("is decoration: hidden from assistive tech, with the ball's canvas", () => {
    const { container } = renderWithProviders(<Stage />);
    const stage = container.querySelector(".esc-stage");
    expect(stage).toHaveAttribute("aria-hidden", "true");
    expect(stage?.querySelector("canvas.esc-stage-lights")).not.toBeNull();
  });

  it("lays the sequin floor only in Sparkle", async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<><ThemeSwitch /><Stage /></>);
    expect(container.querySelector(".esc-stage-sequins")).toBeNull();
    await user.click(screen.getByRole("switch", { name: "Sparkle mode" }));
    expect(container.querySelector(".esc-stage-sequins")).not.toBeNull();
    await user.click(screen.getByRole("switch", { name: "Sparkle mode" }));
    expect(container.querySelector(".esc-stage-sequins")).toBeNull();
  });
});
