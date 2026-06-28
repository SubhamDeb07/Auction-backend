# Auction Backend

Node.js + Express + MySQL + Socket.IO backend for the FC 26 Live Multiplayer Auction app.

## Architecture (MVC)

```
src/
├── config/          # MySQL connection
├── controllers/     # HTTP request handlers
├── models/          # MySQL data access layer
├── routes/          # Express routes
├── services/        # Business logic (auction engine)
├── sockets/         # Socket.IO event handlers
├── migrations/      # SQL schema
└── utils/           # Shared constants/helpers
```

## Setup

1. Ensure MySQL is running locally.

2. Copy environment file:

```bash
cp .env.example .env
```

3. Install dependencies and create the `auction` database + tables:

```bash
npm install
npm run db:init
```

4. Start the server:

```bash
npm run dev
```

Server runs at `http://localhost:3000`.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `MYSQL_HOST` | MySQL host (default: localhost) |
| `MYSQL_USER` | MySQL user |
| `MYSQL_PASSWORD` | MySQL password |
| `MYSQL_DATABASE` | Database name (default: auction) |
| `PORT` | API port (default: 3000) |
| `CLIENT_URL` | React app URL for CORS |

## API

- `GET /api/health` — health check
- `GET /api/state` — current auction state snapshot

## Socket Events

Same event contract as the original prototype (`register-manager`, `admin-init-game`, `draw-player`, `place-bid`, etc.).
