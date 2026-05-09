/**
 * useOnlineGame.ts — Server-driven game state for online multiplayer.
 *
 * Unlike useGameEngine (which evaluates guesses locally), this hook:
 *  - Sends submit_guess to the backend
 *  - Receives guess_result (full tile data for local player only)
 *  - Receives player_update (visible tiles for opponents, grey stripped)
 *  - Receives game_over and builds a GameResult for the ResultsScreen
 *
 * Local keyboard + typing state is still managed on the frontend.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameState, Player, GuessRow, GuessTile, TileState, GameResult } from '../types/game';
import { wsClient } from '../api/wsClient';
import type {
  GuessResultPayload, PlayerUpdatePayload, GameOverPayload,
} from '../api/wsClient';
import { deriveKeyStates } from '../lib/wordle';

const WORD_LENGTH = 5;

// ─── Player factory ───────────────────────────────────────────────────────────

function makePlayer(id: string, name: string): Player {
  return {
    id, name,
    score: 0,
    guesses: [],
    hasWon: false,
    isEliminated: false,
    isReady: false,
    isAI: false,
  };
}

// ─── Tile converters ──────────────────────────────────────────────────────────

function serverTileToState(state: string): TileState {
  if (state === 'correct') return 'correct';
  if (state === 'present') return 'present';
  return 'absent';
}

function buildRowFromServer(tiles: GuessResultPayload['tiles']): GuessRow {
  let score = 0;
  const guessedTiles: GuessTile[] = tiles.map(t => {
    const s = serverTileToState(t.state);
    if (s === 'correct') score += 2;
    if (s === 'present') score += 1;
    return { letter: t.letter, state: s };
  });
  return { tiles: guessedTiles, isSubmitted: true, score };
}

function buildRowFromVisible(tiles: PlayerUpdatePayload['visible_tiles']): GuessRow {
  let score = 0;
  const guessedTiles: GuessTile[] = tiles.map(t => {
    let state: TileState;
    if (t.state === 'correct') { state = 'correct'; score += 2; }
    else if (t.state === 'present') { state = 'present'; score += 1; }
    else { state = 'absent'; }
    return { letter: t.letter, state };
  });
  return { tiles: guessedTiles, isSubmitted: true, score };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseOnlineGameProps {
  playerName: string;
  myPlayerId: string;
  lobbyPlayers: Array<{ id: string; name: string }>;
  onGameOver: (result: GameResult) => void;
}

export function useOnlineGame({
  playerName,
  myPlayerId,
  lobbyPlayers,
  onGameOver,
}: UseOnlineGameProps) {
  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;

  // Always-current state ref so callbacks don't capture stale closures
  const stateRef = useRef<GameState | null>(null);

  const [state, setState] = useState<GameState>(() => {
    // Build player list from lobby. Always ensure our own player is present
    // so typeLetter / submitGuess can find `me` via myPlayerId.
    let players: Player[] = lobbyPlayers.length > 0
      ? lobbyPlayers.map(p => makePlayer(p.id, p.name))
      : [];

    // Safety-net: if our ID isn't in the list (stale lobby ref edge-case), inject it
    const selfInList = players.some(p => p.id === myPlayerId);
    if (!selfInList) {
      players = [makePlayer(myPlayerId, playerName), ...players];
    }

    return {
      word: '?????',       // hidden — server never reveals it until game_over
      players,
      myId: myPlayerId,
      currentRow: 0,
      currentGuess: '',
      isGameOver: false,
      result: null,
      wordList: [],         // not needed — server validates
      gameMode: 'online',
      invalidGuess: false,
      revealingRow: null,
    };
  });

  // Keep stateRef current every render
  stateRef.current = state;

  // ── Subscribe to server messages ───────────────────────────────────────────
  useEffect(() => {
    const unsubs: Array<() => void> = [];

    // 1. guess_result — our own guess evaluated by server
    unsubs.push(wsClient.on<GuessResultPayload>('guess_result', payload => {
      if (!payload || payload.player_id !== myPlayerId) return;

      const newRow = buildRowFromServer(payload.tiles);

      setState(prev => {
        if (prev.isGameOver) return prev;

        const updatedPlayers = prev.players.map(p => {
          if (p.id !== myPlayerId) return p;
          const newGuesses = [...p.guesses, newRow];
          return {
            ...p,
            guesses: newGuesses,
            score: payload.total_score,
            hasWon: payload.is_correct,
            isEliminated: !payload.is_correct && payload.attempts_left === 0,
          };
        });

        return {
          ...prev,
          players: updatedPlayers,
          currentGuess: '',
          currentRow: prev.currentRow + 1,
          revealingRow: prev.currentRow,
          invalidGuess: false,
        };
      });

      // Clear reveal animation
      setTimeout(() => setState(prev => ({ ...prev, revealingRow: null })), 600);
    }));

    // 2. player_update — someone else submitted a guess (grey tiles hidden)
    unsubs.push(wsClient.on<PlayerUpdatePayload>('player_update', payload => {
      if (!payload || payload.player_id === myPlayerId) return;

      const newRow = buildRowFromVisible(payload.visible_tiles);

      setState(prev => {
        if (prev.isGameOver) return prev;

        // Add player if they're not already in the list (late-join edge case)
        const exists = prev.players.some(p => p.id === payload.player_id);
        const basePlayers = exists
          ? prev.players
          : [...prev.players, makePlayer(payload.player_id, payload.player_name)];

        const updatedPlayers = basePlayers.map(p => {
          if (p.id !== payload.player_id) return p;
          const newGuesses = [...p.guesses, newRow];
          return {
            ...p,
            guesses: newGuesses,
            score: payload.total_score,
            hasWon: payload.has_won,
            isEliminated: payload.is_eliminated,
          };
        });

        return { ...prev, players: updatedPlayers };
      });
    }));

    // 3. game_over — backend reveals the word and final scores
    unsubs.push(wsClient.on<GameOverPayload>('game_over', payload => {
      if (!payload) return;

      setState(prev => {
        const result: GameResult = {
          winnerId: payload.winner_id || null,
          winnerName: payload.winner_name || null,
          wonByGuess: payload.won_by_guess,
          word: payload.word,
          players: payload.leaderboard.map(e => {
            const existing = prev.players.find(p => p.id === e.player_id);
            return {
              id: e.player_id,
              name: e.player_name,
              score: e.score,
              hasWon: e.has_won,
              guesses: existing?.guesses ?? [],
            };
          }),
        };

        onGameOverRef.current(result);
        return { ...prev, word: payload.word, isGameOver: true, result };
      });
    }));

    // 4. server error — handle "not_in_word_list"
    unsubs.push(wsClient.on<{ message: string }>('error', payload => {
      if (!payload) return;
      if (payload.message === 'not_in_word_list' || payload.message.includes('word')) {
        setState(prev => ({ ...prev, invalidGuess: true }));
        setTimeout(() => setState(prev => ({ ...prev, invalidGuess: false })), 600);
      }
    }));

    return () => unsubs.forEach(u => u());
  }, [myPlayerId]);

  // ── Keyboard input ─────────────────────────────────────────────────────────

  const typeLetter = useCallback((letter: string) => {
    setState(prev => {
      if (prev.isGameOver) return prev;
      const me = prev.players.find(p => p.id === myPlayerId);
      if (!me || me.hasWon || me.isEliminated) return prev;
      if (prev.currentGuess.length >= WORD_LENGTH) return prev;
      return { ...prev, currentGuess: prev.currentGuess + letter.toLowerCase(), invalidGuess: false };
    });
  }, [myPlayerId]);

  const deleteLetter = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentGuess: prev.currentGuess.slice(0, -1),
      invalidGuess: false,
    }));
  }, []);

  const submitGuess = useCallback(() => {
    // Read latest state from ref to avoid stale closures
    const current = stateRef.current;
    if (!current || current.isGameOver) return;
    const me = current.players.find(p => p.id === myPlayerId);
    if (!me || me.hasWon || me.isEliminated) return;
    if (current.currentGuess.length !== WORD_LENGTH) return;

    const guess = current.currentGuess;

    // Optimistically clear the input so the board feels responsive
    setState(prev => ({ ...prev, currentGuess: '' }));

    // Send to backend — server will respond with guess_result
    wsClient.submitGuess(guess);
  }, [myPlayerId]);

  // ── Physical keyboard ──────────────────────────────────────────────────────
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
  const me = state.players.find(p => p.id === myPlayerId);
  // Fallback: if myPlayerId not yet resolved, use first non-AI player
  const effectiveMe = me ?? state.players[0];
  const keyStates = effectiveMe ? deriveKeyStates(effectiveMe.guesses) : {};

  // Guard: online game always has a word placeholder so loading screen doesn't flicker
  const isReady = state.players.length > 0;

  // True when we are the only player (game started solo — shouldn't happen but guard it)
  const waitingForOpponent = state.players.length < 2;

  return {
    state: { ...state, myId: myPlayerId },
    me: effectiveMe,
    keyStates,
    isReady,
    waitingForOpponent,
    typeLetter,
    deleteLetter,
    submitGuess,
  };
}
