import { useNavigate } from "react-router-dom";
import styled from "styled-components";

const SelectDifficulty = () => {
  const navigate = useNavigate();

  const handleSelect = (difficulty: string) => {
    navigate(`/quiz/${difficulty}`);
  };

  return (
    <Container>
      <Title>Choose Difficulty</Title>
      <ButtonContainer>
        <Button onClick={() => handleSelect("easy")}>
          <DifficultyText>Easy</DifficultyText>
          <DifficultyDescription>You know who Loreen is</DifficultyDescription>
        </Button>
        <Button onClick={() => handleSelect("medium")}>
          <DifficultyText>Medium </DifficultyText>
          <DifficultyDescription>You know the year Alexander Rybak won ESC</DifficultyDescription>
        </Button>
        <Button onClick={() => handleSelect("hard")}>
          <DifficultyText>Hard</DifficultyText>
          <DifficultyDescription>You know where ESC was held when Dana International won</DifficultyDescription></Button>
      </ButtonContainer>
    </Container>
  );
};

export default SelectDifficulty;

// Styled Components
const Container = styled.div`
  width: 100%;
  max-width: 31.25rem; /* 500px - standardized container width */
  text-align: center;
  padding: 1.25rem; /* 20px */
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: auto;
`;

const Title = styled.h2`
  font-family: ${({ theme }) => theme.fonts.heading};
  color: ${({ theme }) => theme.colors.white};
  font-size: 2rem;
  margin-bottom: 1.25rem; /* 20px */
`;

const ButtonContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 31.25rem; /* 500px */
`;

const Button = styled.button`
  background: ${({ theme }) => theme.colors.purple};
  color: white;
  font-size: 1rem;
  padding: 1rem;
  border: none;
  cursor: pointer;
  margin: 0.625rem 0; /* 10px */
  transition: 0.3s;
  width: 100%;
  word-wrap: break-word;
  white-space: normal;

  &:hover {
    background: ${({ theme }) => theme.colors.darkpurple};
  }
`;

const DifficultyText = styled.span`
  font-size: 1.5rem;
  font-weight: bold;
`;

const DifficultyDescription = styled.span`
  font-size: 1rem;
  display: block;
  margin-top: 0.3125rem; /* 5px */
`;
