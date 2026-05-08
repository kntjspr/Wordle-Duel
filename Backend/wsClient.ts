/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║   wsClient.ts — WebSocket Connection to Go Backend              ║
 * ║                                                                  ║
 * ║   Replaces useMockOnline.ts for production.                     ║
 * ║   Set VITE_WS_URL=ws://localhost:8080 in your .env              ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

export type MsgType =
  | 'connected' | 'name_set' | 'pong' | 'error'
  | 'lobby_created' | 'lobby_list' | 'lobby_joined' | 'lobby_update' | 'lobby_left'
  | 'game_begin' | 'guess_result' | 'player_update' | 'game_over'
  | 'game_starting';

export interface Envelope {
  type: MsgType;
  payload?: unknown;
}

type Handler = (payload: unknown) => void;

export class WordleWarsClient {
  private ws: WebSocket | null = null;
  private handlers = new Map<MsgType, Handler[]>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private url: string;

  constructor(url = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8080/ws') {
    this.url = url;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
      this.ws.onmessage = (e) => {
        // Server may batch newline-separated messages
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
        console.log('[WS] disconnected, reconnecting in 2s');
        this.reconnectTimer = setTimeout(() => this.connect(), 2000);
      };
    });
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
  }

  on(type: MsgType, handler: Handler) {
    if (!this.handlers.has(type)) this.handlers.set(type, []);
    this.handlers.get(type)!.push(handler);
    return () => {
      const arr = this.handlers.get(type);
      if (arr) this.handlers.set(type, arr.filter(h => h !== handler));
    };
  }

  private send(type: string, payload?: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    } else {
      console.warn('[WS] not connected, dropping:', type);
    }
  }

  // ── Lobby API ─────────────────────────────────────────────────────────────

  setName(name: string)           { this.send('set_name', { name }); }
  createLobby()                   { this.send('create_lobby'); }
  listLobbies()                   { this.send('list_lobbies'); }
  joinLobby(lobbyId: string)      { this.send('join_lobby', { lobby_id: lobbyId }); }
  leaveLobby()                    { this.send('leave_lobby'); }
  startGame()                     { this.send('start_game'); }

  // ── Game API ──────────────────────────────────────────────────────────────

  submitGuess(guess: string)      { this.send('submit_guess', { guess }); }
  ping()                          { this.send('ping'); }
}

// Singleton for the app to import
export const wsClient = new WordleWarsClient();
