import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { radioGroupKeys, radioTabIndex } from "./radioGroupKeys";

const Group = ({ picked, pick }: { picked: number | null; pick: (index: number) => void }) => (
  <div role="radiogroup" aria-label="Acts">
    {["Abba", "Lordi", "Loreen"].map((name, index) => (
      <button
        key={name}
        role="radio"
        aria-checked={picked === index}
        tabIndex={radioTabIndex(index, picked)}
        onKeyDown={event => radioGroupKeys(event, index, 3, pick)}
      >
        {name}
      </button>
    ))}
  </div>
);

describe("radioGroupKeys", () => {
  it.each([
    ["ArrowDown", 0, 1],
    ["ArrowRight", 1, 2],
    ["ArrowDown", 2, 0],
    ["ArrowUp", 1, 0],
    ["ArrowLeft", 0, 2],
    ["Home", 2, 0],
    ["End", 0, 2],
  ])("%s from radio %i picks and focuses radio %i", (key, from, to) => {
    const pick = vi.fn();
    render(<Group picked={from} pick={pick} />);
    const radios = screen.getAllByRole("radio");
    radios[from].focus();
    const notPrevented = fireEvent.keyDown(radios[from], { key });
    expect(notPrevented).toBe(false);
    expect(pick).toHaveBeenCalledWith(to);
    expect(radios[to]).toHaveFocus();
  });

  it("leaves other keys alone", () => {
    const pick = vi.fn();
    render(<Group picked={0} pick={pick} />);
    const radio = screen.getAllByRole("radio")[0];
    expect(fireEvent.keyDown(radio, { key: "Enter" })).toBe(true);
    expect(fireEvent.keyDown(radio, { key: "Tab" })).toBe(true);
    expect(pick).not.toHaveBeenCalled();
  });
});

describe("radioTabIndex", () => {
  it("makes the picked radio the one tab stop", () => {
    expect([0, 1, 2].map(index => radioTabIndex(index, 1))).toEqual([-1, 0, -1]);
  });

  it("falls back to the first radio when none is picked", () => {
    expect([0, 1, 2].map(index => radioTabIndex(index, null))).toEqual([0, -1, -1]);
  });
});
