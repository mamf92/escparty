import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    arrayUnion,
    onSnapshot,
    runTransaction,
    serverTimestamp,
    Timestamp,
    FieldValue
} from "firebase/firestore";
import { db } from "../firebase";
import { phaseAfterQuestion } from "./quizTiming";

// Define room and player interfaces
export interface Player {
    id: string;
    name: string;
    score: number;
    joinedAt?: Timestamp | FieldValue;
}

/**
 * Which stage of the quiz a room is in. Server-authoritative: written by
 * createRoom/startGame and the progression writes below (advanceQuestion,
 * resumeAfterMidQuiz), never derived per client. In multiplayer, Quiz.tsx
 * renders whatever question this says (#62).
 */
export type RoomPhase = "lobby" | "question" | "mid-scoreboard" | "results";

export interface Room {
    id: string;
    hostId: string;
    started: boolean;
    difficulty?: string;
    createdAt: Timestamp | FieldValue;
    players: Player[];
    hostIsObserver?: boolean; // Flag to indicate if host is in observer mode
    continueReady?: boolean; // Unused since #63 (players follow `phase`); old rooms may still carry it
    playersAtMidQuiz?: string[]; // Array of playerIds that have reached the mid-quiz scoreboard
    // Shared progression state (#61). Optional because rooms created before
    // these fields existed don't have them.
    phase?: RoomPhase;
    currentQuestionIndex?: number;
    // Written as serverTimestamp(), never a client clock. Reads as null in a
    // snapshot where that write is still pending (the writer's own listener
    // sees it first), so readers must handle null.
    phaseStartedAt?: Timestamp | FieldValue | null;
}

/**
 * A score write the room turned down for a reason another attempt can't
 * change (#131). `reason` says which, so callers don't parse messages.
 */
export class ScoreWriteRejected extends Error {
    constructor(
        public readonly reason: "invalid-score" | "no-room" | "unknown-player" | "lower-score",
        message: string,
        /** For "lower-score": the score the room already holds. */
        public readonly currentScore?: number,
    ) {
        super(message);
        this.name = "ScoreWriteRejected";
    }
}

/**
 * Debug utility to check if Firebase is properly initialized
 */
export const checkFirebaseInitialization = () => {
    if (!db) {
        console.error("Firebase database not initialized");
        return false;
    }
    return true;
};

/**
 * Create a new room with the given host
 */
export const createRoom = async (roomCode: string, hostId: string, hostName: string, hostIsObserver: boolean = false): Promise<void> => {
    console.log(`Creating room ${roomCode} with host ${hostName} (${hostId}), hostIsObserver: ${hostIsObserver}`);
    console.log("Environment:", import.meta.env.MODE, "BASE_URL:", import.meta.env.BASE_URL);

    if (!checkFirebaseInitialization()) {
        const error = new Error("Firebase not initialized");
        console.error(error);
        throw error;
    }

    try {
        // Use a regular timestamp for player data instead of serverTimestamp()
        // because serverTimestamp() is not supported inside arrays
        const currentTime = Timestamp.now();
        console.log("Current timestamp created:", currentTime);

        const roomRef = doc(db, "rooms", roomCode);
        console.log("Room reference created:", roomRef);

        const roomData: Room = {
            id: roomCode,
            hostId,
            started: false,
            hostIsObserver,
            createdAt: serverTimestamp(), // This is fine outside of the array
            phase: "lobby",
            currentQuestionIndex: 0,
            phaseStartedAt: serverTimestamp(),
            players: [{
                id: hostId,
                name: hostName,
                score: 0,
                joinedAt: currentTime // Use Timestamp.now() instead of serverTimestamp()
            }]
        };

        console.log("About to create room with data:", JSON.stringify({
            ...roomData,
            createdAt: "SERVER_TIMESTAMP", // Cannot stringify the timestamp
            phaseStartedAt: "SERVER_TIMESTAMP",
            players: [{
                ...roomData.players[0],
                joinedAt: currentTime.toDate().toISOString() // Convert to ISO string for logging
            }]
        }));

        await setDoc(roomRef, roomData);
        console.log(`Room ${roomCode} created successfully`);
    } catch (error) {
        console.error("Error creating room:", error);
        const detail = error as { code?: string; message?: string };
        console.error("Error details:", detail?.code, detail?.message);
        console.error("Stack:", (error as Error).stack);
        throw new Error(`Failed to create room: ${(error as Error).message}`);
    }
};

/**
 * Get room data by room code
 */
export const getRoom = async (roomCode: string): Promise<Room | null> => {
    console.log(`Getting room ${roomCode}`);

    if (!checkFirebaseInitialization()) {
        throw new Error("Firebase not initialized");
    }

    try {
        const roomRef = doc(db, "rooms", roomCode);
        const roomDoc = await getDoc(roomRef);

        if (roomDoc.exists()) {
            return roomDoc.data() as Room;
        } else {
            console.log(`Room ${roomCode} does not exist`);
            return null;
        }
    } catch (error) {
        console.error("Error getting room:", error);
        throw new Error(`Failed to get room: ${(error as Error).message}`);
    }
};

/**
 * Add a player to a room
 */
export const addPlayerToRoom = async (roomCode: string, playerId: string, playerName: string): Promise<void> => {
    if (!checkFirebaseInitialization()) {
        throw new Error("Firebase not initialized");
    }

    try {
        // Get current room data to validate
        const currentRoom = await getRoom(roomCode);
        
        if (!currentRoom) {
            throw new Error("Room not found");
        }
        
        if (currentRoom.started) {
            throw new Error("Game has already started");
        }

        // Only the same ID is the same player. Matching on the name too
        // skipped a second guest who drew the same name, leaving their ID
        // out of the room, so every score they sent was lost (#131). The
        // join screen already draws a name nobody in the room has; two
        // guests joining at the same instant can still share one, which only
        // costs a duplicate name on the scoreboard, not a score.
        const existingPlayer = currentRoom.players.find(p => p.id === playerId);
        if (existingPlayer) {
            return; // Player already exists, skip adding
        }

        const roomRef = doc(db, "rooms", roomCode);
        const currentTime = Timestamp.now();
        
        const newPlayer = {
            id: playerId,
            name: playerName,
            score: 0,
            joinedAt: currentTime
        };
        
        await updateDoc(roomRef, {
            players: arrayUnion(newPlayer)
        });
        
    } catch (error) {
        const err = error as { code?: string; message: string };
        console.error("Error adding player to room:", error);
        
        if (err.code === 'permission-denied') {
            throw new Error("Security rules prevented joining the room");
        }
        
        throw error;
    }
};

/**
 * Set the difficulty of a room
 */
export const setRoomDifficulty = async (roomCode: string, difficulty: string): Promise<void> => {
    console.log(`Setting difficulty for room ${roomCode} to ${difficulty}`);

    if (!checkFirebaseInitialization()) {
        throw new Error("Firebase not initialized");
    }

    try {
        const roomRef = doc(db, "rooms", roomCode);
        await updateDoc(roomRef, { difficulty });
        console.log(`Difficulty set to ${difficulty} for room ${roomCode}`);
    } catch (error) {
        console.error("Error setting room difficulty:", error);
        throw new Error(`Failed to set difficulty: ${(error as Error).message}`);
    }
};

/**
 * Start a game in a room
 */
export const startGame = async (roomCode: string): Promise<void> => {
    console.log(`Starting game in room ${roomCode}`);

    if (!checkFirebaseInitialization()) {
        throw new Error("Firebase not initialized");
    }

    try {
        const roomRef = doc(db, "rooms", roomCode);
        await updateDoc(roomRef, {
            started: true,
            phase: "question",
            currentQuestionIndex: 0,
            phaseStartedAt: serverTimestamp(),
        });
        console.log(`Game started in room ${roomCode}`);
    } catch (error) {
        console.error("Error starting game:", error);
        throw new Error(`Failed to start game: ${(error as Error).message}`);
    }
};

/**
 * Update a player's score
 */
export const updatePlayerScore = async (roomCode: string, playerId: string, score: number): Promise<void> => {
    console.log(`Updating score for player ${playerId} in room ${roomCode} to ${score}`);

    if (!checkFirebaseInitialization()) {
        throw new Error("Firebase not initialized");
    }

    // Defense in depth: reject nonsensical scores before they ever reach Firestore.
    // This is client-side validation only, not a security boundary — see
    // docs/agent/firestore-data-model.md for the actual trust boundary.
    if (!Number.isFinite(score) || score < 0) {
        throw new ScoreWriteRejected("invalid-score", `Refusing to write invalid score ${score} for player ${playerId}`);
    }

    try {
        const roomRef = doc(db, "rooms", roomCode);
        // A transaction (not a plain getDoc+updateDoc) so the "don't lower an
        // existing score" check below reads the state it actually writes
        // against — a manual read-modify-write here can't stop a concurrent
        // write (e.g. submitAnswer and handleTimeUp both firing near a
        // question's deadline) from reverting an already-committed score.
        await runTransaction(db, async (transaction) => {
            const roomDoc = await transaction.get(roomRef);

            if (!roomDoc.exists()) {
                throw new ScoreWriteRejected("no-room", `Room ${roomCode} does not exist`);
            }

            const room = roomDoc.data() as Room;
            const existingPlayer = room.players.find(player => player.id === playerId);
            // An unknown player (a stale or regenerated ID) would otherwise
            // rewrite the array unchanged and report success (#131).
            if (!existingPlayer) {
                throw new ScoreWriteRejected("unknown-player", `Room ${roomCode} has no player ${playerId}`);
            }
            if (score < existingPlayer.score) {
                throw new ScoreWriteRejected(
                    "lower-score",
                    `Refusing to lower score for player ${playerId} in room ${roomCode} (${existingPlayer.score} -> ${score})`,
                    existingPlayer.score
                );
            }

            const updatedPlayers = room.players.map(player => {
                if (player.id === playerId) {
                    return { ...player, score };
                }
                return player;
            });

            transaction.update(roomRef, { players: updatedPlayers });
        });
        console.log(`Score updated for player ${playerId} in room ${roomCode}`);
    } catch (error) {
        console.error("Error updating player score:", error);
        if (error instanceof ScoreWriteRejected) {
            throw new ScoreWriteRejected(error.reason, `Failed to update score: ${error.message}`, error.currentScore);
        }
        throw new Error(`Failed to update score: ${(error as Error).message}`);
    }
};

/**
 * End the question the room is on and move it to whatever comes next: the
 * next question, the mid-quiz break, or the results (see phaseAfterQuestion).
 *
 * Any client may call this once the question's slot is over — the observer
 * host never runs the quiz, so it can't be host-only. It runs in a
 * transaction and only advances if the room is still on `fromIndex` in the
 * question phase, so when several clients race to end the same question,
 * one write lands and the rest are no-ops. firestore.rules rejects the write
 * until QUESTION_SLOT_MS after phaseStartedAt, so a client with a fast clock
 * gets permission-denied and should simply try again a moment later.
 *
 * @returns true if this call advanced the room, false if it had already moved on.
 */
export const advanceQuestion = async (roomCode: string, fromIndex: number, totalQuestions: number): Promise<boolean> => {
    if (!checkFirebaseInitialization()) {
        throw new Error("Firebase not initialized");
    }

    try {
        const roomRef = doc(db, "rooms", roomCode);
        return await runTransaction(db, async (transaction) => {
            const roomDoc = await transaction.get(roomRef);
            if (!roomDoc.exists()) {
                throw new Error(`Room ${roomCode} does not exist`);
            }

            const room = roomDoc.data() as Room;
            if (room.phase !== "question" || room.currentQuestionIndex !== fromIndex) {
                return false;
            }

            const next = phaseAfterQuestion(fromIndex, totalQuestions);
            transaction.update(roomRef, {
                phase: next.phase,
                currentQuestionIndex: next.currentQuestionIndex,
                phaseStartedAt: serverTimestamp(),
            });
            return true;
        });
    } catch (error) {
        console.error("Error advancing question:", error);
        throw new Error(`Failed to advance question: ${(error as Error).message}`);
    }
};

/**
 * Leave the mid-quiz break: start the question the room is already pointing
 * at (the break's currentQuestionIndex is the next question), and clear who
 * was marked ready at the scoreboard for the next break. A no-op unless
 * the room is actually in the break, so a double-click or a second host tab
 * can't restart a question that's already running.
 *
 * @returns true if this call resumed the quiz, false if it wasn't in the break.
 */
export const resumeAfterMidQuiz = async (roomCode: string): Promise<boolean> => {
    if (!checkFirebaseInitialization()) {
        throw new Error("Firebase not initialized");
    }

    try {
        const roomRef = doc(db, "rooms", roomCode);
        return await runTransaction(db, async (transaction) => {
            const roomDoc = await transaction.get(roomRef);
            if (!roomDoc.exists()) {
                throw new Error(`Room ${roomCode} does not exist`);
            }

            const room = roomDoc.data() as Room;
            if (room.phase !== "mid-scoreboard") {
                return false;
            }

            // Clearing the ready marks in the same write means a resume can't
            // half-happen and leave stale marks that make the next break
            // look "all ready" before anyone has arrived.
            transaction.update(roomRef, {
                phase: "question",
                phaseStartedAt: serverTimestamp(),
                playersAtMidQuiz: [],
            });
            return true;
        });
    } catch (error) {
        console.error("Error resuming after mid-quiz:", error);
        throw new Error(`Failed to resume quiz: ${(error as Error).message}`);
    }
};

/**
 * Listen to changes in a room
 */
export const listenToRoom = (roomCode: string, callback: (room: Room | null) => void): (() => void) => {
    console.log(`Setting up listener for room ${roomCode}`);

    if (!checkFirebaseInitialization()) {
        console.error("Firebase not initialized - cannot set up listener");
        callback(null);
        return () => { }; // Return empty function
    }

    try {
        const roomRef = doc(db, "rooms", roomCode);
        const unsubscribe = onSnapshot(
            roomRef,
            (doc) => {
                if (doc.exists()) {
                    const roomData = doc.data() as Room;
                    console.log(`Room ${roomCode} data updated:`, roomData);
                    callback(roomData);
                } else {
                    console.log(`Room ${roomCode} does not exist or was deleted`);
                    callback(null);
                }
            },
            (error) => {
                console.error(`Error listening to room ${roomCode}:`, error);
                callback(null);
            }
        );

        return unsubscribe;
    } catch (error) {
        console.error("Error setting up room listener:", error);
        callback(null);
        return () => { }; // Return empty function
    }
};

/**
 * Generate a random room code (4 uppercase letters)
 */
export const generateRoomCode = (): string => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < 4; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    console.log(`Generated room code: ${result}`);
    return result;
};

/**
 * Signal to continue to the next question
 * @deprecated Nothing calls this since #63: players return from the break by
 * following `room.phase` (see resumeAfterMidQuiz). Kept so the exported API
 * doesn't change outside a coordinated migration.
 */
export const setContinueReady = async (roomCode: string, continueReady: boolean): Promise<void> => {
    console.log(`Setting continue ready state for room ${roomCode} to ${continueReady}`);

    if (!checkFirebaseInitialization()) {
        throw new Error("Firebase not initialized");
    }

    try {
        const roomRef = doc(db, "rooms", roomCode);
        await updateDoc(roomRef, { continueReady });
        console.log(`Continue ready state set to ${continueReady} for room ${roomCode}`);
    } catch (error) {
        console.error("Error setting continue ready state:", error);
        throw new Error(`Failed to set continue ready state: ${(error as Error).message}`);
    }
};

/**
 * Mark a player as ready at mid-quiz scoreboard
 */
export const markPlayerAtMidQuiz = async (roomCode: string, playerId: string): Promise<void> => {
    console.log(`Marking player ${playerId} as ready at mid-quiz in room ${roomCode}`);

    if (!checkFirebaseInitialization()) {
        throw new Error("Firebase not initialized");
    }

    try {
        // arrayUnion, not a read-modify-write: since #62 every player reaches
        // the break on the same snapshot, and concurrent read-modify-writes
        // dropped each other's IDs, leaving an observer host's Continue
        // disabled for good. arrayUnion adds server-side and skips an ID
        // that's already there, so no read is needed. (updateDoc fails on a
        // room that doesn't exist.)
        const roomRef = doc(db, "rooms", roomCode);
        await updateDoc(roomRef, { playersAtMidQuiz: arrayUnion(playerId) });
        console.log(`Player ${playerId} marked as ready at mid-quiz in room ${roomCode}`);
    } catch (error) {
        console.error("Error marking player as ready at mid-quiz:", error);
        throw new Error(`Failed to mark player as ready: ${(error as Error).message}`);
    }
};

/**
 * Reset the players at mid-quiz array
 * @deprecated Nothing calls this since #62: resumeAfterMidQuiz clears the
 * marks in the same write that resumes the room.
 */
export const resetPlayersAtMidQuiz = async (roomCode: string): Promise<void> => {
    console.log(`Resetting players at mid-quiz for room ${roomCode}`);

    if (!checkFirebaseInitialization()) {
        throw new Error("Firebase not initialized");
    }

    try {
        const roomRef = doc(db, "rooms", roomCode);
        await updateDoc(roomRef, { playersAtMidQuiz: [] });
        console.log(`Players at mid-quiz reset for room ${roomCode}`);
    } catch (error) {
        console.error("Error resetting players at mid-quiz:", error);
        throw new Error(`Failed to reset players at mid-quiz: ${(error as Error).message}`);
    }
};

// Update the joinRoom function with better error handling

export const joinRoom = async (roomCode: string, playerId: string, playerName: string): Promise<boolean> => {
    if (!checkFirebaseInitialization()) {
        throw new Error("Firebase not initialized");
    }

    try {
        // addPlayerToRoom reads the room itself, and a player already in it
        // (the same ID) is a no-op there, so a rejoin also counts as success.
        await addPlayerToRoom(roomCode, playerId, playerName);
        return true;
    } catch (error) {
        const err = error as { code?: string; message: string };

        // A code that doesn't exist, or a game that's already on, is an
        // answer rather than a failure.
        if (err.message === "Room not found" || err.message === "Game has already started") {
            return false;
        }

        console.error("Error joining room:", error);

        if (err.code === 'permission-denied' || err.message.includes('Security rules')) {
            throw new Error("Failed to join room: Security rules prevented access");
        }

        throw new Error(`Failed to join room: ${err.message}`);
    }
};
