import { useEffect, useState, useCallback } from "react";
import styled from "styled-components";
import { useLocation, useNavigate } from "react-router-dom";
import { Player, listenToRoom } from "../utils/roomsFirestore";
import { useResumeRoom } from "../hooks/useResumeRoom";

const HostObserverView = () => {
    const location = useLocation();
    const navigate = useNavigate();

    // Try to get data from location state first
    const locationState = location.state || {
        currentQuestionIndex: 0,
        difficulty: "easy",
        players: [],
        roomCode: null
    };

    const [gameData, setGameData] = useState({
        currentQuestionIndex: locationState.currentQuestionIndex || 0,
        difficulty: locationState.difficulty || "easy",
        players: locationState.players || [],
        roomCode: locationState.roomCode || null
    });

    const [players, setPlayers] = useState<Player[]>(gameData.players);
    const [error, setError] = useState<string | null>(null);
    const [playersAtMidQuiz, setPlayersAtMidQuiz] = useState<string[]>([]);
    const [allPlayersReady, setAllPlayersReady] = useState<boolean>(false);
    // Start the next question for the whole room; the observer host doesn't
    // navigate to the quiz itself. Players follow the room's phase back to
    // the quiz (#63), and the same write clears the ready marks for the next
    // break.
    const { resume, resuming, resumeError } = useResumeRoom(gameData.roomCode);

    const continueQuiz = useCallback(async () => {
        if (error) {
            navigate("/multiplayer");
            return;
        }
        await resume();
    }, [navigate, error, resume]);

    useEffect(() => {
        // If we don't have location state but we're on this page, try to recover from sessionStorage
        if (!location.state) {
            const storedData = sessionStorage.getItem('multiplayerGame');
            if (storedData) {
                try {
                    const hostData = JSON.parse(storedData);
                    setGameData(prev => ({
                        ...prev,
                        roomCode: hostData.roomCode,
                        difficulty: hostData.difficulty || prev.difficulty,
                        currentQuestionIndex: hostData.currentQuestionIndex || 0
                    }));
                } catch (e) {
                    console.error("Error parsing host observer data from sessionStorage:", e);
                    setError("Unable to retrieve game data. Please return to the lobby.");
                }
            }
        }

        // Set up real-time listener if we have a room code
        if (gameData.roomCode) {
            const unsubscribe = listenToRoom(gameData.roomCode, (room) => {
                if (room) {
                    // Filter out host from players list (since host is in observer mode)
                    const filteredPlayers = room.players.filter(player => player.id !== room.hostId);

                    // Always update players array to ensure real-time score updates
                    setPlayers(filteredPlayers);

                    // Update the players at mid-quiz array
                    if (room.playersAtMidQuiz) {
                        setPlayersAtMidQuiz(room.playersAtMidQuiz);

                        // Check if all players are at the mid-quiz scoreboard
                        // We compare the players array (excluding host) with the players at mid-quiz array
                        const allReady = filteredPlayers.length > 0 &&
                            filteredPlayers.every(player =>
                                room.playersAtMidQuiz?.includes(player.id)
                            );
                        setAllPlayersReady(allReady);
                    } else {
                        setPlayersAtMidQuiz([]);
                        setAllPlayersReady(false);
                    }
                } else {
                    setError("Game room no longer exists");
                    setTimeout(() => navigate("/multiplayer"), 2000);
                }
            });

            return () => unsubscribe();
        }
    }, [gameData.roomCode, location.state, navigate]);

    if (error) {
        return (
            <Container>
                <Title>Error</Title>
                <ErrorMessage>{error}</ErrorMessage>
                <NextButton onClick={() => navigate("/multiplayer")}>Return to Multiplayer</NextButton>
            </Container>
        );
    }

    return (
        <Container>
            <Title>📊 Host Observer View</Title>
            <ScoreTitle>🏆 Current Standings</ScoreTitle>
            <ScoreTable>
                <thead>
                    <tr>
                        <th>Player</th>
                        <th>Score</th>
                    </tr>
                </thead>
                <tbody>
                    {players
                        .sort((a: Player, b: Player) => b.score - a.score)
                        .map((player: Player) => (
                            <tr key={player.id}>
                                <td>
                                    {player.name}
                                    {playersAtMidQuiz.includes(player.id) && (
                                        <ReadyIndicator>✓</ReadyIndicator>
                                    )}
                                </td>
                                <td>{player.score}</td>
                            </tr>
                        ))}
                </tbody>
            </ScoreTable>

            <WaitingMessage>
                <ReadyIndicator>✓</ReadyIndicator> indicates players ready to continue
            </WaitingMessage>

            <NextButton
                onClick={continueQuiz}
                disabled={resuming || (players.length > 0 && !allPlayersReady)}
                title={!allPlayersReady && players.length > 0 ? "Wait for all players to reach the mid-quiz scoreboard" : "Continue to the next question"}
            >
                {resuming ? "Continuing..." : "Continue Quiz"}
            </NextButton>
            {resumeError && <ErrorMessage>{resumeError}</ErrorMessage>}
        </Container>
    );
};

export default HostObserverView;

// Styled Components
const Container = styled.div`
  width: 100%;
  max-width: 31.25rem; /* 500px */
  margin: auto;
  text-align: center;
  padding: 1.25rem; /* 20px */
  background: ${({ theme }) => theme.colors.magnolia};
  border-radius: 0; /* Changed to match square design */
`;

const Title = styled.h2`
  font-family: ${({ theme }) => theme.fonts.heading};
  color: ${({ theme }) => theme.colors.night};
  font-size: 1.5rem;
  margin-bottom: 1.25rem; /* 20px */
`;

const ScoreTitle = styled.h3`
  font-family: ${({ theme }) => theme.fonts.heading};
  color: ${({ theme }) => theme.colors.night};
  margin-top: 1.25rem; /* 20px */
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

const NextButton = styled.button`
  margin-top: 1.25rem; /* 20px */
  padding: 1rem 2rem; /* 16px 32px */
  font-size: 1rem;
  font-weight: bold;
  background-color: ${({ theme }) => theme.colors.purple};
  color: white;
  border: none;
  cursor: pointer;
  transition: 0.3s;
  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.darkpurple};
  }
  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
`;

const ErrorMessage = styled.p`
  color: ${({ theme }) => theme.colors.incorrectRed};
  font-size: 1.2rem;
  margin-bottom: 1.25rem; /* 20px */
`;

const WaitingMessage = styled.p`
  color: ${({ theme }) => theme.colors.deepblue};
  font-size: 1rem;
  font-style: italic;
  margin-top: 0.75rem; /* 12px */
  margin-bottom: 0.5rem; /* 8px */
  padding: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const ReadyIndicator = styled.span`
  color: ${({ theme }) => theme.colors.correctGreen};
  margin-left: 0.5rem;
  font-weight: bold;
`;