import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { useDesignTheme } from "./useDesignTheme";

const Orphan = () => {
  useDesignTheme();
  return null;
};

describe("useDesignTheme", () => {
  it("says what's missing when used outside the provider", () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Orphan />)).toThrow(/DesignThemeProvider/);
    quiet.mockRestore();
  });
});
