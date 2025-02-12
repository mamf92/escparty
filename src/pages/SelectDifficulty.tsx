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
            <Button onClick={() => handleSelect("easy")}>Easy (You know who Loreen is)</Button>
            <Button onClick={() => handleSelect("medium")}>Medium (You know the year Alexander Rybak won ESC)</Button>
            <Button onClick={() => handleSelect("hard")}>Hard (You remember where ESC was held when Dana International won)</Button>
        </Container>
    );
};

export default SelectDifficulty;

// Styled Components
const Container = styled.div`
  text-align: center;
  padding: 20px;
`;

const Title = styled.h2`
  font-family: ${({ theme }) => theme.fonts.heading};
  color: ${({ theme }) => theme.colors.magnolia};
  font-size: 2rem;
  margin-bottom: 20px;
`;

const Button = styled.button`
  background: ${({ theme }) => theme.colors.amethyst};
  color: white;
  font-size: 1rem;
  padding: 10px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  margin: 10px;
  transition: 0.3s;

  &:hover {
    background: ${({ theme }) => theme.colors.pinkLavender};
  }
`;
