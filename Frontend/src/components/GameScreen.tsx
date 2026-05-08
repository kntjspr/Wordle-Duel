import type { GameMode, GameResult } from '../types/game';
import { useGameEngine } from '../hooks/useGameEngine';
import { useOnlineGame } from '../hooks/useOnlineGame';
import { GameBoard } from './GameBoard';
import { Keyboard } from './Keyboard';
import { PlayerCard } from './PlayerCard';
import { totalScore } from '../lib/wordle';

interface Props {
  playerName: string;
  gameMode: GameMode;
  myPlayerId: string;
  lobbyPlayers?: Array<{ id: string; name: string; isAI?: boolean }>;
  onGameOver: (result: GameResult) => void;
}

// ─── AI wrapper (local game engine) ──────────────────────────────────────────

function AIGame({ playerName, onGameOver }: { playerName: string; onGameOver: (r: GameResult) => void }) {
  const { state, me, keyStates, typeLetter, deleteLetter, submitGuess } = useGameEngine({
    playerName,
    gameMode: 'ai',
    onGameOver,
  });
  return (
    <GameLayout
      state={state} me={me} keyStates={keyStates}
      gameMode="ai"
      typeLetter={typeLetter} deleteLetter={deleteLetter} submitGuess={submitGuess}
    />
  );
}

// ─── Online wrapper (server-driven game) ──────────────────────────────────────

function OnlineGame({
  playerName, myPlayerId, lobbyPlayers, onGameOver,
}: {
  playerName: string;
  myPlayerId: string;
  lobbyPlayers: Array<{ id: string; name: string; isAI?: boolean }>;
  onGameOver: (r: GameResult) => void;
}) {
  const { state, me, keyStates, typeLetter, deleteLetter, submitGuess } = useOnlineGame({
    playerName,
    myPlayerId,
    lobbyPlayers,
    onGameOver,
  });
  return (
    <GameLayout
      state={state} me={me} keyStates={keyStates}
      gameMode="online"
      typeLetter={typeLetter} deleteLetter={deleteLetter} submitGuess={submitGuess}
    />
  );
}

// ─── Root export — picks which hook to use ────────────────────────────────────

export function GameScreen({ playerName, gameMode, myPlayerId, lobbyPlayers, onGameOver }: Props) {
  if (gameMode === 'online') {
    return (
      <OnlineGame
        playerName={playerName}
        myPlayerId={myPlayerId}
        lobbyPlayers={lobbyPlayers ?? []}
        onGameOver={onGameOver}
      />
    );
  }
  return <AIGame playerName={playerName} onGameOver={onGameOver} />;
}

// ─── Shared layout (used by both AI and Online) ───────────────────────────────

import type { GameState, Player, KeyState } from '../types/game';

function GameLayout({
  state, me, keyStates, gameMode, typeLetter, deleteLetter, submitGuess,
}: {
  state: GameState;
  me: Player | undefined;
  keyStates: KeyState;
  gameMode: GameMode;
  typeLetter: (l: string) => void;
  deleteLetter: () => void;
  submitGuess: () => void;
}) {
  const otherPlayers = state.players.filter(p => p.id !== state.myId);
  const myScore = me ? totalScore(me) : 0;
  const myAttempts = me?.guesses.length ?? 0;

  // Loading state: AI waits for word fetch; online waits for players
  if (!state.word || state.word === '?????' && state.players.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
               style={{ borderColor: 'var(--color-primary)' }} />
          <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Loading game...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 py-3 border-b"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-card)' }}>
        <div>
          <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: 'var(--color-muted-foreground)' }}>
            {gameMode === 'ai' ? 'VS AI' : 'Online'}
          </p>
          <p className="text-sm font-black">Wordle Duel</p>
        </div>
        <div className="flex items-center gap-3 px-4 py-2 rounded-full text-sm font-black"
             style={{ background: 'var(--color-secondary)' }}>
          <span style={{ color: 'var(--color-primary)' }}>{myScore} pts</span>
          <span style={{ color: 'var(--color-muted-foreground)', fontWeight: 400, fontSize: '0.7rem' }}>
            {myAttempts}/5
          </span>
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 max-w-5xl mx-auto w-full">

        {/* Left: local player board + keyboard */}
        <div className="flex flex-col items-center gap-4 flex-1">

          {/* Status banners */}
          {state.isGameOver && state.result && (
            <div className="w-full max-w-xs py-2 px-4 rounded-xl text-center text-sm font-black animate-pulse"
              style={{
                background: state.result.winnerId === state.myId ? 'var(--color-primary)' : 'var(--color-muted)',
                color: state.result.winnerId === state.myId ? 'var(--color-primary-foreground)' : 'var(--color-muted-foreground)',
              }}>
              {state.result.winnerId === state.myId
                ? '🏆 You Won!'
                : state.result.winnerName
                ? `${state.result.winnerName} won!`
                : "It's a draw!"}
            </div>
          )}
          {me?.hasWon && !state.result && (
            <div className="w-full max-w-xs py-2 px-4 rounded-xl text-center text-sm font-black"
                 style={{ background: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}>
              🎉 Correct! Waiting for others...
            </div>
          )}
          {me?.isEliminated && !me.hasWon && !state.isGameOver && (
            <div className="w-full max-w-xs py-2 px-4 rounded-xl text-center text-sm font-semibold"
                 style={{ background: 'var(--color-muted)', color: 'var(--color-muted-foreground)' }}>
              Waiting for others to finish...
            </div>
          )}
          {state.invalidGuess && (
            <div className="w-full max-w-xs py-2 px-4 rounded-xl text-center text-sm font-semibold"
                 style={{ background: 'var(--color-destructive)', color: 'var(--color-destructive-foreground)' }}>
              Not in word list!
            </div>
          )}

          {/* Board */}
          <div className="glow rounded-2xl p-4" style={{ background: 'var(--color-card)' }}>
            <p className="text-xs text-center mb-3 uppercase tracking-widest font-semibold"
               style={{ color: 'var(--color-muted-foreground)' }}>Your Board</p>
            {me && <GameBoard state={state} />}
          </div>

          {/* Keyboard */}
          <div className="w-full max-w-sm">
            <Keyboard
              keyStates={keyStates}
              onLetter={typeLetter}
              onDelete={deleteLetter}
              onEnter={submitGuess}
              disabled={!!me?.hasWon || !!me?.isEliminated || state.isGameOver}
            />
          </div>
        </div>

        {/* Right: other players */}
        <aside className="lg:w-64 xl:w-72">
          <p className="text-xs uppercase tracking-widest font-semibold mb-3 text-center lg:text-left"
             style={{ color: 'var(--color-muted-foreground)' }}>Other Players</p>
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
            {otherPlayers.map(player => (
              <PlayerCard key={player.id} player={player} />
            ))}
            {otherPlayers.length === 0 && (
              <p className="text-xs col-span-2 text-center py-4" style={{ color: 'var(--color-muted-foreground)' }}>
                No other players
              </p>
            )}
          </div>

          {/* Scoreboard */}
          {state.players.length > 1 && (
            <div className="mt-4 rounded-xl border p-3"
                 style={{ borderColor: 'var(--color-border)', background: 'var(--color-card)' }}>
              <p className="text-xs uppercase tracking-widest font-semibold mb-2"
                 style={{ color: 'var(--color-muted-foreground)' }}>Scoreboard</p>
              {[...state.players]
                .sort((a, b) => totalScore(b) - totalScore(a))
                .map((p, i) => (
                  <div key={p.id} className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs w-4" style={{ color: 'var(--color-muted-foreground)' }}>{i + 1}.</span>
                      <span className="text-xs font-semibold truncate max-w-[100px]">
                        {p.name}{p.id === state.myId ? ' 🫵' : ''}
                      </span>
                    </div>
                    <span className="text-xs font-black" style={{ color: 'var(--color-primary)' }}>{totalScore(p)}</span>
                  </div>
                ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
