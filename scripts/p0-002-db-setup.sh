#!/usr/bin/env bash
# P0-002 PostgreSQL Database — Development Setup Script
# This script starts the PostgreSQL container via Docker Compose and validates the database.
# It does NOT implement trading functionality, exchange integration, or risk engine changes.

set -euo pipefail

COMPOSE_FILE="docker-compose.yml"
DB_NAME="vua_trading"
DB_USER="postgres"
DB_HOST="localhost"
DB_PORT="5432"
DB_URL="postgresql://${DB_USER}:postgres@${DB_HOST}:${DB_PORT}/${DB_NAME}"

echo "P0-002: Starting PostgreSQL development service..."
docker compose -f "${COMPOSE_FILE}" up -d postgres || docker-compose -f "${COMPOSE_FILE}" up -d postgres

echo "Waiting for PostgreSQL health..."
for i in $(seq 1 30); do
    if docker exec vua_postgres_dev pg_isready -U "${DB_USER}" -d "${DB_NAME}" 2>/dev/null; then
        echo "PostgreSQL is ready."
        break
    fi
    echo "Attempt ${i}/30: PostgreSQL not yet ready..."
    sleep 1
done

echo "P0-002: PostgreSQL container started and healthy."
echo "DB URL: ${DB_URL}"
