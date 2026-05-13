/**
 * wordList.ts — Word API (authoritative backend only)
 *
 *   GET  /api/words/random   → { word: string }
 *   GET  /api/words/list     → { words: string[] }
 *   POST /api/words/validate → { valid: boolean }
 */

const API = import.meta.env.VITE_API_URL ?? '';

async function parseJSON<T>(res: Response, endpoint: string): Promise<T> {
  if (!res.ok) {
    throw new Error(`${endpoint} failed with HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchRandomWord(): Promise<string> {
  const res = await fetch(`${API}/api/words/random`);
  const data = await parseJSON<{ word: string }>(res, '/api/words/random');
  return data.word;
}

export async function fetchWordList(): Promise<string[]> {
  const res = await fetch(`${API}/api/words/list`);
  const data = await parseJSON<{ words: string[] }>(res, '/api/words/list');
  return data.words.filter(w => w.length === 5);
}

export async function validateWord(word: string): Promise<boolean> {
  const res = await fetch(`${API}/api/words/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ word: word.toLowerCase() }),
  });
  const data = await parseJSON<{ valid: boolean }>(res, '/api/words/validate');
  return data.valid;
}
