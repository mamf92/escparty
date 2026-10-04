import React from 'react';
import styled from 'styled-components';
import { Stage, ThemeSwitch } from '../design';

interface MobileFrameProps {
  children: React.ReactNode;
}

/**
 * The phone-frame chrome every app screen sits in (docs/design/design-system.md,
 * "Page anatomy"): a bezel on wide screens, full bleed on a phone, and the
 * app bar with the brand and the theme switch. The brand is deliberately not
 * a home link: several screens are mid-game and have their own way out.
 * The stage (the disco ball, and Sparkle's sequins) sits behind the
 * scrolling content, fixed to the screen.
 */
const MobileFrame: React.FC<MobileFrameProps> = ({ children }) => {
  return (
    <FrameContainer>
      <PhoneFrame>
        <PhoneScreen className="esc-app">
          <Stage />
          <Scroller>
            <AppBar>
              <Brand className="esc-title-text">ESCParty</Brand>
              <ThemeSwitch />
            </AppBar>
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

const Brand = styled.span`
  display: inline-flex;
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
