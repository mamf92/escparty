import { describe, expect, it } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRovingTabs } from "./useRovingTabs";
import { Control } from "./Surface";

const KEYS = ["one", "two", "three"] as const;
type Key = (typeof KEYS)[number];

const Tabs = ({ start = "one" }: { start?: Key }) => {
  const [chosen, setChosen] = useState<Key>(start);
  const tabs = useRovingTabs(KEYS, chosen, setChosen);
  return (
    <>
      <div role="tablist" aria-label="Numbers">
        {KEYS.map(key => (
          <Control key={key} {...tabs.tab(key)}>{key}</Control>
        ))}
      </div>
      <div {...tabs.panel}>Showing {chosen}</div>
    </>
  );
};

describe("useRovingTabs", () => {
  it("makes the chosen tab the one tab stop and labels the panel with it", () => {
    render(<Tabs />);
    const [one, two] = screen.getAllByRole("tab");
    expect(one).toHaveAttribute("aria-selected", "true");
    expect(one).toHaveAttribute("tabindex", "0");
    expect(two).toHaveAttribute("aria-selected", "false");
    expect(two).toHaveAttribute("tabindex", "-1");
    const panel = screen.getByRole("tabpanel", { name: "one" });
    expect(panel).toHaveAttribute("tabindex", "0");
    expect(one).toHaveAttribute("aria-controls", panel.id);
  });

  it("chooses on click", async () => {
    render(<Tabs />);
    await userEvent.click(screen.getByRole("tab", { name: "two" }));
    expect(screen.getByRole("tab", { name: "two" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: "two" })).toHaveTextContent("Showing two");
  });

  it("moves choice and focus with the arrow keys, wrapping, and Home and End", async () => {
    const user = userEvent.setup();
    render(<Tabs />);
    screen.getByRole("tab", { name: "one" }).focus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "three" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "three" })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "one" })).toHaveFocus();
    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "three" })).toHaveFocus();
    await user.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: "one" })).toHaveFocus();
    await user.keyboard("{Tab}");
    expect(screen.getByRole("tabpanel")).toHaveFocus();
  });

  it("leaves modified arrows to the browser", () => {
    render(<Tabs />);
    const one = screen.getByRole("tab", { name: "one" });
    for (const modifier of ["altKey", "ctrlKey", "metaKey"]) {
      const notCancelled = fireEvent.keyDown(one, { key: "ArrowRight", [modifier]: true });
      expect(notCancelled).toBe(true);
    }
    expect(one).toHaveAttribute("aria-selected", "true");
  });

  it("keeps the first tab as the tab stop when the choice isn't one of the tabs", () => {
    render(<Tabs start={"four" as Key} />);
    expect(screen.getByRole("tab", { name: "one" })).toHaveAttribute("tabindex", "0");
    // It looks chosen too, so the look never disagrees with aria-selected.
    expect(screen.getByRole("tab", { name: "one" })).toHaveClass("is-chosen");
    expect(screen.getByRole("tabpanel", { name: "one" })).toBeInTheDocument();
  });
});
