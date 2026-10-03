import type { ReactElement, ReactNode } from "react";
import { MemoryRouter, type InitialEntry } from "react-router-dom";
import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import { DesignThemeProvider } from "../design/DesignThemeProvider";

/**
 * The providers every screen in this app is mounted under in `App.tsx`:
 * the design system's `DesignThemeProvider` (Calm or Sparkle) and a router
 * (so `useNavigate`/`<Link>` work).
 *
 * `MemoryRouter` stands in for the app's `HashRouter` — routes are still
 * `#/...` in the browser, but in a test the history lives in memory, so a
 * test can start on any route without touching `window.location`.
 */
const Providers = ({ children }: { children: ReactNode }) => (
  <DesignThemeProvider>{children}</DesignThemeProvider>
);

export type RenderWithProvidersOptions = Omit<RenderOptions, "wrapper"> & {
  /**
   * Initial history entries for the router, e.g. `["/lobby"]`, or a location
   * with router state: `[{ pathname: "/quiz/easy", state: { ... } }]`.
   */
  initialEntries?: InitialEntry[];
};

/**
 * `render` from React Testing Library, with the app's providers already
 * wrapped around the component under test. Prefer this over calling `render`
 * directly so a component that reaches for the theme or the router doesn't
 * have to be special-cased in every test.
 */
export const renderWithProviders = (
  ui: ReactElement,
  { initialEntries = ["/"], ...options }: RenderWithProvidersOptions = {},
): RenderResult =>
  render(ui, {
    wrapper: ({ children }) => (
      <MemoryRouter initialEntries={initialEntries}>
        <Providers>{children}</Providers>
      </MemoryRouter>
    ),
    ...options,
  });

// Re-exported so a test file only needs one import for the common case.
export { screen, waitFor, within } from "@testing-library/react";
export { default as userEvent } from "@testing-library/user-event";
