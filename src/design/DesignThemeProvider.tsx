import { useEffect, useMemo, useState, type ReactNode } from "react";
import { applyTheme, DesignThemeContext, readStoredTheme, storeTheme, type ThemeName } from "./theme";

/**
 * Holds which theme is on, remembers it, and puts it on <html> as
 * `data-theme` so tokens.css can switch every variable at once.
 */
export const DesignThemeProvider = ({ children, initialTheme }: {
  children: ReactNode;
  /** For tests and stories; the app reads the stored choice. */
  initialTheme?: ThemeName;
}) => {
  const [theme, setThemeState] = useState<ThemeName>(() => initialTheme ?? readStoredTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const value = useMemo(() => ({
    theme,
    setTheme: (next: ThemeName) => {
      storeTheme(next);
      setThemeState(next);
    },
  }), [theme]);

  return <DesignThemeContext.Provider value={value}>{children}</DesignThemeContext.Provider>;
};

export default DesignThemeProvider;
