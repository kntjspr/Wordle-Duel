package main

import (
	"bufio"
	_ "embed"
	"fmt"
	"math/rand"
	"strings"
	"sync"
)

// ══════════════════════════════════════════════════════════════════════════════
// words.go — Server-Side Word Authority
//
// The server is the ONLY source of valid words. Clients never see the answer
// until game_over. Word validation happens here, not on the client.
// ══════════════════════════════════════════════════════════════════════════════

//go:embed allowed_guess.txt
var allowedGuessRaw string

// WordList is the server's authoritative 5-letter allowed-guesses list.
// Loaded from local file: Backend/allowed_guess.txt (embedded at build time).
var WordList = mustLoadEmbeddedWordList()

func mustLoadEmbeddedWordList() []string {
	words, err := loadWordListFromText(allowedGuessRaw)
	if err != nil {
		panic(fmt.Sprintf("failed to load embedded word list: %v", err))
	}
	if len(words) == 0 {
		panic("embedded word list is empty")
	}
	return words
}

func loadWordListFromText(raw string) ([]string, error) {
	scanner := bufio.NewScanner(strings.NewReader(raw))
	words := make([]string, 0, 11000)
	seen := make(map[string]struct{}, 11000)

	for scanner.Scan() {
		w := strings.ToLower(strings.TrimSpace(scanner.Text()))
		if len([]rune(w)) != WordLength {
			continue
		}
		if _, exists := seen[w]; exists {
			continue
		}
		seen[w] = struct{}{}
		words = append(words, w)
	}

	if err := scanner.Err(); err != nil {
		return nil, err
	}

	return words, nil
}

// WordService holds the word list and provides thread-safe access.
type WordService struct {
	mu      sync.RWMutex
	words   []string
	wordSet map[string]struct{} // O(1) lookup
}

// NewWordService builds the word service from a list of words.
func NewWordService(words []string) *WordService {
	ws := &WordService{
		words:   make([]string, 0, len(words)),
		wordSet: make(map[string]struct{}, len(words)),
	}
	for _, w := range words {
		w = strings.ToLower(strings.TrimSpace(w))
		if len([]rune(w)) == WordLength {
			if _, exists := ws.wordSet[w]; exists {
				continue
			}
			ws.words = append(ws.words, w)
			ws.wordSet[w] = struct{}{}
		}
	}
	return ws
}

// Random returns a random 5-letter word. Thread-safe.
func (ws *WordService) Random() string {
	ws.mu.RLock()
	defer ws.mu.RUnlock()
	if len(ws.words) == 0 {
		return "crane" // fallback
	}
	return ws.words[rand.Intn(len(ws.words))]
}

// IsValid returns true if the word is in the valid word list. Thread-safe.
func (ws *WordService) IsValid(word string) bool {
	ws.mu.RLock()
	defer ws.mu.RUnlock()
	_, ok := ws.wordSet[strings.ToLower(word)]
	return ok
}

// All returns a copy of the word list (for the /api/words/list endpoint).
func (ws *WordService) All() []string {
	ws.mu.RLock()
	defer ws.mu.RUnlock()
	out := make([]string, len(ws.words))
	copy(out, ws.words)
	return out
}
