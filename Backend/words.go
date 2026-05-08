package main

import (
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

// ─── Word list ────────────────────────────────────────────────────────────────

// WordList is the server's authoritative 5-letter word list.
// This is the designated swap point for connecting to an external word API.
//
// TODO: Replace with API call when backend word service is ready:
//
//	func loadWordsFromAPI(url string) ([]string, error) {
//	    resp, err := http.Get(url)
//	    ...
//	    json.Decode(&words)
//	    return words, nil
//	}
var WordList = []string{
	"about", "above", "abuse", "actor", "acute", "admit", "adopt", "adult", "after", "again",
	"agent", "agree", "ahead", "alarm", "album", "alert", "alike", "align", "alive", "alley",
	"allow", "alone", "along", "alter", "angel", "anger", "angle", "angry", "ankle", "apple",
	"apply", "arena", "argue", "arise", "armor", "arrow", "aside", "asset", "audio", "audit",
	"avoid", "awake", "aware", "awful", "azure", "badge", "badly", "baker", "basic", "basil",
	"basis", "batch", "beach", "began", "begin", "being", "below", "bench", "berry", "birth",
	"black", "blade", "bland", "blast", "blaze", "bleak", "blend", "bless", "blind", "block",
	"blood", "blown", "board", "boost", "bound", "brain", "brand", "brave", "break", "brick",
	"brief", "bring", "broad", "broke", "brown", "build", "burst", "buyer", "candy", "cargo",
	"carry", "cause", "cease", "chain", "chair", "chaos", "charm", "chase", "cheap", "check",
	"cheek", "chess", "chest", "chief", "child", "chill", "civic", "civil", "claim", "class",
	"clean", "clear", "clerk", "click", "cliff", "climb", "cling", "clock", "close", "cloud",
	"coach", "coast", "color", "comic", "cover", "craft", "crane", "crash", "crazy", "cream",
	"creek", "crime", "crisp", "cross", "crowd", "crown", "crush", "curve", "cycle", "daily",
	"dairy", "dance", "datum", "debut", "decay", "delta", "dense", "depth", "devil", "digit",
	"dirty", "disco", "doubt", "dough", "draft", "drain", "drama", "drank", "drawn", "dream",
	"dress", "drift", "drink", "drive", "drove", "drown", "dwarf", "eagle", "early", "earth",
	"eight", "elite", "empty", "enemy", "enjoy", "enter", "equal", "error", "essay", "event",
	"every", "exact", "exist", "extra", "fable", "faith", "false", "fancy", "fatal", "fault",
	"feast", "fence", "fever", "field", "fifth", "fifty", "fight", "final", "first", "fixed",
	"flame", "flare", "flash", "fleet", "flesh", "float", "flood", "floor", "flour", "focus",
	"force", "forge", "forth", "forum", "found", "frame", "frank", "fresh", "front", "frost",
	"froze", "fruit", "fully", "funny", "giant", "given", "glass", "globe", "gloom", "going",
	"grace", "grade", "grain", "grand", "grant", "grape", "grasp", "grass", "grave", "great",
	"greed", "green", "greet", "grief", "grill", "grind", "groan", "group", "grove", "grown",
	"guard", "guest", "guide", "guild", "guilt", "habit", "happy", "harsh", "heart", "heavy",
	"hedge", "hobby", "honor", "horse", "hotel", "house", "human", "humid", "hurry", "ideal",
	"image", "imply", "inner", "input", "issue", "jewel", "joint", "judge", "juice", "juicy",
	"knife", "knock", "known", "label", "lance", "large", "laser", "later", "laugh", "layer",
	"learn", "lease", "least", "leave", "legal", "lemon", "level", "light", "limit", "local",
	"lodge", "logic", "loose", "lower", "lucky", "lunar", "lunch", "lyric", "magic", "major",
	"maker", "manor", "maple", "march", "match", "mayor", "media", "merge", "mercy", "merit",
	"metal", "might", "minor", "minus", "model", "money", "month", "moral", "motor", "mount",
	"mouse", "mouth", "music", "naval", "nerve", "never", "night", "noble", "noise", "north",
	"novel", "nurse", "oasis", "ocean", "offer", "often", "onion", "opera", "order", "other",
	"owner", "ozone", "paint", "panic", "paper", "party", "pause", "peace", "pearl", "penny",
	"phase", "phone", "photo", "piano", "pilot", "pitch", "pixel", "pizza", "place", "plain",
	"plane", "plant", "plate", "plaza", "pluck", "point", "polar", "power", "press", "price",
	"pride", "prime", "print", "prior", "prize", "probe", "proof", "prose", "proud", "prove",
	"proxy", "pulse", "punch", "pupil", "purse", "query", "quest", "quick", "quiet", "quota",
	"quote", "radar", "radio", "raise", "rally", "ranch", "range", "rapid", "ratio", "reach",
	"ready", "realm", "rebel", "refer", "reign", "relax", "remix", "repay", "reset", "rider",
	"rifle", "right", "risky", "rival", "river", "robot", "rocky", "round", "route", "royal",
	"ruins", "ruler", "rural", "rusty", "saint", "salad", "sauce", "scale", "scene", "scent",
	"scope", "score", "scout", "serve", "setup", "seven", "shade", "shake", "shall", "shame",
	"shape", "share", "shark", "sharp", "shelf", "shell", "shift", "shine", "shirt", "shock",
	"shook", "shore", "short", "shout", "sigma", "silly", "since", "skill", "slate", "sleep",
	"slice", "slide", "slope", "smart", "smell", "smile", "smoke", "snake", "solar", "solid",
	"solve", "sonic", "sorry", "sound", "south", "space", "speak", "speed", "spell", "spend",
	"spice", "spine", "spite", "split", "sport", "spray", "squad", "stack", "staff", "stage",
	"stain", "stake", "stale", "stamp", "stand", "stare", "stark", "start", "state", "steam",
	"steep", "steer", "stern", "stick", "stiff", "still", "stock", "stone", "stood", "store",
	"storm", "story", "stove", "strap", "straw", "stray", "study", "style", "sugar", "suite",
	"sunny", "super", "surge", "swamp", "swear", "sweep", "sweet", "swept", "swift", "swing",
	"sword", "swore", "sworn", "syrup", "table", "taste", "tense", "terms", "theme", "there",
	"thick", "thing", "think", "third", "thorn", "those", "three", "threw", "tiger", "tight",
	"timer", "tired", "title", "today", "token", "touch", "tough", "tower", "toxic", "trace",
	"track", "trade", "trail", "train", "trait", "tread", "treat", "trend", "trial", "tribe",
	"trick", "troop", "trove", "truck", "truly", "trunk", "trust", "truth", "twice", "twist",
	"ultra", "under", "unify", "union", "unite", "unity", "until", "upper", "upset", "urban",
	"usual", "utter", "valid", "value", "valve", "vapor", "vault", "verse", "video", "viral",
	"virus", "visit", "vista", "vital", "vivid", "vocal", "voice", "voter", "wager", "waste",
	"watch", "water", "weary", "weave", "wedge", "weird", "wheat", "where", "which", "while",
	"white", "whole", "whose", "wider", "witch", "woman", "women", "world", "worry", "worse",
	"worst", "worth", "would", "wrath", "write", "wrong", "yacht", "yield", "young", "youth",
	"zebra", "abbey", "adorn", "aglow", "amaze", "amble", "ample", "annoy", "ardor", "ascot",
	"ashen", "askew", "attic", "axiom", "baize", "baton", "bayou", "blurt", "bogus", "booze",
	"botch", "boxer", "brash", "brine", "brisk", "brunt", "burly", "cacao", "cadet", "canny",
	"caper", "cedar", "champ", "chant", "cheer", "chirp", "chore", "chump", "cinch", "clamp",
	"clang", "clash", "clasp", "cleft", "cloak", "clout", "cluck", "comet", "corny", "couch",
	"crave", "creak", "creed", "crept", "crimp", "croak", "crook", "crumb", "crust", "crypt",
	"curly", "daunt", "dowdy", "drape", "drawl", "dread", "drool", "droop", "duchy", "dusky",
	"dusty", "dwelt", "eerie", "eject", "elbow", "ethos", "evoke", "exert", "expel", "extol",
	"exult", "facet", "faint", "feral", "fiend", "fiery", "finch", "fishy", "flair", "flank",
	"flaunt","flout", "fluff", "flunk", "flute", "foamy", "folly", "foray", "frail", "frond",
	"froth", "fudge", "fungi", "funky", "gaudy", "gauze", "gavel", "gawky", "ghoul", "gleam",
	"glean", "gloat", "gnash", "gnome", "golly", "gourd", "graft", "gruff", "guile", "gummy",
	"gusty", "growl", "gripe", "grime", "gruel", "infer", "intro", "ivory", "joker", "jolly",
	"jumbo", "kayak", "kiosk", "knack", "kneel", "koala", "libel", "liner", "liver", "lobby",
	"lofty", "loner", "lusty", "manor", "mirth", "moody", "motto", "mover", "muddy", "murky",
	"musty", "nadir", "nifty", "nomad", "notch", "nymph", "obese", "oddly", "onset", "optic",
	"orbit", "ovary", "oxide", "pagan", "penal", "petal", "petty", "plaid", "plumb", "plume",
	"plunk", "poker", "poppy", "potty", "pouty", "prowl", "prune", "psalm", "pudgy", "puffy",
	"quirk", "rabbi", "rabid", "radix", "rainy", "raven", "rawer", "rayon", "razed", "reach",
	"rebut", "recap", "recut", "regal", "repel", "rerun", "reuse", "rivet", "robin", "rodeo",
	"rogue", "roomy", "rouge", "rowdy", "rugby", "rumor", "rupee", "saber", "sadly", "salvo",
	"sandy", "sassy", "savvy", "scald", "scalp", "scaly", "scamp", "scant", "scary", "scoff",
	"scold", "scone", "scoop", "scowl", "seize", "servo", "shady", "shale", "shawl", "sheen",
	"shrub", "shuck", "shunt", "silky", "skimp", "siren", "sixth", "sixty", "skate", "skied",
	"skimp", "skulk", "skunk", "slack", "slain", "slang", "slant", "slash", "sleek", "sleet",
	"slept", "slick", "slime", "slimy", "sling", "slink", "slunk", "slurp", "smack", "smear",
	"smelt", "smite", "smock", "smudge","smug",  "snack", "snail", "snaky", "snare", "snarl",
	"sneak", "sneer", "snide", "sniff", "snore", "snort", "snout", "snowy", "snuck", "snuff",
	"soggy", "spank", "spawn", "speck", "spelt", "spied", "spill", "spire", "spite", "spoof",
	"spook", "spool", "spoon", "spout", "spunk", "spurn", "squab", "squat", "squid", "staid",
	"stalk", "stall", "stave", "stead", "steed", "stomp", "stout", "strut", "stuck", "stump",
	"stung", "stunk", "stunt", "surge", "surly", "swath", "swill", "swine", "swipe", "swirl",
	"swoon", "synod", "taboo", "talon", "taunt", "tawny", "taunt", "tepid", "terse", "thane",
	"thatch","theft", "their", "tidal", "tilde", "tiled", "tonal", "topaz", "torso", "touchy",
	"toxin", "tramp", "trawl", "tremble","tromp","trout", "truce", "tulip", "tunic", "twerp",
	"twill", "tying", "udder", "ulcer", "uncut", "undue", "unfed", "unfit", "unlit", "unmet",
	"unwed", "unzip", "upend", "usurp", "vague", "vaunt", "venom", "vigil", "villa", "viper",
	"visor", "vomit", "vouch", "vulva", "waltz", "warty", "weedy", "whack", "whiff", "whine",
	"whiny", "whirl", "whoop", "wince", "windy", "wispy", "witty", "wooly", "wordy", "wrack",
	"wreak", "wreck", "wrung", "yearn", "zappy", "zippy", "zonal",
}
