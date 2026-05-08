# Wordle Duel

Game Project for PDC.

## Run with Docker

From the repo root:

```bash
docker compose up --build
```

Then open:

`http://localhost:5173`

## Services

- `frontend`: React app served by Nginx on port `5173` (container port `80`)
- `backend`: Go API + WebSocket server (internal port `8080`)

Nginx proxies:

- `/api/*` → backend REST API
- `/ws` → backend WebSocket endpoint
