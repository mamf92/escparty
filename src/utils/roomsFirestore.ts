import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    arrayUnion,
    onSnapshot,
    serverTimestamp,
    Timestamp
} from "firebase/firestore";
import { db } from "../firebase";

// Define room and player interfaces
export interface Player {
    id: string;
    name: string;
    score: number;
    joinedAt?: any; // Firestore timestamp
}

export interface Room {
    id: string;
    hostId: string;
    started: boolean;
    difficulty?: string;
    createdAt: any; // Firestore timestamp
    players: Player[];
}

/**
 * Debug utility to check if Firebase is properly initialized
 */
export const checkFirebaseInitialization = () => {
    if (!db) {
        console.error("Firebase Firestore instance not initialized!");
        return false;
    }

    // Add more detailed db checking
    console.log("Firebase DB object exists:", !!db);
    console.log("Firebase app mode:", import.meta.env.MODE);
    return true;
};

/**
 * Create a new room with the given host
 */
export const createRoom = async (roomCode: string, hostId: string, hostName: string): Promise<void> => {
    console.log(`Creating room ${roomCode} with host ${hostName} (${hostId})`);
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
            createdAt: serverTimestamp(), // This is fine outside of the array
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
            players: [{
                ...roomData.players[0],
                joinedAt: currentTime.toDate().toISOString() // Convert to ISO string for logging
            }]
        }));

        await setDoc(roomRef, roomData);
        console.log(`Room ${roomCode} created successfully`);
    } catch (error) {
        console.error("Error creating room:", error);
        console.error("Error details:", (error as any)?.code, (error as any)?.message);
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
    console.log(`Adding player ${playerName} (${playerId}) to room ${roomCode}`);

    if (!checkFirebaseInitialization()) {
        throw new Error("Firebase not initialized");
    }

    try {
        // Use Timestamp.now() instead of serverTimestamp() for player data
        const currentTime = Timestamp.now();

        const roomRef = doc(db, "rooms", roomCode);
        await updateDoc(roomRef, {
            players: arrayUnion({
                id: playerId,
                name: playerName,
                score: 0,
                joinedAt: currentTime // Use regular timestamp object
            })
        });
        console.log(`Player ${playerName} added to room ${roomCode}`);
    } catch (error) {
        console.error("Error adding player to room:", error);
        throw new Error(`Failed to add player: ${(error as Error).message}`);
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
        await updateDoc(roomRef, { started: true });
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

    try {
        // Get current room data to find the player
        const roomRef = doc(db, "rooms", roomCode);
        const roomDoc = await getDoc(roomRef);

        if (!roomDoc.exists()) {
            throw new Error(`Room ${roomCode} does not exist`);
        }

        const room = roomDoc.data() as Room;
        const updatedPlayers = room.players.map(player => {
            if (player.id === playerId) {
                return { ...player, score };
            }
            return player;
        });

        await updateDoc(roomRef, { players: updatedPlayers });
        console.log(`Score updated for player ${playerId} in room ${roomCode}`);
    } catch (error) {
        console.error("Error updating player score:", error);
        throw new Error(`Failed to update score: ${(error as Error).message}`);
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
 * Join a room by room code
 * @returns boolean indicating if joining was successful
 */
export const joinRoom = async (roomCode: string, playerId: string, playerName: string): Promise<boolean> => {
    console.log(`Attempting to join room ${roomCode} as ${playerName} (${playerId})`);

    if (!checkFirebaseInitialization()) {
        throw new Error("Firebase not initialized");
    }

    try {
        // First, check if room exists
        const room = await getRoom(roomCode);
        if (!room) {
            console.log(`Cannot join room ${roomCode} - room does not exist`);
            return false;
        }

        // Check if game has already started
        if (room.started) {
            console.log(`Cannot join room ${roomCode} - game already started`);
            return false;
        }

        // Add player to the room
        await addPlayerToRoom(roomCode, playerId, playerName);
        console.log(`Successfully joined room ${roomCode}`);
        return true;
    } catch (error) {
        console.error("Error joining room:", error);
        throw new Error(`Failed to join room: ${(error as Error).message}`);
    }
};