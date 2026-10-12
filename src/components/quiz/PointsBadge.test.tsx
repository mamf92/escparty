import { describe, expect, it } from "vitest";
import { renderWithProviders, screen } from "../../test/test-utils";
import { PointsBadge } from "./PointsBadge";

describe("PointsBadge", () => {
  it("reads as one sentence with the points", () => {
    renderWithProviders(<PointsBadge points={1240} />);
    expect(screen.getByText("Points so far: 1240")).toBeInTheDocument();
  });

  it("shows the label and the value, hidden from screen readers so they aren't read twice", () => {
    const { container } = renderWithProviders(<PointsBadge points={0} />);
    expect(container.querySelector(".quiz-points-label")).toHaveTextContent("Points");
    expect(container.querySelector(".quiz-points-value")).toHaveTextContent("0");
    expect(container.querySelector(".quiz-points-label")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector(".quiz-points-value")).toHaveAttribute("aria-hidden", "true");
  });
});
