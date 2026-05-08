/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║   wordList.ts (BACKEND CONNECTED VERSION)                       ║
 * ║                                                                  ║
 * ║   Swap this file in to replace the dev version once the Go      ║
 * ║   backend is running. Set VITE_API_URL in your .env file.       ║
 * ║                                                                  ║
 * ║   The backend is now the ONLY word authority.                   ║
 * ║   Frontend never picks or validates words itself.               ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Backend endpoints (Go server):
 *   GET  /api/words/random    → { word: string }
 *   GET  /api/words/list      → { words: string[] }
 *   POST /api/words/validate  → { valid: boolean }
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';

export async function fetchRandomWord(): Promise<string> {
  const res = await fetch(`${API_URL}/api/words/random`);
  if (!res.ok) throw new Error('Failed to fetch random word');
  const data = await res.json();
  return data.word as string;
}

export async function fetchWordList(): Promise<string[]> {
  const res = await fetch(`${API_URL}/api/words/list`);
  if (!res.ok) throw new Error('Failed to fetch word list');
  const data = await res.json();
  return data.words as string[];
}

export async function validateWord(word: string): Promise<boolean> {
  // In the real game, word validation happens on the server side when
  // the player submits a guess via WebSocket (submit_guess message).
  // This function is kept for any client-side pre-checks.
  const res = await fetch(`${API_URL}/api/words/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ word }),
  });
  if (!res.ok) return false;
  const data = await res.json();
  return data.valid as boolean;
}
