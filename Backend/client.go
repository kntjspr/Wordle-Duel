package main

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// ══════════════════════════════════════════════════════════════════════════════
// client.go — WebSocket Client (Per-Player Connection)
//
// Each connected player gets:
//   - readPump goroutine:  reads incoming messages from the WebSocket
//   - writePump goroutine: drains the send channel → WebSocket
//
// This is the classic "two goroutines per connection" pattern for safe
// concurrent WebSocket usage with gorilla/websocket.
// ══════════════════════════════════════════════════════════════════════════════

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 512
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins in dev; restrict in production
	},
}

// Client represents one WebSocket connection (one player).
type Client struct {
	mu      sync.RWMutex
	ID      string
	Name    string
	LobbyID string
	conn    *websocket.Conn
	outbox  chan []byte // outbound message queue
	hub     *Hub
}

// NewClient creates a Client and begins its goroutines.
func NewClient(conn *websocket.Conn, hub *Hub) *Client {
	c := &Client{
		ID:     randomID(),
		conn:   conn,
		outbox: make(chan []byte, 256),
		hub:    hub,
	}
	return c
}

// ─── Goroutines ───────────────────────────────────────────────────────────────

// readPump runs in its own goroutine.
// It reads messages from the WebSocket and dispatches them to the hub.
// When this goroutine exits, it unregisters the client.
func (c *Client) readPump() {
	defer func() {
		log.Printf("[Client %s] readPump exit, unregistering", c.ID)
		c.hub.unregister(c)
		c.conn.Close()
	}()

	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, raw, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err,
				websocket.CloseGoingAway,
				websocket.CloseAbnormalClosure) {
				log.Printf("[Client %s] read error: %v", c.ID, err)
			}
			return
		}
		c.hub.dispatch(c, raw)
	}
}

// writePump runs in its own goroutine.
// It drains the send channel and writes messages to the WebSocket.
// A periodic ping keeps the connection alive.
func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
		log.Printf("[Client %s] writePump exit", c.ID)
	}()

	for {
		select {
		case msg, ok := <-c.outbox:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// Hub closed the channel
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(msg)

			// Batch any pending messages
			n := len(c.outbox)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-c.outbox)
			}
			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// ─── Outbound helpers ─────────────────────────────────────────────────────────

// send marshals a typed envelope and queues it for the writePump.
func (c *Client) send(msgType MsgType, payload any) {
	data, err := json.Marshal(Envelope{Type: msgType, Payload: payload})
	if err != nil {
		log.Printf("[Client %s] marshal error: %v", c.ID, err)
		return
	}
	c.sendRaw(data)
}

// sendRaw queues pre-marshalled bytes (used by lobby.broadcast for efficiency).
func (c *Client) sendRaw(data []byte) {
	select {
	case c.outbox <- data:
	default:
		log.Printf("[Client %s] send buffer full, dropping message", c.ID)
	}
}

// closeOutbox drains and closes the outbox channel.
func (c *Client) closeOutbox() {
	select {
	case _, ok := <-c.outbox:
		if ok {
			close(c.outbox)
		}
	default:
		close(c.outbox)
	}
}
