/**
 * useMockOnline — Mock WebSocket / lobby state
 *
 * Simulates the real-time lobby system for development.
 * ──────────────────────────────────────────────────────
 * PRODUCTION SWAP POINT:
 *   Replace the mock functions below with real WebSocket calls:
 *
 *   const ws = new WebSocket(`${WS_URL}/lobby`);
 *   ws.onmessage = (e) => handleServerMessage(JSON.parse(e.data));
 *
 *   Golang backend endpoints:
 *     WS  /ws/lobby/:id     — lobby room
 *     POST /api/lobby/create — create lobby
 *     GET  /api/lobby/list   — list open lobbies
 *     POST /api/lobby/join   — join by id
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LobbyInfo, LobbyPlayer } from '../types/game';

const MAX_PLAYERS = 5;
const BOT_NAMES = [
  'xXWordSlayerXx', 'Lexical_Legend', 'GuessMaster3000',
  'VowelVigilante', 'SpellingSpecter', 'TileTerminator',
  'AlphaStrike99', 'GrammarGhost',
];

function randomCode(): string {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

function randomId(): string {
  return Math.random().toString(36).substring(2, 10);
}

// ─── Mock lobby store ─────────────────────────────────────────────────────────

const MOCK_LOBBIES: LobbyInfo[] = [
  {
    id: 'lobby-demo-1',
    code: 'WRDL',
    hostName: 'LexiPro',
    players: [
      { id: 'demo-host-1', name: 'LexiPro', isHost: true },
      { id: 'demo-p2', name: 'QuickQuill', isHost: false },
    ],
    maxPlayers: 5,
    status: 'waiting',
    createdAt: Date.now() - 45000,
  },
  {
    id: 'lobby-demo-2',
    code: 'TILE',
    hostName: 'WordWitch',
    players: [
      { id: 'demo-host-2', name: 'WordWitch', isHost: true },
    ],
    maxPlayers: 5,
    status: 'waiting',
    createdAt: Date.now() - 15000,
  },
  {
    id: 'lobby-demo-3',
    code: 'GUES',
    hostName: 'AlphaKing',
    players: [
      { id: 'demo-host-3', name: 'AlphaKing', isHost: true },
      { id: 'demo-p3b', name: 'Cryptix', isHost: false },
      { id: 'demo-p3c', name: 'NightOwl', isHost: false },
    ],
    maxPlayers: 5,
    status: 'waiting',
    createdAt: Date.now() - 120000,
  },
];

// ─── Hook ─────────────────────────────────────────────────────────────────────

export type LobbyView = 'choose' | 'create' | 'search' | 'room';

export function useMockOnline(playerName: string) {
  const myId = useRef('player-' + randomId());
  const [view, setView] = useState<LobbyView>('choose');
  const [lobbies, setLobbies] = useState<LobbyInfo[]>([]);
  const [currentLobby, setCurrentLobby] = useState<LobbyInfo | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [startingGame, setStartingGame] = useState(false);
  const joinTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const myPlayerId = myId.current;

  // Cleanup
  useEffect(() => () => { joinTimers.current.forEach(clearTimeout); }, []);

  // ── Create Lobby ─────────────────────────────────────────────────────────

  const createLobby = useCallback(() => {
    const lobby: LobbyInfo = {
      id: 'lobby-' + randomId(),
      code: randomCode(),
      hostName: playerName,
      players: [{ id: myPlayerId, name: playerName, isHost: true }],
      maxPlayers: 5,
      status: 'waiting',
      createdAt: Date.now(),
    };
    setCurrentLobby(lobby);
    setView('room');

    // Simulate players joining over time
    simulatePlayersJoining(lobby);
  }, [playerName, myPlayerId]);

  // ── Search Lobbies ────────────────────────────────────────────────────────

  const searchLobbies = useCallback(() => {
    setIsSearching(true);
    setView('search');
    // Simulate loading
    setTimeout(() => {
      setLobbies([...MOCK_LOBBIES]);
      setIsSearching(false);
    }, 800);
  }, []);

  // ── Join Lobby ────────────────────────────────────────────────────────────

  const joinLobby = useCallback((lobby: LobbyInfo) => {
    const me: LobbyPlayer = { id: myPlayerId, name: playerName, isHost: false };
    const updated: LobbyInfo = {
      ...lobby,
      players: [...lobby.players, me],
    };
    setCurrentLobby(updated);
    setView('room');

    // Simulate more players joining
    if (updated.players.length < MAX_PLAYERS) {
      simulatePlayersJoining(updated);
    }
  }, [playerName, myPlayerId]);

  // ── Simulate joining ──────────────────────────────────────────────────────

  function simulatePlayersJoining(lobby: LobbyInfo) {
    joinTimers.current.forEach(clearTimeout);
    joinTimers.current = [];

    const needed = MAX_PLAYERS - lobby.players.length;
    const count = Math.min(needed, Math.floor(Math.random() * 3) + 1);
    const usedNames = new Set(lobby.players.map(p => p.name));

    for (let i = 0; i < count; i++) {
      const delay = 2000 + i * (1500 + Math.random() * 2000);
      const name = BOT_NAMES.find(n => !usedNames.has(n)) ?? `Player${Math.floor(Math.random()*99)}`;
      usedNames.add(name);

      const t = setTimeout(() => {
        setCurrentLobby(prev => {
          if (!prev || prev.players.length >= MAX_PLAYERS) return prev;
          return {
            ...prev,
            players: [...prev.players, { id: randomId(), name, isHost: false }],
          };
        });
      }, delay);
      joinTimers.current.push(t);
    }
  }

  // ── Start Game ────────────────────────────────────────────────────────────

  const startGame = useCallback(() => {
    setStartingGame(true);
    // Small delay for UX feedback
    setTimeout(() => setStartingGame(false), 400);
    return true; // signals parent to transition to game screen
  }, []);

  // ── Leave Lobby ───────────────────────────────────────────────────────────

  const leaveLobby = useCallback(() => {
    joinTimers.current.forEach(clearTimeout);
    joinTimers.current = [];
    setCurrentLobby(null);
    setView('choose');
  }, []);

  const isHost = currentLobby?.players[0]?.id === myPlayerId;

  return {
    view,
    setView,
    lobbies,
    currentLobby,
    isSearching,
    startingGame,
    isHost,
    myPlayerId,
    createLobby,
    searchLobbies,
    joinLobby,
    startGame,
    leaveLobby,
  };
}
