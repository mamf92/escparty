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
        <Button onClick={() => handleSelect("easy")}>Easy (You know who Loreen is)</Button>
        <Button onClick={() => handleSelect("medium")}>Medium (You know the year Alexander Rybak won ESC)</Button>
        <Button onClick={() => handleSelect("hard")}>Hard (You remember where ESC was held when Dana International won)</Button>
      </ButtonContainer>
    </Container>
  );
};

export default SelectDifficulty;

// Styled Components
const Container = styled.div`
  width: 100%;
  text-align: center;
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const Title = styled.h2`
  font-family: ${({ theme }) => theme.fonts.heading};
  color: ${({ theme }) => theme.colors.magnolia};
  font-size: 2rem;
  margin-bottom: 20px;
`;

const ButtonContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 400px;
`;

const Button = styled.button`
  background: ${({ theme }) => theme.colors.amethyst};
  color: white;
  font-size: 1rem;
  padding: 15px 10px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  margin: 10px 0;
  transition: 0.3s;
  width: 100%;
  word-wrap: break-word;
  white-space: normal;

  &:hover {
    background: ${({ theme }) => theme.colors.pinkLavender};
  }
`;
