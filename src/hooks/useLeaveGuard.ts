import { createContext, useContext, useEffect, useRef } from "react";

/** What a page in progress tells the ESCParty brand: what leaving costs, and how to leave. */
export interface LeaveGuard {
  /** Said when the brand asks first, e.g. "Go back to ESCParty? You'll leave the quiz." */
  message: string;
  /** Leaves for the home screen, doing the page's own clean-up on the way. */
  onLeave: () => void;
}

interface LeaveGuardState {
  guard: LeaveGuard | null;
  setGuard: (update: (current: LeaveGuard | null) => LeaveGuard | null) => void;
}

/** Held by `MobileFrame`; outside one (a page under test) registering does nothing. */
export const LeaveGuardContext = createContext<LeaveGuardState>({ guard: null, setGuard: () => { } });

/**
 * A page registers this while something would be lost by going home: a
 * quiz running, a room this tab is in, a quiz being built. While it is set
 * the brand asks `message` first and then runs `onLeave`, which does the
 * page's own clean-up and navigates; while it is `null` the brand just goes
 * home. Register only while there is something in progress.
 */
export const useLeaveGuard = (guard: LeaveGuard | null): void => {
  const { setGuard } = useContext(LeaveGuardContext);
  // The latest callback, so a new function each render doesn't re-register.
  const onLeave = useRef<(() => void) | undefined>(undefined);
  useEffect(() => {
    onLeave.current = guard?.onLeave;
  });
  const message = guard?.message;
  useEffect(() => {
    if (message === undefined) return;
    const mine: LeaveGuard = { message, onLeave: () => onLeave.current?.() };
    setGuard(() => mine);
    return () => setGuard(current => (current === mine ? null : current));
  }, [message, setGuard]);
};
