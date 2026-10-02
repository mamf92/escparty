import { describe, expect, it } from "vitest";
import styled from "styled-components";
import { renderWithProviders, screen } from "./test-utils";
import { theme } from "../styles/theme";

// The harness itself: screens still on styled-components read
// `theme.colors.*`, which throws without the ThemeProvider. If this fails,
// the harness is broken, not the screen under test.
const Probe = styled.p`
  color: ${({ theme }) => theme.colors.white};
`;

describe("renderWithProviders", () => {
  it("resolves theme values in styled-components", () => {
    renderWithProviders(<Probe>probe</Probe>);

    expect(screen.getByText("probe")).toHaveStyle({ color: theme.colors.white });
  });
});
