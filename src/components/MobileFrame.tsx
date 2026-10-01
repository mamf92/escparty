import React from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { Sparkles, ThemeSwitch } from '../design';

interface MobileFrameProps {
  children: React.ReactNode;
}

/**
 * The phone-frame chrome every app screen sits in (docs/design/design-system.md,
 * "Page anatomy"): a bezel on wide screens, full bleed on a phone, and the
 * app bar with the way home and the theme switch.
 */
const MobileFrame: React.FC<MobileFrameProps> = ({ children }) => {
  return (
    <FrameContainer>
      <PhoneFrame>
        <PhoneScreen className="esc-app">
          <AppBar>
            <Brand to="/" aria-label="ESCParty home">
              <span className="esc-title-text">ESCParty</span>
            </Brand>
            <ThemeSwitch />
          </AppBar>
          <ContentConstraint>
            {children}
          </ContentConstraint>
        </PhoneScreen>
        <Sparkles />
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
  box-shadow: 0 0 0 10px #0d0a10, 0 0 30px rgba(0, 0, 0, 0.5);
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
  overflow-y: auto;
  overflow-x: hidden;
  background: var(--esc-screen);
  background-attachment: local;
  border-radius: 30px;
  display: flex;
  flex-direction: column;
  position: relative;

  @media (max-width: 768px) {
    border-radius: 0;
  }
`;

const AppBar = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--esc-space-3);
  padding: var(--esc-space-2) var(--esc-space-4) 0;
`;

const Brand = styled(Link)`
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  font-family: var(--esc-font-display);
  font-size: var(--esc-text-control);
  font-weight: 700;
  letter-spacing: var(--esc-title-tracking);
  text-transform: uppercase;
  text-decoration: none;
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
  background-color: #333;
  border-radius: 3px;
  bottom: 10px;

  @media (max-width: 768px) {
    display: none;
  }
`;
