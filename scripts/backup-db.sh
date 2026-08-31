#!/bin/bash
# Nightly Postgres backup for wouldyoubuyit. Keeps 30 days, gzip-compressed.
set -euo pipefail

BACKUP_DIR="/opt/projects/user/wouldyoubuyit/backups"
CONTAINER="wouldyoubuyit-postgres"
DB_USER="wybi"
DB_NAME="wouldyoubuyit"
STAMP="$(date +%Y-%m-%d_%H%M%S)"
FILE="$BACKUP_DIR/wouldyoubuyit_${STAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

docker exec "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" | gzip > "$FILE"

# Sanity check: fail loudly if the dump is suspiciously small (empty/broken)
SIZE=$(stat -c%s "$FILE" 2>/dev/null || echo 0)
if [ "$SIZE" -lt 1000 ]; then
  echo "Backup FAILED or suspiciously small ($SIZE bytes): $FILE" >&2
  exit 1
fi

# Prune backups older than 30 days
find "$BACKUP_DIR" -name "wouldyoubuyit_*.sql.gz" -mtime +30 -delete

echo "Backup OK: $FILE ($SIZE bytes)"
