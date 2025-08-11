# Start Postgres via Docker Compose, initialize DB, and run dev server.
# Usage: run from repository root: ./scripts/start-local.ps1
param()

Write-Host 'Starting Postgres via docker compose...'
docker compose up -d

$container = (docker compose ps -q db)
if (-not $container) {
  Write-Error 'DB container not found. Is the service named "db" in docker-compose.yml?'
  exit 1
}

Write-Host 'Waiting for Postgres to become available...'
$maxAttempts = 60
$attempt = 0
while ($attempt -lt $maxAttempts) {
  docker compose exec -T db pg_isready -U postgres > $null 2>&1
  if ($LASTEXITCODE -eq 0) {
    Write-Host 'Postgres is ready.'
    break
  }
  Start-Sleep -Seconds 2
  $attempt++
}
if ($LASTEXITCODE -ne 0) {
  Write-Error 'Postgres did not become ready in time.'
  exit 1
}

# Copy and run initialization SQL if present
if (Test-Path './server/sql/init_db.sql') {
  Write-Host 'Copying init SQL into container...'
  docker cp ./server/sql/init_db.sql "$container:/init_db.sql"
  Write-Host 'Applying init SQL...'
  docker compose exec -T db psql -U postgres -d crypto_futures -f /init_db.sql
} else {
  Write-Host 'No init_db.sql found; skipping SQL initialization.'
}

Write-Host 'Starting development server...'
npm run dev
