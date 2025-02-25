import { useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";

const ESC_WINNERS = [
    "Loreen 🇸🇪", // Sweden
    "Måneskin 🇮🇹", // Italy
    "Conchita Wurst 🕊️", // Austria (Rise Like a Phoenix)
    "Alexander Rybak 🎻", // Norway (Fairytale)
    "ABBA 🇸🇪", // Sweden
    "Duncan Laurence 🎹", // Netherlands (Arcade)
    "Netta 🐔", // Israel (Toy)
    "Dana International 🏳️‍🌈", // Israel (Diva)
    "Céline Dion 🇨🇭", // Switzerland
    "Johnny Logan 🇮🇪", // Ireland
    "Ruslana 🔥", // Ukraine (Wild Dances)
    "Lena 🇩🇪", // Germany
    "Lordi 👹", // Finland (Hard Rock Hallelujah)
    "Eleni Foureira 🔥", // Cyprus (Fuego)
    "Helena Paparizou 🇬🇷", // Greece
    "Marija Šerifović 🌈", // Serbia (Molitva)
    "Emilie de Forest 🎤", // Denmark (Only Teardrops)
    "Verka Serduchka 🌟" // Ukraine (Dancing Lasha Tumbai)
];

const MultiplayerLobby = () => {
    const [gameCode, setGameCode] = useState<string | null>(null);
    const [joinCode, setJoinCode] = useState("");
    const navigate = useNavigate();

    // Function to generate a random game code
    const generateGameCode = () => {
        const newCode = Math.random().toString(36).substring(2, 8).toUpperCase(); // Example: ABX123
        setGameCode(newCode);
        console.log("Game Code:", newCode);

        localStorage.setItem("isHost", "true");
        localStorage.setItem("gameCode", newCode);
        localStorage.setItem("playerName", "👑 Host");

        const gameRooms = JSON.parse(localStorage.getItem("gameRooms") || "{}");
        gameRooms[newCode] = { players: ["👑 Host"] };
        console.log("Game Rooms:", gameRooms);
        localStorage.setItem("gameRooms", JSON.stringify(gameRooms));

        navigate("/lobby");
    };

    // Function to join an existing game
    const joinGame = () => {
        if (joinCode) {
            const randomName = ESC_WINNERS[Math.floor(Math.random() * ESC_WINNERS.length)];

            // Get existing rooms
            const gameRooms = JSON.parse(localStorage.getItem("gameRooms") || "{}");

            // Check if the game code exists
            if (gameRooms[joinCode]) {
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

            {/* Host: Create Game */}
            <Button onClick={generateGameCode}>Create Game</Button>
            {gameCode && <p>Game Code: <strong>{gameCode}</strong></p>}

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
