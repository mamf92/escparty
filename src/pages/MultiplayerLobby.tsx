import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { createRoom, joinRoom, generateRoomCode, getRoom, JoinRejected } from "../utils/roomsFirestore";
import { isKnownQuizKey, setRoomQuiz } from "../utils/quizCatalog";
import { useQuizTitle } from "../hooks/useQuizTitle";
import { CalmLink, CalmNote, CalmPage } from "../components/CalmPage";
import { Control, Field, Ground, Pane } from "../design";

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

type Step = "choose" | "host" | "join";

const NOT_FOUND_NOTE = "No game has that code. Check the four letters with the host and try again.";
const STARTED_NOTE = "That game has already started. Ask the host to start a new one.";

// What went wrong joining, as a note that says what to do next (#172).
// joinRoom answers "no such game" and "already started" with false, and
// throws for a full room (a JoinRejected as the cause) or a failure.
const joinErrorNote = (error: unknown): string => {
  const cause = (error as { cause?: unknown } | null)?.cause;
  if (cause instanceof JoinRejected && cause.reason === "full") return "This game is full. Ask the host to start a new one.";
  if (cause instanceof JoinRejected) return cause.reason === "started" ? STARTED_NOTE : NOT_FOUND_NOTE;
  const message = (error as { message?: string } | null)?.message ?? "";
  if (message.includes("Security rules")) return "The room didn't let you in. Try again, or check the code with the host.";
  return "We couldn't join the game. Check your connection and try again.";
};

// Why joinRoom said no: one more read tells a wrong code from a started game.
const refusedNote = async (code: string): Promise<string> => {
  try {
    const room = await getRoom(code);
    return room ? STARTED_NOTE : NOT_FOUND_NOTE;
  } catch {
    return "That game can't be joined: it may have started, or the code may be wrong. Check it with the host.";
  }
};

type StoredPlayer = { id: string; name: string };

/**
 * The way into a multiplayer quiz: host a game (playing along, or only
 * running it) or join one with its four-letter code. Errors and the offer
 * to rejoin as yourself are notes and controls on the page (#172).
 */
const MultiplayerLobby = () => {
  const [step, setStep] = useState<Step>("choose");
  const [joinCode, setJoinCode] = useState("");
  // Four letters, A to Z; the field upper-cases what is typed.
  const codeInvalid = !/^[A-Z]{4}$/.test(joinCode);
  const [loading, setLoading] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set when this device was already in the game with the typed code: the
  // player it was, offered back before joining (#65). Kept as offered, so
  // another tab changing the stored game can't swap who rejoins.
  const [rejoinAs, setRejoinAs] = useState<StoredPlayer | null>(null);
  const navigate = useNavigate();
  // A create or join still running when the page is left must not pull
  // the user into the lobby afterwards.
  const left = useRef(false);
  useEffect(() => {
    left.current = false;
    return () => { left.current = true; };
  }, []);
  // Keyboard focus: back to the control that was pressed once it is
  // enabled again, and onto the rejoin choice when it replaces the submit.
  const pressed = useRef<HTMLButtonElement | null>(null);
  const rejoinButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (loading) return;
    const target = pressed.current;
    pressed.current = null;
    if (target?.isConnected && document.activeElement === document.body) target.focus();
  }, [loading]);
  useEffect(() => {
    if (rejoinAs) rejoinButton.current?.focus();
  }, [rejoinAs]);
  // A quiz picked in the library before coming here (#72): the new room
  // starts with it chosen, and the host can start straight away.
  const location = useLocation();
  const [quizKey, setQuizKey] = useState(() => {
    const picked = (location.state as { quizKey?: string } | null)?.quizKey;
    return isKnownQuizKey(picked) ? picked : null;
  });
  const pickedTitle = useQuizTitle(quizKey);
  // The pick is for one new room: drop it from this history entry, so
  // coming Back here later doesn't preset the next room with it.
  const forgetPickedQuiz = () => {
    setQuizKey(null);
    if (location.state) navigate(location.pathname, { replace: true, state: null });
  };

  const goTo = (next: Step) => {
    setStep(next);
    setError(null);
    setAttempted(false);
    setRejoinAs(null);
    setJoinCode("");
  };

  // Create the room, with the host playing along or only observing.
  const createGame = async (hostIsObserver: boolean) => {
    setLoading(true);
    setError(null);
    try {
      // Generate a unique ID for the host
      const hostId = uuidv4();
      const hostName = "The host";

      // Generate a room code
      const newGameCode = generateRoomCode();

      // Create the room in Firestore
      await createRoom(newGameCode, hostId, hostName, hostIsObserver);
      if (quizKey) {
        // Best effort: if it doesn't stick, the lobby still offers the list.
        await setRoomQuiz(newGameCode, quizKey).catch(error =>
          console.error("Couldn't preselect the quiz:", error));
      }

      // Save user info in local storage
      localStorage.setItem("playerId", hostId);
      localStorage.setItem("playerName", hostName);
      localStorage.setItem("gameCode", newGameCode);
      localStorage.setItem("isHost", "true");
      // Whether the host only observes lives on the room (hostIsObserver),
      // which every page reads; a localStorage copy would outlive this game.

      if (left.current) return;
      forgetPickedQuiz();
      navigate("/lobby");
    } catch (error) {
      console.error("Error creating game:", error);
      if (!left.current) setError("We couldn't set up the room. Check your connection and try again.");
    } finally {
      if (!left.current) setLoading(false);
    }
  };

  // Join with the typed code. `rejoin` answers the rejoin offer; it is
  // undefined until that offer has been made.
  const joinGame = async (rejoin?: boolean) => {
    setAttempted(true);
    setError(null);

    if (codeInvalid) {
      return;
    }

    // Back into a game this device was already in (a closed tab, a
    // restarted browser, #65): the same player ID and name, so the room
    // lets them in again even after the start and their score carries on.
    // Asked first, since every tab on this device shares that identity and
    // someone else may be joining from it. Otherwise a new ID and a free
    // Eurovision winner's name.
    const code = joinCode;
    if (rejoin === undefined) {
      const storedId = localStorage.getItem("playerId");
      const storedName = localStorage.getItem("playerName");
      if (localStorage.getItem("gameCode") === code && storedId && storedName) {
        setRejoinAs({ id: storedId, name: storedName });
        return;
      }
    }

    setLoading(true);
    try {
      const before = rejoin === true ? rejoinAs : null;
      const playerId = before ? before.id : uuidv4();
      const randomName = before ? before.name : await getUniquePlayerName(code, ESC_WINNERS);

      // Join the room in Firestore
      const joined = await joinRoom(code, playerId, randomName);

      if (left.current) return;
      if (joined) {
        // Save user info in local storage
        localStorage.setItem("playerId", playerId);
        localStorage.setItem("playerName", randomName);
        localStorage.setItem("gameCode", code);

        // Navigate to lobby
        navigate("/lobby");
      } else {
        const note = await refusedNote(code);
        if (!left.current) setError(note);
      }
    } catch (error) {
      console.error("Error joining game:", error);
      if (!left.current) setError(joinErrorNote(error));
    } finally {
      if (!left.current) setLoading(false);
    }
  };

  const submitJoin = (event: FormEvent) => {
    event.preventDefault();
    // While the rejoin choice is up, Enter waits for one of its two buttons.
    if (rejoinAs || loading) return;
    void joinGame();
  };

  // Remember the pressed control, so focus can go back to it after loading.
  const remember = (event: MouseEvent<HTMLButtonElement>) => {
    pressed.current = event.currentTarget;
  };

  const backHome = <CalmLink onClick={() => navigate("/")} disabled={loading}>Back to ESCParty</CalmLink>;
  const footer = step === "choose" ? backHome : (
    <>
      <CalmLink onClick={() => goTo("choose")} disabled={loading}>Back to host or join</CalmLink>
      {backHome}
    </>
  );
  const showCodeHelp = attempted && codeInvalid;

  return (
    <CalmPage
      title="Multiplayer quiz"
      subtitle={step === "join"
        ? "Type the four-letter code from the host's screen."
        : "Play the quiz together: one of you hosts, everyone else joins with the code."}
      footer={footer}
    >
      {quizKey && <CalmNote>Hosting: {pickedTitle}</CalmNote>}

      {step === "choose" && (
        <Ground>
          <Pane>
            <Control block onClick={() => setStep("host")}>
              <span>Host a game</span>
              <span className="calm-sub">Get a code and invite your party</span>
            </Control>
            <Control
              block
              onClick={() => {
                // Joining someone else's room: the quiz picked for hosting doesn't apply.
                forgetPickedQuiz();
                setStep("join");
              }}
            >
              <span>Join a game</span>
              <span className="calm-sub">Got a code from the host? Jump in</span>
            </Control>
          </Pane>
        </Ground>
      )}

      {step === "host" && (
        <>
          <Ground>
            <Pane role="group" aria-label="How you'll host">
              <Control block disabled={loading} onClick={(event) => { remember(event); void createGame(false); }}>
                <span>Host and play</span>
                <span className="calm-sub">Run the game and answer along with everyone</span>
              </Control>
              <Control block disabled={loading} onClick={(event) => { remember(event); void createGame(true); }}>
                <span>Host only</span>
                <span className="calm-sub">Run the game and follow everyone's progress</span>
              </Control>
            </Pane>
          </Ground>
          {loading && <CalmNote role="status">Setting up the room…</CalmNote>}
          {error && <CalmNote role="alert">{error}</CalmNote>}
        </>
      )}

      {step === "join" && (
        <>
          <form onSubmit={submitJoin} noValidate>
            <Ground>
              <Pane>
                <label>
                  <span className="calm-label">Game code</span>
                  <Field
                    type="text"
                    value={joinCode}
                    onChange={(e) => {
                      setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""));
                      setRejoinAs(null);
                      setError(null);
                    }}
                    placeholder="ABBA"
                    disabled={loading}
                    aria-invalid={showCodeHelp}
                    aria-describedby={showCodeHelp ? "join-code-help" : undefined}
                    autoFocus
                    autoCapitalize="characters"
                    autoComplete="off"
                    maxLength={4}
                  />
                </label>
                {rejoinAs ? (
                  <>
                    <Control disabled={loading} onClick={(event) => { remember(event); void joinGame(false); }}>Join as someone new</Control>
                    <Control ref={rejoinButton} disabled={loading} onClick={(event) => { remember(event); void joinGame(true); }}>Rejoin as {rejoinAs.name}</Control>
                  </>
                ) : (
                  <Control type="submit" disabled={loading} onClick={remember}>Join the game</Control>
                )}
              </Pane>
            </Ground>
          </form>
          {showCodeHelp && <CalmNote id="join-code-help" role="alert">A game code is four letters, like ABBA.</CalmNote>}
          {rejoinAs && !loading && (
            <CalmNote role="status">
              You were in this game as {rejoinAs.name}. Rejoin as them, or join as someone new if someone else is playing on this device.
            </CalmNote>
          )}
          {loading && <CalmNote role="status">Joining the game…</CalmNote>}
          {error && <CalmNote role="alert">{error}</CalmNote>}
        </>
      )}
    </CalmPage>
  );
};

export default MultiplayerLobby;
