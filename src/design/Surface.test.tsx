import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "../test/test-utils";
import { Control, Field, Ground, Pane } from "./Surface";

describe("Surface", () => {
  it("renders ground, pane and controls with no wrappers between them", () => {
    render(
      <Ground data-testid="ground">
        <Pane as="ol" aria-label="Answers">
          <Control>One</Control>
          <Control>Two</Control>
        </Pane>
      </Ground>,
    );
    const pane = screen.getByRole("list", { name: "Answers" });
    expect(pane).toHaveClass("lycra-pane");
    expect(pane.parentElement).toHaveClass("calm-ground");
    for (const control of screen.getAllByRole("button")) expect(control.parentElement).toBe(pane);
  });

  it("maps the layout to the scale and split classes", () => {
    const { container } = render(<><Pane layout="scale" /><Pane layout="split" /></>);
    const [scale, split] = container.querySelectorAll(".lycra-pane");
    expect(scale).toHaveClass("calm-scale");
    expect(split).toHaveClass("calm-split");
  });

  it("a chosen control holds the sink and says it's pressed", () => {
    render(<><Control chosen>Picked</Control><Control chosen={false}>Not picked</Control><Control>Plain</Control></>);
    expect(screen.getByRole("button", { name: "Picked" })).toHaveClass("lycra", "is-chosen");
    expect(screen.getByRole("button", { name: "Picked" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Not picked" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Plain" })).not.toHaveAttribute("aria-pressed");
  });

  it("maps block, info and low to their classes and defaults to type=button", async () => {
    const onClick = vi.fn();
    render(<Control block info low onClick={onClick}>Row</Control>);
    const row = screen.getByRole("button", { name: "Row" });
    expect(row).toHaveClass("is-block", "is-static", "is-low");
    expect(row).toHaveAttribute("type", "button");
    await userEvent.setup().click(row);
    expect(onClick).toHaveBeenCalled();
  });

  it("a field is a sunken input", () => {
    render(<Field aria-label="Your name" />);
    expect(screen.getByRole("textbox", { name: "Your name" })).toHaveClass("lycra-field");
  });
});
