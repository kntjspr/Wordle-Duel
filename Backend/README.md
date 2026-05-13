# Wordle Wars — Backend (Go)

Real-time multiplayer Wordle battle server. Server-authoritative: all game logic,
scoring, and word validation runs on the backend. The frontend is pure UI.

---

## Quick Start

```bash
# Run the server
PORT=8080 go run .

# Run tests
go test -v ./...

# Build binary
go build -o wordlewars-server .
```

Environment variables:
```
PORT=8080          # HTTP/WS port (default: 8080)
```

---

## Architecture

```
                    HTTP :8080
                        │
          ┌─────────────┼─────────────────┐
          │             │                 │
    GET /api/words/*  GET /health    GET /ws  ← WebSocket upgrade
          │                               │
     WordService                         Hub
     (thread-safe)              (RWMutex-protected registry)
          │                        │              │
     Random()                 clients{}       lobbies{}
     IsValid()            map[id]*Client   map[id]*Lobby
     All()                     │                 │
                                │         ┌──────▼──────────┐
                    ┌───────────┴───┐     │ Lobby goroutine │
                    │    Client     │     │  event loop     │
                    │  readPump()   │────▶│  Enqueue(evt)   │
                    │  writePump()  │◀────│  broadcast()    │
                    └───────────────┘     └──────┬──────────┘
                       (2 goroutines)            │
                       per connection     GameState (server-auth)
                                          ProcessGuess()
                                          BuildGameOverPayload()
```

---

## Parallel / Distributed Concepts Demonstrated

| Concept | Implementation |
|---|---|
| **Multithreading** | 2 goroutines per player (`readPump` + `writePump`) |
| **Per-lobby goroutine** | Each lobby runs its own event loop (`Lobby.Run()`) |
| **Background worker** | `NameStore.StartCleanup()` — TTL purge goroutine |
| **Async I/O** | `net/http` + gorilla/websocket non-blocking I/O |
| **Message passing** | `lobby.events chan LobbyEvent` — player goroutines → lobby goroutine |
| **Shared state protection** | `sync.RWMutex` on Hub, Lobby, PlayerState |
| **Parallel broadcast** | `sync.WaitGroup` + goroutine per recipient in `lobby.broadcast()` |
| **Buffered channels** | `outbox chan []byte` (256 buffer) prevents blocking senders |
| **Graceful shutdown** | `os.Signal` + `context.WithTimeout` for clean drain |

---

## WebSocket Protocol

**Connection flow:**
```
Client connects → server sends { type: "connected", payload: { player_id } }
Client sends   → { type: "set_name", payload: { name: "Alice" } }
Server sends   → { type: "name_set", payload: { name: "Alice" } }
```

**Lobby flow:**
```
{ type: "create_lobby" }          → { type: "lobby_created", payload: LobbyState }
{ type: "list_lobbies" }          → { type: "lobby_list",    payload: { lobbies: [...] } }
{ type: "join_lobby", payload: { lobby_id } } → { type: "lobby_joined", payload: LobbyState }
{ type: "start_game" }            → { type: "game_begin",    payload: { players: [...] } }
```

**Game flow:**
```
{ type: "submit_guess", payload: { guess: "crane" } }

→ To guesser:
  { type: "guess_result", payload: {
      tiles: [{letter, state}×5],  ← full result including grey
      row_score, total_score, is_correct, attempts_left
  }}

→ Broadcast to ALL players:
  { type: "player_update", payload: {
      player_id, player_name,
      visible_tiles: [{letter, state}×5],  ← grey tiles are HIDDEN (letter="", state="empty")
      row_score, total_score, has_won, is_eliminated
  }}

→ When game ends:
  { type: "game_over", payload: {
      winner_id, winner_name, won_by_guess, word,
      leaderboard: [{player_id, name, score, has_won, guesses}]
  }}
```

---

## Scoring (Server-Authoritative)

All points are calculated server-side in `wordle.go` and `game.go`.
The client **never** sends a score — only the raw guess string.

| Tile | Points |
|---|---|
| 🟩 Green (correct) | +2 |
| 🟨 Yellow (present) | +1 |
| ⬛ Grey (absent) | +0 |
| 🏆 Solve bonus | +15 |

Win condition:
1. First player to guess the word wins outright
2. If nobody guesses, highest total score wins
3. If tied on score, it's a draw

---

## REST API

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/words/random` | Random word (used by server internally) |
| `GET` | `/api/words/list` | Full word list for frontend autocomplete/validation |
| `POST` | `/api/words/validate` | `{ word }` → `{ valid: bool }` |
| `GET` | `/health` | Health check |

## Wordlist Dataset References

The backend embeds wordlists from the following sources:

- `possible_answers.txt` (answer pool): https://gist.github.com/cfreshman/a03ef2cba789d8cf00c08f767e0fad7b
- `allowed_guess.txt` (valid guess dictionary): https://gist.github.com/cfreshman/cdcdf777450c5b5301e439061d29694c

---

## Frontend Integration

1. Replace `src/api/wordList.ts` with `wordList.connected.ts`
2. Add `src/api/wsClient.ts` to your frontend
3. Set in `.env`:
   ```
   VITE_API_URL=http://localhost:8080
   VITE_WS_URL=ws://localhost:8080/ws
   ```
4. In `useMockOnline.ts`: replace mock functions with `wsClient.createLobby()`, etc.
5. In `useGameEngine.ts`: replace local `buildGuessRow()` with WS `submit_guess` → `guess_result` handler

---

## File Structure

```
wordlewars-backend/
  main.go        — HTTP server, routes, graceful shutdown
  hub.go         — Central client/lobby registry, message dispatch
  client.go      — WebSocket client (readPump + writePump goroutines)
  lobby.go       — Lobby event loop goroutine, game lifecycle
  game.go        — Server-authoritative game state and player state
  wordle.go      — NYT-rules tile evaluation engine + scoring
  words.go       — Authoritative word list (swap point for word API)
  store.go       — Player name TTL store (24h expiry, cleanup goroutine)
  messages.go    — WebSocket protocol type definitions
  wordle_test.go — Unit tests for game logic
  wsClient.ts    — Frontend WebSocket client (drop into src/api/)
  wordList.connected.ts — Backend-connected word API (replaces dev version)
```
