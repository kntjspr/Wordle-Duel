import type { TileState, GuessRow } from '../types/game';

// ─── AI Opening Words ────────────────────────────────────────────────────────

const OPENERS = ['crane', 'slate', 'audio', 'trace', 'arose', 'stare', 'least', 'adore'];

// ─── Filter helpers ──────────────────────────────────────────────────────────

function filterWords(wordList: string[], guesses: GuessRow[]): string[] {
  let remaining = [...wordList];

  for (const row of guesses) {
    if (!row.isSubmitted) continue;
    const guess = row.tiles.map(t => t.letter).join('').toLowerCase();

    // Build constraints from this row
    const mustBeAt: Map<number, string> = new Map();
    const mustContain: Map<string, number[]> = new Map(); // letter → positions it can't be at
    const mustNotContain: Set<string> = new Set();

    row.tiles.forEach((tile, i) => {
      const l = tile.letter.toLowerCase();
      if (tile.state === 'correct') {
        mustBeAt.set(i, l);
      } else if (tile.state === 'present') {
        if (!mustContain.has(l)) mustContain.set(l, []);
        mustContain.get(l)!.push(i);
      } else if (tile.state === 'absent') {
        // Only mark absent if letter isn't also marked correct/present
        const isAlsoPresentOrCorrect = row.tiles.some(
          (t, j) => j !== i && t.letter.toLowerCase() === l && (t.state === 'correct' || t.state === 'present')
        );
        if (!isAlsoPresentOrCorrect) mustNotContain.add(l);
      }
    });

    remaining = remaining.filter(word => {
      const w = word.toLowerCase();

      // Must have correct letters at correct positions
      for (const [pos, letter] of mustBeAt) {
        if (w[pos] !== letter) return false;
      }

      // Must contain present letters (not at wrong positions)
      for (const [letter, wrongPositions] of mustContain) {
        if (!w.includes(letter)) return false;
        for (const pos of wrongPositions) {
          if (w[pos] === letter) return false;
        }
      }

      // Must not contain absent letters
      for (const letter of mustNotContain) {
        // Allow if letter appears in correct/present position (counts are tricky)
        const countInWord = [...w].filter(c => c === letter).length;
        const countRequired = [...mustBeAt.values(), ...mustContain.keys()]
          .filter(l => l === letter).length;
        if (countInWord > countRequired) return false;
        if (countRequired === 0 && w.includes(letter)) return false;
      }

      // Can't re-guess same word
      if (w === guess) return false;

      return true;
    });
  }

  return remaining;
}

// ─── AI Guess ────────────────────────────────────────────────────────────────

export interface AIConfig {
  difficulty: 'easy' | 'medium' | 'hard';
  /** Delay range in ms before AI submits */
  minDelay: number;
  maxDelay: number;
}

export const AI_CONFIGS: Record<string, AIConfig> = {
  easy:   { difficulty: 'easy',   minDelay: 4000, maxDelay: 8000 },
  medium: { difficulty: 'medium', minDelay: 2500, maxDelay: 5000 },
  hard:   { difficulty: 'hard',   minDelay: 1200, maxDelay: 3000 },
};

export function pickAIGuess(
  wordList: string[],
  guesses: GuessRow[],
  difficulty: 'easy' | 'medium' | 'hard' = 'medium'
): string {
  const submitted = guesses.filter(r => r.isSubmitted);

  // First guess: use opener
  if (submitted.length === 0) {
    const opener = OPENERS[Math.floor(Math.random() * OPENERS.length)];
    return opener;
  }

  const remaining = filterWords(wordList, submitted);

  if (remaining.length === 0) {
    // Fallback: random from full list
    return wordList[Math.floor(Math.random() * wordList.length)];
  }

  if (difficulty === 'easy') {
    // Easy: pick randomly from all remaining
    return remaining[Math.floor(Math.random() * remaining.length)];
  }

  if (difficulty === 'medium') {
    // Medium: top 20 candidates, random among them
    const candidates = remaining.slice(0, Math.min(20, remaining.length));
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  // Hard: pick word that eliminates most letters (simple heuristic)
  // Score each word by unique-letter count
  const scored = remaining.map(w => ({
    word: w,
    score: new Set(w.split('')).size,
  }));
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 5);
  return top[Math.floor(Math.random() * top.length)].word;
}

export function getAIDelay(config: AIConfig): number {
  return config.minDelay + Math.random() * (config.maxDelay - config.minDelay);
}
