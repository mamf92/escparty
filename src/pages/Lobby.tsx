import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import styled, { keyframes } from "styled-components";

const Lobby = () => {
    const [players, setPlayers] = useState<string[]>([]);
    const [isHost, setIsHost] = useState<boolean>(false);
    const [gameCode, setGameCode] = useState<string | null>(null);
    const [playerName, setPlayerName] = useState<string | null>(null);
    const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const storedGameCode = localStorage.getItem("gameCode");
        if (!storedGameCode) {
            alert("No game found! Returning to multiplayer lobby.");
            navigate("/multiplayer");
            return;
        }
        setGameCode(storedGameCode);

        const gameRooms = JSON.parse(localStorage.getItem("gameRooms") || "{}");
        if (gameRooms[storedGameCode]) {
            setPlayers(gameRooms[storedGameCode].players);
            setSelectedDifficulty(gameRooms[storedGameCode].difficulty || "Not selected");
        }

        setIsHost(localStorage.getItem("isHost") === "true");
        setPlayerName(localStorage.getItem("playerName"));

        const handleStorageUpdate = () => {
            const updatedGameRooms = JSON.parse(localStorage.getItem("gameRooms") || "{}");
            if (updatedGameRooms[storedGameCode]) {
                setPlayers(updatedGameRooms[storedGameCode].players);
            }
        };

        const handleGameStarted = () => {
            const gameStarted = localStorage.getItem("gameStarted");
            if (gameStarted === "true") {
                navigate(`/quiz/${selectedDifficulty}`);
            }
        };

        window.addEventListener("storage", handleStorageUpdate);
        window.addEventListener("storage", handleGameStarted);
        return () => {
            window.removeEventListener("storage", handleStorageUpdate);
            window.removeEventListener("storage", handleGameStarted);
        };
    }, [navigate, selectedDifficulty]);

    const startGame = () => {
        if (isHost && gameCode) {
            localStorage.setItem("gameStarted", "true");
            navigate(`/quiz/${selectedDifficulty}`);
        }
    };

    return (
        <Container>
            <Title>Quiz Lobby</Title>
            {playerName && <PlayerName>You are: <Highlight>{playerName}</Highlight></PlayerName>}
            <GameInfo>
                <InfoItem>Game Code: <Code>{gameCode}</Code></InfoItem>
                <InfoItem>Difficulty: <Difficulty>{selectedDifficulty}</Difficulty></InfoItem>
            </GameInfo>
            <AnimatedSubtitle>Waiting for players...</AnimatedSubtitle>
            <PlayerListTitle>Current players:</PlayerListTitle>
            <PlayerList>
                {players.map((player, index) => (
                    <Player key={index}>{index === 0 ? "👑 " : ""}{player}</Player>
                ))}
            </PlayerList>
            {isHost && <StartButton onClick={startGame}>Start Game</StartButton>}
        </Container>
    );
};

export default Lobby;

// Styled Components
const Container = styled.div`
    text-align: center;
    padding: 20px;
    max-width: 500px;
    margin: auto;
    background: ${({ theme }) => theme.colors.night};
    color: ${({ theme }) => theme.colors.magnolia};
    border-radius: 10px;
`;

const Title = styled.h2`
    font-size: 2rem;
    margin-bottom: 20px;
    font-family: ${({ theme }) => theme.fonts.heading};
    color: ${({ theme }) => theme.colors.pinkLavender};
`;

const GameInfo = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    margin: 15px 0;
`;

const InfoItem = styled.p`
    font-size: 1.2rem;
    margin: 5px 0;
`;

const Code = styled.span`
    font-weight: bold;
    color: ${({ theme }) => theme.colors.amethyst};
    font-size: 1.4rem;
`;

const Difficulty = styled.span`
    font-weight: bold;
    color: ${({ theme }) => theme.colors.amethyst};
    font-size: 1.2rem;
`;

const PlayerListTitle = styled.h3`
    font-size: 1.2rem;
    margin-top: 1em;
    text-align: left;
    text-decoration: underline;
    color: ${({ theme }) => theme.colors.pinkLavender};
`;

const Highlight = styled.span`
    font-weight: bold;
    color: ${({ theme }) => theme.colors.amethyst};
`;

const PlayerList = styled.ul`
    list-style: none;
    padding: 0;
    text-align: left;
    margin: 20px 0;
`;

const Player = styled.li`
    font-size: 1.2rem;
    margin: 5px 0;
`;

const StartButton = styled.button`
    margin-top: 20px;
    padding: 10px 20px;
    font-size: 1.2rem;
    background-color: ${({ theme }) => theme.colors.amethyst};
    color: white;
    border: none;
    cursor: pointer;
    border-radius: 5px;
    transition: 0.3s;
    &:hover {
        background: ${({ theme }) => theme.colors.pinkLavender};
    }
`;

const PlayerName = styled.p`
    margin-top: 20px;
    font-size: 1.2rem;
    font-weight: bold;
    color: ${({ theme }) => theme.colors.pinkLavender};
`;

const blink = keyframes`
    0% { opacity: 1; }
    50% { opacity: 0.5; }
    100% { opacity: 1; }
`;

const AnimatedSubtitle = styled.p`
    font-size: 1.2rem;
    color: ${({ theme }) => theme.colors.gray};
    animation: ${blink} 1.5s infinite;
`;
