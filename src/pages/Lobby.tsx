import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import styled, { keyframes } from "styled-components";
import { listenToRoom, Room, setRoomDifficulty, startGame } from "../utils/roomsFirestore";

const Lobby = () => {
    const [room, setRoom] = useState<Room | null>(null);
    const [isHost, setIsHost] = useState<boolean>(false);
    const [gameCode, setGameCode] = useState<string | null>(null);
    const [playerName, setPlayerName] = useState<string | null>(null);
    const [_playerId, setPlayerId] = useState<string | null>(null); // Renamed to _playerId to indicate it's not used directly
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const navigate = useNavigate();

    useEffect(() => {
        // Get user data from localStorage
        const storedGameCode = localStorage.getItem("gameCode");
        const storedPlayerId = localStorage.getItem("playerId");
        const storedPlayerName = localStorage.getItem("playerName");
        const storedIsHost = localStorage.getItem("isHost") === "true";

        if (!storedGameCode || !storedPlayerId || !storedPlayerName) {
            setError("Missing game data. Returning to multiplayer lobby.");
            setTimeout(() => navigate("/multiplayer"), 2000);
            return;
        }

        setGameCode(storedGameCode);
        setPlayerId(storedPlayerId);
        setPlayerName(storedPlayerName);
        setIsHost(storedIsHost);

        // Set up real-time listener for room changes
        const unsubscribe = listenToRoom(storedGameCode, (roomData) => {
            if (roomData) {
                setRoom(roomData);
                setLoading(false);

                // Check if game has started
                if (roomData.started) {
                    // Save essentials to sessionStorage to persist through page refresh 
                    // Only pass hostIsObserver=true if the current user is the host and host is observer
                    const isCurrentUserObserver = storedIsHost && roomData.hostIsObserver || false;

                    sessionStorage.setItem("multiplayerGame", JSON.stringify({
                        multiplayer: true,
                        roomCode: storedGameCode,
                        playerId: storedPlayerId,
                        difficulty: roomData.difficulty,
                        hostIsObserver: isCurrentUserObserver
                    }));

                    navigate(`/quiz/${roomData.difficulty}`, {
                        state: {
                            multiplayer: true,
                            roomCode: storedGameCode,
                            playerId: storedPlayerId,
                            hostIsObserver: isCurrentUserObserver
                        }
                    });
                }
            } else {
                setError("Game not found");
                setLoading(false);
            }
        });

        // Clean up listener when component unmounts
        return () => unsubscribe();
    }, [navigate]);

    const handleSelectDifficulty = async (displayDifficulty: string) => {
        if (isHost && gameCode) {
            // Convert to lowercase for internal storage while keeping display capitalized
            const difficulty = displayDifficulty.toLowerCase();
            try {
                await setRoomDifficulty(gameCode, difficulty);
            } catch (error) {
                console.error("Error setting difficulty:", error);
                setError("Failed to set difficulty");
            }
        }
    };

    const handleStartGame = async () => {
        if (isHost && gameCode) {
            try {
                if (!room?.difficulty) {
                    alert("Please select a difficulty first!");
                    return;
                }
                await startGame(gameCode);
            } catch (error) {
                console.error("Error starting game:", error);
                setError("Failed to start game");
            }
        }
    };

    if (loading) {
        return (
            <Container>
                <Title>Loading Lobby...</Title>
            </Container>
        );
    }

    if (error) {
        return (
            <Container>
                <Title>Error</Title>
                <ErrorMessage>{error}</ErrorMessage>
            </Container>
        );
    }

    return (
        <Container>
            <Title>Quiz Lobby</Title>
            {playerName && <PlayerName>You are: <Highlight>{playerName}</Highlight></PlayerName>}
            <GameInfo>
                <InfoItem>Game Code: <Code>{gameCode}</Code></InfoItem>
                <InfoItem>Difficulty: <Difficulty>{room?.difficulty ? room.difficulty.charAt(0).toUpperCase() + room.difficulty.slice(1) : "Not selected"}</Difficulty></InfoItem>
            </GameInfo>
            <AnimatedSubtitle>Waiting for players...</AnimatedSubtitle>

            {/* If host and difficulty not selected, show difficulty options */}
            {isHost && !room?.difficulty && (
                <DifficultySection>
                    <SubTitle>Select Difficulty:</SubTitle>
                    <ButtonGroup>
                        <DifficultyButton onClick={() => handleSelectDifficulty("Easy")}>Easy</DifficultyButton>
                        <DifficultyButton onClick={() => handleSelectDifficulty("Medium")}>Medium</DifficultyButton>
                        <DifficultyButton onClick={() => handleSelectDifficulty("Hard")}>Hard</DifficultyButton>
                    </ButtonGroup>
                </DifficultySection>
            )}

            <PlayerListTitle>Current players:</PlayerListTitle>
            <PlayerList>
                {room?.players
                    .filter(player => !(room.hostIsObserver && player.id === room.hostId))
                    .map((player, _index) => (
                        <Player key={player.id}>
                            {player.name}
                        </Player>
                    ))}
            </PlayerList>

            {isHost && room?.difficulty && <StartButton onClick={handleStartGame}>Start Game</StartButton>}
        </Container>
    );
};

export default Lobby;

// Styled Components
const Container = styled.div`
    text-align: center;
    padding: 1.25rem; /* 20px */
    width: 100%;
    max-width: 31.25rem; /* 500px */
    margin: auto;
    background: ${({ theme }) => theme.colors.nightblue};
    color: ${({ theme }) => theme.colors.magnolia};
    border-radius: 0; /* Making consistent with square design */
`;

const Title = styled.h2`
    font-size: 2rem;
    margin-bottom: 1.25rem; /* 20px */
    font-family: ${({ theme }) => theme.fonts.heading};
    color: ${({ theme }) => theme.colors.white}; /* Changed to white */
`;

const GameInfo = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.625rem; /* 10px */
    margin: 0.9375rem 0; /* 15px 0 */
    width: 100%;
`;

const InfoItem = styled.p`
    font-size: 1.2rem;
    margin: 0.3125rem 0; /* 5px 0 */
    color: ${({ theme }) => theme.colors.white}; /* Explicitly set to white */
`;

const Code = styled.span`
    font-weight: bold;
    color: ${({ theme }) => theme.colors.brightpurple}; /* Changed to purple */
    font-size: 1.4rem;
`;

const Difficulty = styled.span`
    font-weight: bold;
    color: ${({ theme }) => theme.colors.brightpurple}; /* Changed to purple */
    font-size: 1.2rem;
`;

const PlayerListTitle = styled.h3`
    font-size: 1.2rem;
    margin-top: 1em;
    text-align: left;
    text-decoration: underline;
    color: ${({ theme }) => theme.colors.white}; /* Changed to white */
`;

const Highlight = styled.span`
    font-weight: bold;
    color: ${({ theme }) => theme.colors.brightpurple}; /* Changed to purple */
`;

const PlayerList = styled.ul`
    list-style: none;
    padding: 0;
    text-align: left;
    margin: 1.25rem 0; /* 20px 0 */
    width: 100%;
`;

const Player = styled.li`
    font-size: 1.2rem;
    margin: 0.3125rem 0; /* 5px 0 */
    color: ${({ theme }) => theme.colors.white}; /* Explicitly set to white */
`;

const StartButton = styled.button`
    margin-top: 1.25rem; /* 20px */
    padding: 1rem 1.25rem; /* 16px 20px */
    font-size: 1.2rem;
    background-color: ${({ theme }) => theme.colors.purple}; /* Changed to purple */
    color: white;
    border: none;
    cursor: pointer;
    border-radius: 0;
    transition: 0.3s;
    font-weight: bold; /* Added bold text */
    width: 100%;
    &:hover {
        background: ${({ theme }) => theme.colors.darkpurple};
    }
`;

const PlayerName = styled.p`
    margin-top: 1.25rem; /* 20px */
    font-size: 1.2rem;
    font-weight: bold;
    color: ${({ theme }) => theme.colors.white}; /* Changed to white */
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

const ErrorMessage = styled.p`
    color: ${({ theme }) => theme.colors.incorrectRed};
    font-size: 1.2rem;
    margin: 1.25rem 0; /* 20px 0 */
`;

const DifficultySection = styled.div`
    margin: 1.25rem 0; /* 20px 0 */
    padding: 0.625rem; /* 10px */
    background: rgba(255, 255, 255, 0.1);
    border-radius: 0; /* Making consistent with square design */
    width: 100%;
`;

const SubTitle = styled.h3`
    font-size: 1.2rem;
    margin-bottom: 0.9375rem; /* 15px */
    color: ${({ theme }) => theme.colors.white}; /* Changed to white */
`;

const ButtonGroup = styled.div`
    display: flex;
    justify-content: space-between;
    gap: 0.625rem; /* 10px */
    flex-wrap: wrap;
    width: 100%;
`;

const DifficultyButton = styled.button`
    padding: 0.5rem 1rem; /* 8px 16px */
    background-color: ${({ theme }) => theme.colors.purple}; /* Changed to purple */
    color: white;
    border: none;
    border-radius: 0;
    cursor: pointer;
    transition: 0.3s;
    font-weight: bold; /* Added bold text */
    flex: 1;
    
    &:hover {
        background: ${({ theme }) => theme.colors.darkpurple};
    }
`;
