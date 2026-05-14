import { useState } from 'react';
import type { GameMode, GameResult, GameScreen as GameScreenType } from './types/game';
import { LandingPage } from './components/LandingPage';
import { LobbyScreen } from './components/LobbyScreen';
import { GameScreen } from './components/GameScreen';
import { ResultsScreen } from './components/ResultsScreen';
import { wsClient } from './api/wsClient';

interface AppState {
  screen: GameScreenType;
  playerName: string;
  gameMode: GameMode;
  myPlayerId: string;                                      // real ID assigned by backend
  lobbyPlayers: Array<{ id: string; name: string; isAI?: boolean }>;
  lastResult: GameResult | null;
  gameKey: number;
}

export default function App() {
  const [app, setApp] = useState<AppState>({
    screen: 'landing',
    playerName: '',
    gameMode: 'ai',
    myPlayerId: 'local-player',                           // overwritten in online mode
    lobbyPlayers: [],
    lastResult: null,
    gameKey: 0,
  });

  // ── Landing → next screen ─────────────────────────────────────────────────

  function handleLandingStart(name: string, mode: GameMode) {
    if (mode === 'ai') {
      setApp(prev => ({
        ...prev,
        playerName: name,
        gameMode: mode,
        screen: 'game',
        myPlayerId: 'local-player',
        lobbyPlayers: [],
        lastResult: null,
        gameKey: prev.gameKey + 1,
      }));
    } else {
      setApp(prev => ({
        ...prev,
        playerName: name,
        gameMode: mode,
        screen: 'lobby',
        lastResult: null,
      }));
    }
  }

  // ── Lobby → game (called by LobbyScreen when game_begin arrives) ──────────

  function handleLobbyStart(
    players: Array<{ id: string; name: string; isAI?: boolean }>,
    myPlayerId: string,
  ) {
    setApp(prev => ({
      ...prev,
      screen: 'game',
      lobbyPlayers: players,
      myPlayerId,
      gameKey: prev.gameKey + 1,
    }));
  }

  // ── Game over ─────────────────────────────────────────────────────────────

  function handleGameOver(result: GameResult) {
    setTimeout(() => {
      setApp(prev => ({ ...prev, screen: 'results', lastResult: result }));
    }, 1200);
  }

  // ── Results → play again / home ───────────────────────────────────────────

  function handlePlayAgain() {
    if (app.gameMode === 'online') {
      if (wsClient.lastLobbyId) {
        wsClient.joinLobby(wsClient.lastLobbyId);
      }
      setApp(prev => ({ ...prev, screen: 'lobby', lastResult: null }));
    } else {
      setApp(prev => ({
        ...prev,
        screen: 'game',
        lastResult: null,
        gameKey: prev.gameKey + 1,
      }));
    }
  }

  function handleHome() {
    if (app.gameMode === 'online') {
      wsClient.leaveLobby();
      wsClient.lastLobbyState = null;
      setApp(prev => ({ ...prev, screen: 'lobby', lastResult: null }));
    } else {
      setApp(prev => ({ ...prev, screen: 'landing', lastResult: null }));
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ fontFamily: 'var(--font-display)' }}>
      {app.screen === 'landing' && (
        <LandingPage onStart={handleLandingStart} />
      )}

      {app.screen === 'lobby' && (
        <LobbyScreen
          playerName={app.playerName}
          onStartGame={handleLobbyStart}
          onBack={() => setApp(prev => ({ ...prev, screen: 'landing' }))}
        />
      )}

      {app.screen === 'game' && (
        <GameScreen
          key={app.gameKey}
          playerName={app.playerName}
          gameMode={app.gameMode}
          myPlayerId={app.myPlayerId}
          lobbyPlayers={app.gameMode === 'online' ? app.lobbyPlayers : undefined}
          onGameOver={handleGameOver}
        />
      )}

      {app.screen === 'results' && app.lastResult && (
        <ResultsScreen
          result={app.lastResult}
          myId={app.myPlayerId}
          onPlayAgain={handlePlayAgain}
          onHome={handleHome}
        />
      )}
    </div>
  );
}
