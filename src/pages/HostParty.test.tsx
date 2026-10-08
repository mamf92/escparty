import { describe, expect, it } from "vitest";
import { Route, Routes, useLocation } from "react-router-dom";
import { renderWithProviders, screen, userEvent, within } from "../test/test-utils";
import HostParty from "./HostParty";

const ShowLocation = () => {
  const location = useLocation();
  return <p>at {location.pathname} {JSON.stringify(location.state)}</p>;
};

const renderHost = () =>
  renderWithProviders(
    <Routes>
      <Route path="/host" element={<HostParty />} />
      <Route path="*" element={<ShowLocation />} />
    </Routes>,
    { initialEntries: ["/host"] },
  );

describe("HostParty", () => {
  it("offers a quiz and a scoreboard, as two cards", () => {
    renderHost();
    expect(screen.getByRole("heading", { level: 1, name: "Host a party" })).toBeInTheDocument();
    const group = screen.getByRole("group", { name: "What to host" });
    const buttons = within(group).getAllByRole("button");
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toHaveAccessibleName(/^Host a quiz/);
    expect(buttons[1]).toHaveAccessibleName(/^Host a scoreboard/);
    for (const button of buttons) expect(button).toHaveClass("lycra", "is-block");
  });

  it("goes straight to hosting a quiz", async () => {
    renderHost();
    await userEvent.setup().click(screen.getByRole("button", { name: /^Host a quiz/ }));
    expect(screen.getByText('at /multiplayer {"step":"host"}')).toBeInTheDocument();
  });

  it("goes straight to setting up a scoreboard party", async () => {
    renderHost();
    await userEvent.setup().click(screen.getByRole("button", { name: /^Host a scoreboard/ }));
    expect(screen.getByText(/at \/party\/new/)).toBeInTheDocument();
  });

  it.each([
    ["Pick or build a quiz", "/quizzes"],
    ["Back to ESCParty", "/"],
  ])("%s goes to %s", async (label, path) => {
    renderHost();
    await userEvent.setup().click(screen.getByRole("button", { name: label }));
    expect(screen.getByText(new RegExp(`^at ${path} `))).toBeInTheDocument();
  });
});
