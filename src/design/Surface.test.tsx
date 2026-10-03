import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "../test/test-utils";
import { Control, Field, Ground, Pane, Row } from "./Surface";

describe("Surface", () => {
  it("renders ground, pane and controls with no wrappers between them", () => {
    render(
      <Ground data-testid="ground">
        <Pane aria-label="Answers" role="group">
          <Control>One</Control>
          <Control>Two</Control>
        </Pane>
      </Ground>,
    );
    const pane = screen.getByRole("group", { name: "Answers" });
    expect(pane).toHaveClass("lycra-pane");
    expect(pane.parentElement).toHaveClass("calm-ground");
    for (const control of screen.getAllByRole("button")) expect(control.parentElement).toBe(pane);
  });

  it("a list pane holds information rows as list items, not buttons", () => {
    render(
      <Pane as="ol" aria-label="Standings">
        <Row as="li" elevation="high">Norway</Row>
        <Row as="li">Sweden</Row>
        <Row as="li" elevation="low">Finland</Row>
      </Pane>,
    );
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    for (const item of items) expect(item).toHaveClass("lycra", "is-block", "is-static");
    expect(items[0]).toHaveClass("is-high");
    expect(items[2]).toHaveClass("is-low");
    expect(items[0].parentElement).toBe(screen.getByRole("list", { name: "Standings" }));
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("a row defaults to a div", () => {
    const { container } = render(<Row>Info</Row>);
    expect(container.firstElementChild?.tagName).toBe("DIV");
  });

  it("maps the layout to the scale and split classes", () => {
    const { container } = render(<><Pane layout="scale" /><Pane layout="split" /></>);
    const [scale, split] = container.querySelectorAll(".lycra-pane");
    expect(scale).toHaveClass("calm-scale");
    expect(split).toHaveClass("calm-split");
  });

  it("a chosen control is pressed in and says it's pressed", () => {
    render(<><Control chosen>Picked</Control><Control chosen={false}>Not picked</Control><Control>Plain</Control></>);
    expect(screen.getByRole("button", { name: "Picked" })).toHaveClass("lycra", "is-chosen");
    expect(screen.getByRole("button", { name: "Picked" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Not picked" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Plain" })).not.toHaveAttribute("aria-pressed");
  });

  it("a chosen control with a role states its choice its own way, not as pressed", () => {
    render(<Control role="radio" aria-checked chosen>Douze</Control>);
    const radio = screen.getByRole("radio", { name: "Douze" });
    expect(radio).toHaveClass("is-chosen");
    expect(radio).toHaveAttribute("aria-checked", "true");
    expect(radio).not.toHaveAttribute("aria-pressed");
  });

  it("a block control is a left-aligned row, type=button by default", async () => {
    const onClick = vi.fn();
    render(<Control block onClick={onClick}>Row</Control>);
    const row = screen.getByRole("button", { name: "Row" });
    expect(row).toHaveClass("lycra", "is-block");
    expect(row).toHaveAttribute("type", "button");
    await userEvent.setup().click(row);
    expect(onClick).toHaveBeenCalled();
  });

  it("a field is a sunken input", () => {
    render(<Field aria-label="Your name" />);
    expect(screen.getByRole("textbox", { name: "Your name" })).toHaveClass("lycra-field");
  });

  it("a field can be a select or a textarea, with the same class", () => {
    render(
      <>
        <Field as="select" aria-label="Category"><option>All</option></Field>
        <Field as="textarea" aria-label="Question" />
      </>,
    );
    expect(screen.getByRole("combobox", { name: "Category" })).toHaveClass("lycra-field");
    const question = screen.getByRole("textbox", { name: "Question" });
    expect(question.tagName).toBe("TEXTAREA");
    expect(question).toHaveClass("lycra-field");
  });
});
