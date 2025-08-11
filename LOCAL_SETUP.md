Local Development Setup

- Prereqs: Node 18+, npm 9+, Docker Desktop (optional for Postgres).
- DB: Use Docker `postgres:16` or a local Postgres. Copy `.env.example` to `.env` and update `DATABASE_URL`.
- Install: `npm install`
- Dev run: `npm run dev` then open `http://localhost:5000`.
- Build client: `npm run build` to generate `dist/public` assets used in production mode.

Commands

- `docker compose up -d` — start Postgres locally.
- `npm run dev` — start Express server with Vite middleware in dev mode.
- `npm run build` — build client to `dist/public`.
- `npm run typecheck` — TypeScript check.
- `npm run migrate [file]` — apply SQL file to configured `DATABASE_URL` (defaults to `server/sql/init_db.sql`).
- `npm run start:local` — cross-platform helper: ensures DB is running, applies migrations, then starts dev server.

Environment

- `PORT` — server port (default 5000)
- `DATABASE_URL` — Postgres connection string (required to boot)

Notes

- The server integrates Vite middleware for the client when `dist/public` is missing.
- For a persistent DB, leave Docker container running; data persists in `db-data` volume.
- If you already have Postgres, skip Docker and point `DATABASE_URL` to it.

Windows-specific helper

- `npm run start:db` — start Postgres via Docker Compose (keeps the container running).
- `npm run start:local` — runs a cross-platform Node helper; a separate PowerShell helper `scripts/start-local.ps1` still exists for convenience.

Developer notes

- `scripts/migrate.cjs` connects to `DATABASE_URL` and applies an SQL file.
- `scripts/start-local.cjs` will attempt to start Docker Compose if the DB is unreachable, wait for readiness, run migrations, and then run `npm run dev`.

