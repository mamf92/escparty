import { create } from 'zustand';

type Player = {
  id: string;
  name: string;
  score?: number;
  isObserver?: boolean;
};

type RoomState = {
  code?: string;
  difficulty?: string;
  started?: boolean;
  players: Player[];
};

type GameState = {
  playerId?: string;
  playerName?: string;
  isHost?: boolean;
  room: RoomState;
  setPlayer: (id: string, name: string, isHost?: boolean) => void;
  setRoom: (room: Partial<RoomState>) => void;
  updatePlayerScore: (id: string, delta: number) => void;
  reset: () => void;
};

export const useGameStore = create<GameState>((set) => ({
  playerId: undefined,
  playerName: undefined,
  isHost: false,
  room: { players: [] },
  setPlayer: (id, name, isHost = false) => {
    set({ playerId: id, playerName: name, isHost });
    try {
      sessionStorage.setItem('playerId', id);
      sessionStorage.setItem('playerName', name);
      sessionStorage.setItem('isHost', JSON.stringify(isHost));
    } catch {
      // ignore sessionStorage errors
    }
  },
  setRoom: (room: Partial<RoomState>) => set((state: GameState) => ({ room: { ...state.room, ...room } })),
  updatePlayerScore: (id: string, delta: number) =>
    set((state) => ({
      room: {
        ...state.room,
        players: state.room.players.map((p: Player) => (p.id === id ? { ...p, score: (p.score || 0) + delta } : p)),
      },
    })),
  reset: () => {
    set({ playerId: undefined, playerName: undefined, isHost: false, room: { players: [] } });
    try {
      sessionStorage.removeItem('playerId');
      sessionStorage.removeItem('playerName');
      sessionStorage.removeItem('isHost');
      sessionStorage.removeItem('multiplayerGame');
    } catch {
      // Storage can be unavailable in private mode. Nothing to recover here.
    }
  },
}));

// Optional: hydrate from sessionStorage on load
try {
  const playerId = sessionStorage.getItem('playerId');
  const playerName = sessionStorage.getItem('playerName');
  const isHost = sessionStorage.getItem('isHost');
  if (playerId && playerName) {
    useGameStore.getState().setPlayer(playerId, playerName, JSON.parse(isHost || 'false'));
  }
} catch {
  // ignore
}

export default useGameStore;
