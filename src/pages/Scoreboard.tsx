import { useEffect, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";

interface ScoreEntry {
    score: number;
    total: number;
    difficulty: string;
    date: string;
}

const Scoreboard = () => {
    const navigate = useNavigate();
    const [scoreHistory, setScoreHistory] = useState<ScoreEntry[]>([]);
    const [sortKey, setSortKey] = useState<"date" | "difficulty" | "score">("date");

    useEffect(() => {
        const storedScores = JSON.parse(localStorage.getItem("quizScores") || "[]");
        setScoreHistory(storedScores);
    }, []);

    const sortedScores = [...scoreHistory].sort((a, b) => {
        if (sortKey === "date") return new Date(b.date).getTime() - new Date(a.date).getTime();
        if (sortKey === "difficulty") return a.difficulty.localeCompare(b.difficulty);
        if (sortKey === "score") return b.score - a.score;
        return 0;
    });

    return (
        <Container>
            <Title>📊 Quiz Scoreboard</Title>

            <SortContainer>
                <SortText>Sort by:</SortText>
                <SortButton onClick={() => setSortKey("date")}>📅 Date</SortButton>
                <SortButton onClick={() => setSortKey("difficulty")}>🎯 Difficulty</SortButton>
                <SortButton onClick={() => setSortKey("score")}>🏆 Score</SortButton>
            </SortContainer>

            <ScoreTable>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Difficulty</th>
                        <th>Score</th>
                    </tr>
                </thead>
                <tbody>
                    {sortedScores.map((entry, index) => (
                        <tr key={index}>
                            <td>{new Date(entry.date).toLocaleDateString()}</td>
                            <td>{entry.difficulty}</td>
                            <td>{entry.score} / {entry.total}</td>
                        </tr>
                    ))}
                </tbody>
            </ScoreTable>

            <BackButton onClick={() => navigate("/")}>🏠 Back to Home</BackButton>
        </Container>
    );
};

export default Scoreboard;

// Styled Components
const Container = styled.div`
    width: 100%;
    max-width: 31.25rem; /* 500px - standardizing width */
    margin: auto;
    text-align: center;
    padding: 1.25rem; /* 20px */
    background: ${({ theme }) => theme.colors.white};
`;

const Title = styled.h2`
    font-family: ${({ theme }) => theme.fonts.heading};
    color: ${({ theme }) => theme.colors.night};
    font-size: 1.5rem;
    margin-bottom: 1.25rem; /* 20px */
`;

const SortContainer = styled.div`
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.625rem; /* 10px */
    margin-bottom: 0.9375rem; /* 15px */
`;

const SortText = styled.p`
    font-size: 1rem;
    color: ${({ theme }) => theme.colors.black};
    font-weight: bold;
`;

const SortButton = styled.button`
    background: ${({ theme }) => theme.colors.purple};
    color: white;
    font-size: 0.9rem;
    padding: 0.5rem;
    border: none;
    cursor: pointer;
    transition: 0.3s;

    &:hover {
        background: ${({ theme }) => theme.colors.darkpurple};
    }
`;

const ScoreTable = styled.table`
    width: 100%;
    margin-top: 0.625rem; /* 10px */
    border-collapse: collapse;
    font-size: 1rem;

    th, td {
        border: 0.0625rem solid ${({ theme }) => theme.colors.gray}; /* 1px */
        padding: 0.5rem; /* 8px */
        text-align: center;
    }

    th {
        background: ${({ theme }) => theme.colors.nightblue};
        color: white;
    }
    
    td {
        color: ${({ theme }) => theme.colors.black};
    }
`;

const BackButton = styled.button`
    background: ${({ theme }) => theme.colors.gray};
    color: white;
    font-size: 1rem;
    font-weight: bold;
    padding: 1rem;
    border: none;
    cursor: pointer;
    margin-top: 1.25rem; /* 20px */
    width: 100%;

    &:hover {
        background: ${({ theme }) => theme.colors.night};
    }
`;
