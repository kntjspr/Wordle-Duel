package main

import (
	"encoding/json"
	"log"
	"math/rand"
	"sync"
	"time"
)

// ══════════════════════════════════════════════════════════════════════════════
// lobby.go — Lobby & Game Room Management
//
// Each Lobby runs its own goroutine (Run) that serialises all state mutations
// through a channel. Concurrent player goroutines send events into this channel.
//
// Concurrency model:
//   - One goroutine per lobby (event loop)
//   - Player connections send LobbyEvents into lobby.events channel
//   - Lobby goroutine processes events sequentially → no data races on state
//   - done channel signals clean shutdown
// ══════════════════════════════════════════════════════════════════════════════

// ─── Events ───────────────────────────────────────────────────────────────────

type EventType string

const (
	EvtPlayerJoin  EventType = "player_join"
	EvtPlayerLeave EventType = "player_leave"
	EvtStartGame   EventType = "start_game"
	EvtGuess       EventType = "guess"
)

// LobbyEvent is sent from a client goroutine into the lobby's event channel.
type LobbyEvent struct {
	Type     EventType
	PlayerID string
	Data     string // raw payload (e.g. guess string)
}

// ─── Lobby ────────────────────────────────────────────────────────────────────

type LobbyStatus string

const (
	LobbyWaiting  LobbyStatus = "waiting"
	LobbyPlaying  LobbyStatus = "playing"
	LobbyFinished LobbyStatus = "finished"
)

type Lobby struct {
	mu      sync.RWMutex
	ID      string
	Code    string
	HostID  string
	Status  LobbyStatus
	players map[string]*Client // playerID → connection
	game    *GameState
	events  chan LobbyEvent
	done    chan struct{}
	hub     *Hub
}

func NewLobby(id, code, hostID string, hub *Hub) *Lobby {
	return &Lobby{
		ID:      id,
		Code:    code,
		HostID:  hostID,
		Status:  LobbyWaiting,
		players: make(map[string]*Client, MaxPlayers),
		events:  make(chan LobbyEvent, 64),
		done:    make(chan struct{}),
		hub:     hub,
	}
}

// ─── Lobby event loop ─────────────────────────────────────────────────────────
// Run is the single goroutine that owns this lobby's mutable state.
// All state changes must flow through this loop via the events channel.

func (l *Lobby) Run() {
	defer func() {
		log.Printf("[Lobby %s] event loop exiting", l.ID)
		l.hub.removeLobby(l.ID)
	}()

	// Inactivity timeout: close lobby if empty for 60s
	inactivityTimer := time.NewTimer(60 * time.Second)
	defer inactivityTimer.Stop()

	for {
		select {
		case evt := <-l.events:
			l.handleEvent(evt)
			// Reset inactivity timer on any event
			if !inactivityTimer.Stop() {
				select {
				case <-inactivityTimer.C:
				default:
				}
			}
			inactivityTimer.Reset(60 * time.Second)

		case <-inactivityTimer.C:
			l.mu.RLock()
			count := len(l.players)
			l.mu.RUnlock()
			if count == 0 {
				log.Printf("[Lobby %s] empty timeout, closing", l.ID)
				return
			}
			inactivityTimer.Reset(60 * time.Second)

		case <-l.done:
			return
		}
	}
}

// handleEvent dispatches lobby events. Called only from Run() goroutine.
func (l *Lobby) handleEvent(evt LobbyEvent) {
	switch evt.Type {
	case EvtPlayerJoin:
		l.onPlayerJoin(evt.PlayerID)
	case EvtPlayerLeave:
		l.onPlayerLeave(evt.PlayerID)
	case EvtStartGame:
		l.onStartGame(evt.PlayerID)
	case EvtGuess:
		l.onGuess(evt.PlayerID, evt.Data)
	}
}

// ─── Event handlers ───────────────────────────────────────────────────────────

func (l *Lobby) onPlayerJoin(playerID string) {
	l.mu.RLock()
	client, ok := l.hub.getClient(playerID)
	count := len(l.players)
	status := l.Status
	l.mu.RUnlock()

	if !ok || status != LobbyWaiting || count >= MaxPlayers {
		if ok {
			client.send(MsgError, ErrorPayload{Message: "Cannot join lobby"})
		}
		return
	}

	l.mu.Lock()
	l.players[playerID] = client
	l.mu.Unlock()

	// Confirm join to the new player
	client.send(MsgLobbyJoined, l.snapshot())

	// Broadcast update to all other players
	l.broadcast(MsgLobbyUpdate, l.snapshot(), "")
	log.Printf("[Lobby %s] player %s joined (%d/%d)", l.ID, client.Name, count+1, MaxPlayers)
}

func (l *Lobby) onPlayerLeave(playerID string) {
	l.mu.Lock()
	delete(l.players, playerID)
	remaining := len(l.players)
	hostLeaving := playerID == l.HostID

	// Transfer host if needed
	if hostLeaving && remaining > 0 {
		for id := range l.players {
			l.HostID = id
			break
		}
	}
	l.mu.Unlock()

	l.broadcast(MsgLobbyUpdate, l.snapshot(), "")
	log.Printf("[Lobby %s] player %s left (%d remaining)", l.ID, playerID, remaining)

	// Close lobby if empty
	if remaining == 0 {
		close(l.done)
	}
}

func (l *Lobby) onStartGame(playerID string) {
	l.mu.Lock()
	if l.Status != LobbyWaiting {
		l.mu.Unlock()
		return
	}
	if playerID != l.HostID {
		l.mu.Unlock()
		if c, ok := l.hub.getClient(playerID); ok {
			c.send(MsgError, ErrorPayload{Message: "Only the host can start the game"})
		}
		return
	}
	if len(l.players) < 1 {
		l.mu.Unlock()
		return
	}
	l.Status = LobbyPlaying
	l.mu.Unlock()

	// Pick word (server-side only — never sent to clients until game over)
	word := l.hub.words.Random()

	// Build player list
	l.mu.RLock()
	playerList := make([]LobbyPlayerInfo, 0, len(l.players))
	playerNames := make([]string, 0, len(l.players))
	for id, c := range l.players {
		c.mu.RLock()
		name := c.Name
		c.mu.RUnlock()
		isHost := id == l.HostID
		playerList = append(playerList, LobbyPlayerInfo{ID: id, Name: name, IsHost: isHost})
		playerNames = append(playerNames, name)
	}
	l.mu.RUnlock()

	// Create authoritative game state
	l.mu.Lock()
	l.game = NewGameState(word, playerList)
	l.mu.Unlock()

	// Notify all players game is beginning
	l.broadcast(MsgGameBegin, GameBeginPayload{
		LobbyID: l.ID,
		Players: playerNames,
	}, "")

	log.Printf("[Lobby %s] game started with %d players, word=%s",
		l.ID, len(playerList), word)
}

func (l *Lobby) onGuess(playerID, guess string) {
	l.mu.RLock()
	game := l.game
	status := l.Status
	l.mu.RUnlock()

	if status != LobbyPlaying || game == nil {
		if c, ok := l.hub.getClient(playerID); ok {
			c.send(MsgError, ErrorPayload{Message: "Game is not active"})
		}
		return
	}

	// Validate word exists in word list (server-side validation)
	if !l.hub.words.IsValid(guess) {
		if c, ok := l.hub.getClient(playerID); ok {
			c.send(MsgError, ErrorPayload{Message: "not_in_word_list"})
		}
		return
	}

	result, update, gameOver := game.ProcessGuess(playerID, guess)
	if result == nil {
		if c, ok := l.hub.getClient(playerID); ok {
			c.send(MsgError, ErrorPayload{Message: "Invalid guess"})
		}
		return
	}

	// Send full result (with grey tiles) ONLY to the guesser
	if c, ok := l.hub.getClient(playerID); ok {
		c.send(MsgGuessResult, result)
	}

	// Broadcast visible update (grey hidden) to ALL players
	l.broadcast(MsgPlayerUpdate, update, "")

	if gameOver {
		payload := game.BuildGameOverPayload()
		l.broadcast(MsgGameOver, payload, "")
		l.mu.Lock()
		l.Status = LobbyFinished
		l.mu.Unlock()
		log.Printf("[Lobby %s] game over, winner=%s word=%s",
			l.ID, payload.WinnerName, payload.Word)
	}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Enqueue sends an event to the lobby's event loop (non-blocking with timeout).
func (l *Lobby) Enqueue(evt LobbyEvent) {
	select {
	case l.events <- evt:
	case <-time.After(5 * time.Second):
		log.Printf("[Lobby %s] event queue full, dropping %s", l.ID, evt.Type)
	case <-l.done:
	}
}

// snapshot builds a LobbyState for sending to clients. Caller must not hold l.mu.
func (l *Lobby) snapshot() LobbyState {
	l.mu.RLock()
	defer l.mu.RUnlock()

	players := make([]LobbyPlayerInfo, 0, len(l.players))
	hostName := ""
	for id, c := range l.players {
		c.mu.RLock()
		name := c.Name
		c.mu.RUnlock()
		isHost := id == l.HostID
		if isHost {
			hostName = name
		}
		players = append(players, LobbyPlayerInfo{ID: id, Name: name, IsHost: isHost})
	}

	return LobbyState{
		ID:         l.ID,
		Code:       l.Code,
		HostID:     l.HostID,
		HostName:   hostName,
		Players:    players,
		MaxPlayers: MaxPlayers,
		Status:     string(l.Status),
	}
}

// broadcast sends a message to all players in the lobby, optionally excluding one.
func (l *Lobby) broadcast(msgType MsgType, payload any, excludeID string) {
	l.mu.RLock()
	clients := make([]*Client, 0, len(l.players))
	for id, c := range l.players {
		if id != excludeID {
			clients = append(clients, c)
		}
	}
	l.mu.RUnlock()

	data, err := json.Marshal(Envelope{Type: msgType, Payload: payload})
	if err != nil {
		log.Printf("[Lobby %s] marshal error: %v", l.ID, err)
		return
	}

	// Send to each client concurrently
	var wg sync.WaitGroup
	for _, c := range clients {
		wg.Add(1)
		go func(cl *Client) {
			defer wg.Done()
			cl.sendRaw(data)
		}(c)
	}
	wg.Wait()
}

// ─── Random code ──────────────────────────────────────────────────────────────

const codeChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

func randomCode() string {
	b := make([]byte, 4)
	for i := range b {
		b[i] = codeChars[rand.Intn(len(codeChars))]
	}
	return string(b)
}

func randomID() string {
	const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, 12)
	for i := range b {
		b[i] = chars[rand.Intn(len(chars))]
	}
	return string(b)
}
