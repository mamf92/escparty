import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "./Badge";

describe("Badge", () => {
  it("shows the label small and the value large", () => {
    const { container } = render(<Badge label="Game code" value="ABBA" />);
    expect(container.querySelector(".esc-badge-label")).toHaveTextContent("Game code");
    expect(container.querySelector(".esc-badge-value")).toHaveTextContent("ABBA");
  });

  it("reads label and value together to a screen reader, hiding the visual copies", () => {
    const { container } = render(<Badge label="Points" value={478} />);
    expect(screen.getByText("Points 478")).toHaveClass("esc-badge-spoken");
    expect(container.querySelector(".esc-badge-label")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector(".esc-badge-value")).toHaveAttribute("aria-hidden", "true");
  });

  it("spells a code out when asked", () => {
    render(<Badge label="Game code" value="ABBA" spell />);
    expect(screen.getByText("Game code A B B A")).toBeInTheDocument();
  });

  it("works without a label, lets a child replace the value, and takes a class", () => {
    const { container } = render(<Badge value="12" className="mine"><b>twelve</b></Badge>);
    expect(container.querySelector(".esc-badge-label")).toBeNull();
    expect(container.querySelector(".esc-badge-value b")).toHaveTextContent("twelve");
    expect(container.firstChild).toHaveClass("esc-badge", "mine");
  });

  it("is information, not a control: no tab stop, selectable only on request", () => {
    const { container, rerender } = render(<Badge value="ABBA" />);
    expect(container.querySelector("button, a, [tabindex]")).toBeNull();
    expect(container.querySelector(".esc-badge-value")).not.toHaveClass("esc-selectable");
    rerender(<Badge value="ABBA" selectable />);
    expect(container.querySelector(".esc-badge-value")).toHaveClass("esc-selectable");
  });
});
