import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { Stage, ThemeSwitch } from '../design';
import { ConfirmLeave } from './ConfirmLeave';
import { LeaveGuardContext, type LeaveGuard } from '../hooks/useLeaveGuard';

interface MobileFrameProps {
  children: React.ReactNode;
}

/**
 * The phone-frame chrome every app screen sits in (docs/design/design-system.md,
 * "Page anatomy"): a bezel on wide screens, full bleed on a phone, and the
 * app bar with the brand and the theme switch. The brand is a link home. A
 * page with something in progress registers a leave guard
 * (`useLeaveGuard`); then the brand asks first, with the same stay-or-leave
 * choice as `LeaveQuiz`, and runs the page's own `onLeave`. With no guard it
 * simply goes home. The stage (the disco ball, and Sparkle's sequins) sits
 * behind the scrolling content, fixed to the screen.
 */
const MobileFrame: React.FC<MobileFrameProps> = ({ children }) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [guard, setGuardState] = useState<LeaveGuard | null>(null);
  const setGuard = useCallback((update: (current: LeaveGuard | null) => LeaveGuard | null) => setGuardState(update), []);
  const guardState = useMemo(() => ({ guard, setGuard }), [guard, setGuard]);
  const [asking, setAsking] = useState(false);
  const brandRef = useRef<HTMLAnchorElement>(null);

  // A new screen answers the question (state reset while rendering, the
  // documented way to reset it when an input changes).
  const [askedAt, setAskedAt] = useState(pathname);
  if (askedAt !== pathname) {
    setAskedAt(pathname);
    setAsking(false);
  }

  const goHome = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!guard) return;
    event.preventDefault();
    setAsking(true);
  };

  // Focus goes back to the brand only when the user chose to stay, not when
  // the question closes because the screen changed.
  const stay = () => {
    setAsking(false);
    brandRef.current?.focus();
  };

  const leave = () => {
    setAsking(false);
    if (guard) guard.onLeave();
    else navigate("/");
  };

  return (
    <LeaveGuardContext.Provider value={guardState}>
    <FrameContainer>
      <PhoneFrame>
        <PhoneScreen className="esc-app">
          <Stage />
          <Scroller>
            <AppBar>
              <Brand ref={brandRef} to="/" className="esc-title-text" onClick={goHome}>ESCParty</Brand>
              <ThemeSwitch />
            </AppBar>
            <ContentConstraint className="esc-content">
              {asking && guard && (
                <Asking
                  prompt={guard.message}
                  stayLabel="Stay here"
                  leaveLabel="Go to ESCParty"
                  onStay={stay}
                  onLeave={leave}
                />
              )}
              {children}
            </ContentConstraint>
          </Scroller>
        </PhoneScreen>
        <PhoneButton />
      </PhoneFrame>
    </FrameContainer>
    </LeaveGuardContext.Provider>
  );
};

export default MobileFrame;

// Styled Components
const FrameContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  padding: 20px;
  background: var(--esc-backdrop);
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;

  @media (max-width: 768px) {
    padding: 0;
    position: relative;
    height: 100vh;
    height: 100dvh;
  }
`;

const PhoneFrame = styled.div`
  position: relative;
  width: 375px;
  max-width: 100%;
  height: 80vh;
  max-height: 812px;
  background-color: var(--esc-frame);
  border-radius: 40px;
  box-shadow: 0 0 0 10px var(--esc-bezel), 0 0 30px var(--esc-frame-glow);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 10px;

  @media (max-width: 768px) {
    width: 100%;
    height: 100%;
    max-height: none;
    border-radius: 0;
    box-shadow: none;
    padding: 0;
  }
`;

const PhoneScreen = styled.div`
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--esc-screen);
  border-radius: 30px;
  position: relative;

  @media (max-width: 768px) {
    border-radius: 0;
  }
`;

// The content scrolls over the screen's background and its stars.
const Scroller = styled.div`
  position: absolute;
  inset: 0;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
`;

// Above the wait's scrim (Loader.tsx), so the theme switch stays usable.
const AppBar = styled.header`
  position: relative;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--esc-space-3);
  padding: var(--esc-space-2) var(--esc-space-4) 0;
`;

// Above the page it interrupts, as wide as the page.
const Asking = styled(ConfirmLeave)`
  padding-top: var(--esc-space-2);
  display: flex;
  flex-direction: column;
  gap: var(--esc-space-3);
`;

const Brand = styled(Link)`
  display: inline-flex;
  text-decoration: none;
  align-items: center;
  min-height: 44px;
  font-family: var(--esc-font-display);
  font-size: var(--esc-text-control);
  font-weight: 400;
  letter-spacing: var(--esc-title-tracking);
  text-transform: uppercase;
  color: var(--esc-title);
`;

const ContentConstraint = styled.div`
  width: 100%;
  max-width: 355px;
  margin: 0 auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: var(--esc-space-2) var(--esc-space-3) var(--esc-space-4);

  @media (max-width: 768px) {
    max-width: 100%;
  }
`;

const PhoneButton = styled.div`
  position: absolute;
  width: 40px;
  height: 5px;
  background-color: var(--esc-home-bar);
  border-radius: 3px;
  bottom: 10px;

  @media (max-width: 768px) {
    display: none;
  }
`;
