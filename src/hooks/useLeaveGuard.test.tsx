import { describe, expect, it, vi } from "vitest";
import { useCallback, useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LeaveGuardContext, useLeaveGuard, type LeaveGuard } from "./useLeaveGuard";

const Probe = ({ on, onLeave }: { on: boolean; onLeave: () => void }) => {
  useLeaveGuard(on ? { message: "Sure?", onLeave } : null);
  return null;
};
const Frame = ({ children }: { children: React.ReactNode }) => {
  const [guard, setGuard] = useState<LeaveGuard | null>(null);
  const register = useCallback((update: (current: LeaveGuard | null) => LeaveGuard | null) => setGuard(update), []);
  return (
    <LeaveGuardContext.Provider value={{ guard, setGuard: register }}>
      <button onClick={() => guard?.onLeave()}>{guard ? guard.message : "no guard"}</button>
      {children}
    </LeaveGuardContext.Provider>
  );
};

describe("useLeaveGuard", () => {
  it("registers while on, clears when off or unmounted, and calls the latest onLeave", async () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<Frame><Probe on={false} onLeave={first} /></Frame>);
    expect(screen.getByRole("button")).toHaveTextContent("no guard");

    rerender(<Frame><Probe on onLeave={first} /></Frame>);
    expect(screen.getByRole("button")).toHaveTextContent("Sure?");

    rerender(<Frame><Probe on onLeave={second} /></Frame>);
    await userEvent.setup().click(screen.getByRole("button"));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);

    rerender(<Frame><Probe on={false} onLeave={second} /></Frame>);
    expect(screen.getByRole("button")).toHaveTextContent("no guard");

    rerender(<Frame><Probe on onLeave={second} /></Frame>);
    rerender(<Frame>{null}</Frame>);
    expect(screen.getByRole("button")).toHaveTextContent("no guard");
  });

  it("does nothing outside a MobileFrame", () => {
    render(<Probe on onLeave={() => { }} />);
  });
});
