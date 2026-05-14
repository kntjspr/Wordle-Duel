// cmd/perf/main.go — Wordle Duel WebSocket Load Test
//
// Connects real WebSocket bots to the live backend and runs through the full
// lobby → game flow, measuring:
//   - Round-trip latency (submit_guess → guess_result)
//   - Throughput (events processed per second)
//   - Server goroutine count and heap memory (via GET /metrics)
//
// Usage (from Backend directory):
//   go run ./cmd/perf
//   go run ./cmd/perf -backend ws://localhost:8080/ws -guesses 4

package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"math"
	"net/http"
	"os"
	"sort"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"
)

// ── Flags ─────────────────────────────────────────────────────────────────────

var (
	flagBackend = flag.String("backend", "ws://localhost:8080/ws", "WebSocket server URL")
	flagHTTP    = flag.String("http", "http://localhost:8080", "HTTP server base URL")
	flagOutput  = flag.String("output", "../testing/performance-report.html", "Output HTML path")
	flagGuesses = flag.Int("guesses", 3, "Guesses per player per game")
	flagTimeout = flag.Duration("timeout", 15*time.Second, "Per-operation timeout")
)

// Valid Wordle words used as test guesses.
// These are common 5-letter words confirmed in the backend word list.
var guessWords = []string{
	"crane", "stare", "light", "table", "plant",
	"bread", "smile", "chair", "ocean", "brain",
	"track", "blend", "crisp", "groan", "flute",
}

// ── WebSocket Bot ─────────────────────────────────────────────────────────────

// Envelope matches the backend's wire format: { "type": "...", "payload": {...} }
type Envelope struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

// Bot is a single simulated player with a live WebSocket connection.
type Bot struct {
	conn   *websocket.Conn
	ID     string // server-assigned player ID
	Name   string
	mu     sync.Mutex
	subs   map[string][]chan json.RawMessage
	closed chan struct{}
	// Pre-subscribed before readLoop starts so we never miss early messages.
	ConnectedCh chan json.RawMessage
}

func NewBot(wsURL, name string) (*Bot, error) {
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		return nil, fmt.Errorf("dial %s: %w", wsURL, err)
	}
	b := &Bot{
		conn:        conn,
		Name:        name,
		subs:        make(map[string][]chan json.RawMessage),
		closed:      make(chan struct{}),
		ConnectedCh: make(chan json.RawMessage, 4),
	}
	// Register before starting readLoop to guarantee we never miss the
	// server's first 'connected' message, which arrives almost immediately.
	b.subs["connected"] = []chan json.RawMessage{b.ConnectedCh}
	go b.readLoop()
	return b, nil
}

func (b *Bot) readLoop() {
	defer close(b.closed)
	for {
		_, data, err := b.conn.ReadMessage()
		if err != nil {
			return
		}
		// The backend writePump batches pending messages into one WS frame
		// separated by newlines. Decode each JSON object individually.
		dec := json.NewDecoder(bytes.NewReader(data))
		for dec.More() {
			var env Envelope
			if err := dec.Decode(&env); err != nil {
				break
			}
			b.mu.Lock()
			chans := append([]chan json.RawMessage(nil), b.subs[env.Type]...)
			b.mu.Unlock()
			for _, ch := range chans {
				select {
				case ch <- env.Payload:
				default:
				}
			}
		}
	}
}

// subscribe returns a buffered channel that receives payloads of the given type.
func (b *Bot) subscribe(msgType string) chan json.RawMessage {
	ch := make(chan json.RawMessage, 8)
	b.mu.Lock()
	b.subs[msgType] = append(b.subs[msgType], ch)
	b.mu.Unlock()
	return ch
}

// waitFor blocks until msgType arrives or timeout expires.
func (b *Bot) waitFor(msgType string, timeout time.Duration) (json.RawMessage, error) {
	ch := b.subscribe(msgType)
	select {
	case msg := <-ch:
		return msg, nil
	case <-time.After(timeout):
		return nil, fmt.Errorf("timeout waiting for %s (bot %s)", msgType, b.Name)
	case <-b.closed:
		return nil, fmt.Errorf("connection closed waiting for %s", msgType)
	}
}

// send serialises and writes a message to the server.
func (b *Bot) send(msgType string, payload any) error {
	env := struct {
		Type    string `json:"type"`
		Payload any    `json:"payload,omitempty"`
	}{Type: msgType, Payload: payload}
	data, _ := json.Marshal(env)
	return b.conn.WriteMessage(websocket.TextMessage, data)
}

func (b *Bot) Close() { b.conn.Close() }

// ── Server metrics ─────────────────────────────────────────────────────────────

type ServerMetrics struct {
	Goroutines  int     `json:"goroutines"`
	HeapAllocMB float64 `json:"heap_alloc_mb"`
	SysMB       float64 `json:"sys_mb"`
}

func fetchMetrics(httpBase string) *ServerMetrics {
	resp, err := http.Get(httpBase + "/metrics")
	if err != nil {
		return nil
	}
	defer resp.Body.Close()
	var m ServerMetrics
	if err := json.NewDecoder(resp.Body).Decode(&m); err != nil {
		return nil
	}
	return &m
}

// ── Latency statistics ─────────────────────────────────────────────────────────

type LatStats struct {
	Count int
	Avg   float64
	P50   float64
	P95   float64
	P99   float64
	Min   float64
	Max   float64
}

func calcStats(durs []time.Duration) LatStats {
	if len(durs) == 0 {
		return LatStats{}
	}
	ms := make([]float64, len(durs))
	for i, d := range durs {
		ms[i] = float64(d.Nanoseconds()) / 1e6
	}
	sort.Float64s(ms)
	n := len(ms)
	sum := 0.0
	for _, v := range ms {
		sum += v
	}
	pct := func(p float64) float64 {
		idx := int(math.Ceil(p/100*float64(n))) - 1
		if idx < 0 {
			idx = 0
		}
		if idx >= n {
			idx = n - 1
		}
		return math.Round(ms[idx]*10) / 10
	}
	return LatStats{
		Count: n,
		Avg:   math.Round(sum/float64(n)*10) / 10,
		P50:   pct(50),
		P95:   pct(95),
		P99:   pct(99),
		Min:   math.Round(ms[0]*10) / 10,
		Max:   math.Round(ms[n-1]*10) / 10,
	}
}

// ── Scenario result ────────────────────────────────────────────────────────────

type ScenarioResult struct {
	Label      string
	NumLobbies int
	NumPlayers int
	Latencies  []time.Duration
	EventCount int64
	ElapsedSec float64
	Before     *ServerMetrics
	After      *ServerMetrics
}

func (r ScenarioResult) EvtPerSec() float64 {
	if r.ElapsedSec == 0 {
		return 0
	}
	return float64(r.EventCount) / r.ElapsedSec
}

// ── Lobby runner ───────────────────────────────────────────────────────────────

// runLobby spins up numPlayers bots, completes the lobby → game flow, and
// measures the RTT for each guess (submit_guess → guess_result).
func runLobby(
	wsURL string,
	lobbyIdx, numPlayers, numGuesses int,
	timeout time.Duration,
	evtCount *int64,
) []time.Duration {
	if numPlayers < 2 {
		numPlayers = 2
	}

	bots := make([]*Bot, numPlayers)
	for i := range bots {
		b, err := NewBot(wsURL, fmt.Sprintf("Perf-%d-%d", lobbyIdx, i))
		if err != nil {
			log.Printf("[L%d] connect error: %v", lobbyIdx, err)
			return nil
		}
		defer b.Close()
		bots[i] = b
	}

	// 1. Receive server-assigned player IDs (use pre-subscribed ConnectedCh
	//    to avoid a race where the message arrives before subscribe() is called)
	for _, b := range bots {
		select {
		case raw := <-b.ConnectedCh:
			var p struct {
				PlayerID string `json:"player_id"`
			}
			json.Unmarshal(raw, &p)
			b.ID = p.PlayerID
			atomic.AddInt64(evtCount, 1)
		case <-time.After(timeout):
			log.Printf("[L%d] connected timeout (bot %s)", lobbyIdx, b.Name)
			return nil
		case <-b.closed:
			log.Printf("[L%d] connection closed before connected (bot %s)", lobbyIdx, b.Name)
			return nil
		}
	}

	// 2. Set display names — subscribe before send to avoid race
	for _, b := range bots {
		nameSetCh := b.subscribe("name_set")
		b.send("set_name", map[string]string{"name": b.Name})
		select {
		case <-nameSetCh:
			atomic.AddInt64(evtCount, 1)
		case <-time.After(timeout):
			log.Printf("[L%d] name_set timeout (bot %s)", lobbyIdx, b.Name)
			return nil
		}
	}

	// 3. Host creates lobby.
	//    The backend sends 'lobby_joined' to the creator (MsgLobbyCreated is
	//    defined but never actually sent). Subscribe before send.
	host := bots[0]
	createdCh := host.subscribe("lobby_joined")
	host.send("create_lobby", nil)
	var lobbyID string
	select {
	case raw := <-createdCh:
		var s struct {
			ID string `json:"id"`
		}
		json.Unmarshal(raw, &s)
		lobbyID = s.ID
		atomic.AddInt64(evtCount, 1)
	case <-time.After(timeout):
		log.Printf("[L%d] lobby_joined (create) timeout", lobbyIdx)
		return nil
	}

	// 4. Guests join — subscribe before send
	for i := 1; i < numPlayers; i++ {
		joinedCh := bots[i].subscribe("lobby_joined")
		bots[i].send("join_lobby", map[string]string{"lobby_id": lobbyID})
		select {
		case <-joinedCh:
			atomic.AddInt64(evtCount, 1)
		case <-time.After(timeout):
			log.Printf("[L%d] lobby_joined (guest %d) timeout", lobbyIdx, i)
			return nil
		}
		time.Sleep(20 * time.Millisecond)
	}

	// 5. Subscribe all bots to game_begin BEFORE host sends start_game
	beginChans := make([]chan json.RawMessage, numPlayers)
	for i, b := range bots {
		beginChans[i] = b.subscribe("game_begin")
	}
	host.send("start_game", nil)
	for i := range bots {
		select {
		case <-beginChans[i]:
			atomic.AddInt64(evtCount, 1)
		case <-time.After(timeout):
			log.Printf("[L%d] game_begin timeout bot %d", lobbyIdx, i)
			return nil
		}
	}

	// 6. All players guess concurrently; measure RTT per guess.
	//    Stop when: player wins, is eliminated, or game_over arrives.
	var (
		latMu sync.Mutex
		lats  []time.Duration
		wg    sync.WaitGroup
	)
	for i, b := range bots {
		wg.Add(1)
		go func(bot *Bot, idx int) {
			defer wg.Done()
			resultCh := bot.subscribe("guess_result")
			gameOverCh := bot.subscribe("game_over")
			for g := 0; g < numGuesses; g++ {
				word := guessWords[(idx+g)%len(guessWords)]
				t0 := time.Now()
				bot.send("submit_guess", map[string]string{"guess": word})
				select {
				case raw := <-resultCh:
					rtt := time.Since(t0)
					latMu.Lock()
					lats = append(lats, rtt)
					latMu.Unlock()
					atomic.AddInt64(evtCount, 1)
					// Stop if this player won or ran out of attempts
					var gr struct {
						IsCorrect    bool `json:"is_correct"`
						AttemptsLeft int  `json:"attempts_left"`
					}
					json.Unmarshal(raw, &gr)
					if gr.IsCorrect || gr.AttemptsLeft == 0 {
						return
					}
				case <-gameOverCh:
					// Another player won — game is done
					atomic.AddInt64(evtCount, 1)
					return
				case <-time.After(timeout):
					log.Printf("[L%d] bot %d guess %d timeout", lobbyIdx, idx, g)
					return
				}
				time.Sleep(50 * time.Millisecond)
			}
		}(b, i)
	}
	wg.Wait()
	return lats
}

// ── Scenario runner ────────────────────────────────────────────────────────────

func runScenario(
	label, wsURL, httpBase string,
	numLobbies, playersPerLobby, numGuesses int,
	timeout time.Duration,
) ScenarioResult {
	before := fetchMetrics(httpBase)

	var (
		latMu sync.Mutex
		lats  []time.Duration
		evts  int64
		wg    sync.WaitGroup
	)

	start := time.Now()
	for li := 0; li < numLobbies; li++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			l := runLobby(wsURL, idx, playersPerLobby, numGuesses, timeout, &evts)
			latMu.Lock()
			lats = append(lats, l...)
			latMu.Unlock()
		}(li)
		time.Sleep(80 * time.Millisecond) // stagger to avoid thundering herd
	}
	wg.Wait()
	elapsed := time.Since(start).Seconds()

	after := fetchMetrics(httpBase)
	return ScenarioResult{
		Label:      label,
		NumLobbies: numLobbies,
		NumPlayers: numLobbies * playersPerLobby,
		Latencies:  lats,
		EventCount: evts,
		ElapsedSec: elapsed,
		Before:     before,
		After:      after,
	}
}

// ── Main ───────────────────────────────────────────────────────────────────────

func main() {
	flag.Parse()
	log.SetFlags(log.Ltime | log.Lmicroseconds)

	fmt.Printf("\n  ╔══════════════════════════════════════════╗\n")
	fmt.Printf("  ║   Wordle Duel — WebSocket Load Test      ║\n")
	fmt.Printf("  ╚══════════════════════════════════════════╝\n\n")
	fmt.Printf("  Backend  : %s\n", *flagBackend)
	fmt.Printf("  HTTP     : %s\n", *flagHTTP)
	fmt.Printf("  Guesses  : %d per player per game\n\n", *flagGuesses)

	// Verify server is reachable
	resp, err := http.Get(*flagHTTP + "/health")
	if err != nil || resp.StatusCode != 200 {
		fmt.Fprintf(os.Stderr, "\n  ✗ Backend not reachable at %s\n", *flagHTTP)
		fmt.Fprintf(os.Stderr, "    Start it first:  go run . (from Backend/)\n\n")
		os.Exit(1)
	}
	resp.Body.Close()
	fmt.Printf("  ✓ Backend is up\n\n")

	idle := fetchMetrics(*flagHTTP)
	if idle != nil {
		fmt.Printf("  Server idle: goroutines=%d  heap=%.1f MB\n\n", idle.Goroutines, idle.HeapAllocMB)
	}

	type scenario struct {
		label   string
		lobbies int
		players int // per lobby (min 2)
	}
	scenarios := []scenario{
		{"Baseline (1 lobby · 5 players)", 1, 5},
		{"Light    (2 lobbies · 5 players)", 2, 5},
		{"Medium   (5 lobbies · 5 players)", 5, 5},
		{"Stress   (10 lobbies · 5 players)", 10, 5},
	}

	results := make([]ScenarioResult, 0, len(scenarios))
	for _, sc := range scenarios {
		fmt.Printf("  ── %s\n", sc.label)
		r := runScenario(sc.label, *flagBackend, *flagHTTP,
			sc.lobbies, sc.players, *flagGuesses, *flagTimeout)
		results = append(results, r)

		st := calcStats(r.Latencies)
		fmt.Printf("     Players   : %d total (%d lobbies × %d)\n",
			r.NumPlayers, sc.lobbies, sc.players)
		fmt.Printf("     Samples   : %d RTT measurements\n", st.Count)
		fmt.Printf("     Latency   : avg=%.1f ms  p50=%.1f ms  p95=%.1f ms  p99=%.1f ms\n",
			st.Avg, st.P50, st.P95, st.P99)
		fmt.Printf("     Throughput: %.0f events/sec\n", r.EvtPerSec())
		if r.After != nil {
			fmt.Printf("     Server    : goroutines=%d  heap=%.1f MB\n",
				r.After.Goroutines, r.After.HeapAllocMB)
		}
		fmt.Println()
		time.Sleep(600 * time.Millisecond)
	}

	// Summary table
	fmt.Println("  ┌──────────────────────────────────────────────────────────────────┐")
	fmt.Println("  │                     RESULTS SUMMARY                              │")
	fmt.Println("  ├──────────────────────────────┬────────┬────────┬────────┬────────┤")
	fmt.Printf("  │ %-28s │ %6s │ %6s │ %6s │ %6s │\n",
		"Scenario", "Avg ms", "P95 ms", "P99 ms", "Evt/s")
	fmt.Println("  ├──────────────────────────────┼────────┼────────┼────────┼────────┤")
	for _, r := range results {
		st := calcStats(r.Latencies)
		label := r.Label
		if len(label) > 28 {
			label = label[:28]
		}
		fmt.Printf("  │ %-28s │ %6.1f │ %6.1f │ %6.1f │ %6.0f │\n",
			label, st.Avg, st.P95, st.P99, r.EvtPerSec())
	}
	fmt.Println("  └──────────────────────────────┴────────┴────────┴────────┴────────┘")

	// Generate HTML report with real data embedded
	if err := writeReport(*flagOutput, results, idle); err != nil {
		fmt.Fprintf(os.Stderr, "\n  ✗ Report error: %v\n", err)
	} else {
		fmt.Printf("\n  ✓ Report saved → %s\n", *flagOutput)
	}
}
