import { useContext } from "react";
import { DesignThemeContext, type DesignThemeContextValue } from "./theme";

/** The active theme and a way to change it. Needs a <DesignThemeProvider>. */
export const useDesignTheme = (): DesignThemeContextValue => {
  const value = useContext(DesignThemeContext);
  if (!value) throw new Error("useDesignTheme needs a <DesignThemeProvider> above it");
  return value;
};
