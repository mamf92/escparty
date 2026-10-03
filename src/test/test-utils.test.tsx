import { describe, expect, it } from "vitest";
import { useLocation } from "react-router-dom";
import { renderWithProviders, screen } from "./test-utils";
import { useDesignTheme } from "../design/useDesignTheme";

// The harness itself: a screen reads the design theme and the router, and
// both throw without their provider. If this fails, the harness is broken,
// not the screen under test.
const Probe = () => {
  const { theme } = useDesignTheme();
  const { pathname } = useLocation();
  return <p>{`${theme} at ${pathname}`}</p>;
};

describe("renderWithProviders", () => {
  it("mounts the design theme and the router around the component", () => {
    renderWithProviders(<Probe />, { initialEntries: ["/lobby"] });

    expect(screen.getByText(/^(calm|sparkle) at \/lobby$/)).toBeInTheDocument();
  });
});
