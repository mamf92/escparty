import { beforeEach, describe, expect, it } from "vitest";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders, screen, userEvent, within } from "../test/test-utils";
import Scoreboard from "./Scoreboard";

const renderScoreboard = () =>
  renderWithProviders(
    <Routes>
      <Route path="/scoreboard" element={<Scoreboard />} />
      <Route path="/" element={<p>home</p>} />
    </Routes>,
    { initialEntries: ["/scoreboard"] },
  );

const rows = () => within(screen.getByRole("list")).getAllByRole("listitem");

describe("Scoreboard", () => {
  beforeEach(() => localStorage.clear());

  it("says there are no runs yet", () => {
    renderScoreboard();
    expect(screen.getByText("No runs recorded yet.")).toBeInTheDocument();
    expect(screen.getByText("No runs yet")).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("survives unreadable history", () => {
    localStorage.setItem("quizScores", "{broken");
    renderScoreboard();
    expect(screen.getByText("No runs recorded yet.")).toBeInTheDocument();
  });

  it("ranks runs by score, marks the best and worst, and re-sorts without moving the marks", async () => {
    const user = userEvent.setup();
    localStorage.setItem("quizScores", JSON.stringify([
      { score: 5, total: 10, difficulty: "medium", date: "2026-05-10T00:00:00Z" },
      { score: 9, total: 10, difficulty: "hard", date: "2026-05-01T00:00:00Z" },
      { score: 2, total: 10, difficulty: "easy", date: "2026-05-16T00:00:00Z" },
    ]));
    renderScoreboard();
    expect(screen.getByText("3 runs. Your best stands highest.")).toBeInTheDocument();
    expect(rows().map(row => row.textContent)).toEqual([
      expect.stringContaining("9 / 10"),
      expect.stringContaining("5 / 10"),
      expect.stringContaining("2 / 10"),
    ]);
    expect(rows()[0]).toHaveClass("is-high");
    expect(rows()[2]).toHaveClass("is-low");

    await user.click(screen.getByRole("tab", { name: "Date" }));
    expect(screen.getByRole("tab", { name: "Date" })).toHaveAttribute("aria-selected", "true");
    expect(rows()[0]).toHaveTextContent("2 / 10");
    expect(rows()[0]).toHaveClass("is-low");

    await user.click(screen.getByRole("tab", { name: "Difficulty" }));
    expect(rows().map(row => row.textContent?.slice(0, 6))).toEqual(["2 / 10", "9 / 10", "5 / 10"]);
  });

  it("keeps every run at rest when they all scored the same", () => {
    localStorage.setItem("quizScores", JSON.stringify([
      { score: 4, total: 8, difficulty: "easy", date: "not a date" },
    ]));
    renderScoreboard();
    expect(screen.getByText("1 run. Your best stands highest.")).toBeInTheDocument();
    expect(rows()[0]).not.toHaveClass("is-high");
    expect(rows()[0]).toHaveTextContent("Unknown date");
  });

  it("goes home", async () => {
    renderScoreboard();
    await userEvent.setup().click(screen.getByRole("button", { name: "Back to ESCParty" }));
    expect(screen.getByText("home")).toBeInTheDocument();
  });
});
