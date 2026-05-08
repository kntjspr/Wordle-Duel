import type { GameResult } from '../types/game';

interface Props {
  result: GameResult;
  myId: string;
  onPlayAgain: () => void;
  onHome: () => void;
}

export function ResultsScreen({ result, myId, onPlayAgain, onHome }: Props) {
  const sorted = [...result.players].sort((a, b) => b.score - a.score);
  const iWon = result.winnerId === myId;

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      {/* ── Result header ─────────────────────────────────────────── */}
      <div className="text-center mb-8">
        <div className="text-6xl mb-3">{iWon ? '🏆' : result.winnerId ? '😤' : '🤝'}</div>
        <h1 className="text-3xl font-black uppercase tracking-widest mb-2">
          {iWon
            ? 'Victory!'
            : result.winnerName
            ? `${result.winnerName} Wins!`
            : 'Draw!'}
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
          {result.wonByGuess
            ? `${result.winnerName ?? 'Someone'} guessed the word`
            : 'Nobody guessed — highest score wins'}
        </p>
      </div>

      {/* ── Word reveal ───────────────────────────────────────────── */}
      <div className="mb-8 text-center">
        <p className="text-xs uppercase tracking-widest mb-3" style={{ color: 'var(--color-muted-foreground)' }}>
          The word was
        </p>
        <div className="flex gap-2 justify-center">
          {result.word.toUpperCase().split('').map((letter, i) => (
            <div
              key={i}
              className="tile tile-correct w-14 h-14 text-2xl font-black rounded-xl border-2 shadow-lg"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              {letter}
            </div>
          ))}
        </div>
      </div>

      {/* ── Leaderboard ──────────────────────────────────────────── */}
      <div
        className="w-full max-w-sm rounded-2xl border-2 overflow-hidden mb-8"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-card)' }}
      >
        <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <p className="text-xs uppercase tracking-widest font-semibold"
             style={{ color: 'var(--color-muted-foreground)' }}>
            Final Scores
          </p>
        </div>
        {sorted.map((player, i) => {
          const isWinner = player.id === result.winnerId;
          const isLocalPlayer = player.id === myId;

          return (
            <div
              key={player.id}
              className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0 transition-all"
              style={{
                borderColor: 'var(--color-border)',
                background: isLocalPlayer ? 'oklch(0.78 0.18 145 / 0.08)' : 'transparent',
              }}
            >
              <span className="text-xl w-8 text-center">{medals[i] ?? `${i + 1}.`}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">
                  {player.name}
                  {isLocalPlayer && <span className="ml-1 text-xs font-normal" style={{ color: 'var(--color-primary)' }}>(you)</span>}
                </p>
                <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                  {player.guesses.length} attempt{player.guesses.length !== 1 ? 's' : ''}
                  {player.hasWon && ' · ✓ Guessed'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-base font-black" style={{ color: isWinner ? 'var(--color-primary)' : 'var(--color-foreground)' }}>
                  {player.score}
                </p>
                <p className="text-[10px]" style={{ color: 'var(--color-muted-foreground)' }}>pts</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Scoring legend ────────────────────────────────────────── */}
      <div className="flex gap-4 mb-8 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: 'var(--correct)' }} />
          +2 per green
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: 'var(--present)' }} />
          +1 per yellow
        </span>
        <span className="flex items-center gap-1">
          🏆 +15 for solving
        </span>
      </div>

      {/* ── Actions ───────────────────────────────────────────────── */}
      <div className="flex gap-3 w-full max-w-sm">
        <button
          onClick={onPlayAgain}
          className="flex-1 py-3 rounded-xl font-black text-sm uppercase tracking-widest transition-all"
          style={{
            background: 'var(--color-primary)',
            color: 'var(--color-primary-foreground)',
            boxShadow: '0 0 20px oklch(0.78 0.18 145 / 0.3)',
          }}
        >
          Play Again
        </button>
        <button
          onClick={onHome}
          className="px-5 py-3 rounded-xl font-semibold text-sm border-2 transition-all"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}
        >
          Home
        </button>
      </div>
    </div>
  );
}
