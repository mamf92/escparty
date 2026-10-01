import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent } from "../../test/test-utils";
import { LeaveQuiz } from "./LeaveQuiz";

describe("LeaveQuiz", () => {
  it("asks first, and leaves only on the second press", async () => {
    const onLeave = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<LeaveQuiz multiplayer={false} onLeave={onLeave} />);

    await user.click(screen.getByRole("button", { name: "Leave the quiz" }));
    expect(onLeave).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Leave the quiz? This run won't be saved.");
    expect(screen.getByRole("button", { name: "Keep playing" })).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Leave the quiz" }));
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it("goes back to the link, with focus on it, when the player stays", async () => {
    const onLeave = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<LeaveQuiz multiplayer={false} onLeave={onLeave} />);

    await user.click(screen.getByRole("button", { name: "Leave the quiz" }));
    await user.click(screen.getByRole("button", { name: "Keep playing" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Leave the quiz" })).toHaveFocus();
    expect(onLeave).not.toHaveBeenCalled();
  });

  it("says the game goes on without a multiplayer player", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LeaveQuiz multiplayer onLeave={() => { }} />);
    await user.click(screen.getByRole("button", { name: "Leave the quiz" }));
    expect(screen.getByRole("alert")).toHaveTextContent("The game carries on without you.");
  });
});
