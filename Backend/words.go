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
//
// Dataset references used by embedded wordlists:
// - possible_answers.txt: https://gist.github.com/cfreshman/a03ef2cba789d8cf00c08f767e0fad7b
// - allowed_guess.txt: https://gist.github.com/cfreshman/cdcdf777450c5b5301e439061d29694c
// ══════════════════════════════════════════════════════════════════════════════

//go:embed allowed_guess.txt
var allowedGuessRaw string

//go:embed possible_answers.txt
var possibleAnswersRaw string

// AllowedGuessList is the server's authoritative 5-letter guess-validation list.
// Loaded from local file: Backend/allowed_guess.txt (embedded at build time).
var AllowedGuessList = mustLoadEmbeddedWordList(allowedGuessRaw, "allowed guesses")

// PossibleAnswerList is the server's answer pool for random word selection.
// Loaded from local file: Backend/possible_answers.txt (embedded at build time).
var PossibleAnswerList = mustLoadEmbeddedWordList(possibleAnswersRaw, "possible answers")

func mustLoadEmbeddedWordList(raw string, label string) []string {
	words, err := loadWordListFromText(raw)
	if err != nil {
		panic(fmt.Sprintf("failed to load embedded %s list: %v", label, err))
	}
	if len(words) == 0 {
		panic(fmt.Sprintf("embedded %s list is empty", label))
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
	answers []string
}

// NewWordService builds the word service from a guess-validation list and
// a possible-answer list.
func NewWordService(words []string, answers []string) *WordService {
	ws := &WordService{
		words:   make([]string, 0, len(words)),
		wordSet: make(map[string]struct{}, len(words)),
		answers: make([]string, 0, len(answers)),
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

	seenAnswers := make(map[string]struct{}, len(answers))
	for _, w := range answers {
		w = strings.ToLower(strings.TrimSpace(w))
		if len([]rune(w)) != WordLength {
			continue
		}
		if _, exists := seenAnswers[w]; exists {
			continue
		}
		seenAnswers[w] = struct{}{}
		ws.answers = append(ws.answers, w)

		// Ensure every possible answer is a valid guess even if it is missing
		// from the allowed-guess list.
		if _, exists := ws.wordSet[w]; !exists {
			ws.words = append(ws.words, w)
			ws.wordSet[w] = struct{}{}
		}
	}

	if len(ws.answers) == 0 {
		ws.answers = append(ws.answers, ws.words...)
	}
	return ws
}

// Random returns a random 5-letter word. Thread-safe.
func (ws *WordService) Random() string {
	ws.mu.RLock()
	defer ws.mu.RUnlock()
	if len(ws.answers) == 0 {
		return "crane" // fallback
	}
	return ws.answers[rand.Intn(len(ws.answers))]
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
