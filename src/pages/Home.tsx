import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { useState, useEffect } from "react";
import { getAssetPath } from "../utils/pathUtils";

const Home = () => {
  const navigate = useNavigate();
  const [backgroundPath, setBackgroundPath] = useState('');

  useEffect(() => {
    // Use our utility to get the correct path
    setBackgroundPath(getAssetPath('concert-bg.jpg'));
  }, []);

  return (
    <Container>
      <BackgroundImage $backgroundPath={backgroundPath} />
      <Overlay>
        <Title>Welcome to ESCParty 🎤</Title>
        <ButtonContainer>
          <QuizButton onClick={() => navigate("/multiplayer")}>Multiplayer quiz</QuizButton>
          <QuizButton onClick={() => navigate("/select-difficulty")}>Single-player quiz</QuizButton>
          <QuizButton onClick={() => navigate("/quiz")}>Create quiz</QuizButton>
        </ButtonContainer>
      </Overlay>
    </Container>
  );
};

export default Home;

// Styled Components
const Container = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
`;

const BackgroundImage = styled.div<{ $backgroundPath: string }>`
  position: absolute;
  width: 100%;
  height: 100%;
  background: ${props => props.$backgroundPath ? `url('${props.$backgroundPath}') center/cover no-repeat` : 'black'};
  filter: brightness(50%);
`;

const Overlay = styled.div`
  position: relative;
  z-index: 2;
  text-align: center;
  width: 100%;
  max-width: 31.25rem; /* 500px - standardizing container width */
  padding: 1.25rem; /* 20px */
`;

const Title = styled.h1`
  font-family: ${({ theme }) => theme.fonts.heading};
  color: ${({ theme }) => theme.colors.white};
  font-size: 2rem;
  margin-bottom: 1.25rem; /* 20px */
`;

const ButtonContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.9375rem; /* 15px */
  padding: 0 0.75rem; /* 0 12px */
`;

const QuizButton = styled.button`
  background: ${({ theme }) => theme.colors.purple};
  color: white;
  font-family: ${({ theme }) => theme.fonts.body};
  font-size: 1rem;
  font-weight: bold;
  padding: 1rem; /* Standardized to 1rem */
  border: none;
  cursor: pointer;
  transition: 0.3s;
  
  &:hover {
    background: ${({ theme }) => theme.colors.darkpurple};
  }
`;
