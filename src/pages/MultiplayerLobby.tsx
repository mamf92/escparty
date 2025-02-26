import { useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";

const ESC_WINNERS = [
    "Loreen 🇸🇪", "Måneskin 🇮🇹", "Conchita Wurst 🕊️", "Alexander Rybak 🎻", "ABBA 🇸🇪", "Duncan Laurence 🎹", "Netta 🐔", "Dana International 🏳️‍🌈", "Céline Dion 🇨🇭", "Johnny Logan 🇮🇪", "Ruslana 🔥", "Lena 🇩🇪", "Lordi 👹", "Eleni Foureira 🔥", "Helena Paparizou 🇬🇷", "Marija Šerifović 🌈", "Emilie de Forest 🎤", "Verka Serduchka 🌟"
];

const MultiplayerLobby = () => {
    const [gameCode, setGameCode] = useState<string | null>(null);
    const [joinCode, setJoinCode] = useState("");
    const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
    const navigate = useNavigate();

    // Function to generate a random game code
    const generateGameCode = () => {
        const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        setGameCode(newCode);
        localStorage.setItem("isHost", "true");
        localStorage.setItem("gameCode", newCode);
        localStorage.setItem("playerName", "👑 Host");
        const gameRooms = JSON.parse(localStorage.getItem("gameRooms") || "{}");
        gameRooms[newCode] = { players: ["👑 Host"], difficulty: null };
        localStorage.setItem("gameRooms", JSON.stringify(gameRooms));
    };

    // Function for host to select difficulty
    const selectDifficulty = (difficulty: string) => {
        setSelectedDifficulty(difficulty);
        const gameRooms = JSON.parse(localStorage.getItem("gameRooms") || "{}");
        if (gameCode) {
            gameRooms[gameCode].difficulty = difficulty;
            localStorage.setItem("gameRooms", JSON.stringify(gameRooms));
            localStorage.setItem("selectedDifficulty", difficulty);
        }
        navigate("/lobby");
    };

    // Function to join an existing game
    const joinGame = () => {
        if (joinCode) {
            const gameRooms = JSON.parse(localStorage.getItem("gameRooms") || "{}");
            if (gameRooms[joinCode]) {
                let randomName;
                do {
                    randomName = ESC_WINNERS[Math.floor(Math.random() * ESC_WINNERS.length)];
                } while (gameRooms[joinCode].players.includes(randomName));
                gameRooms[joinCode].players.push(randomName);
                localStorage.setItem("gameRooms", JSON.stringify(gameRooms));
                localStorage.setItem("isHost", "false");
                localStorage.setItem("gameCode", joinCode);
                localStorage.setItem("playerName", randomName);
                navigate("/lobby");
            } else {
                alert("Game not found!");
            }
        } else {
            alert("Please enter a game code.");
        }
    };

    return (
        <Container>
            <h2>Multiplayer Quiz Lobby</h2>

            {!gameCode && <Button onClick={generateGameCode}>Create Game</Button>}
            {gameCode && <p>Game Code: <strong>{gameCode}</strong></p>}

            {/* Host: Choose Difficulty */}
            {gameCode && !selectedDifficulty && (
                <div>
                    <h3>Choose Quiz Difficulty:</h3>
                    <Button onClick={() => selectDifficulty("easy")}>Easy</Button>
                    <Button onClick={() => selectDifficulty("medium")}>Medium</Button>
                    <Button onClick={() => selectDifficulty("hard")}>Hard</Button>
                </div>
            )}

            {selectedDifficulty && <p>Selected Difficulty: <strong>{selectedDifficulty}</strong></p>}

            {/* Player: Join Game */}
            <Input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Enter game code"
            />
            <Button onClick={joinGame}>Join Game</Button>
        </Container>
    );
};

export default MultiplayerLobby;

// Styled Components
const Container = styled.div`
  text-align: center;
  max-width: 400px;
  margin: auto;
  padding: 20px;
`;

const Button = styled.button`
  margin: 10px;
  padding: 10px;
  background: ${({ theme }) => theme.colors.amethyst};
  color: white;
  border: none;
  cursor: pointer;
`;

const Input = styled.input`
  padding: 10px;
  margin: 10px;
  width: 80%;
`;
