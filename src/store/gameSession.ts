import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface GameSessionState {
// Mode and player info
  isMultiplayer: boolean; 
  playerId: string | null;
  playerName: string | null;
  isHost: boolean;
  roomCode: string | null;
  hostIsObserver: boolean;

// Game state info
  difficulty: 'easy' | 'medium' | 'hard' | null; // Changed: allow null
  currentQuestionIndex: number;
  score: number; 
  isGameActive: boolean;

// Actions
  setMultiplayerMode: (isMultiplayer: boolean) => void;
  setPlayerIdentity: (playerId: string, playerName: string, isHost: boolean) => void;
  setRoomInfo: (roomCode: string, hostIsObserver?: boolean) => void;
  setDifficulty: (difficulty: 'easy' | 'medium' | 'hard') => void;
  setCurrentQuestionIndex: (index: number) => void;
  incrementScore: (points: number) => void;
  setScore: (score: number) => void;
  resetGame: () => void;
  clearSession: () => void;
}

export const useGameSession = create<GameSessionState>()(
  persist(
    (set) => ({
      // Initial state
      isMultiplayer: false,
      playerId: null,
      playerName: null,
      isHost: false,
      roomCode: null,
      hostIsObserver: false,
      difficulty: null,
      currentQuestionIndex: 0,
      score: 0,
      isGameActive: false,
      
      // Actions
      setMultiplayerMode: (isMultiplayer) => 
        set({ isMultiplayer }),
      
      setPlayerIdentity: (playerId, playerName, isHost) => 
        set({ playerId, playerName, isHost }),
      
      setRoomInfo: (roomCode, hostIsObserver = false) => 
        set({ roomCode, hostIsObserver }),
      
      setDifficulty: (difficulty) => 
        set({ difficulty }),
      
      setCurrentQuestionIndex: (index) => 
        set({ currentQuestionIndex: index }),
      
      incrementScore: (points) => 
        set((state) => ({ score: state.score + points })),
      
      setScore: (score) => 
        set({ score }),
      
      resetGame: () => 
        set({ 
          currentQuestionIndex: 0, 
          score: 0, 
          isGameActive: false 
        }),
      
      clearSession: () => 
        set({
          isMultiplayer: false,
          playerId: null,
          playerName: null,
          isHost: false,
          roomCode: null,
          hostIsObserver: false,
          difficulty: null,
          currentQuestionIndex: 0,
          score: 0,
          isGameActive: false,
        }),
    }),
    {
      name: 'europarty:session',
    }
  )
);

// Expose store to window object in development
declare global {
  interface Window {
    gameSession?: ReturnType<typeof useGameSession>;
  }
}

if (import.meta.env.DEV) {
  window.gameSession = useGameSession;
  console.log('🎮 Game session store exposed to window.gameSession');
}