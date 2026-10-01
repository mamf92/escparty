import { createContext } from "react";

/**
 * The two themes of the one design language (docs/design/design-system.md).
 * Calm is the accessible default; Sparkle is the opt-in sequins skin.
 */
export type ThemeName = "calm" | "sparkle";

export const THEMES: readonly ThemeName[] = ["calm", "sparkle"];

/** Where the chosen theme is remembered, per browser. */
export const THEME_STORAGE_KEY = "escparty-theme";

export const isThemeName = (value: unknown): value is ThemeName =>
  typeof value === "string" && (THEMES as readonly string[]).includes(value);

/** The stored theme, or Calm when nothing (or nothing valid) is stored. */
export const readStoredTheme = (): ThemeName => {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeName(stored) ? stored : "calm";
  } catch {
    return "calm";
  }
};

export const storeTheme = (theme: ThemeName) => {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private mode or blocked storage: the choice lasts for this visit only.
  }
};

/** Puts the theme on <html>, where tokens.css reads it. */
export const applyTheme = (theme: ThemeName) => {
  document.documentElement.dataset.theme = theme;
};

export type DesignThemeContextValue = {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
};

export const DesignThemeContext = createContext<DesignThemeContextValue | null>(null);
