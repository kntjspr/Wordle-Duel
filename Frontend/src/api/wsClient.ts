/**
 * wsClient.ts — Typed WebSocket client for the Wordle Duel Go backend.
 *
 * Protocol: all messages are JSON envelopes:  { type: string, payload?: any }
 * Backend endpoint: ws://localhost:8080/ws  (configured via VITE_WS_URL)
 */

// ─── Message types (mirrors backend messages.go) ──────────────────────────────

export type MsgType =
  // Inbound (server → client)
  | 'connected' | 'name_set' | 'pong' | 'error'
  | 'lobby_created' | 'lobby_list' | 'lobby_joined' | 'lobby_update' | 'lobby_left'
  | 'game_starting' | 'game_begin'
  | 'guess_result' | 'player_update' | 'game_over'
  // Outbound (client → server)
  | 'set_name' | 'create_lobby' | 'list_lobbies' | 'join_lobby' | 'leave_lobby'
  | 'start_game' | 'submit_guess' | 'ping';

export interface Envelope {
  type: MsgType;
  payload?: unknown;
}

// ─── Payload shapes (server → client) ────────────────────────────────────────

export interface ConnectedPayload   { player_id: string }
export interface NameSetPayload     { name: string }
export interface ErrorPayload       { message: string }

export interface LobbyPlayerInfo {
  id: string;
  name: string;
  is_host: boolean;
}

export interface LobbyState {
  id: string;
  code: string;
  host_id: string;
  host_name: string;
  players: LobbyPlayerInfo[];
  max_players: number;
  status: 'waiting' | 'playing' | 'finished';
}

export interface LobbyListInfo {
  id: string;
  code: string;
  host_name: string;
  player_count: number;
  max_players: number;
}

export interface LobbyListPayload   { lobbies: LobbyListInfo[] }

export interface GameBeginPayload {
  lobby_id: string;
  player_names: string[];
}

export interface TileResult {
  letter: string;
  state: 'correct' | 'present' | 'absent';
}

export interface GuessResultPayload {
  player_id: string;
  guess_index: number;
  tiles: TileResult[];
  row_score: number;
  total_score: number;
  is_correct: boolean;
  attempts_left: number;
}

export interface VisibleTile {
  letter: string;
  state: 'correct' | 'present' | 'empty';
}

export interface PlayerUpdatePayload {
  player_id: string;
  player_name: string;
  guess_index: number;
  visible_tiles: VisibleTile[];
  row_score: number;
  total_score: number;
  has_won: boolean;
  is_eliminated: boolean;
}

export interface LeaderboardEntry {
  player_id: string;
  player_name: string;
  score: number;
  has_won: boolean;
  guesses: number;
}

export interface GameOverPayload {
  winner_id: string;
  winner_name: string;
  won_by_guess: boolean;
  word: string;
  leaderboard: LeaderboardEntry[];
}

// ─── Handler type ─────────────────────────────────────────────────────────────

type Handler<T = unknown> = (payload: T) => void;

export type ConnectionState = 'idle' | 'connecting' | 'open' | 'closed';

// ─── Client class ─────────────────────────────────────────────────────────────

export class WordleWarsClient {
  private ws: WebSocket | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handlers = new Map<MsgType, Handler<any>[]>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _state: ConnectionState = 'idle';
  private stateListeners: ((s: ConnectionState) => void)[] = [];
  private url: string;
  private shouldReconnect = true;

  constructor(url = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8080/ws') {
    this.url = url;
  }

  get connectionState(): ConnectionState { return this._state; }

  onStateChange(fn: (s: ConnectionState) => void): () => void {
    this.stateListeners.push(fn);
    return () => { this.stateListeners = this.stateListeners.filter(f => f !== fn); };
  }

  private setState(s: ConnectionState) {
    this._state = s;
    this.stateListeners.forEach(f => f(s));
  }

  // ── Connection lifecycle ───────────────────────────────────────────────────

  connect(): Promise<void> {
    if (this._state === 'open' || this._state === 'connecting') return Promise.resolve();
    this.shouldReconnect = true;
    this.setState('connecting');

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.setState('open');
        resolve();
      };

      this.ws.onerror = (e) => {
        this.setState('closed');
        reject(e);
      };

      this.ws.onmessage = (e) => {
        // Backend may send multiple newline-delimited JSON objects in one frame
        const lines = (e.data as string).split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const env: Envelope = JSON.parse(line);
            this.handlers.get(env.type)?.forEach(h => h(env.payload));
          } catch {
            console.warn('[WS] bad message:', line);
          }
        }
      };

      this.ws.onclose = () => {
        this.setState('closed');
        if (this.shouldReconnect) {
          console.log('[WS] disconnected — reconnecting in 2 s');
          this.reconnectTimer = setTimeout(() => this.connect().catch(() => {}), 2000);
        }
      };
    });
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.setState('closed');
  }

  // ── Message subscription ───────────────────────────────────────────────────

  on<T = unknown>(type: MsgType, handler: Handler<T>): () => void {
    if (!this.handlers.has(type)) this.handlers.set(type, []);
    this.handlers.get(type)!.push(handler as Handler);
    return () => {
      const arr = this.handlers.get(type);
      if (arr) this.handlers.set(type, arr.filter(h => h !== handler));
    };
  }

  // ── Send helpers ───────────────────────────────────────────────────────────

  private send(type: MsgType, payload?: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    } else {
      console.warn('[WS] not connected, dropping:', type);
    }
  }

  // ── Lobby API ──────────────────────────────────────────────────────────────

  setName(name: string)         { this.send('set_name',      { name }); }
  createLobby()                 { this.send('create_lobby'); }
  listLobbies()                 { this.send('list_lobbies'); }
  joinLobby(lobbyId: string)    { this.send('join_lobby',    { lobby_id: lobbyId }); }
  leaveLobby()                  { this.send('leave_lobby'); }
  startGame()                   { this.send('start_game'); }

  // ── Game API ───────────────────────────────────────────────────────────────

  submitGuess(guess: string)    { this.send('submit_guess',  { guess }); }
  ping()                        { this.send('ping'); }
}

// Singleton — import this everywhere
export const wsClient = new WordleWarsClient();
