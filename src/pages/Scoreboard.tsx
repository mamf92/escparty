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
                <span>Sort by: </span>
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
    max-width: 600px;
    margin: auto;
    text-align: center;
    padding: 20px;
    background: ${({ theme }) => theme.colors.magnolia};
    border-radius: 10px;
`;

const Title = styled.h2`
    font-family: ${({ theme }) => theme.fonts.heading};
    color: ${({ theme }) => theme.colors.night};
    font-size: 1.8rem;
    margin-bottom: 20px;
`;

const SortContainer = styled.div`
    display: flex;
    justify-content: center;
    gap: 10px;
    margin-bottom: 15px;
`;

const SortButton = styled.button`
    background: ${({ theme }) => theme.colors.amethyst};
    color: white;
    font-size: 0.9rem;
    padding: 8px 12px;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    transition: 0.3s;

    &:hover {
        background: ${({ theme }) => theme.colors.pinkLavender};
    }
`;

const ScoreTable = styled.table`
    width: 100%;
    margin-top: 10px;
    border-collapse: collapse;
    font-size: 1rem;

    th, td {
        border: 1px solid ${({ theme }) => theme.colors.gray};
        padding: 8px;
        text-align: center;
    }

    th {
        background: ${({ theme }) => theme.colors.pinkLavender};
    }
`;

const BackButton = styled.button`
    background: ${({ theme }) => theme.colors.gray};
    color: white;
    font-size: 1rem;
    padding: 10px;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    margin-top: 20px;
    width: 100%;

    &:hover {
        background: ${({ theme }) => theme.colors.night};
    }
`;
