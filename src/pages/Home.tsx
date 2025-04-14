import { useNavigate } from "react-router-dom";
import styled from "styled-components";

const Home = () => {
  const navigate = useNavigate();

  return (
    <Container>
      <BackgroundImage />
      <Overlay>
        <Title>Welcome to EuroParty 🎤</Title>
        <ButtonContainer>
          <QuizButton onClick={() => navigate("/quiz")}>Create Quiz</QuizButton>
          <QuizButton onClick={() => navigate("/select-difficulty")}>Take a Quiz</QuizButton>
          <QuizButton onClick={() => navigate("/multiplayer")}>Multiplayer Quiz</QuizButton>
        </ButtonContainer>
      </Overlay>
    </Container>
  );
};

export default Home;

// Styled Components
const Container = styled.div`
  position: relative;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const BackgroundImage = styled.div`
  position: absolute;
  width: 100%;
  height: 100%;
  background: url('/escparty/concert-bg.jpg') center/cover no-repeat;
  filter: brightness(50%);
`;

const Overlay = styled.div`
  position: relative;
  z-index: 2;
  text-align: center;
`;

const Title = styled.h1`
  font-family: ${({ theme }) => theme.fonts.heading};
  color: ${({ theme }) => theme.colors.magnolia};
  font-size: 2rem;
  margin-bottom: 20px;
`;

const ButtonContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 15px;
  padding-left: 12px; 
  padding-right: 12px; 
`;

const QuizButton = styled.button`
  background: ${({ theme }) => theme.colors.amethyst};
  color: white;
  font-family: ${({ theme }) => theme.fonts.body};
  font-size: 1.2rem;
  padding: 12px 24px;
  border: none;
  border-radius: 2px;
  cursor: pointer;
  transition: 0.3s;
  
  &:hover {
    background: ${({ theme }) => theme.colors.pinkLavender};
  }
`;
