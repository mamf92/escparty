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
      expect.stringContaining("9 points"),
      expect.stringContaining("5 points"),
      expect.stringContaining("2 points"),
    ]);
    expect(rows()[0]).toHaveClass("is-high");
    expect(rows()[2]).toHaveClass("is-low");

    await user.click(screen.getByRole("tab", { name: "Date" }));
    expect(screen.getByRole("tab", { name: "Date" })).toHaveAttribute("aria-selected", "true");
    expect(rows()[0]).toHaveTextContent("2 points");
    expect(rows()[0]).toHaveClass("is-low");

    await user.click(screen.getByRole("tab", { name: "Difficulty" }));
    // Easiest first.
    expect(rows().map(row => row.textContent?.match(/^\d+ points/)?.[0])).toEqual(["2 points", "5 points", "9 points"]);
  });

  it("ranks by the points shown, not points per question", () => {
    localStorage.setItem("quizScores", JSON.stringify([
      { score: 1200, total: 10, difficulty: "quick-fire", date: "2026-05-10T00:00:00Z" },
      { score: 1300, total: 12, difficulty: "nul-points", date: "2026-05-01T00:00:00Z" },
    ]));
    renderScoreboard();
    expect(rows()[0]).toHaveTextContent("1300 points");
    expect(rows()[0]).toHaveClass("is-high");
  });

  it("keeps every run at rest when they all scored the same", () => {
    localStorage.setItem("quizScores", JSON.stringify([
      { score: 4, total: 8, difficulty: "easy", date: "not a date" },
      { score: 4, total: 10, difficulty: "t-nordic-nights", date: "2026-05-16T00:00:00Z" },
    ]));
    renderScoreboard();
    expect(screen.getByText("2 runs. Your best stands highest.")).toBeInTheDocument();
    for (const row of rows()) {
      expect(row).not.toHaveClass("is-high");
      expect(row).not.toHaveClass("is-low");
    }
    expect(screen.getByText("8 questions · Unknown date")).toBeInTheDocument();
  });

  it("puts other quizzes after the classics, by title", async () => {
    localStorage.setItem("quizScores", JSON.stringify([
      { score: 1, total: 10, difficulty: "t-nordic-nights", date: "2026-05-16T00:00:00Z" },
      { score: 2, total: 10, difficulty: "hard", date: "2026-05-16T00:00:00Z" },
    ]));
    renderScoreboard();
    await userEvent.setup().click(screen.getByRole("tab", { name: "Difficulty" }));
    expect(rows()[0]).toHaveTextContent("2 points");
  });

  it("goes home", async () => {
    renderScoreboard();
    await userEvent.setup().click(screen.getByRole("button", { name: "Back to ESCParty" }));
    expect(screen.getByText("home")).toBeInTheDocument();
  });
});
