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

/** The stored game, or null if there's none (or it can't be read). */
export const readMultiplayerGame = (): MultiplayerSession | null => {
    try {
        const parsed = JSON.parse(sessionStorage.getItem("multiplayerGame") ?? "null");
        if (parsed && typeof parsed.roomCode === "string" && typeof parsed.playerId === "string") {
            return {
                multiplayer: true,
                roomCode: parsed.roomCode,
                playerId: parsed.playerId,
                difficulty: typeof parsed.difficulty === "string" ? parsed.difficulty : undefined,
            };
        }
    } catch (e) {
        console.error("Error parsing multiplayer data from sessionStorage:", e);
    }
    return null;
};
