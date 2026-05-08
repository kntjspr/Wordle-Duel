import type { LobbyInfo } from '../types/game';
import { useOnline } from '../hooks/useOnline';
import { AnimatedBackground } from './AnimatedBackground';

interface Props {
  playerName: string;
  onStartGame: (players: Array<{ id: string; name: string; isAI?: boolean }>, myPlayerId: string) => void;
  onBack: () => void;
}

export function LobbyScreen({ playerName, onStartGame, onBack }: Props) {
  const {
    view, setView, lobbies, currentLobby, isSearching,
    startingGame, isHost, myPlayerId, connectionError,
    createLobby, searchLobbies, joinLobby, startGame, leaveLobby,
  } = useOnline(playerName, {
    onGameBegin: (players, pid) => onStartGame(players, pid),
  });

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-4 z-10">
      <AnimatedBackground />
      <div className="relative z-10 w-full max-w-md">

        {connectionError && (
          <div className="mb-4 px-4 py-3 rounded-xl text-sm font-semibold text-center"
               style={{ background: 'var(--color-destructive)', color: 'var(--color-destructive-foreground)' }}>
            ⚠️ {connectionError}
          </div>
        )}

        <button
          onClick={view === 'room' ? leaveLobby : view === 'choose' ? onBack : () => setView('choose')}
          className="flex items-center gap-2 mb-6 text-sm font-semibold transition-opacity hover:opacity-70"
          style={{ color: 'var(--color-muted-foreground)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          {view === 'room' ? 'Leave Lobby' : view === 'choose' ? 'Back' : 'Back to Online Menu'}
        </button>

        {view === 'choose' && (
          <div className="space-y-4">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-black uppercase tracking-widest mb-1">Online Mode</h2>
              <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Battle up to 5 players in real time</p>
            </div>
            <button onClick={createLobby}
              className="w-full py-5 rounded-2xl font-black text-sm uppercase tracking-widest border-2 transition-all duration-200 flex flex-col items-center gap-1"
              style={{ background: 'var(--color-card)', borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/>
              </svg>
              Create Lobby
              <span className="text-xs font-normal opacity-60 normal-case tracking-normal">Start a new room, share your code</span>
            </button>
            <button onClick={searchLobbies}
              className="w-full py-5 rounded-2xl font-black text-sm uppercase tracking-widest border-2 transition-all duration-200 flex flex-col items-center gap-1"
              style={{ background: 'var(--color-card)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
              </svg>
              Browse Lobbies
              <span className="text-xs font-normal opacity-60 normal-case tracking-normal">Find and join an open game</span>
            </button>
          </div>
        )}

        {view === 'search' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black uppercase tracking-widest">Open Lobbies</h2>
              <button onClick={searchLobbies}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                ↻ Refresh
              </button>
            </div>
            {isSearching ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                     style={{ borderColor: 'var(--color-primary)' }} />
                <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Searching for lobbies...</p>
              </div>
            ) : lobbies.length === 0 ? (
              <div className="text-center py-12" style={{ color: 'var(--color-muted-foreground)' }}>
                <p className="text-3xl mb-2">🔍</p>
                <p className="text-sm">No open lobbies found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {lobbies.map(lobby => (
                  <LobbyCard key={lobby.id} lobby={lobby} onJoin={() => joinLobby(lobby)} />
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'room' && currentLobby && (
          <RoomView
            lobby={currentLobby}
            myPlayerId={myPlayerId}
            isHost={isHost}
            startingGame={startingGame}
            onStart={() => startGame()}
          />
        )}
      </div>
    </div>
  );
}

function LobbyCard({ lobby, onJoin }: { lobby: LobbyInfo; onJoin: () => void }) {
  const full = lobby.players.length >= lobby.maxPlayers;
  return (
    <div className="flex items-center justify-between p-4 rounded-xl border-2 transition-all"
         style={{ background: 'var(--color-card)', borderColor: 'var(--color-border)' }}>
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="font-black text-base tracking-widest"
                style={{ color: 'var(--color-primary)', fontFamily: 'monospace' }}>{lobby.code}</span>
          <span className="text-sm font-semibold">{lobby.hostName}'s Room</span>
        </div>
        <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
          <span>👥 {lobby.players.length}/{lobby.maxPlayers}</span>
        </div>
      </div>
      <button onClick={onJoin} disabled={full}
        className="px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ background: full ? 'var(--color-muted)' : 'var(--color-primary)', color: full ? 'var(--color-muted-foreground)' : 'var(--color-primary-foreground)' }}>
        {full ? 'Full' : 'Join'}
      </button>
    </div>
  );
}

function RoomView({ lobby, myPlayerId, isHost, startingGame, onStart }: {
  lobby: LobbyInfo; myPlayerId: string; isHost: boolean; startingGame: boolean; onStart: () => void;
}) {
  const slots = Array.from({ length: lobby.maxPlayers }, (_, i) => lobby.players[i] ?? null);
  return (
    <div>
      <div className="text-center mb-6">
        <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Lobby Code</p>
        <p className="text-4xl font-black tracking-[0.3em]" style={{ color: 'var(--color-primary)', fontFamily: 'monospace' }}>{lobby.code}</p>
        <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>Share this code with friends</p>
      </div>
      <div className="space-y-2 mb-6">
        {slots.map((player, i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-xl border-2 transition-all"
            style={{
              background: player ? 'var(--color-card)' : 'transparent',
              borderColor: player ? (player.id === myPlayerId ? 'var(--color-primary)' : 'var(--color-border)') : 'var(--color-border)',
              borderStyle: player ? 'solid' : 'dashed',
              opacity: player ? 1 : 0.4,
            }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black"
              style={{
                background: player ? (player.isHost ? 'var(--color-primary)' : 'var(--color-secondary)') : 'transparent',
                color: player ? (player.isHost ? 'var(--color-primary-foreground)' : 'var(--color-secondary-foreground)') : 'transparent',
              }}>
              {player ? player.name[0].toUpperCase() : '?'}
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold">
                {player ? player.name : 'Waiting...'}
                {player?.id === myPlayerId && <span className="ml-2 text-xs font-normal" style={{ color: 'var(--color-primary)' }}>(you)</span>}
              </p>
              {player?.isHost && <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Host</p>}
            </div>
            {player && <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--color-correct)' }} />}
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {isHost ? (
          <button onClick={onStart} disabled={startingGame || lobby.players.length < 2}
            className="w-full py-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'var(--color-primary)', color: 'var(--color-primary-foreground)', boxShadow: '0 0 20px oklch(0.78 0.18 145 / 0.35)' }}>
            {startingGame ? 'Starting...' : `Start Game (${lobby.players.length} player${lobby.players.length !== 1 ? 's' : ''})`}
          </button>
        ) : (
          <div className="w-full py-4 rounded-xl text-sm text-center font-semibold"
               style={{ background: 'var(--color-muted)', color: 'var(--color-muted-foreground)' }}>
            Waiting for host to start...
          </div>
        )}
        {isHost && lobby.players.length < 2 && (
          <p className="text-xs text-center font-semibold" style={{ color: 'oklch(0.78 0.18 60)' }}>
            ⚠️ Need at least 2 players to start
          </p>
        )}
        <p className="text-xs text-center" style={{ color: 'var(--color-muted-foreground)' }}>
          Game starts when host presses Start · Max 5 players
        </p>
      </div>
    </div>
  );
}
