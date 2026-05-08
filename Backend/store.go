package main

import (
	"log"
	"sync"
	"time"
)

// ══════════════════════════════════════════════════════════════════════════════
// store.go — Player Name Storage with 24-Hour TTL
//
// Stores player name registrations. A background goroutine purges entries
// older than 24 hours, fulfilling the "name deleted after 1 day" requirement.
//
// CONCURRENCY: Protected by sync.RWMutex.
// The cleanup goroutine runs independently and uses a write lock for purging.
// ══════════════════════════════════════════════════════════════════════════════

const (
	NameTTL          = 24 * time.Hour
	CleanupInterval  = 1 * time.Hour
)

// NameEntry is one registered player name with its expiry time.
type NameEntry struct {
	PlayerID  string
	Name      string
	CreatedAt time.Time
	ExpiresAt time.Time
}

// NameStore is a thread-safe in-memory store for player names.
type NameStore struct {
	mu      sync.RWMutex
	entries map[string]*NameEntry // playerID → entry
	done    chan struct{}
}

func NewNameStore() *NameStore {
	return &NameStore{
		entries: make(map[string]*NameEntry),
		done:    make(chan struct{}),
	}
}

// Set registers or refreshes a player name.
func (ns *NameStore) Set(playerID, name string) {
	now := time.Now()
	ns.mu.Lock()
	ns.entries[playerID] = &NameEntry{
		PlayerID:  playerID,
		Name:      name,
		CreatedAt: now,
		ExpiresAt: now.Add(NameTTL),
	}
	ns.mu.Unlock()
}

// Get retrieves a name by playerID. Returns ("", false) if not found or expired.
func (ns *NameStore) Get(playerID string) (string, bool) {
	ns.mu.RLock()
	entry, ok := ns.entries[playerID]
	ns.mu.RUnlock()

	if !ok || time.Now().After(entry.ExpiresAt) {
		return "", false
	}
	return entry.Name, true
}

// Delete removes a name entry (called on disconnect).
func (ns *NameStore) Delete(playerID string) {
	ns.mu.Lock()
	delete(ns.entries, playerID)
	ns.mu.Unlock()
}

// Count returns the total number of active name registrations.
func (ns *NameStore) Count() int {
	ns.mu.RLock()
	defer ns.mu.RUnlock()
	return len(ns.entries)
}

// StartCleanup starts the background TTL purge goroutine.
// ← CONCURRENCY DEMO: Dedicated background goroutine for maintenance tasks
func (ns *NameStore) StartCleanup() {
	go func() {
		ticker := time.NewTicker(CleanupInterval)
		defer ticker.Stop()
		log.Println("[NameStore] cleanup goroutine started")

		for {
			select {
			case <-ticker.C:
				ns.purgeExpired()
			case <-ns.done:
				log.Println("[NameStore] cleanup goroutine stopped")
				return
			}
		}
	}()
}

// Stop signals the cleanup goroutine to exit.
func (ns *NameStore) Stop() {
	close(ns.done)
}

// purgeExpired removes all entries past their expiry time.
func (ns *NameStore) purgeExpired() {
	now := time.Now()
	ns.mu.Lock()
	expired := 0
	for id, entry := range ns.entries {
		if now.After(entry.ExpiresAt) {
			delete(ns.entries, id)
			expired++
		}
	}
	ns.mu.Unlock()
	if expired > 0 {
		log.Printf("[NameStore] purged %d expired name entries", expired)
	}
}
