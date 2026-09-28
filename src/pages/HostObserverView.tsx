import { useEffect, useState } from "react";
import styled from "styled-components";
import { useLocation, useNavigate } from "react-router-dom";
import { Player, Room, listenToRoom } from "../utils/roomsFirestore";
import { ObserverRouteState, isObserverHost, playingPlayers } from "../utils/roomRoles";
import { useResumeRoom } from "../hooks/useResumeRoom";

const HostObserverView = () => {
    const location = useLocation();
    const navigate = useNavigate();

    // Where this screen is and who's viewing: from the redirect that brought
    // us here (observerRouteState), with anything missing filled from this
    // tab's sessionStorage game. Router state survives a refresh, but one
    // from an older version of the app may lack playerId, and without it
    // the Continue below could never be enabled.
    const routeState = (location.state ?? {}) as Partial<ObserverRouteState>;
    const [session] = useState<{ roomCode?: string; playerId?: string } | null>(() => {
        try {
            return JSON.parse(sessionStorage.getItem("multiplayerGame") ?? "null");
        } catch (e) {
            console.error("Error parsing host observer data from sessionStorage:", e);
            return null;
        }
    });
    const roomCode = routeState.roomCode ?? session?.roomCode ?? null;
    const playerId = routeState.playerId ?? session?.playerId ?? null;

    // Everything below is derived from the latest snapshot.
    const [room, setRoom] = useState<Room | null>(null);
    const [error, setError] = useState<string | null>(null);
    const players = room ? playingPlayers(room) : (routeState.players ?? []);
    const playersAtMidQuiz = room?.playersAtMidQuiz ?? [];
    const allPlayersReady = players.length > 0 && players.every(player => playersAtMidQuiz.includes(player.id));
    const inBreak = room?.phase === "mid-scoreboard";
    // Continue resumes the room for everyone, so only the room's observer
    // host gets it, checked against the room rather than whoever opened
    // this page.
    const isRoomObserver = isObserverHost(room, playerId);

    // Start the next question for the whole room; the observer host doesn't
    // navigate to the quiz itself. Players follow the room's phase back to
    // the quiz (#63), and the same write clears the ready marks for the next
    // break. This screen stays up for the whole quiz, so any Continue state
    // or message is dropped as soon as the room moves on, keyed on the phase
    // and the index together: a locked phone can get one snapshot that goes
    // straight from one break to the next.
    const { resume, resuming, resumeError, reset } = useResumeRoom(roomCode);
    useEffect(() => {
        reset();
    }, [room?.phase, room?.currentQuestionIndex, reset]);

    useEffect(() => {
        if (!roomCode) return;
        const unsubscribe = listenToRoom(roomCode, (snapshot) => {
            if (snapshot) {
                setRoom(snapshot);
            } else {
                setError("Game room no longer exists");
                setTimeout(() => navigate("/multiplayer"), 2000);
            }
        });
        return () => unsubscribe();
    }, [roomCode, navigate]);

    if (error) {
        return (
            <Container>
                <Title>Error</Title>
                <ErrorMessage>{error}</ErrorMessage>
                <NextButton onClick={() => navigate("/multiplayer")}>Return to Multiplayer</NextButton>
            </Container>
        );
    }

    const continueHint = !isRoomObserver
        ? "Only the room's host can continue"
        : room?.phase === "results"
        ? "The quiz is over"
        : !inBreak
        ? "Continue is for the mid-quiz break"
        : !allPlayersReady && players.length > 0 ? "Wait for all players to reach the mid-quiz scoreboard" : "Continue to the next question";

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
                    {[...players]
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
                onClick={resume}
                disabled={resuming || !isRoomObserver || !inBreak || (players.length > 0 && !allPlayersReady)}
                title={continueHint}
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