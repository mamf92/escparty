import { useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { v4 as uuidv4 } from "uuid";
import { createRoom, joinRoom, generateRoomCode } from "../utils/roomsFirestore";

const ESC_WINNERS = [
    "Loreen 🇸🇪", "Måneskin 🇮🇹", "Conchita Wurst 🕊️", "Alexander Rybak 🎻", "ABBA 🇸🇪", "Duncan Laurence 🎹", "Netta 🐔", "Dana International 🏳️‍🌈", "Céline Dion 🇨🇭", "Johnny Logan 🇮🇪", "Ruslana 🔥", "Lena 🇩🇪", "Lordi 👹", "Eleni Foureira 🔥", "Helena Paparizou 🇬🇷", "Marija Šerifović 🌈", "Emilie de Forest 🎤", "Verka Serduchka 🌟"
];

const MultiplayerLobby = () => {
    const [_gameCode, setGameCode] = useState<string | null>(null); // Renamed to _gameCode as it's not used directly
    const [joinCode, setJoinCode] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    // Function to generate a random game code and create room
    const handleCreateGame = async () => {
        setLoading(true);
        try {
            // Generate a unique ID for the host
            const hostId = uuidv4();
            const hostName = "👑 Host";

            // Generate a room code
            const newGameCode = generateRoomCode();

            // Create the room in Firestore
            await createRoom(newGameCode, hostId, hostName);

            // Save user info in local storage
            localStorage.setItem("playerId", hostId);
            localStorage.setItem("playerName", hostName);
            localStorage.setItem("gameCode", newGameCode);
            localStorage.setItem("isHost", "true");

            // Update state and navigate
            setGameCode(newGameCode);
            navigate("/lobby");
        } catch (error) {
            console.error("Error creating game:", error);
            alert("Failed to create game. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // Function to join an existing game
    const joinGame = async () => {
        if (!joinCode) {
            alert("Please enter a game code.");
            return;
        }

        setLoading(true);
        try {
            // Generate a unique ID for the player
            const playerId = uuidv4();

            // Generate a random name
            const randomName = ESC_WINNERS[Math.floor(Math.random() * ESC_WINNERS.length)];

            // Join the room in Firestore
            const joined = await joinRoom(joinCode.toUpperCase(), playerId, randomName);

            if (joined) {
                // Save user info in local storage
                localStorage.setItem("playerId", playerId);
                localStorage.setItem("playerName", randomName);
                localStorage.setItem("gameCode", joinCode.toUpperCase());
                localStorage.setItem("isHost", "false");

                // Navigate to lobby
                navigate("/lobby");
            } else {
                alert("Game not found!");
            }
        } catch (error) {
            console.error("Error joining game:", error);
            alert("Failed to join game. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Container>
            <h2>Multiplayer Quiz Lobby</h2>

            <Button onClick={handleCreateGame} disabled={loading}>
                {loading ? "Creating..." : "Create Game"}
            </Button>

            <JoinContainer>
                <Input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    placeholder="Enter game code"
                    disabled={loading}
                />
                <Button onClick={joinGame} disabled={loading}>
                    {loading ? "Joining..." : "Join Game"}
                </Button>
            </JoinContainer>
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
  opacity: ${props => props.disabled ? 0.7 : 1};
  
  &:disabled {
    cursor: not-allowed;
  }
`;

const JoinContainer = styled.div`
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const Input = styled.input`
  padding: 10px;
  margin: 10px;
  width: 80%;
`;
