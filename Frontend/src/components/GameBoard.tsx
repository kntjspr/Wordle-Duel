import type { GameState, GuessTile, TileState } from '../types/game';

interface Props {
  state: GameState;
}

const WORD_LENGTH = 5;
const MAX_ROWS = 5;

export function GameBoard({ state }: Props) {
  const me = state.players.find(p => p.id === state.myId);
  if (!me) return null;

  const rows = Array.from({ length: MAX_ROWS }, (_, rowIdx) => {
    const submitted = me.guesses[rowIdx];
    const isCurrent = rowIdx === state.currentRow && !state.isGameOver;
    const isRevealing = rowIdx === state.revealingRow;

    if (submitted) {
      return (
        <SubmittedRow
          key={rowIdx}
          tiles={submitted.tiles}
          rowScore={submitted.score}
          isRevealing={isRevealing}
          rowIdx={rowIdx}
        />
      );
    }

    if (isCurrent) {
      return (
        <CurrentRow
          key={rowIdx}
          guess={state.currentGuess}
          invalid={state.invalidGuess}
        />
      );
    }

    return <EmptyRow key={rowIdx} />;
  });

  return (
    <div className="flex flex-col gap-1.5">
      {rows}
    </div>
  );
}

// ─── Submitted row ────────────────────────────────────────────────────────────

function SubmittedRow({
  tiles, rowScore, isRevealing, rowIdx,
}: {
  tiles: GuessTile[];
  rowScore: number;
  isRevealing: boolean;
  rowIdx: number;
}) {
  return (
    <div className="relative flex gap-1.5 items-center">
      <div className="flex gap-1.5">
        {tiles.map((tile, i) => (
          <div
            key={i}
            className={`tile w-14 h-14 text-2xl font-black rounded-lg border-2 ${tileClass(tile.state)} ${isRevealing ? 'tile-flip' : ''}`}
            style={{
              animationDelay: isRevealing ? `${i * 120}ms` : undefined,
            }}
          >
            {tile.letter.toUpperCase()}
          </div>
        ))}
      </div>
      {rowScore > 0 && (
        <span
          className="ml-2 text-xs font-black animate-bounce"
          style={{ color: 'var(--color-primary)' }}
        >
          +{rowScore}
        </span>
      )}
    </div>
  );
}

// ─── Current row ──────────────────────────────────────────────────────────────

function CurrentRow({ guess, invalid }: { guess: string; invalid: boolean }) {
  const tiles = Array.from({ length: WORD_LENGTH }, (_, i) => guess[i] ?? '');

  return (
    <div
      className="flex gap-1.5"
      style={{
        animation: invalid ? 'shake 0.4s ease-out' : undefined,
      }}
    >
      {tiles.map((letter, i) => (
        <div
          key={i}
          className={`tile w-14 h-14 text-2xl font-black rounded-lg border-2 ${
            letter
              ? 'tile-pop'
              : ''
          }`}
          style={{
            borderColor: letter ? 'var(--color-primary)' : 'var(--tile-border)',
            background: 'var(--tile)',
            color: 'var(--color-foreground)',
          }}
        >
          {letter.toUpperCase()}
        </div>
      ))}
    </div>
  );
}

// ─── Empty row ────────────────────────────────────────────────────────────────

function EmptyRow() {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: WORD_LENGTH }, (_, i) => (
        <div
          key={i}
          className="tile w-14 h-14 rounded-lg border-2"
          style={{ background: 'var(--tile)', borderColor: 'var(--tile-border)', opacity: 0.5 }}
        />
      ))}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tileClass(state: TileState): string {
  switch (state) {
    case 'correct': return 'tile-correct';
    case 'present': return 'tile-present';
    case 'absent':  return 'tile-absent';
    default:        return '';
  }
}
