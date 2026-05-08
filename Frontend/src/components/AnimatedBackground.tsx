import { useMemo } from 'react';

interface BgTile {
  id: number;
  letter: string;
  stateClass: string;
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
  opacity: number;
  rotate: number;
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const STATE_CLASSES = ['tile-correct', 'tile-present', 'tile-absent', 'tile-absent', 'tile-absent'];

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function generateTiles(count: number): BgTile[] {
  const rng = seededRandom(42); // deterministic so no hydration mismatch
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    letter: LETTERS[Math.floor(rng() * LETTERS.length)],
    stateClass: STATE_CLASSES[Math.floor(rng() * STATE_CLASSES.length)],
    x: rng() * 100,
    y: rng() * 100,
    size: 36 + rng() * 40,
    delay: rng() * 5,
    duration: 3.5 + rng() * 5,
    opacity: 0.08 + rng() * 0.18,
    rotate: (rng() - 0.5) * 30,
  }));
}

export function AnimatedBackground() {
  const tiles = useMemo(() => generateTiles(40), []);

  return (
    <div
      className="fixed inset-0 overflow-hidden pointer-events-none z-0 select-none"
      aria-hidden="true"
    >
      {tiles.map(tile => (
        <div
          key={tile.id}
          className={`tile ${tile.stateClass} absolute flex items-center justify-center font-black rounded-lg border-2`}
          style={{
            left: `${tile.x}%`,
            top: `${tile.y}%`,
            width: tile.size,
            height: tile.size,
            fontSize: tile.size * 0.52,
            opacity: tile.opacity,
            transform: `translate(-50%, -50%) rotate(${tile.rotate}deg) scale(0.8)`,
            animation: `bg-zoom ${tile.duration}s ease-in-out ${tile.delay}s infinite`,
            willChange: 'transform, opacity',
          }}
        >
          {tile.letter}
        </div>
      ))}
    </div>
  );
}
