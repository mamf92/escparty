import React, { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { Control, Ground, Pane, Stage, ThemeSwitch } from '../design';
import { CalmNote } from './CalmPage';

// The screens that are mid-game: the quiz, its lobby and breaks, the
// observer's view and a party's rating room. Going home from one asks first.
const MID_GAME = /^\/(quiz\/|lobby|mid-quiz-scoreboard|host-observer|party\/(?!new$)[^/]+$)/;

interface MobileFrameProps {
  children: React.ReactNode;
}

/**
 * The phone-frame chrome every app screen sits in (docs/design/design-system.md,
 * "Page anatomy"): a bezel on wide screens, full bleed on a phone, and the
 * app bar with the brand and the theme switch. The brand is a link home;
 * on a mid-game screen (`MID_GAME`) it asks first, with the same
 * stay-or-leave choice as `LeaveQuiz`, so a stray tap can't end a game.
 * The stage (the disco ball, and Sparkle's sequins) sits behind the
 * scrolling content, fixed to the screen.
 */
const MobileFrame: React.FC<MobileFrameProps> = ({ children }) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [asking, setAsking] = useState(false);
  const stayRef = useRef<HTMLButtonElement>(null);
  const brandRef = useRef<HTMLAnchorElement>(null);
  const wasAsking = useRef(false);
  const promptId = useId();

  // A new screen answers the question (state reset while rendering, the
  // documented way to reset it when an input changes).
  const [askedAt, setAskedAt] = useState(pathname);
  if (askedAt !== pathname) {
    setAskedAt(pathname);
    setAsking(false);
  }

  // Focus follows the question, as in LeaveQuiz: onto "Stay here" when it
  // opens, back to the brand when it closes.
  useEffect(() => {
    if (asking) stayRef.current?.focus();
    else if (wasAsking.current) brandRef.current?.focus();
    wasAsking.current = asking;
  }, [asking]);

  const goHome = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!MID_GAME.test(pathname)) return;
    event.preventDefault();
    setAsking(true);
  };

  return (
    <FrameContainer>
      <PhoneFrame>
        <PhoneScreen className="esc-app">
          <Stage />
          <Scroller>
            <AppBar>
              <Brand ref={brandRef} to="/" className="esc-title-text" onClick={goHome}>ESCParty</Brand>
              <ThemeSwitch />
            </AppBar>
            {asking && (
              <Leave>
                <CalmNote id={promptId}>Go back to ESCParty? You'll leave what you're in the middle of.</CalmNote>
                <Ground>
                  <Pane layout="split">
                    <Control ref={stayRef} aria-describedby={promptId} onClick={() => setAsking(false)}>Stay here</Control>
                    <Control onClick={() => { setAsking(false); navigate("/"); }}>Go to ESCParty</Control>
                  </Pane>
                </Ground>
              </Leave>
            )}
            <ContentConstraint>
              {children}
            </ContentConstraint>
          </Scroller>
        </PhoneScreen>
        <PhoneButton />
      </PhoneFrame>
    </FrameContainer>
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
  z-index: 1;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
`;

const AppBar = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--esc-space-3);
  padding: var(--esc-space-2) var(--esc-space-4) 0;
`;

const Leave = styled.div`
  width: 100%;
  max-width: 355px;
  margin: 0 auto;
  padding: var(--esc-space-2) var(--esc-space-3) 0;
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
