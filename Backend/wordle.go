package main

// ══════════════════════════════════════════════════════════════════════════════
// wordle.go — Server-Authoritative Game Logic
//
// All scoring and tile evaluation happens HERE. The frontend is only UI.
// ══════════════════════════════════════════════════════════════════════════════

const (
	WordLength   = 5
	MaxAttempts  = 5
	MaxPlayers   = 5

	// Scoring weights
	PointsCorrect = 2  // green tile: right letter, right position
	PointsPresent = 1  // yellow tile: right letter, wrong position
	PointsAbsent  = 0  // grey tile
	PointsWinBonus = 15 // bonus for guessing the word
)

// TileState represents the evaluation of a single letter tile.
type TileState string

const (
	TileCorrect TileState = "correct" // right letter, right position (green)
	TilePresent TileState = "present" // right letter, wrong position (yellow)
	TileAbsent  TileState = "absent"  // letter not in word at all (grey)
)

// EvalTile is one cell of an evaluated guess.
type EvalTile struct {
	Letter string
	State  TileState
}

// EvaluateGuess evaluates a 5-letter guess against the target word.
//
// Uses NYT Wordle rules for duplicate letters:
//   - Pass 1: mark exact matches (green)
//   - Pass 2: mark present letters (yellow), consuming unmatched target letters
//
// Example: word="ABBEY", guess="AABBY"
//   A→correct, A→absent (second A, but only one A left), B→correct, B→present, Y→absent
func EvaluateGuess(guess, word string) []EvalTile {
	g := []rune(guess)
	w := []rune(word)
	tiles := make([]EvalTile, WordLength)
	wordUsed := make([]bool, WordLength)
	guessUsed := make([]bool, WordLength)

	// Normalize to lowercase
	for i := range g {
		g[i] = toLower(g[i])
	}
	for i := range w {
		w[i] = toLower(w[i])
	}

	// Pass 1: correct positions (green)
	for i := 0; i < WordLength; i++ {
		tiles[i].Letter = string(g[i])
		if g[i] == w[i] {
			tiles[i].State = TileCorrect
			wordUsed[i] = true
			guessUsed[i] = true
		}
	}

	// Pass 2: present but wrong position (yellow)
	for i := 0; i < WordLength; i++ {
		if guessUsed[i] {
			continue
		}
		for j := 0; j < WordLength; j++ {
			if !wordUsed[j] && g[i] == w[j] {
				tiles[i].State = TilePresent
				wordUsed[j] = true
				break
			}
		}
		if tiles[i].State == "" {
			tiles[i].State = TileAbsent
		}
	}

	return tiles
}

func toLower(r rune) rune {
	if r >= 'A' && r <= 'Z' {
		return r + 32
	}
	return r
}

// ScoreRow calculates points earned for a single evaluated row.
func ScoreRow(tiles []EvalTile) int {
	score := 0
	for _, t := range tiles {
		switch t.State {
		case TileCorrect:
			score += PointsCorrect
		case TilePresent:
			score += PointsPresent
		}
	}
	return score
}

// IsCorrect returns true if all tiles are green (word guessed correctly).
func IsCorrect(tiles []EvalTile) bool {
	for _, t := range tiles {
		if t.State != TileCorrect {
			return false
		}
	}
	return true
}

// ToTileResults converts internal EvalTile slice to wire format.
func ToTileResults(tiles []EvalTile) []TileResult {
	results := make([]TileResult, len(tiles))
	for i, t := range tiles {
		results[i] = TileResult{
			Letter: t.Letter,
			State:  string(t.State),
		}
	}
	return results
}

// ToVisibleTiles strips absent tiles for broadcast to other players.
// Grey letters are hidden for competitive fairness.
func ToVisibleTiles(tiles []EvalTile) []VisibleTile {
	visible := make([]VisibleTile, len(tiles))
	for i, t := range tiles {
		if t.State == TileAbsent {
			visible[i] = VisibleTile{Letter: "", State: "empty"}
		} else {
			visible[i] = VisibleTile{Letter: t.Letter, State: string(t.State)}
		}
	}
	return visible
}
