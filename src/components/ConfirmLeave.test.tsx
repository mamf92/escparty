import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent } from "../test/test-utils";
import { ConfirmLeave } from "./ConfirmLeave";

describe("ConfirmLeave", () => {
  const renderIt = () => {
    const onLeave = vi.fn();
    const onStay = vi.fn();
    renderWithProviders(
      <ConfirmLeave prompt="Leave this?" stayLabel="Stay" leaveLabel="Go" onLeave={onLeave} onStay={onStay} />,
    );
    return { onLeave, onStay };
  };

  it("focuses the stay button, which the question describes", () => {
    renderIt();
    expect(screen.getByRole("button", { name: "Stay" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "Stay" })).toHaveAccessibleDescription("Leave this?");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("calls onStay or onLeave for the matching button", async () => {
    const { onLeave, onStay } = renderIt();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Stay" }));
    expect(onStay).toHaveBeenCalledTimes(1);
    expect(onLeave).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Go" }));
    expect(onLeave).toHaveBeenCalledTimes(1);
  });
});
