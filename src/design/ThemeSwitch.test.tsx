import { afterEach, describe, expect, it } from "vitest";
import { renderWithProviders, screen, userEvent } from "../test/test-utils";
import { ThemeSwitch } from "./ThemeSwitch";

afterEach(() => localStorage.clear());

describe("ThemeSwitch", () => {
  it("is a switch named Sparkle mode, off in Calm", () => {
    renderWithProviders(<ThemeSwitch />);
    expect(screen.getByRole("switch", { name: "Sparkle mode" })).toHaveAttribute("aria-checked", "false");
  });

  it("turns Sparkle on and off", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ThemeSwitch />);
    const toggle = screen.getByRole("switch", { name: "Sparkle mode" });
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(document.documentElement.dataset.theme).toBe("sparkle");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(document.documentElement.dataset.theme).toBe("calm");
  });
});
