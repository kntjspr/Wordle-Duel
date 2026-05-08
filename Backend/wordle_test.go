package main

import (
	"testing"
)

func TestEvaluateGuess_AllCorrect(t *testing.T) {
	tiles := EvaluateGuess("crane", "crane")
	for i, tile := range tiles {
		if tile.State != TileCorrect {
			t.Errorf("tile %d: got %s, want correct", i, tile.State)
		}
	}
}

func TestEvaluateGuess_AllAbsent(t *testing.T) {
	tiles := EvaluateGuess("zzzzz", "crane")
	for _, tile := range tiles {
		if tile.State != TileAbsent {
			t.Errorf("expected absent, got %s", tile.State)
		}
	}
}

func TestEvaluateGuess_MixedStates(t *testing.T) {
	// word=crane, guess=clack → c=correct(pos0), l=absent, a=correct(pos2), c=absent(already used), k=absent
	tiles := EvaluateGuess("clack", "crane")
	expected := []TileState{TileCorrect, TileAbsent, TileCorrect, TileAbsent, TileAbsent}
	for i, tile := range tiles {
		if tile.State != expected[i] {
			t.Errorf("tile %d: got %s, want %s", i, tile.State, expected[i])
		}
	}
}

func TestEvaluateGuess_Present(t *testing.T) {
	// word=crane, guess=nacre → n=present, a=present, c=present, r=present, e=correct
	tiles := EvaluateGuess("nacre", "crane")
	expected := []TileState{TilePresent, TilePresent, TilePresent, TilePresent, TileCorrect}
	for i, tile := range tiles {
		if tile.State != expected[i] {
			t.Errorf("tile %d: got %s, want %s", i, tile.State, expected[i])
		}
	}
}

func TestEvaluateGuess_DuplicateLetters(t *testing.T) {
	// word=abbey, guess=aabby: a-correct, a-absent, b-correct, b-present, y-absent
	tiles := EvaluateGuess("aabby", "abbey")
	if tiles[0].State != TileCorrect { t.Errorf("tile 0: want correct, got %s", tiles[0].State) }
	if tiles[1].State != TileAbsent  { t.Errorf("tile 1: want absent, got %s",  tiles[1].State) }
	if tiles[2].State != TileCorrect { t.Errorf("tile 2: want correct, got %s", tiles[2].State) }
	if tiles[3].State != TilePresent { t.Errorf("tile 3: want present, got %s", tiles[3].State) }
}

func TestScoreRow(t *testing.T) {
	tiles := EvaluateGuess("crane", "crane") // all correct
	score := ScoreRow(tiles)
	if score != 5*PointsCorrect {
		t.Errorf("all correct: want %d, got %d", 5*PointsCorrect, score)
	}
}

func TestScoreRow_Mixed(t *testing.T) {
	// crane vs crane: 5 correct = 10 pts
	tiles := []EvalTile{
		{State: TileCorrect}, // +2
		{State: TilePresent}, // +1
		{State: TileAbsent},  // +0
		{State: TileCorrect}, // +2
		{State: TilePresent}, // +1
	}
	score := ScoreRow(tiles)
	if score != 6 {
		t.Errorf("mixed: want 6, got %d", score)
	}
}

func TestIsCorrect(t *testing.T) {
	correctTiles := EvaluateGuess("crane", "crane")
	if !IsCorrect(correctTiles) {
		t.Error("expected IsCorrect=true for correct guess")
	}
	wrongTiles := EvaluateGuess("plane", "crane")
	if IsCorrect(wrongTiles) {
		t.Error("expected IsCorrect=false for wrong guess")
	}
}

func TestVisibleTiles_GreyHidden(t *testing.T) {
	// absent tiles should be hidden
	tiles := EvaluateGuess("zzzz"+"e", "crane") // z=absent, z, z, z, e=present
	visible := ToVisibleTiles(tiles)
	for i, v := range visible {
		if tiles[i].State == TileAbsent {
			if v.Letter != "" || v.State != "empty" {
				t.Errorf("tile %d: absent should be hidden, got letter=%q state=%s", i, v.Letter, v.State)
			}
		}
	}
}

func TestPlayerState_SubmitGuess(t *testing.T) {
	ps := &PlayerState{PlayerID: "p1", PlayerName: "Alice"}
	result := ps.SubmitGuess("crane", "crane")
	if result == nil {
		t.Fatal("expected non-nil result")
	}
	if !result.IsCorrect {
		t.Error("expected IsCorrect=true")
	}
	if ps.Score != 5*PointsCorrect+PointsWinBonus {
		t.Errorf("score: want %d, got %d", 5*PointsCorrect+PointsWinBonus, ps.Score)
	}
	if !ps.HasWon {
		t.Error("expected HasWon=true")
	}
}

func TestPlayerState_MaxAttempts(t *testing.T) {
	ps := &PlayerState{PlayerID: "p2", PlayerName: "Bob"}
	for i := 0; i < MaxAttempts; i++ {
		ps.SubmitGuess("zzzzz", "crane")
	}
	if !ps.IsEliminated {
		t.Error("expected IsEliminated=true after max attempts")
	}
	// Further guesses should return nil
	result := ps.SubmitGuess("crane", "crane")
	if result != nil {
		t.Error("expected nil result after elimination")
	}
}

func TestWordService(t *testing.T) {
	ws := NewWordService([]string{"crane", "slate", "audio", "train", "brave"})
	if !ws.IsValid("crane") {
		t.Error("crane should be valid")
	}
	if ws.IsValid("zzzzz") {
		t.Error("zzzzz should not be valid")
	}
	word := ws.Random()
	if len(word) != WordLength {
		t.Errorf("random word length: want %d, got %d", WordLength, len(word))
	}
}

func TestNameStore_TTL(t *testing.T) {
	ns := NewNameStore()
	ns.Set("p1", "Alice")
	name, ok := ns.Get("p1")
	if !ok || name != "Alice" {
		t.Errorf("expected Alice, got %q, ok=%v", name, ok)
	}
	ns.Delete("p1")
	_, ok = ns.Get("p1")
	if ok {
		t.Error("expected not found after delete")
	}
}
