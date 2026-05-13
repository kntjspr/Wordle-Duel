package main

// ══════════════════════════════════════════════════════════════════════════════
// main.go — Wordle Wars Backend Server
//
// Architecture:
//   ┌─────────────────────────────────────────────────────────────┐
//   │  HTTP Server (net/http)                                     │
//   │    GET  /api/words/random   → random word (game server use) │
//   │    GET  /api/words/list     → full word list (frontend use) │
//   │    POST /api/words/validate → check if word is valid        │
//   │    GET  /health             → server health check           │
//   │    GET  /ws                 → WebSocket upgrade             │
//   └──────────────────────┬──────────────────────────────────────┘
//                          │ WebSocket
//                          ▼
//   ┌──────────────────────────────────────────────────────────────┐
//   │  Hub (central registry)                                      │
//   │    clients: map[playerID]*Client                             │
//   │    lobbies: map[lobbyID]*Lobby                               │
//   │    dispatch(client, message) → routes all incoming messages  │
//   └──────────┬───────────────────────────┬───────────────────────┘
//              │                           │
//   ┌──────────▼─────────┐     ┌───────────▼──────────────────────┐
//   │  Client (per conn) │     │  Lobby (per room) — goroutine    │
//   │  readPump goroutine│     │  event loop: join/leave/start/    │
//   │  writePump gorouti │     │  guess → GameState.ProcessGuess() │
//   └────────────────────┘     └──────────────────────────────────┘
//
// Parallelism demonstrated:
//   1. readPump + writePump per player (2 goroutines per connection)
//   2. One goroutine per lobby (event loop pattern)
//   3. Hub.broadcast uses sync.WaitGroup for parallel writes
//   4. NameStore cleanup goroutine (TTL maintenance)
//   5. sync.RWMutex on Hub, Lobby, PlayerState for concurrent safety
//   6. Buffered channels for non-blocking message passing
// ══════════════════════════════════════════════════════════════════════════════

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"runtime"
	"syscall"
	"time"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// ── Services ────────────────────────────────────────────────────────────
	words := NewWordService(AllowedGuessList, PossibleAnswerList)
	nameStore := NewNameStore()
	nameStore.StartCleanup() // ← background TTL goroutine
	defer nameStore.Stop()

	hub := NewHub(words)

	// ── Routes ──────────────────────────────────────────────────────────────
	mux := http.NewServeMux()

	// REST: Word API (easy swap point for external word service)
	mux.HandleFunc("GET /api/words/random", corsMiddleware(handleRandomWord(words)))
	mux.HandleFunc("GET /api/words/list", corsMiddleware(handleWordList(words)))
	mux.HandleFunc("POST /api/words/validate", corsMiddleware(handleValidateWord(words)))
	mux.HandleFunc("GET /health", handleHealth)
	mux.HandleFunc("GET /metrics", handleMetrics)

	// WebSocket endpoint
	mux.HandleFunc("GET /ws", func(w http.ResponseWriter, r *http.Request) {
		handleWebSocket(hub, nameStore, w, r)
	})

	// ── Server ──────────────────────────────────────────────────────────────
	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      mux,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// Graceful shutdown on SIGINT/SIGTERM
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	go func() {
		log.Printf("╔══════════════════════════════════════╗")
		log.Printf("║  Wordle Wars Backend  :%s           ║", port)
		log.Printf("║  Words loaded: %d                 ║", len(words.All()))
		log.Printf("║  WS:  ws://localhost:%s/ws         ║", port)
		log.Printf("║  API: http://localhost:%s/api/...  ║", port)
		log.Printf("╚══════════════════════════════════════╝")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	<-stop
	log.Println("Shutting down gracefully...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	srv.Shutdown(ctx)
	log.Println("Server stopped.")
}

// ─── WebSocket Handler ────────────────────────────────────────────────────────

func handleWebSocket(hub *Hub, nameStore *NameStore, w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}

	client := NewClient(conn, hub)
	hub.register(client)

	// Send connection confirmation with assigned player ID
	client.send(MsgConnected, ConnectedPayload{PlayerID: client.ID})

	// ← CONCURRENCY: Two goroutines per connection
	//   readPump: blocks on conn.ReadMessage()
	//   writePump: blocks on select{send channel, ping ticker}
	go client.writePump()
	go client.readPump() // closes send channel on exit → writePump exits
}

// ─── REST Handlers ────────────────────────────────────────────────────────────

func handleRandomWord(words *WordService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"word": words.Random()})
	}
}

func handleWordList(words *WordService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{"words": words.All()})
	}
}

func handleValidateWord(words *WordService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Word string `json:"word"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]bool{"valid": words.IsValid(body.Word)})
	}
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "wordlewars"})
}

func handleMetrics(w http.ResponseWriter, r *http.Request) {
	var ms runtime.MemStats
	runtime.ReadMemStats(&ms)
	w.Header().Set("Access-Control-Allow-Origin", "*")
	writeJSON(w, http.StatusOK, map[string]any{
		"goroutines":    runtime.NumGoroutine(),
		"heap_alloc_mb": float64(ms.HeapAlloc) / 1024 / 1024,
		"heap_sys_mb":   float64(ms.HeapSys) / 1024 / 1024,
		"sys_mb":        float64(ms.Sys) / 1024 / 1024,
		"gc_cycles":     ms.NumGC,
	})
}

// ─── Middleware ───────────────────────────────────────────────────────────────

func corsMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next(w, r)
	}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}
