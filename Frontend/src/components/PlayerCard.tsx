import type { Player } from '../types/game';
import { getVisibleGuesses, totalScore } from '../lib/wordle';

interface Props {
  player: Player;
  isMe?: boolean;
}

const WORD_LENGTH = 5;
const MAX_ROWS = 5;

export function PlayerCard({ player, isMe }: Props) {
  const visibleGuesses = isMe ? player.guesses : getVisibleGuesses(player);
  const score = totalScore(player);

  const status = player.hasWon
    ? '🏆 Won!'
    : player.isEliminated
    ? '❌ Out'
    : `Row ${player.guesses.length + 1}/5`;

  return (
    <div
      className="rounded-2xl border-2 p-3 flex flex-col gap-2 transition-all"
      style={{
        background: 'var(--color-card)',
        borderColor: player.hasWon
          ? 'var(--color-correct)'
          : isMe
          ? 'var(--color-primary)'
          : 'var(--color-border)',
        boxShadow: player.hasWon ? '0 0 16px oklch(0.72 0.18 145 / 0.4)' : undefined,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-6 h-6 rounded-md shrink-0 flex items-center justify-center text-xs font-black"
            style={{
              background: isMe ? 'var(--color-primary)' : 'var(--color-secondary)',
              color: isMe ? 'var(--color-primary-foreground)' : 'var(--color-secondary-foreground)',
            }}
          >
            {player.isAI ? '🤖' : player.name[0].toUpperCase()}
          </div>
          <span className="text-xs font-bold truncate">{player.name}{isMe ? ' (you)' : ''}</span>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-xs font-black" style={{ color: 'var(--color-primary)' }}>
            {score} pts
          </div>
          <div className="text-[10px]" style={{ color: 'var(--color-muted-foreground)' }}>
            {status}
          </div>
        </div>
      </div>

      {/* Mini board */}
      <div className="flex flex-col gap-0.5">
        {Array.from({ length: MAX_ROWS }, (_, rowIdx) => {
          const row = visibleGuesses[rowIdx];
          return (
            <div key={rowIdx} className="flex gap-0.5">
              {Array.from({ length: WORD_LENGTH }, (_, colIdx) => {
                const tile = row?.tiles[colIdx];
                const tileState = tile?.state ?? 'empty';
                const letter = tile?.letter ?? '';

                const bg = (() => {
                  switch (tileState) {
                    case 'correct': return 'var(--correct)';
                    case 'present': return 'var(--present)';
                    case 'absent':  return 'var(--absent)';
                    default:        return 'var(--tile)';
                  }
                })();

                return (
                  <div
                    key={colIdx}
                    className="w-7 h-7 rounded flex items-center justify-center text-[11px] font-black
                               border transition-all"
                    style={{
                      background: bg,
                      borderColor: tileState === 'empty' ? 'var(--tile-border)' : bg,
                      color: (tileState === 'correct' || tileState === 'present') ? 'white' : 'transparent',
                    }}
                  >
                    {letter.toUpperCase()}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
