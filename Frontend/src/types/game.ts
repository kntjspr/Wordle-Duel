// ─── Tile & Board ────────────────────────────────────────────────────────────

export type TileState = 'empty' | 'typing' | 'correct' | 'present' | 'absent';

export interface GuessTile {
  letter: string;
  state: TileState;
}

export interface GuessRow {
  tiles: GuessTile[];
  isSubmitted: boolean;
  score: number; // points earned on this row
}

// ─── Players ─────────────────────────────────────────────────────────────────

export type PlayerId = string;

export interface Player {
  id: PlayerId;
  name: string;
  score: number;
  guesses: GuessRow[];
  hasWon: boolean;
  isEliminated: boolean; // used all 5 attempts without winning
  isReady: boolean;
  isAI: boolean;
  aiDifficulty?: 'easy' | 'medium' | 'hard';
}

// ─── Lobby ───────────────────────────────────────────────────────────────────

export type LobbyStatus = 'waiting' | 'playing' | 'finished';

export interface LobbyPlayer {
  id: PlayerId;
  name: string;
  isHost: boolean;
}

export interface LobbyInfo {
  id: string;
  code: string;              // short display code e.g. "XKCD"
  hostName: string;
  players: LobbyPlayer[];
  maxPlayers: 5;
  status: LobbyStatus;
  createdAt: number;
}

// ─── Game ─────────────────────────────────────────────────────────────────────

export type GameMode = 'ai' | 'online';
export type GameScreen = 'landing' | 'lobby' | 'game' | 'results';

export interface GameResult {
  winnerId: PlayerId | null;
  winnerName: string | null;
  wonByGuess: boolean;       // true = guessed word, false = highest score
  word: string;
  players: Array<{
    id: PlayerId;
    name: string;
    score: number;
    hasWon: boolean;
    guesses: GuessRow[];
  }>;
}

export interface GameState {
  word: string;
  players: Player[];
  myId: PlayerId;
  currentRow: number;        // which row the local player is on (0–4)
  currentGuess: string;      // letters typed so far
  isGameOver: boolean;
  result: GameResult | null;
  wordList: string[];
  gameMode: GameMode;
  invalidGuess: boolean;     // shake animation trigger
  revealingRow: number | null; // which row is mid-flip animation
}

// ─── Keyboard ────────────────────────────────────────────────────────────────

export interface KeyState {
  [letter: string]: TileState | 'unused';
}

// ─── Score popup ─────────────────────────────────────────────────────────────

export interface ScorePopup {
  id: string;
  amount: number;
  x: number;
  y: number;
}
