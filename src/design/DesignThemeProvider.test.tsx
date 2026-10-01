import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "../test/test-utils";
import { DesignThemeProvider } from "./DesignThemeProvider";
import { THEME_STORAGE_KEY } from "./theme";
import { useDesignTheme } from "./useDesignTheme";

const Probe = () => {
  const { theme, setTheme } = useDesignTheme();
  return <button type="button" onClick={() => setTheme(theme === "calm" ? "sparkle" : "calm")}>{theme}</button>;
};

afterEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe("DesignThemeProvider", () => {
  it("lands on Calm and puts it on <html>", () => {
    render(<DesignThemeProvider><Probe /></DesignThemeProvider>);
    expect(screen.getByRole("button")).toHaveTextContent("calm");
    expect(document.documentElement.dataset.theme).toBe("calm");
  });

  it("starts from the remembered theme", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "sparkle");
    render(<DesignThemeProvider><Probe /></DesignThemeProvider>);
    expect(screen.getByRole("button")).toHaveTextContent("sparkle");
    expect(document.documentElement.dataset.theme).toBe("sparkle");
  });

  it("ignores a stored value that isn't a theme", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "disco");
    render(<DesignThemeProvider><Probe /></DesignThemeProvider>);
    expect(screen.getByRole("button")).toHaveTextContent("calm");
  });

  it("switching remembers the choice and updates <html>", async () => {
    render(<DesignThemeProvider><Probe /></DesignThemeProvider>);
    await userEvent.setup().click(screen.getByRole("button"));
    expect(screen.getByRole("button")).toHaveTextContent("sparkle");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("sparkle");
    expect(document.documentElement.dataset.theme).toBe("sparkle");
  });

  it("an explicit initial theme wins over the stored one", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "calm");
    render(<DesignThemeProvider initialTheme="sparkle"><Probe /></DesignThemeProvider>);
    expect(screen.getByRole("button")).toHaveTextContent("sparkle");
  });
});
