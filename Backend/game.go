package main

import (
	"sort"
	"sync"
	"time"
)

// ══════════════════════════════════════════════════════════════════════════════
// game.go — Server-Authoritative Game State
//
// GameState owns all game data. The server is the single source of truth.
// Frontend only renders what the server sends it.
// ══════════════════════════════════════════════════════════════════════════════

// PlayerState tracks one player's progress during a game.
// This lives entirely on the server — the client never sends score.
type PlayerState struct {
	mu           sync.Mutex
	PlayerID     string
	PlayerName   string
	Guesses      [][]EvalTile // submitted guess rows
	Score        int
	HasWon       bool
	IsEliminated bool // used all attempts without winning
	FinishedAt   time.Time
}

// AttemptsUsed returns how many guesses this player has submitted.
func (ps *PlayerState) AttemptsUsed() int {
	ps.mu.Lock()
	defer ps.mu.Unlock()
	return len(ps.Guesses)
}

// IsDone returns true if the player cannot make more guesses.
func (ps *PlayerState) IsDone() bool {
	ps.mu.Lock()
	defer ps.mu.Unlock()
	return ps.HasWon || ps.IsEliminated || len(ps.Guesses) >= MaxAttempts
}

// SubmitGuess evaluates a guess, updates state, and returns the result.
// Returns nil if the player is already done or has no attempts left.
func (ps *PlayerState) SubmitGuess(guess, word string) *GuessResultPayload {
	ps.mu.Lock()
	defer ps.mu.Unlock()

	if ps.HasWon || ps.IsEliminated || len(ps.Guesses) >= MaxAttempts {
		return nil
	}

	tiles := EvaluateGuess(guess, word)
	rowScore := ScoreRow(tiles)
	ps.Guesses = append(ps.Guesses, tiles)
	ps.Score += rowScore

	won := IsCorrect(tiles)
	attemptsLeft := MaxAttempts - len(ps.Guesses)

	if won {
		ps.HasWon = true
		ps.Score += PointsWinBonus
		ps.FinishedAt = time.Now()
	} else if len(ps.Guesses) >= MaxAttempts {
		ps.IsEliminated = true
		ps.FinishedAt = time.Now()
	}

	return &GuessResultPayload{
		PlayerID:     ps.PlayerID,
		GuessIndex:   len(ps.Guesses) - 1,
		Tiles:        ToTileResults(tiles),
		RowScore:     rowScore,
		TotalScore:   ps.Score,
		IsCorrect:    won,
		AttemptsLeft: attemptsLeft,
	}
}

// ─── GameState ────────────────────────────────────────────────────────────────

type GameStatus string

const (
	GameWaiting  GameStatus = "waiting"
	GamePlaying  GameStatus = "playing"
	GameFinished GameStatus = "finished"
)

// GameState is the authoritative state of one game session.
// Protected by a single RWMutex for safe concurrent reads.
type GameState struct {
	mu      sync.RWMutex
	Word    string
	Players map[string]*PlayerState // playerID → state
	Status  GameStatus
	StartedAt time.Time
	FinishedAt time.Time
}

// NewGameState creates a game for the given players.
func NewGameState(word string, players []LobbyPlayerInfo) *GameState {
	gs := &GameState{
		Word:    word,
		Players: make(map[string]*PlayerState, len(players)),
		Status:  GamePlaying,
		StartedAt: time.Now(),
	}
	for _, p := range players {
		gs.Players[p.ID] = &PlayerState{
			PlayerID:   p.ID,
			PlayerName: p.Name,
		}
	}
	return gs
}

// ProcessGuess handles a guess submission for one player.
// Returns (guessResult, playerUpdatePayload, isGameOver).
func (gs *GameState) ProcessGuess(playerID, guess string) (
	result *GuessResultPayload,
	update *PlayerUpdatePayload,
	gameOver bool,
) {
	gs.mu.RLock()
	ps, ok := gs.Players[playerID]
	word := gs.Word
	gs.mu.RUnlock()

	if !ok {
		return nil, nil, false
	}

	result = ps.SubmitGuess(guess, word)
	if result == nil {
		return nil, nil, false
	}

	// Build the visible update (no grey tiles) for broadcast
	guessIdx := result.GuessIndex
	ps.mu.Lock()
	lastTiles := ps.Guesses[guessIdx]
	hasWon := ps.HasWon
	isElim := ps.IsEliminated
	score := ps.Score
	name := ps.PlayerName
	ps.mu.Unlock()

	update = &PlayerUpdatePayload{
		PlayerID:     playerID,
		PlayerName:   name,
		GuessIndex:   guessIdx,
		VisibleTiles: ToVisibleTiles(lastTiles),
		RowScore:     result.RowScore,
		TotalScore:   score,
		HasWon:       hasWon,
		IsEliminated: isElim,
	}

	gameOver = gs.checkGameOver()
	return result, update, gameOver
}

// checkGameOver returns true if all players are done.
func (gs *GameState) checkGameOver() bool {
	gs.mu.RLock()
	defer gs.mu.RUnlock()
	for _, ps := range gs.Players {
		if !ps.IsDone() {
			return false
		}
	}
	return true
}

// BuildGameOverPayload assembles the final results packet.
func (gs *GameState) BuildGameOverPayload() *GameOverPayload {
	gs.mu.Lock()
	gs.Status = GameFinished
	gs.FinishedAt = time.Now()
	gs.mu.Unlock()

	gs.mu.RLock()
	defer gs.mu.RUnlock()

	// Build leaderboard
	entries := make([]LeaderboardEntry, 0, len(gs.Players))
	for _, ps := range gs.Players {
		ps.mu.Lock()
		entries = append(entries, LeaderboardEntry{
			PlayerID:   ps.PlayerID,
			PlayerName: ps.PlayerName,
			Score:      ps.Score,
			HasWon:     ps.HasWon,
			Guesses:    len(ps.Guesses),
		})
		ps.mu.Unlock()
	}

	// Sort: winners first (by finish time), then by score desc
	sort.Slice(entries, func(i, j int) bool {
		pi := gs.Players[entries[i].PlayerID]
		pj := gs.Players[entries[j].PlayerID]
		pi.mu.Lock()
		pj.mu.Lock()
		wi, wj := pi.HasWon, pj.HasWon
		fi, fj := pi.FinishedAt, pj.FinishedAt
		si, sj := pi.Score, pj.Score
		pi.mu.Unlock()
		pj.mu.Unlock()

		if wi != wj {
			return wi // winners first
		}
		if wi && wj {
			return fi.Before(fj) // earlier winner wins
		}
		return si > sj // higher score wins
	})

	// Determine overall winner
	var winnerID, winnerName string
	wonByGuess := false

	// First: anyone who guessed correctly (sorted by finish time above)
	for _, e := range entries {
		ps := gs.Players[e.PlayerID]
		ps.mu.Lock()
		won := ps.HasWon
		ps.mu.Unlock()
		if won {
			winnerID = e.PlayerID
			winnerName = e.PlayerName
			wonByGuess = true
			break
		}
	}

	// If no one guessed: highest score wins (check for draw)
	if winnerID == "" && len(entries) > 0 {
		top := entries[0]
		// Check for tie
		isTie := len(entries) > 1 && entries[1].Score == top.Score
		if !isTie {
			winnerID = top.PlayerID
			winnerName = top.PlayerName
		}
	}

	return &GameOverPayload{
		WinnerID:    winnerID,
		WinnerName:  winnerName,
		WonByGuess:  wonByGuess,
		Word:        gs.Word,
		Leaderboard: entries,
	}
}
