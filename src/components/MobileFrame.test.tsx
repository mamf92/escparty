import { describe, expect, it, vi } from "vitest";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { renderWithProviders, screen, userEvent } from "../test/test-utils";
import { useLeaveGuard } from "../hooks/useLeaveGuard";
import MobileFrame from "./MobileFrame";

const Here = () => <p>at {useLocation().pathname}</p>;

// A page with something in progress, and a button that moves on without the brand.
const Busy = ({ onLeave }: { onLeave: () => void }) => {
  const navigate = useNavigate();
  useLeaveGuard({ message: "Go back to ESCParty? You'll lose the game.", onLeave });
  return <button onClick={() => navigate("/elsewhere")}>Move on</button>;
};

const renderBusy = (onLeave = vi.fn()) => {
  renderWithProviders(
    <MobileFrame>
      <Routes>
        <Route path="/busy" element={<Busy onLeave={onLeave} />} />
        <Route path="*" element={<Here />} />
      </Routes>
    </MobileFrame>,
    { initialEntries: ["/busy"] },
  );
  return onLeave;
};

describe("MobileFrame", () => {
  it("renders the page inside the phone frame", () => {
    renderWithProviders(<MobileFrame><p>Douze points</p></MobileFrame>);
    expect(screen.getByText("Douze points")).toBeInTheDocument();
  });

  it("has an app bar with the brand and the Sparkle mode switch, on the themed screen", () => {
    const { container } = renderWithProviders(<MobileFrame><p>Douze points</p></MobileFrame>);
    const bar = screen.getByRole("banner");
    expect(bar).toHaveTextContent("ESCParty");
    expect(screen.getByRole("switch", { name: "Sparkle mode" })).toBeInTheDocument();
    expect(screen.getByText("Douze points").closest(".esc-app")).not.toBeNull();
    expect(container.querySelector(".esc-stage")).toHaveAttribute("aria-hidden", "true");
  });

  it.each(["/join", "/quiz/easy", "/lobby", "/party/ZZZZ", "/quizzes/new"])(
    "makes the brand a link home that goes straight there from %s when no page set a guard",
    async (path) => {
      renderWithProviders(
        <MobileFrame><Routes><Route path="*" element={<Here />} /></Routes></MobileFrame>,
        { initialEntries: [path] },
      );
      const brand = screen.getByRole("link", { name: "ESCParty" });
      expect(brand).toHaveAttribute("href", "/");
      await userEvent.setup().click(brand);
      expect(screen.getByText("at /")).toBeInTheDocument();
      expect(screen.queryByText(/Go back to ESCParty/)).not.toBeInTheDocument();
    },
  );

  it("asks with the page's message when a page set a guard, and Stay here keeps the page and returns focus to the brand", async () => {
    const onLeave = renderBusy();
    const user = userEvent.setup();
    await user.click(screen.getByRole("link", { name: "ESCParty" }));
    expect(screen.getByRole("button", { name: "Stay here" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "Stay here" })).toHaveAccessibleDescription("Go back to ESCParty? You'll lose the game.");

    await user.click(screen.getByRole("button", { name: "Stay here" }));
    expect(screen.queryByText(/Go back to ESCParty/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ESCParty" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "Move on" })).toBeInTheDocument();
    expect(onLeave).not.toHaveBeenCalled();
  });

  it("runs the page's own leave, not a bare navigation, once confirmed", async () => {
    const onLeave = renderBusy();
    const user = userEvent.setup();
    await user.click(screen.getByRole("link", { name: "ESCParty" }));
    await user.click(screen.getByRole("button", { name: "Go to ESCParty" }));
    expect(onLeave).toHaveBeenCalledTimes(1);
    // The page's onLeave navigates; this one doesn't, so the page is still up.
    expect(screen.getByRole("button", { name: "Move on" })).toBeInTheDocument();
    expect(screen.queryByText(/Go back to ESCParty/)).not.toBeInTheDocument();
  });

  it("drops the question without moving focus to the brand when the screen changes under it", async () => {
    renderBusy();
    const user = userEvent.setup();
    await user.click(screen.getByRole("link", { name: "ESCParty" }));
    expect(screen.getByText(/Go back to ESCParty\?/)).toBeInTheDocument();
    // The page moves on by itself (a game ending, say) while asking.
    await user.click(screen.getByRole("button", { name: "Move on" }));
    expect(screen.getByText("at /elsewhere")).toBeInTheDocument();
    expect(screen.queryByText(/Go back to ESCParty\?/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ESCParty" })).not.toHaveFocus();
    // And the guard went with the page: the brand goes straight home.
    await user.click(screen.getByRole("link", { name: "ESCParty" }));
    expect(screen.getByText("at /")).toBeInTheDocument();
  });
});
