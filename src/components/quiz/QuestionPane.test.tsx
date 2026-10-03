import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent } from "../../test/test-utils";
import { QuestionPane } from "./QuestionPane";

const OPTIONS = ["Sweden", "Norway", "Ireland"];

const renderPane = (props: Partial<Parameters<typeof QuestionPane>[0]> = {}) =>
  renderWithProviders(
    <QuestionPane
      question="Which country won in 1974?"
      options={OPTIONS}
      picked={null}
      correctAnswer="Sweden"
      settled={false}
      onPick={() => { }}
      {...props}
    />,
  );

const markerOf = (name: string) =>
  screen.getByRole("button", { name }).querySelector(".calm-marker")?.getAttribute("data-marker");

describe("QuestionPane", () => {
  it("puts the question in an h2 straight above a pane of answer controls", () => {
    const { container } = renderPane();
    const heading = screen.getByRole("heading", { level: 2, name: "Which country won in 1974?" });
    const group = screen.getByRole("group", { name: "Answers" });
    expect(heading.nextElementSibling).toHaveClass("calm-ground");
    expect(group).toHaveClass("lycra-pane");
    // Controls are direct children of their pane.
    for (const button of screen.getAllByRole("button")) expect(button.parentElement).toBe(group);
    expect(container.querySelector(".calm-marker")).toBeNull();
  });

  it("reports a pick and shows it chosen while the question is open", async () => {
    const onPick = vi.fn();
    const user = userEvent.setup();
    renderPane({ picked: "Norway", onPick });

    expect(screen.getByRole("button", { name: "Norway" })).toHaveClass("is-chosen");
    expect(screen.getByRole("button", { name: "Norway" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Sweden" })).toHaveAttribute("aria-pressed", "false");

    await user.click(screen.getByRole("button", { name: "Ireland" }));
    expect(onPick).toHaveBeenCalledWith("Ireland");
  });

  it("marks the right answer and a wrong pick once settled, and locks the answers", () => {
    renderPane({ picked: "Norway", settled: true });

    expect(markerOf("Sweden")).toBe("correct");
    expect(markerOf("Norway")).toBe("wrong");
    expect(markerOf("Ireland")).toBeUndefined();
    expect(screen.getByRole("button", { name: "Sweden" })).toHaveClass("is-marked", "is-high");
    expect(screen.getByRole("button", { name: "Norway" })).toHaveClass("is-marked", "is-low");
    // The pick is still the pick, but shown by its marker rather than the sink.
    expect(screen.getByRole("button", { name: "Norway" })).not.toHaveClass("is-chosen");
    expect(screen.getByRole("button", { name: "Norway" })).toHaveAttribute("aria-pressed", "true");
    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
  });

  it("marks only the right answer when it was the pick, or when nothing was picked", () => {
    const { unmount } = renderPane({ picked: "Sweden", settled: true });
    expect(markerOf("Sweden")).toBe("correct");
    expect(document.querySelectorAll(".calm-marker")).toHaveLength(1);
    unmount();

    renderPane({ picked: null, settled: true });
    expect(markerOf("Sweden")).toBe("correct");
    expect(document.querySelectorAll(".calm-marker")).toHaveLength(1);
  });

  it("gives a pick the clock beat to it no cross: it was never locked in", () => {
    renderPane({ picked: "Norway", settled: true, lockedIn: false });
    expect(markerOf("Sweden")).toBe("correct");
    expect(markerOf("Norway")).toBeUndefined();
    expect(screen.getByRole("button", { name: "Norway" })).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps the markers silent: the verdict is said in words elsewhere", () => {
    renderPane({ picked: "Norway", settled: true });
    for (const marker of document.querySelectorAll(".calm-marker")) {
      expect(marker).toHaveAttribute("aria-hidden", "true");
    }
  });
});
