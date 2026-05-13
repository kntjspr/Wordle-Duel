import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameState, Player, GuessRow, GameMode, GameResult } from '../types/game';
import { buildGuessRow, deriveKeyStates, isCorrectGuess, WIN_BONUS } from '../lib/wordle';
import { pickAIGuess, getAIDelay, AI_CONFIGS } from '../lib/ai';
import { fetchRandomWord, fetchWordList } from '../api/wordList';

const MAX_ROWS = 5;
const WORD_LENGTH = 5;

// ─── Player factory ──────────────────────────────────────────────────────────

function makePlayer(id: string, name: string, isAI = false): Player {
  return {
    id,
    name,
    score: 0,
    guesses: [],
    hasWon: false,
    isEliminated: false,
    isReady: false,
    isAI,
    aiDifficulty: isAI ? 'medium' : undefined,
  };
}

// ─── Hook ────────────────────────────────────────────────────────────────────

interface UseGameEngineProps {
  playerName: string;
  gameMode: GameMode;
  lobbyPlayers?: Array<{ id: string; name: string; isAI?: boolean }>;
  onGameOver?: (result: GameResult) => void;
}

export function useGameEngine({ playerName, gameMode, lobbyPlayers, onGameOver }: UseGameEngineProps) {
  const myId = 'local-player';
  const aiTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [wordList, setWordList] = useState<string[]>([]);
  const [initError, setInitError] = useState<string | null>(null);
  const [state, setState] = useState<GameState>({
    word: '',
    players: [],
    myId,
    currentRow: 0,
    currentGuess: '',
    isGameOver: false,
    result: null,
    wordList: [],
    gameMode,
    invalidGuess: false,
    revealingRow: null,
  });

  // ── Init game ──────────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      try {
        setInitError(null);
        const [word, list] = await Promise.all([fetchRandomWord(), fetchWordList()]);
        const validList = list.filter(w => w.length === WORD_LENGTH);

        let players: Player[];

        if (gameMode === 'ai') {
          players = [
            makePlayer(myId, playerName, false),
            makePlayer('ai-1', 'WordBot α', true),
          ];
        } else {
          // Online mode: use lobby players + local player
          players = (lobbyPlayers ?? []).map(lp =>
            makePlayer(lp.id, lp.name, lp.isAI ?? false)
          );
          if (!players.find(p => p.id === myId)) {
            players.unshift(makePlayer(myId, playerName, false));
          }
        }

        setState(s => ({ ...s, word, players, wordList: validList }));
        setWordList(validList);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load word data';
        setInitError(message);
      }
    }
    init();
    return () => {
      aiTimers.current.forEach(t => clearTimeout(t));
      aiTimers.current.clear();
    };
  }, []); // eslint-disable-line

  // ── AI turn scheduler ──────────────────────────────────────────────────────
  const scheduleAI = useCallback((aiPlayer: Player, currentWord: string, currentList: string[], currentGuesses: GuessRow[]) => {
    if (aiPlayer.hasWon || aiPlayer.isEliminated) return;
    if (currentGuesses.length >= MAX_ROWS) return;

    const config = AI_CONFIGS[aiPlayer.aiDifficulty ?? 'medium'];
    const delay = getAIDelay(config);

    const timer = setTimeout(() => {
      const guess = pickAIGuess(currentList, currentGuesses, aiPlayer.aiDifficulty ?? 'medium');
      const newRow = buildGuessRow(guess, currentWord);
      const won = isCorrectGuess(guess, currentWord);

      setState(prev => {
        if (prev.isGameOver) return prev;
        const updatedPlayers = prev.players.map(p => {
          if (p.id !== aiPlayer.id) return p;
          const newGuesses = [...p.guesses, newRow];
          const newScore = p.score + newRow.score + (won ? WIN_BONUS : 0);
          return {
            ...p,
            guesses: newGuesses,
            score: newScore,
            hasWon: won,
            isEliminated: !won && newGuesses.length >= MAX_ROWS,
          };
        });

        const gameOver = won || checkAllDone(updatedPlayers);
        const result = gameOver ? buildResult(updatedPlayers, prev.word) : null;
        if (result) onGameOver?.(result);

        return { ...prev, players: updatedPlayers, isGameOver: gameOver, result };
      });
    }, delay);

    aiTimers.current.set(aiPlayer.id, timer);
  }, [onGameOver]);

  // Watch for AI players needing their next turn
  useEffect(() => {
    if (!state.word || state.isGameOver) return;
    const list = wordList.length ? wordList : state.wordList;

    state.players.forEach(p => {
      if (!p.isAI || p.hasWon || p.isEliminated) return;
      if (aiTimers.current.has(p.id)) return; // already scheduled

      scheduleAI(p, state.word, list, p.guesses);
    });
  }, [state.players, state.word, state.isGameOver, wordList, scheduleAI]);

  // Clear AI timer when player finishes
  useEffect(() => {
    state.players.forEach(p => {
      if (p.isAI && (p.hasWon || p.isEliminated)) {
        const t = aiTimers.current.get(p.id);
        if (t) {
          clearTimeout(t);
          aiTimers.current.delete(p.id);
        }
      }
    });
  }, [state.players]);

  // ── Keyboard input ─────────────────────────────────────────────────────────

  const typeLetter = useCallback((letter: string) => {
    setState(prev => {
      if (prev.isGameOver) return prev;
      const me = prev.players.find(p => p.id === myId);
      if (!me || me.hasWon || me.isEliminated) return prev;
      if (prev.currentGuess.length >= WORD_LENGTH) return prev;
      return { ...prev, currentGuess: prev.currentGuess + letter.toLowerCase(), invalidGuess: false };
    });
  }, []);

  const deleteLetter = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentGuess: prev.currentGuess.slice(0, -1),
      invalidGuess: false,
    }));
  }, []);

  const submitGuess = useCallback(() => {
    setState(prev => {
      if (prev.isGameOver) return prev;
      const guess = prev.currentGuess;
      if (guess.length !== WORD_LENGTH) return prev;

      // Validate word
      const isValid = prev.wordList.includes(guess.toLowerCase());
      if (!isValid) return { ...prev, invalidGuess: true };

      const me = prev.players.find(p => p.id === myId);
      if (!me || me.hasWon || me.isEliminated) return prev;

      const newRow = buildGuessRow(guess, prev.word);
      const won = isCorrectGuess(guess, prev.word);

      const updatedPlayers = prev.players.map(p => {
        if (p.id !== myId) return p;
        const newGuesses = [...p.guesses, newRow];
        const newScore = p.score + newRow.score + (won ? WIN_BONUS : 0);
        return {
          ...p,
          guesses: newGuesses,
          score: newScore,
          hasWon: won,
          isEliminated: !won && newGuesses.length >= MAX_ROWS,
        };
      });

      const gameOver = won || checkAllDone(updatedPlayers);
      const result = gameOver ? buildResult(updatedPlayers, prev.word) : null;
      if (result) onGameOver?.(result);

      // Cancel pending AI timers so they can reschedule
      aiTimers.current.forEach((t, id) => {
        if (id !== myId) {
          clearTimeout(t);
          aiTimers.current.delete(id);
        }
      });

      return {
        ...prev,
        players: updatedPlayers,
        currentGuess: '',
        currentRow: prev.currentRow + 1,
        isGameOver: gameOver,
        result,
        revealingRow: prev.currentRow,
        invalidGuess: false,
      };
    });

    // Clear revealingRow after animation
    setTimeout(() => {
      setState(prev => ({ ...prev, revealingRow: null }));
    }, 600);
  }, [onGameOver]);

  // ── Keyboard event listener ────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Backspace') { deleteLetter(); return; }
      if (e.key === 'Enter') { submitGuess(); return; }
      if (/^[a-zA-Z]$/.test(e.key)) typeLetter(e.key);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [typeLetter, deleteLetter, submitGuess]);

  // ── Derived state ──────────────────────────────────────────────────────────

  const me = state.players.find(p => p.id === myId);
  const keyStates = me ? deriveKeyStates(me.guesses) : {};

  return {
    state,
    me,
    keyStates,
    initError,
    typeLetter,
    deleteLetter,
    submitGuess,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function checkAllDone(players: Player[]): boolean {
  return players.every(p => p.hasWon || p.isEliminated || p.guesses.length >= MAX_ROWS);
}

function buildResult(players: Player[], word: string): GameResult {
  // Find winner: first person who guessed correctly wins outright
  const winner = players.find(p => p.hasWon) ?? null;

  if (winner) {
    return {
      winnerId: winner.id,
      winnerName: winner.name,
      wonByGuess: true,
      word,
      players: players.map(p => ({
        id: p.id,
        name: p.name,
        score: p.score,
        hasWon: p.hasWon,
        guesses: p.guesses,
      })),
    };
  }

  // No one guessed: highest score wins
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const top = sorted[0];
  const tied = sorted.filter(p => p.score === top.score);
  const isDrawn = tied.length > 1;

  return {
    winnerId: isDrawn ? null : top.id,
    winnerName: isDrawn ? null : top.name,
    wonByGuess: false,
    word,
    players: players.map(p => ({
      id: p.id,
      name: p.name,
      score: p.score,
      hasWon: p.hasWon,
      guesses: p.guesses,
    })),
  };
}
