import React from 'react';
import styled from 'styled-components';

interface MobileFrameProps {
  children: React.ReactNode;
}

const MobileFrame: React.FC<MobileFrameProps> = ({ children }) => {
  return (
    <FrameContainer>
      <PhoneFrame>
        <PhoneNotch />
        <PhoneScreen>
          <ContentConstraint>
            {children}
          </ContentConstraint>
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
  width: 100vw;
  height: 100vh;
  padding: 20px;
  background-color: #f0f2f5;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;

  @media (max-width: 768px) {
    padding: 0;
    background-color: transparent;
    position: relative;
  }
`;

const PhoneFrame = styled.div`
  position: relative;
  width: 375px;
  max-width: 100%;
  height: 80vh;
  max-height: 812px;
  background-color: #1a1a1a;
  border-radius: 40px;
  box-shadow: 0 0 0 10px #111, 0 0 30px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 10px;

  @media (max-width: 768px) {
    width: 100%;
    height: 100vh;
    max-height: none;
    border-radius: 0;
    box-shadow: none;
    padding: 0;
  }
`;

const PhoneNotch = styled.div`
  position: absolute;
  top: 0;
  width: 150px;
  height: 30px;
  background-color: #1a1a1a;
  border-bottom-left-radius: 20px;
  border-bottom-right-radius: 20px;
  z-index: 10;

  @media (max-width: 768px) {
    display: none;
  }
`;

const PhoneScreen = styled.div`
  width: 100%;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  background-color: #242424;
  border-radius: 30px;
  display: flex;
  flex-direction: column;

  @media (max-width: 768px) {
    border-radius: 0;
  }
`;

const ContentConstraint = styled.div`
  width: 100%;
  max-width: 355px;
  margin: 0 auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  
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