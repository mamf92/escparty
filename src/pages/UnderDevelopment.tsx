import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { FaHome } from "react-icons/fa";

const UnderDevelopment = () => {
  const navigate = useNavigate();

  return (
    <Container>
      <Title>🚧 Feature Under Development 🚧</Title>
      <Message>
        The Create Quiz feature is coming soon! Our team is working hard to bring you
        the ability to create your own Eurovision quizzes.
      </Message>
      <SubMessage>
        Check back later for updates or try our existing quiz modes.
      </SubMessage>
      <ButtonContainer>
        <HomeButton onClick={() => navigate("/")}>
          <FaHome size={20} /> Return to Home
        </HomeButton>
      </ButtonContainer>
    </Container>
  );
};

export default UnderDevelopment;

// Styled Components
const Container = styled.div`
  width: 100%;
  max-width: 500px;
  margin: auto;
  text-align: center;
  padding: 20px;
  background: ${({ theme }) => theme.colors.magnolia};
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
`;

const Title = styled.h2`
  font-family: ${({ theme }) => theme.fonts.heading};
  color: ${({ theme }) => theme.colors.night};
  font-size: 1.8rem;
  margin-bottom: 20px;
`;

const Message = styled.p`
  font-size: 1.2rem;
  color: ${({ theme }) => theme.colors.night};
  margin-bottom: 15px;
  line-height: 1.6;
`;

const SubMessage = styled.p`
  font-size: 1rem;
  color: ${({ theme }) => theme.colors.gray};
  margin-bottom: 25px;
  font-style: italic;
`;

const ButtonContainer = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 20px;
`;

const HomeButton = styled.button`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 20px;
  background: ${({ theme }) => theme.colors.purple};
  color: white;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  transition: 0.3s;
  
  &:hover {
    background: ${({ theme }) => theme.colors.darkpurple};
  }
`;