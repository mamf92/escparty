import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChoiceCard, ChoiceGrid } from "./ChoiceCard";

describe("ChoiceCard", () => {
  it("shows title, meta and sub, and passes role props through", async () => {
    const onClick = vi.fn();
    render(<ChoiceCard role="radio" aria-checked={false} title="Quick Fire" meta="Easy · 10 questions" sub="Ten easy ones." onClick={onClick} />);
    const card = screen.getByRole("radio", { name: /Quick Fire/ });
    expect(card).toHaveTextContent("Easy · 10 questions");
    expect(card).toHaveTextContent("Ten easy ones.");
    await userEvent.setup().click(card);
    expect(onClick).toHaveBeenCalled();
  });

  it("is chosen when asked and can be disabled", () => {
    render(<ChoiceCard role="radio" aria-checked title="A" chosen disabled />);
    const card = screen.getByRole("radio");
    expect(card).toHaveClass("is-chosen");
    expect(card).toBeDisabled();
  });
});

describe("ChoiceGrid", () => {
  it("is two columns by default, one on request, and forwards its ref", () => {
    const ref = createRef<HTMLDivElement>();
    const { rerender } = render(<ChoiceGrid ref={ref} role="radiogroup" aria-label="Pick" />);
    expect(screen.getByRole("radiogroup", { name: "Pick" })).toBe(ref.current);
    expect(ref.current).not.toHaveClass("is-single");
    rerender(<ChoiceGrid ref={ref} columns={1} role="radiogroup" aria-label="Pick" />);
    expect(ref.current).toHaveClass("is-single");
  });
});
