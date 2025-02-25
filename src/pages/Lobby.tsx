import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";

const Lobby = () => {
    const [players, setPlayers] = useState<string[]>([]);
    const [isHost, setIsHost] = useState<boolean>(false);
    const [gameCode, setGameCode] = useState<string | null>(null);
    const [playerName, setPlayerName] = useState<string | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        // Get game code from localStorage
        const storedGameCode = localStorage.getItem("gameCode");
        if (!storedGameCode) {
            alert("No game found! Returning to multiplayer lobby.");
            navigate("/multiplayer");
            return;
        }
        setGameCode(storedGameCode);

        // Retrieve correct game room from localStorage
        const gameRooms = JSON.parse(localStorage.getItem("gameRooms") || "{}");
        if (gameRooms[storedGameCode]) {
            setPlayers(gameRooms[storedGameCode].players);
        }

        setIsHost(localStorage.getItem("isHost") === "true");
        setPlayerName(localStorage.getItem("playerName"));

        // Listen for storage updates to update players live
        const handleStorageUpdate = () => {
            const updatedGameRooms = JSON.parse(localStorage.getItem("gameRooms") || "{}");
            if (updatedGameRooms[storedGameCode]) {
                setPlayers(updatedGameRooms[storedGameCode].players);
            }
        };

        window.addEventListener("storage", handleStorageUpdate);
        return () => window.removeEventListener("storage", handleStorageUpdate);
    }, [navigate]);

    const startGame = () => {
        if (isHost && gameCode) {
            localStorage.setItem("gameStarted", "true");
            navigate("/quiz");
        }
    };

    return (
        <Container>
            <Title>🎮 Game Lobby</Title>
            {playerName && <PlayerName>You are: {playerName}</PlayerName>}
            <Subtitle>Game Code: {gameCode}</Subtitle>
            {isHost && <StartButton onClick={startGame}>Start Game</StartButton>}
            <Subtitle>Waiting for players...</Subtitle>
            <Subtitle>Current players: </Subtitle>
            <PlayerList>
                {players.map((player, index) => (
                    <Player key={index}>{player} {index === 0 ? "" : ""}</Player>
                ))}
            </PlayerList>


        </Container>
    );
};

export default Lobby;

// Styled Components
const Container = styled.div`
    text-align: center;
    padding: 20px;
`;

const Title = styled.h2`
    font-size: 1.8rem;
`;

const Subtitle = styled.p`
    font-size: 1.2rem;
`;

const PlayerList = styled.ul`
    list-style: none;
    padding: 0;
`;

const Player = styled.li`
    font-size: 1.2rem;
    margin: 5px 0;
`;

const StartButton = styled.button`
    margin-top: 20px;
    padding: 10px 20px;
    font-size: 1.2rem;
    background-color: #4CAF50;
    color: white;
    border: none;
    cursor: pointer;
    border-radius: 5px;
`;

const PlayerName = styled.p`
    margin-top: 20px;
    font-size: 1.2rem;
`;