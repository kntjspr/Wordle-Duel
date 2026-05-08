package main

import (
	"encoding/json"
	"log"
	"sync"
)

// ══════════════════════════════════════════════════════════════════════════════
// hub.go — Central Connection & Lobby Registry
//
// The Hub owns:
//   - All active WebSocket clients (register/unregister)
//   - All active lobbies
//   - Message dispatch from clients → lobby event loops
//
// Concurrency model:
//   - Hub state is protected by sync.RWMutex (not a goroutine)
//   - Safe for concurrent access from many readPump goroutines
//   - Lobby state is managed by each lobby's own goroutine
// ══════════════════════════════════════════════════════════════════════════════

type Hub struct {
	mu      sync.RWMutex
	clients map[string]*Client // playerID → client
	lobbies map[string]*Lobby  // lobbyID → lobby
	words   *WordService
}

func NewHub(words *WordService) *Hub {
	return &Hub{
		clients: make(map[string]*Client),
		lobbies: make(map[string]*Lobby),
		words:   words,
	}
}

// ─── Registration ─────────────────────────────────────────────────────────────

func (h *Hub) register(c *Client) {
	h.mu.Lock()
	h.clients[c.ID] = c
	h.mu.Unlock()
	log.Printf("[Hub] client registered: %s", c.ID)
}

func (h *Hub) unregister(c *Client) {
	h.mu.Lock()
	delete(h.clients, c.ID)
	lobbyID := c.LobbyID
	h.mu.Unlock()

	// Tell the lobby this player left (non-blocking, lobby has its own goroutine)
	if lobbyID != "" {
		h.mu.RLock()
		lobby, ok := h.lobbies[lobbyID]
		h.mu.RUnlock()
		if ok {
			lobby.Enqueue(LobbyEvent{Type: EvtPlayerLeave, PlayerID: c.ID})
		}
	}

	c.closeOutbox()
	log.Printf("[Hub] client unregistered: %s", c.ID)
}

func (h *Hub) getClient(id string) (*Client, bool) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	c, ok := h.clients[id]
	return c, ok
}

// ─── Lobby management ─────────────────────────────────────────────────────────

func (h *Hub) addLobby(lobby *Lobby) {
	h.mu.Lock()
	h.lobbies[lobby.ID] = lobby
	h.mu.Unlock()
}

func (h *Hub) removeLobby(id string) {
	h.mu.Lock()
	delete(h.lobbies, id)
	h.mu.Unlock()
	log.Printf("[Hub] lobby removed: %s", id)
}

func (h *Hub) getLobby(id string) (*Lobby, bool) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	l, ok := h.lobbies[id]
	return l, ok
}

// ─── Message dispatch ─────────────────────────────────────────────────────────
// dispatch parses a raw WebSocket message and routes it.
// Called from each client's readPump goroutine — must be safe for concurrency.

func (h *Hub) dispatch(c *Client, raw []byte) {
	var env Envelope
	if err := json.Unmarshal(raw, &env); err != nil {
		c.send(MsgError, ErrorPayload{Message: "invalid message format"})
		return
	}

	switch env.Type {

	case MsgSetName:
		var p SetNamePayload
		if unmarshalPayload(env.Payload, &p) != nil || p.Name == "" {
			c.send(MsgError, ErrorPayload{Message: "invalid name"})
			return
		}
		name := sanitizeName(p.Name)
		c.mu.Lock()
		c.Name = name
		c.mu.Unlock()
		c.send(MsgNameSet, NameSetPayload{Name: name})
		log.Printf("[Hub] client %s set name: %s", c.ID, name)

	case MsgCreateLobby:
		h.handleCreateLobby(c)

	case MsgListLobbies:
		h.handleListLobbies(c)

	case MsgJoinLobby:
		var p JoinLobbyPayload
		if unmarshalPayload(env.Payload, &p) != nil {
			c.send(MsgError, ErrorPayload{Message: "invalid payload"})
			return
		}
		h.handleJoinLobby(c, p.LobbyID)

	case MsgLeaveLobby:
		h.handleLeaveLobby(c)

	case MsgStartGame:
		h.handleStartGame(c)

	case MsgSubmitGuess:
		var p SubmitGuessPayload
		if unmarshalPayload(env.Payload, &p) != nil || len(p.Guess) != WordLength {
			c.send(MsgError, ErrorPayload{Message: "guess must be 5 letters"})
			return
		}
		h.handleGuess(c, p.Guess)

	case MsgPing:
		c.send(MsgPong, nil)

	default:
		c.send(MsgError, ErrorPayload{Message: "unknown message type"})
	}
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

func (h *Hub) handleCreateLobby(c *Client) {
	c.mu.RLock()
	name := c.Name
	c.mu.RUnlock()
	if name == "" {
		c.send(MsgError, ErrorPayload{Message: "set your name first"})
		return
	}

	// Leave existing lobby first
	if c.LobbyID != "" {
		h.handleLeaveLobby(c)
	}

	lobbyID := "lb-" + randomID()
	code := randomCode()
	lobby := NewLobby(lobbyID, code, c.ID, h)
	h.addLobby(lobby)

	// Assign player to lobby
	c.mu.Lock()
	c.LobbyID = lobbyID
	c.mu.Unlock()

	// Start lobby event loop goroutine
	// ← CONCURRENCY: one goroutine per lobby
	go lobby.Run()

	// Join via event loop so state is consistent
	lobby.Enqueue(LobbyEvent{Type: EvtPlayerJoin, PlayerID: c.ID})
	log.Printf("[Hub] lobby created: %s (code=%s) by %s", lobbyID, code, name)
}

func (h *Hub) handleListLobbies(c *Client) {
	h.mu.RLock()
	infos := make([]LobbyListInfo, 0, len(h.lobbies))
	for _, lobby := range h.lobbies {
		lobby.mu.RLock()
		if lobby.Status == LobbyWaiting && len(lobby.players) < MaxPlayers {
			hostName := ""
			if host, ok := lobby.players[lobby.HostID]; ok {
				host.mu.RLock()
				hostName = host.Name
				host.mu.RUnlock()
			}
			infos = append(infos, LobbyListInfo{
				ID:          lobby.ID,
				Code:        lobby.Code,
				HostName:    hostName,
				PlayerCount: len(lobby.players),
				MaxPlayers:  MaxPlayers,
			})
		}
		lobby.mu.RUnlock()
	}
	h.mu.RUnlock()

	c.send(MsgLobbyList, LobbyListPayload{Lobbies: infos})
}

func (h *Hub) handleJoinLobby(c *Client, lobbyID string) {
	c.mu.RLock()
	name := c.Name
	c.mu.RUnlock()
	if name == "" {
		c.send(MsgError, ErrorPayload{Message: "set your name first"})
		return
	}

	// Leave existing lobby
	if c.LobbyID != "" {
		h.handleLeaveLobby(c)
	}

	lobby, ok := h.getLobby(lobbyID)
	if !ok {
		c.send(MsgError, ErrorPayload{Message: "lobby not found"})
		return
	}

	c.mu.Lock()
	c.LobbyID = lobbyID
	c.mu.Unlock()

	// Enqueue join — processed by lobby goroutine
	lobby.Enqueue(LobbyEvent{Type: EvtPlayerJoin, PlayerID: c.ID})
}

func (h *Hub) handleLeaveLobby(c *Client) {
	c.mu.RLock()
	lobbyID := c.LobbyID
	c.mu.RUnlock()
	if lobbyID == "" {
		return
	}

	c.mu.Lock()
	c.LobbyID = ""
	c.mu.Unlock()

	if lobby, ok := h.getLobby(lobbyID); ok {
		lobby.Enqueue(LobbyEvent{Type: EvtPlayerLeave, PlayerID: c.ID})
	}
	c.send(MsgLobbyLeft, nil)
}

func (h *Hub) handleStartGame(c *Client) {
	c.mu.RLock()
	lobbyID := c.LobbyID
	c.mu.RUnlock()
	if lobbyID == "" {
		c.send(MsgError, ErrorPayload{Message: "not in a lobby"})
		return
	}

	lobby, ok := h.getLobby(lobbyID)
	if !ok {
		c.send(MsgError, ErrorPayload{Message: "lobby not found"})
		return
	}

	lobby.Enqueue(LobbyEvent{Type: EvtStartGame, PlayerID: c.ID})
}

func (h *Hub) handleGuess(c *Client, guess string) {
	c.mu.RLock()
	lobbyID := c.LobbyID
	c.mu.RUnlock()
	if lobbyID == "" {
		c.send(MsgError, ErrorPayload{Message: "not in a game"})
		return
	}

	lobby, ok := h.getLobby(lobbyID)
	if !ok {
		c.send(MsgError, ErrorPayload{Message: "lobby not found"})
		return
	}

	// Enqueue to lobby event loop
	// ← CONCURRENCY: multiple player goroutines safely contend here
	lobby.Enqueue(LobbyEvent{Type: EvtGuess, PlayerID: c.ID, Data: guess})
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

func unmarshalPayload(payload any, target any) error {
	if payload == nil {
		return nil
	}
	b, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	return json.Unmarshal(b, target)
}

func sanitizeName(name string) string {
	runes := []rune(name)
	if len(runes) > 16 {
		runes = runes[:16]
	}
	return string(runes)
}
