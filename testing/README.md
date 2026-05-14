# Wordle Duel — Performance Testing

Contains the standalone performance visualisation report for the Wordle Duel Go backend.

## Files

| File | Purpose |
|------|---------|
| `performance-report.html` | Single-column brochure-ready chart report (open in any browser) |

## How to run the test

```bash
# Run against the local backend (default)
.\run_perf.ps1 -StartBackend

# Run against the live production deployment
.\run_perf.ps1 -Prod
```

## How to open the report

```bash
# Windows — double-click or:
start performance-report.html

# macOS / Linux
open performance-report.html
```

## How to print / export to PDF for brochure

1. Open `performance-report.html` in Chrome or Edge.
2. Press **Ctrl + P** (or Cmd + P on Mac).
3. Set:
   - **Destination** → Save as PDF  
   - **Paper size** → A4 or Letter  
   - **Margins** → Minimum  
   - **Background graphics** → ✅ Enabled (essential for the dark theme)
4. Click **Save**.

The layout is pre-optimised for a single-column portrait brochure — each chart breaks cleanly across pages.

## Metrics covered

| # | Metric | Chart type |
|---|--------|-----------|
| 1 | WebSocket round-trip latency (Avg / P95 / P99) | Grouped bar |
| 2 | Server throughput — events/sec | Horizontal bar |
| 3 | Memory usage — server heap + system RAM | Dual-axis bar + line |
| 4 | Goroutine count vs player load | Area line + expected reference |

## Data source

All figures were recorded on a **ThinkPad T480** (Intel i5-8250U, 4-core, 8 GB DDR4)
running the Go 1.22 backend locally. Tests were driven by a WebSocket load-test client
simulating concurrent player connections across multiple lobbies.
