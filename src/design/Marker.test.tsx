import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Marker } from "./Marker";

describe("Marker", () => {
  it.each(["correct", "wrong"] as const)("draws a silent %s glyph with its own class", (kind) => {
    const { container } = render(<Marker kind={kind} />);
    const marker = container.querySelector(".calm-marker");
    expect(marker).toHaveClass(`is-${kind}`);
    expect(marker).toHaveAttribute("data-marker", kind);
    expect(marker).toHaveAttribute("aria-hidden", "true");
    expect(marker?.querySelectorAll("path")).toHaveLength(kind === "correct" ? 1 : 2);
  });
});
