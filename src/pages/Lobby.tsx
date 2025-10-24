import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import styled, { keyframes } from "styled-components";
import { listenToRoom, Room, setRoomDifficulty, startGame } from "../utils/roomsFirestore";
import { useGameSession } from "../store/gameSession";

const Lobby = () => {
    const navigate = useNavigate();

    // Read from Zustand store
    const roomCode = useGameSession((state) => state.roomCode);
    const playerId = useGameSession((state) => state.playerId);
    const playerName = useGameSession((state) => state.playerName);
    const isHost = useGameSession((state) => state.isHost);
    const hostIsObserver = useGameSession((state) => state.hostIsObserver); // ← Remove underscore
    const setDifficulty = useGameSession((state) => state.setDifficulty);

    // Local component state
    const [room, setRoom] = useState<Room | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        // Safety check
        if (!roomCode || !playerId) {
            console.error("Missing roomCode or playerId, redirecting to multiplayer");
            setError("Missing game data. Returning to multiplayer lobby.");
            setTimeout(() => navigate("/multiplayer"), 2000);
            return;
        }

        // Set up real-time listener
        const unsubscribe = listenToRoom(roomCode, (roomData) => {
            if (roomData) {
                setRoom(roomData);
                setLoading(false);

                // Check if game started
                if (roomData.started) {
                    // === CHANGE THIS LINE ===
                    // const isCurrentUserObserver = isHost && roomData.hostIsObserver;
                    
                    // === TO THIS (use Zustand as source of truth) ===
                    const isCurrentUserObserver = isHost && hostIsObserver;

                    // Write difficulty to Zustand
                    if (roomData.difficulty) {
                        setDifficulty(roomData.difficulty as 'easy' | 'medium' | 'hard');
                    }

                    // Keep sessionStorage for backward compatibility (temporary)
                    sessionStorage.setItem("multiplayerGame", JSON.stringify({
                        multiplayer: true,
                        roomCode: roomCode,
                        playerId: playerId,
                        difficulty: roomData.difficulty,
                        hostIsObserver: isCurrentUserObserver
                    }));

                    navigate(`/quiz/${roomData.difficulty}`, {
                        state: {
                            multiplayer: true,
                            roomCode: roomCode,
                            playerId: playerId,
                            hostIsObserver: isCurrentUserObserver
                        }
                    });
                }
            } else {
                setError("Game not found");
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, [roomCode, playerId, isHost, hostIsObserver, navigate, setDifficulty]); // ← Add hostIsObserver

    const handleSelectDifficulty = async (displayDifficulty: string) => {
        if (isHost && roomCode) {
            const difficulty = displayDifficulty.toLowerCase();
            try {
                await setRoomDifficulty(roomCode, difficulty);
                setDifficulty(difficulty as 'easy' | 'medium' | 'hard');
            } catch (error) {
                console.error("Error setting difficulty:", error);
                setError("Failed to set difficulty");
            }
        }
    };

    const handleStartGame = async () => {
        if (isHost && roomCode) {
            try {
                if (!room?.difficulty) {
                    alert("Please select a difficulty first!");
                    return;
                }
                await startGame(roomCode);
            } catch (error) {
                console.error("Error starting game:", error);
                setError("Failed to start game");
            }
        }
    };

    // Safety check
    if (!roomCode || !playerId) {
        return (
            <Container>
                <Title>Redirecting...</Title>
            </Container>
        );
    }

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
                <InfoItem>Game Code: <Code>{roomCode}</Code></InfoItem>
                <InfoItem>Difficulty: <Difficulty>{room?.difficulty ? room.difficulty.charAt(0).toUpperCase() + room.difficulty.slice(1) : "Not selected"}</Difficulty></InfoItem>
            </GameInfo>
            <AnimatedSubtitle>Waiting for players...</AnimatedSubtitle>

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
                    .map((player) => (
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

// Styled Components (unchanged)
const Container = styled.div`
    text-align: center;
    padding: 1.25rem;
    width: 100%;
    max-width: 31.25rem;
    margin: auto;
    background: ${({ theme }) => theme.colors.nightblue};
    color: ${({ theme }) => theme.colors.magnolia};
    border-radius: 0;
`;

const Title = styled.h2`
    font-size: 2rem;
    margin-bottom: 1.25rem;
    font-family: ${({ theme }) => theme.fonts.heading};
    color: ${({ theme }) => theme.colors.white};
`;

const GameInfo = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.625rem;
    margin: 0.9375rem 0;
    width: 100%;
`;

const InfoItem = styled.p`
    font-size: 1.2rem;
    margin: 0.3125rem 0;
    color: ${({ theme }) => theme.colors.white};
`;

const Code = styled.span`
    font-weight: bold;
    color: ${({ theme }) => theme.colors.brightpurple};
    font-size: 1.4rem;
`;

const Difficulty = styled.span`
    font-weight: bold;
    color: ${({ theme }) => theme.colors.brightpurple};
    font-size: 1.2rem;
`;

const PlayerListTitle = styled.h3`
    font-size: 1.2rem;
    margin-top: 1em;
    text-align: left;
    text-decoration: underline;
    color: ${({ theme }) => theme.colors.white};
`;

const Highlight = styled.span`
    font-weight: bold;
    color: ${({ theme }) => theme.colors.brightpurple};
`;

const PlayerList = styled.ul`
    list-style: none;
    padding: 0;
    text-align: left;
    margin: 1.25rem 0;
    width: 100%;
`;

const Player = styled.li`
    font-size: 1.2rem;
    margin: 0.3125rem 0;
    color: ${({ theme }) => theme.colors.white};
`;

const StartButton = styled.button`
    margin-top: 1.25rem;
    padding: 1rem 1.25rem;
    font-size: 1.2rem;
    background-color: ${({ theme }) => theme.colors.purple};
    color: white;
    border: none;
    cursor: pointer;
    border-radius: 0;
    transition: 0.3s;
    font-weight: bold;
    width: 100%;
    &:hover {
        background: ${({ theme }) => theme.colors.darkpurple};
    }
`;

const PlayerName = styled.p`
    margin-top: 1.25rem;
    font-size: 1.2rem;
    font-weight: bold;
    color: ${({ theme }) => theme.colors.white};
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
    margin: 1.25rem 0;
`;

const DifficultySection = styled.div`
    margin: 1.25rem 0;
    padding: 0.625rem;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 0;
    width: 100%;
`;

const SubTitle = styled.h3`
    font-size: 1.2rem;
    margin-bottom: 0.9375rem;
    color: ${({ theme }) => theme.colors.white};
`;

const ButtonGroup = styled.div`
    display: flex;
    justify-content: space-between;
    gap: 0.625rem;
    flex-wrap: wrap;
    width: 100%;
`;

const DifficultyButton = styled.button`
    padding: 0.5rem 1rem;
    background-color: ${({ theme }) => theme.colors.purple};
    color: white;
    border: none;
    border-radius: 0;
    cursor: pointer;
    transition: 0.3s;
    font-weight: bold;
    flex: 1;
    
    &:hover {
        background: ${({ theme }) => theme.colors.darkpurple};
    }
`;
