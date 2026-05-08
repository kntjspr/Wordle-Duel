import type { TileState, GuessRow, GuessTile, Player, KeyState } from '../types/game';

// ─── Wordle Evaluation ───────────────────────────────────────────────────────

/**
 * Evaluates a guess against the target word.
 * Handles duplicate letters correctly (NYT rules).
 */
export function evaluateGuess(guess: string, word: string): TileState[] {
  const g = guess.toLowerCase().split('');
  const w = word.toLowerCase().split('');
  const result: TileState[] = Array(5).fill('absent');
  const wordUsed = Array(5).fill(false);
  const guessUsed = Array(5).fill(false);

  // Pass 1: correct positions
  for (let i = 0; i < 5; i++) {
    if (g[i] === w[i]) {
      result[i] = 'correct';
      wordUsed[i] = true;
      guessUsed[i] = true;
    }
  }

  // Pass 2: present (wrong position)
  for (let i = 0; i < 5; i++) {
    if (guessUsed[i]) continue;
    for (let j = 0; j < 5; j++) {
      if (!wordUsed[j] && g[i] === w[j]) {
        result[i] = 'present';
        wordUsed[j] = true;
        break;
      }
    }
  }

  return result;
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

/**
 * Points per tile:
 *   correct  → +2 (right letter, right position)
 *   present  → +1 (right letter, wrong position)
 *   absent   → +0
 */
export function scoreRow(states: TileState[]): number {
  return states.reduce((acc, s) => acc + (s === 'correct' ? 2 : s === 'present' ? 1 : 0), 0);
}

/** Bonus points for guessing the word correctly */
export const WIN_BONUS = 15;

// ─── Build a GuessRow ────────────────────────────────────────────────────────

export function buildGuessRow(guess: string, word: string): GuessRow {
  const states = evaluateGuess(guess, word);
  const tiles: GuessTile[] = guess.split('').map((letter, i) => ({
    letter,
    state: states[i],
  }));
  return {
    tiles,
    isSubmitted: true,
    score: scoreRow(states),
  };
}

// ─── Check Win ───────────────────────────────────────────────────────────────

export function isCorrectGuess(guess: string, word: string): boolean {
  return guess.toLowerCase() === word.toLowerCase();
}

// ─── Keyboard State ─────────────────────────────────────────────────────────

/**
 * Derives keyboard key states from all submitted guesses.
 * A key keeps the "best" state seen across all guesses.
 */
export function deriveKeyStates(guesses: GuessRow[]): KeyState {
  const priority: Record<TileState | 'unused', number> = {
    unused: 0,
    absent: 1,
    present: 2,
    correct: 3,
    empty: 0,
    typing: 0,
  };

  const states: KeyState = {};

  for (const row of guesses) {
    if (!row.isSubmitted) continue;
    for (const tile of row.tiles) {
      const key = tile.letter.toLowerCase();
      const current = states[key] ?? 'unused';
      if (priority[tile.state] > priority[current as TileState | 'unused']) {
        states[key] = tile.state;
      }
    }
  }

  return states;
}

// ─── Visible tiles (for other players' boards) ──────────────────────────────

/**
 * Returns what another player can SEE of a given player's guesses.
 * Green and yellow tiles show their letter.
 * Gray (absent) tiles are hidden — shown as empty.
 */
export function getVisibleGuesses(player: Player): GuessRow[] {
  return player.guesses.map(row => ({
    ...row,
    tiles: row.tiles.map(tile => ({
      letter: tile.state === 'absent' ? '' : tile.letter,
      state: tile.state === 'absent' ? 'empty' : tile.state,
    })),
  }));
}

// ─── Total score ─────────────────────────────────────────────────────────────

export function totalScore(player: Player): number {
  return player.guesses.reduce((sum, row) => sum + row.score, 0) + (player.hasWon ? WIN_BONUS : 0);
}
