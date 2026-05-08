/**
 * useOnline.ts — Real WebSocket lobby hook
 *
 * Drop-in replacement for useMockOnline.ts.
 * Connects to the Go backend via wsClient and exposes the same interface
 * that LobbyScreen.tsx already consumes.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LobbyInfo, LobbyPlayer } from '../types/game';
import { wsClient } from '../api/wsClient';
import type {
  LobbyState, LobbyListInfo, LobbyListPayload,
  GameBeginPayload, ConnectedPayload,
} from '../api/wsClient';

export type LobbyView = 'choose' | 'create' | 'search' | 'room';

// ─── Type adapter: backend → frontend ────────────────────────────────────────

function toLobbyInfo(s: LobbyState): LobbyInfo {
  const players: LobbyPlayer[] = s.players.map(p => ({
    id: p.id,
    name: p.name,
    isHost: p.is_host,
  }));
  return {
    id: s.id,
    code: s.code,
    hostName: s.host_name,
    players,
    maxPlayers: 5,
    status: s.status,
    createdAt: Date.now(),
  };
}

function listInfoToLobbyInfo(l: LobbyListInfo): LobbyInfo {
  // Build a minimal LobbyInfo from the compact list entry (no player array)
  return {
    id: l.id,
    code: l.code,
    hostName: l.host_name,
    players: Array.from({ length: l.player_count }, (_, i) => ({
      id: `unknown-${i}`,
      name: i === 0 ? l.host_name : `Player ${i + 1}`,
      isHost: i === 0,
    })),
    maxPlayers: 5,
    status: 'waiting',
    createdAt: Date.now(),
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseOnlineOptions {
  onGameBegin?: (players: Array<{ id: string; name: string; isAI?: boolean }>, myPlayerId: string) => void;
}

export function useOnline(
  playerName: string,
  { onGameBegin }: UseOnlineOptions = {}
) {
  const myPlayerId = useRef<string>('');
  const currentLobbyRef = useRef<LobbyInfo | null>(null); // always-current ref for closures
  const [view, setView] = useState<LobbyView>('choose');
  const [lobbies, setLobbies] = useState<LobbyInfo[]>([]);
  const [currentLobby, setCurrentLobby] = useState<LobbyInfo | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [startingGame, setStartingGame] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Keep ref in sync so WS closures always see latest lobby
  useEffect(() => { currentLobbyRef.current = currentLobby; }, [currentLobby]);

  const isHost = currentLobby
    ? currentLobby.players.find(p => p.id === myPlayerId.current)?.isHost ?? false
    : false;

  // ── Connect & register handlers ────────────────────────────────────────────
  useEffect(() => {
    let unsubs: Array<() => void> = [];

    wsClient.connect()
      .then(() => {
        setConnectionError(null);

        // 1. Server assigns us a player ID
        unsubs.push(wsClient.on<ConnectedPayload>('connected', payload => {
          if (!payload) return;
          myPlayerId.current = payload.player_id;
          // Immediately set our display name
          wsClient.setName(playerName);
        }));

        // 2. Name confirmed — nothing to do in UI
        // unsubs.push(wsClient.on('name_set', () => {}));

        // 3. We created a lobby
        unsubs.push(wsClient.on<LobbyState>('lobby_created', payload => {
          if (!payload) return;
          setCurrentLobby(toLobbyInfo(payload));
          setView('room');
        }));

        // 4. We joined someone else's lobby
        unsubs.push(wsClient.on<LobbyState>('lobby_joined', payload => {
          if (!payload) return;
          setCurrentLobby(toLobbyInfo(payload));
          setView('room');
        }));

        // 5. Someone joined/left our lobby
        unsubs.push(wsClient.on<LobbyState>('lobby_update', payload => {
          if (!payload) return;
          setCurrentLobby(toLobbyInfo(payload));
        }));

        // 6. We left the lobby
        unsubs.push(wsClient.on('lobby_left', () => {
          setCurrentLobby(null);
          setView('choose');
          setStartingGame(false);
        }));

        // 7. Lobby list response
        unsubs.push(wsClient.on<LobbyListPayload>('lobby_list', payload => {
          if (!payload) return;
          setLobbies((payload.lobbies ?? []).map(listInfoToLobbyInfo));
          setIsSearching(false);
        }));

        // 8. Server counting down before game
        unsubs.push(wsClient.on('game_starting', () => {
          setStartingGame(true);
        }));

        // 9. Game actually begins — hand off to App
        unsubs.push(wsClient.on<GameBeginPayload>('game_begin', payload => {
          if (!payload) return;
          setStartingGame(false);
          if (onGameBegin) {
            // Use the ref (not state) so we always have the latest lobby players
            const lobbyPlayers = currentLobbyRef.current?.players ?? [];
            const players = payload.player_names.map((name, i) => ({
              id: lobbyPlayers[i]?.id ?? `player-${i}`,
              name,
              isAI: false,
            }));
            onGameBegin(players, myPlayerId.current);
          }
        }));

        // 10. Server error — surface to UI
        unsubs.push(wsClient.on<{ message: string }>('error', payload => {
          if (!payload) return;
          console.error('[WS] server error:', payload.message);
          setConnectionError(payload.message);
          setIsSearching(false);
          setStartingGame(false);
        }));
      })
      .catch(err => {
        console.error('[WS] connection failed:', err);
        setConnectionError('Cannot reach server. Check that the backend is running.');
      });

    return () => {
      unsubs.forEach(u => u());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerName]);

  // ── Lobby actions ──────────────────────────────────────────────────────────

  const createLobby = useCallback(() => {
    wsClient.createLobby();
  }, []);

  const searchLobbies = useCallback(() => {
    setIsSearching(true);
    setView('search');
    wsClient.listLobbies();
  }, []);

  const joinLobby = useCallback((lobby: LobbyInfo) => {
    wsClient.joinLobby(lobby.id);
  }, []);

  const startGame = useCallback(() => {
    wsClient.startGame();
    return true;
  }, []);

  const leaveLobby = useCallback(() => {
    wsClient.leaveLobby();
    // Optimistic local reset (lobby_left will confirm)
    setCurrentLobby(null);
    setView('choose');
  }, []);

  return {
    view,
    setView,
    lobbies,
    currentLobby,
    isSearching,
    startingGame,
    isHost,
    myPlayerId: myPlayerId.current,
    connectionError,
    createLobby,
    searchLobbies,
    joinLobby,
    startGame,
    leaveLobby,
  };
}
