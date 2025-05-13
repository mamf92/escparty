import { useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { v4 as uuidv4 } from "uuid";
import { createRoom, joinRoom, generateRoomCode, getRoom } from "../utils/roomsFirestore";

const ESC_WINNERS = [
  "Loreen 🇸🇪", "Måneskin 🇮🇹", "Conchita Wurst 🕊️", "Alexander Rybak 🎻", "ABBA 🇸🇪", "Duncan Laurence 🎹", "Netta 🐔", "Dana International 🏳️‍🌈", "Céline Dion 🇨🇭", "Johnny Logan 🇮🇪", "Ruslana 🔥", "Lena 🇩🇪", "Lordi 👹", "Eleni Foureira 🔥", "Helena Paparizou 🇬🇷", "Marija Šerifović 🌈", "Emmelie de Forest 🎤", "Verka Serduchka 🌟", "Mahmood 🇮🇹", "Käärijä 💚", "Chanel 💃", "Barbara Pravi 🇫🇷", "Cornelia Jakobs 🌌", "Salvador Sobral 🕊️", "Noa Kirel 🦄", "Teya & Salena 🧪", "KEiiNO 🐺", "Benjamin Ingrosso 💫", "Subwoolfer 🚀", "Daði Freyr 🧔", "Rosa Linn 🧵", "Marco Mengoni 🎙️", "Gjon's Tears 😢", "Alessandra 👑", "Sam Ryder 🚀", "Go_A 🌿", "S10 🌧️", "Sergey Lazarev 💎", "Stefania 🐎", "Il Volo 🎶"
];

// Helper function to find a unique player name
const getUniquePlayerName = async (roomCode: string, namesList: string[]): Promise<string> => {
  // Get the current room data
  const room = await getRoom(roomCode);

  if (!room) {
    // If room doesn't exist, any name is fine
    return namesList[Math.floor(Math.random() * namesList.length)];
  }

  // Get all names currently in use
  const usedNames = room.players.map(player => player.name);

  // Filter out names that are already used
  const availableNames = namesList.filter(name => !usedNames.includes(name));

  if (availableNames.length === 0) {
    // If all names are taken, add a number suffix to a random name
    const baseName = namesList[Math.floor(Math.random() * namesList.length)];
    return `${baseName} #${Math.floor(Math.random() * 1000)}`;
  }

  // Return a random available name
  return availableNames[Math.floor(Math.random() * availableNames.length)];
};

const MultiplayerLobby = () => {
  const [_gameCode, setGameCode] = useState<string | null>(null); // Renamed to _gameCode as it's not used directly
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [showJoinForm, setShowJoinForm] = useState(false); // Added missing state variable
  const [showCreateOptions, setShowCreateOptions] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const navigate = useNavigate();

  // Function to create game with host as observer
  const createGame = async (hostIsObserver: boolean) => {
    setLoading(true);
    try {
      // Generate a unique ID for the host
      const hostId = uuidv4();
      const hostName = "👑 HOST 👑";

      // Generate a room code
      const newGameCode = generateRoomCode();

      // Create the room in Firestore
      await createRoom(newGameCode, hostId, hostName, hostIsObserver);

      // Save user info in local storage
      localStorage.setItem("playerId", hostId);
      localStorage.setItem("playerName", hostName);
      localStorage.setItem("gameCode", newGameCode);
      localStorage.setItem("isHost", "true");
      localStorage.setItem("hostIsObserver", String(hostIsObserver));

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

  // Function to handle showing create game options
  const handleShowCreateOptions = () => {
    setShowCreateOptions(true);
  };

  // Function to handle creating a game where host participates
  const handleCreateGameAsParticipant = () => {
    createGame(false);
  };

  // Function to handle creating a game where host observes
  const handleCreateGameAsObserver = () => {
    createGame(true);
  };

  // Function to join an existing game
  const joinGame = async () => {
    setAttempted(true);

    if (!joinCode) {
      return;
    }
    if (joinCode.length !== 4 || !/^[A-Z]{4}$/.test(joinCode)) {
      return;
    }

    setLoading(true);
    try {
      // Generate a unique ID for the player
      const playerId = uuidv4();

      // Get a unique name for the player
      let randomName = await getUniquePlayerName(joinCode.toUpperCase(), ESC_WINNERS);

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

  const handleShowJoinForm = () => {
    setShowJoinForm(true);
  };

  // Added function to go back to options
  const handleBackToOptions = () => {
    setShowJoinForm(false);
    setJoinCode("");
  };

  return (
    <Container>
      <Title>Multiplayer Quiz</Title>
      {!showJoinForm && !showCreateOptions ? (
        <OptionsContainer>
          <OptionCard onClick={loading ? undefined : handleShowCreateOptions} disabled={loading}>
            <OptionTitle>Create game</OptionTitle>
            <OptionDescription>Host your own game and invite friends!</OptionDescription>
            {loading && <LoadingText>Creating...</LoadingText>}
          </OptionCard>

          <OrDivider>OR</OrDivider>

          <OptionCard onClick={loading ? undefined : handleShowJoinForm} disabled={loading}>
            <OptionTitle>Join game</OptionTitle>
            <OptionDescription>Enter a game code to join an existing game.</OptionDescription>
          </OptionCard>
        </OptionsContainer>
      ) : showCreateOptions ? (
        <OptionsContainer>
          <OptionCard onClick={loading ? undefined : () => createGame(false)} disabled={loading}>
            <OptionTitle>Host & Play</OptionTitle>
            <OptionDescription>Host the game and participate in the quiz</OptionDescription>
            {loading && <LoadingText>Creating...</LoadingText>}
          </OptionCard>

          <OrDivider>OR</OrDivider>

          <OptionCard onClick={loading ? undefined : () => createGame(true)} disabled={loading}>
            <OptionTitle>Host Only</OptionTitle>
            <OptionDescription>Host the game and observe the players' progress</OptionDescription>
            {loading && <LoadingText>Creating...</LoadingText>}
          </OptionCard>

          <Button onClick={() => setShowCreateOptions(false)} disabled={loading} secondary style={{ marginTop: '1rem' }}>
            Back
          </Button>
        </OptionsContainer>
      ) : (
        <JoinContainer>
          <JoinTitle>Enter Game Code</JoinTitle>
          <Input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="code"
            disabled={loading}
            isInvalid={attempted && (!joinCode || joinCode.length < 4 || !/^[A-Z]{4}$/.test(joinCode))}
            autoFocus
            autoCapitalize="characters"
            maxLength={4}
          />
          {attempted && (!joinCode || joinCode.length < 4 || !/^[A-Z]{4}$/.test(joinCode)) && <InputHelperText>Please enter 4 letters.</InputHelperText>}
          <ButtonGroup>
            <Button onClick={handleBackToOptions} disabled={loading} secondary>
              Back
            </Button>
            <Button onClick={joinGame} disabled={loading}>
              {loading ? "Joining..." : "Join Game"}
            </Button>
          </ButtonGroup>
        </JoinContainer>
      )}
    </Container>
  );
};

export default MultiplayerLobby;

// Styled Components
interface OptionCardProps {
  disabled?: boolean;
}
interface ButtonProps {
  secondary?: boolean;
}

interface InputProps {
  isInvalid?: boolean;
}

const Container = styled.div`
  text-align: center;
  max-width: 31.25rem; /* 500px - standardized width */
  margin: auto;
  padding: 1.25rem; /* 20px */
`;

const Title = styled.h2`
  font-family: ${({ theme }) => theme.fonts.heading};
  color: ${({ theme }) => theme.colors.white};
  font-size: 2rem;
  margin-bottom: 1.25rem; /* 20px */
`;

const OptionsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.9375rem; /* 15px */
`;

const OptionCard = styled.div<OptionCardProps>`
  padding: 1.25rem; /* 20px */
  background: ${({ theme }) => theme.colors.purple};
  border: 0.125rem solid ${({ theme }) => theme.colors.purple}; /* 2px */
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  opacity: ${props => props.disabled ? 0.7 : 1};
  transition: all 0.2s ease;
  position: relative;
  
  &:hover {
    background: ${({ theme }) => theme.colors.darkpurple};
    border-color: ${({ theme }) => theme.colors.darkpurple};
  }
`;

const OptionTitle = styled.h3`
  color: ${({ theme }) => theme.colors.white};
  font-size: 1.5rem;
  margin-bottom: 0.5rem; /* 8px */
`;

const OptionDescription = styled.p`
  color: ${({ theme }) => theme.colors.white};
  font-size: 1rem;
`;

const LoadingText = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  font-weight: bold;
`;

const OrDivider = styled.div`
  display: flex;
  align-items: center;
  margin: 0.3125rem 0; /* 5px */
  color: ${({ theme }) => theme.colors.white};
  font-size: 0.9rem;
  
  &::before, &::after {
    content: '';
    flex: 1;
    height: 0.0625rem; /* 1px */
    background: ${({ theme }) => theme.colors.deepblue};
    margin: 0 0.625rem; /* 10px */
  }
`;

const JoinContainer = styled.div`
  margin-top: 1.25rem; /* 20px */
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const JoinTitle = styled.h3`
  color: ${({ theme }) => theme.colors.white};
  font-size: 1.4rem;
  margin-bottom: 0.9375rem; /* 15px */
`;

const Input = styled.input<InputProps>`
  padding: 0.75rem; /* 12px */
  margin: 0.625rem 0; /* 10px */
  width: 90%;
  border: 0.1875rem solid ${({ isInvalid, theme }) => isInvalid ? theme.colors.accentorange : theme.colors.purple}; /* 3px */
  background: ${({ theme }) => theme.colors.white};
  color: ${({ theme }) => theme.colors.black};
  font-size: 1rem;
  border-radius: 0; 
  -webkit-appearance: none; 
  -moz-appearance: none; 
  appearance: none; 
  text-transform: uppercase;
  
  &:focus {
    outline: none;
    border-width: 0.125rem; /* 2px */
  }
`;

const InputHelperText = styled.div`
  color: ${({ theme }) => theme.colors.accentorange};
  font-size: 0.9rem;
  align-self: flex-start;
  margin-left: 5%;
  margin-top: 0.3125rem; /* 5px */
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 0.625rem; /* 10px */
  margin-top: 0.625rem; /* 10px */
  width: 90%;
  justify-content: space-between;
`;

const Button = styled.button<ButtonProps>`
    padding: 0.75rem 1.25rem; /* 12px 20px */
    background: ${({ secondary, theme }) => secondary ? theme.colors.darkpurple : theme.colors.purple};
    color: ${({ theme }) => theme.colors.white};
    font-size: 1rem;
    font-weight: bold;
    border: none;
    cursor: pointer;
    flex: ${props => props.secondary ? '0.4' : '0.6'};
    transition: all 0.2s ease;

    &:hover {
      background: ${({ secondary, theme }) => secondary ? theme.colors.purple : theme.colors.darkpurple};
    }
    
    &:disabled {
      cursor: not-allowed;
      opacity: 0.7;
    }
  `;
