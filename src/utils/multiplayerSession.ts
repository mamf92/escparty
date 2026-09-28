// This tab's multiplayer game, kept in sessionStorage ("multiplayerGame") so
// a page opened without router state (a direct link, a new tab, a restored
// tab) can find its way back into the room. Lobby writes it when the game
// starts; the quiz page rewrites it. Router state, where there is some, wins.

export interface MultiplayerSession {
    multiplayer: true;
    roomCode: string;
    playerId: string;
    difficulty?: string;
}

export interface StoredGame {
    /** The stored game, or null if there's none or it can't be read. */
    game: MultiplayerSession | null;
    /** True when something is stored but it can't be read (corrupt, or
     *  missing its room or player), as opposed to nothing stored at all. */
    unreadable: boolean;
}

/** The stored game, and whether a stored value couldn't be read. Never
 *  throws, even where sessionStorage itself does (blocked storage). */
export const readStoredGame = (): StoredGame => {
    try {
        const raw = sessionStorage.getItem("multiplayerGame");
        if (raw === null) return { game: null, unreadable: false };
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.roomCode === "string" && typeof parsed.playerId === "string") {
            return {
                game: {
                    multiplayer: true,
                    roomCode: parsed.roomCode,
                    playerId: parsed.playerId,
                    difficulty: typeof parsed.difficulty === "string" ? parsed.difficulty : undefined,
                },
                unreadable: false,
            };
        }
    } catch (e) {
        console.error("Error reading multiplayer data from sessionStorage:", e);
    }
    return { game: null, unreadable: true };
};

/** The stored game, or null if there's none (or it can't be read). */
export const readMultiplayerGame = (): MultiplayerSession | null => readStoredGame().game;
