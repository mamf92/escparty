import { within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders, screen } from "../test/test-utils";
import { Standings } from "./Standings";

const players = [
  { id: "a", name: "Loreen", score: 700 },
  { id: "b", name: "Lordi", score: 900 },
  { id: "c", name: "Jedward", score: 700 },
  { id: "d", name: "Alexander", score: 1 },
];

describe("Standings", () => {
  it("lists players highest first, sharing a place on a tie, as a polite live list on the surface", () => {
    renderWithProviders(<Standings players={players} label="Standings" empty="Nobody yet." />);
    const list = screen.getByRole("list", { name: "Standings" });
    expect(list.tagName).toBe("OL");
    expect(list).toHaveClass("lycra-pane");
    expect(list).toHaveAttribute("aria-live", "polite");
    expect(list.parentElement).toHaveClass("calm-ground");
    const rows = within(list).getAllByRole("listitem");
    expect(rows.map(row => row.textContent)).toEqual([
      "1. Lordi900 points", "2. Loreen700 points", "2. Jedward700 points", "4. Alexander1 point",
    ]);
    // Information rows: raised, but not controls and never chosen.
    for (const row of rows) {
      expect(row).toHaveClass("lycra", "is-static");
      expect(row).not.toHaveClass("is-chosen");
    }
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("raises the leader and the viewer's own row, marked (you)", () => {
    renderWithProviders(<Standings players={players} label="Standings" meId="d" empty="Nobody yet." />);
    const rows = screen.getAllByRole("listitem");
    expect(rows.map(row => row.classList.contains("is-high"))).toEqual([true, false, false, true]);
    expect(rows[3]).toHaveTextContent("4. Alexander (you)1 point");
  });

  it("adds a detail line under each row", () => {
    renderWithProviders(
      <Standings players={players.slice(0, 2)} label="Standings" detail={p => (p.id === "a" ? "Ready" : "On the way")} empty="Nobody yet." />,
    );
    const rows = screen.getAllByRole("listitem");
    expect(within(rows[0]).getByText("On the way")).toHaveClass("calm-sub");
    expect(within(rows[1]).getByText("Ready")).toHaveClass("calm-sub");
  });

  it("says so in a row when there's nobody to rank", () => {
    renderWithProviders(<Standings players={[]} label="Standings" empty="Nobody yet." />);
    expect(screen.getByRole("listitem")).toHaveTextContent("Nobody yet.");
  });
});
