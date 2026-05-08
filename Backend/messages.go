package main

// ══════════════════════════════════════════════════════════════════════════════
// messages.go — WebSocket Protocol Definitions
//
// All client↔server communication is JSON over WebSocket.
// Format: { "type": "<MsgType>", "payload": { ... } }
// ══════════════════════════════════════════════════════════════════════════════

// ─── Inbound (Client → Server) ────────────────────────────────────────────────

type MsgType string

const (
	// Lobby flow
	MsgSetName     MsgType = "set_name"     // { name: string }
	MsgCreateLobby MsgType = "create_lobby" // {}
	MsgListLobbies MsgType = "list_lobbies" // {}
	MsgJoinLobby   MsgType = "join_lobby"   // { lobby_id: string }
	MsgLeaveLobby  MsgType = "leave_lobby"  // {}
	MsgStartGame   MsgType = "start_game"   // {} — host only

	// Gameplay
	MsgSubmitGuess MsgType = "submit_guess" // { guess: string }
	MsgPing        MsgType = "ping"         // {}
)

// ─── Outbound (Server → Client) ──────────────────────────────────────────────

const (
	// Connection
	MsgConnected   MsgType = "connected"    // { player_id: string }
	MsgNameSet     MsgType = "name_set"     // { name: string }
	MsgPong        MsgType = "pong"         // {}
	MsgError       MsgType = "error"        // { message: string }

	// Lobby
	MsgLobbyCreated MsgType = "lobby_created" // LobbyState
	MsgLobbyList    MsgType = "lobby_list"    // { lobbies: []LobbyInfo }
	MsgLobbyJoined  MsgType = "lobby_joined"  // LobbyState
	MsgLobbyUpdate  MsgType = "lobby_update"  // LobbyState
	MsgLobbyLeft    MsgType = "lobby_left"    // {}

	// Game
	MsgGameStarting MsgType = "game_starting"  // { countdown: int }
	MsgGameBegin    MsgType = "game_begin"     // GameBeginPayload
	MsgGuessResult  MsgType = "guess_result"   // GuessResultPayload (only to guesser)
	MsgPlayerUpdate MsgType = "player_update"  // PlayerUpdatePayload (broadcast, grey hidden)
	MsgGameOver     MsgType = "game_over"      // GameOverPayload
)

// ─── Wire envelope ────────────────────────────────────────────────────────────

// Envelope is the top-level JSON wrapper for all messages.
type Envelope struct {
	Type    MsgType `json:"type"`
	Payload any     `json:"payload,omitempty"`
}

// ─── Payload structs ──────────────────────────────────────────────────────────

// --- Inbound payloads ---

type SetNamePayload struct {
	Name string `json:"name"`
}

type JoinLobbyPayload struct {
	LobbyID string `json:"lobby_id"`
}

type SubmitGuessPayload struct {
	Guess string `json:"guess"`
}

// --- Outbound payloads ---

type ConnectedPayload struct {
	PlayerID string `json:"player_id"`
}

type NameSetPayload struct {
	Name string `json:"name"`
}

type ErrorPayload struct {
	Message string `json:"message"`
}

// LobbyPlayerInfo is a public view of a player in the lobby.
type LobbyPlayerInfo struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	IsHost bool   `json:"is_host"`
}

// LobbyState is the full lobby snapshot sent on create/join/update.
type LobbyState struct {
	ID         string            `json:"id"`
	Code       string            `json:"code"`
	HostID     string            `json:"host_id"`
	HostName   string            `json:"host_name"`
	Players    []LobbyPlayerInfo `json:"players"`
	MaxPlayers int               `json:"max_players"`
	Status     string            `json:"status"` // "waiting" | "playing" | "finished"
}

// LobbyListInfo is a compact row shown in the lobby browser.
type LobbyListInfo struct {
	ID          string `json:"id"`
	Code        string `json:"code"`
	HostName    string `json:"host_name"`
	PlayerCount int    `json:"player_count"`
	MaxPlayers  int    `json:"max_players"`
}

type LobbyListPayload struct {
	Lobbies []LobbyListInfo `json:"lobbies"`
}

// GameBeginPayload is sent to every player when the game starts.
type GameBeginPayload struct {
	LobbyID string   `json:"lobby_id"`
	Players []string `json:"player_names"` // ordered list for UI
}

// TileResult describes a single tile after evaluation.
type TileResult struct {
	Letter string `json:"letter"`
	State  string `json:"state"` // "correct" | "present" | "absent"
}

// GuessResultPayload is sent ONLY to the guesser — contains full tile states.
type GuessResultPayload struct {
	PlayerID   string       `json:"player_id"`
	GuessIndex int          `json:"guess_index"` // 0-4
	Tiles      []TileResult `json:"tiles"`
	RowScore   int          `json:"row_score"`
	TotalScore int          `json:"total_score"`
	IsCorrect  bool         `json:"is_correct"`
	AttemptsLeft int        `json:"attempts_left"`
}

// VisibleTile is what other players see: grey tiles are hidden.
type VisibleTile struct {
	Letter string `json:"letter"` // empty string for absent tiles
	State  string `json:"state"`  // "correct" | "present" | "empty"
}

// PlayerUpdatePayload is broadcast to ALL players when someone submits a guess.
// Grey tiles are stripped for competitive fairness.
type PlayerUpdatePayload struct {
	PlayerID     string        `json:"player_id"`
	PlayerName   string        `json:"player_name"`
	GuessIndex   int           `json:"guess_index"`
	VisibleTiles []VisibleTile `json:"visible_tiles"` // grey → empty
	RowScore     int           `json:"row_score"`
	TotalScore   int           `json:"total_score"`
	HasWon       bool          `json:"has_won"`
	IsEliminated bool          `json:"is_eliminated"`
}

// GameOverPayload is the final results packet sent to all players.
type GameOverPayload struct {
	WinnerID    string              `json:"winner_id"`    // empty = draw
	WinnerName  string              `json:"winner_name"`  // empty = draw
	WonByGuess  bool                `json:"won_by_guess"` // false = score-based
	Word        string              `json:"word"`
	Leaderboard []LeaderboardEntry  `json:"leaderboard"`
}

type LeaderboardEntry struct {
	PlayerID   string `json:"player_id"`
	PlayerName string `json:"player_name"`
	Score      int    `json:"score"`
	HasWon     bool   `json:"has_won"`
	Guesses    int    `json:"guesses"`
}
