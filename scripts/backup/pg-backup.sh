#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# PostgreSQL Backup Script for 车店云管家
# Creates pg_dump in custom format, validates, uploads to S3, and cleans old.
# =============================================================================

# --- Environment Variables (from .env or exported) ---
# Required:
#   DATABASE_URL            — PostgreSQL connection string
#   POSTGRES_USER           — PostgreSQL user
#   POSTGRES_PASSWORD       — PostgreSQL password
# Optional:
#   BACKUP_LOCAL_DIR        — Local backup directory (default: /var/backups/carshop)
#   BACKUP_RETENTION_DAYS   — Days to keep local backups (default: 14)
#   BACKUP_S3_BUCKET        — S3 bucket name for remote backups
#   BACKUP_S3_ENDPOINT      — S3 endpoint URL
#   BACKUP_S3_ACCESS_KEY    — S3 access key
#   BACKUP_S3_SECRET_KEY    — S3 secret key
#   BACKUP_S3_REGION        — S3 region (default: us-east-1)
#   BACKUP_ALERT_WEBHOOK    — Webhook URL for failure alerts (empty = skip)
#   PG_CONTAINER            — Docker container name for postgres (default: car-postgres)

# --- Configuration ---
BACKUP_LOCAL_DIR="${BACKUP_LOCAL_DIR:-/var/backups/carshop}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
PG_CONTAINER="${PG_CONTAINER:-car-postgres}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DUMP_FILENAME="carshop_${TIMESTAMP}.dump"
DUMP_PATH="${BACKUP_LOCAL_DIR}/${DUMP_FILENAME}"
LOG_FILE="${BACKUP_LOCAL_DIR}/backup.log"

# --- Parse DATABASE_URL to extract connection info ---
if [ -z "${DATABASE_URL:-}" ]; then
  echo "[ERROR] DATABASE_URL is not set" | tee -a "$LOG_FILE" 2>/dev/null
  exit 1
fi

# Extract host, port, dbname from DATABASE_URL
# Format: postgresql://user:pass@host:port/dbname?params
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:/]*\).*|\1|p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|.*\/\([^?]*\).*|\1|p')

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-car_shop}"

PG_USER="${POSTGRES_USER:-car_admin}"

# --- Functions ---
log() {
  local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
  echo "$msg" | tee -a "$LOG_FILE"
}

alert_webhook() {
  local message="$1"
  if [ -n "${BACKUP_ALERT_WEBHOOK:-}" ]; then
    curl -s -X POST "$BACKUP_ALERT_WEBHOOK" \
      -H "Content-Type: application/json" \
      -d "{\"msgtype\":\"text\",\"text\":{\"content\":\"[车店云管家备份告警] $message\"}}" \
      --max-time 10 || true
  fi
}

cleanup_old_backups() {
  log "Cleaning up local backups older than ${BACKUP_RETENTION_DAYS} days..."
  local count
  count=$(find "$BACKUP_LOCAL_DIR" -name "carshop_*.dump" -mtime +"$BACKUP_RETENTION_DAYS" | wc -l)
  if [ "$count" -gt 0 ]; then
    find "$BACKUP_LOCAL_DIR" -name "carshop_*.dump" -mtime +"$BACKUP_RETENTION_DAYS" -delete
    log "Removed $count old backup(s)"
  else
    log "No old backups to remove"
  fi
}

cleanup_s3_old() {
  if [ -z "${BACKUP_S3_BUCKET:-}" ]; then
    log "BACKUP_S3_BUCKET not set, skipping S3 cleanup"
    return
  fi

  log "Cleaning up S3 backups older than ${BACKUP_S3_RETENTION_DAYS:-90} days..."
  local retention_days="${BACKUP_S3_RETENTION_DAYS:-90}"
  local cutoff_date
  cutoff_date=$(date -d "-${retention_days} days" +%Y-%m-%d 2>/dev/null || date -v-"${retention_days}"d +%Y-%m-%d 2>/dev/null)

  if [ -n "$cutoff_date" ]; then
    mc find "${BACKUP_S3_ALIAS:-s3}/${BACKUP_S3_BUCKET}/backups/" \
      --name "carshop_*.dump" \
      --older-than "${retention_days}d" \
      --exec "mc rm {}" 2>/dev/null || log "S3 cleanup: no old files or error"
  fi
}

upload_to_s3() {
  if [ -z "${BACKUP_S3_BUCKET:-}" ]; then
    log "BACKUP_S3_BUCKET not set, skipping S3 upload"
    return 0
  fi

  log "Configuring S3 alias..."
  mc alias set s3 \
    "${BACKUP_S3_ENDPOINT:-https://s3.amazonaws.com}" \
    "${BACKUP_S3_ACCESS_KEY:-}" \
    "${BACKUP_S3_SECRET_KEY:-}" \
    --api S3v4 2>/dev/null

  log "Uploading ${DUMP_FILENAME} to s3://${BACKUP_S3_BUCKET}/backups/..."
  mc cp "$DUMP_PATH" "s3://${BACKUP_S3_BUCKET}/backups/${DUMP_FILENAME}" 2>&1 | tee -a "$LOG_FILE"

  if [ $? -eq 0 ]; then
    log "S3 upload successful"
  else
    log "[ERROR] S3 upload failed"
    return 1
  fi
}

# --- Main ---
main() {
  mkdir -p "$BACKUP_LOCAL_DIR"
  log "========== Backup Start =========="
  log "Target: ${DB_HOST}:${DB_PORT}/${DB_NAME}"
  log "Dump file: ${DUMP_PATH}"

  # Step 1: pg_dump via docker exec
  log "Step 1: Running pg_dump..."
  docker exec "$PG_CONTAINER" \
    pg_dump -U "$PG_USER" -h "$DB_HOST" -p "$DB_PORT" \
    -Fc --no-owner --no-privileges \
    -f "/tmp/${DUMP_FILENAME}" \
    "$DB_NAME" 2>&1 | tee -a "$LOG_FILE"

  # Copy dump out of container
  docker cp "${PG_CONTAINER}:/tmp/${DUMP_FILENAME}" "$DUMP_PATH"
  docker exec "$PG_CONTAINER" rm -f "/tmp/${DUMP_FILENAME}"

  if [ ! -f "$DUMP_PATH" ]; then
    log "[ERROR] Dump file not created"
    alert_webhook "备份失败：dump 文件未生成"
    exit 1
  fi

  local dump_size
  dump_size=$(stat -c%s "$DUMP_PATH" 2>/dev/null || stat -f%z "$DUMP_PATH" 2>/dev/null)
  log "Dump size: ${dump_size} bytes"

  # Step 2: Validate dump with pg_restore --list
  log "Step 2: Validating dump..."
  if docker exec "$PG_CONTAINER" pg_restore --list "/tmp/${DUMP_FILENAME}" > /dev/null 2>&1; then
    log "Dump validation passed"
  else
    # Copy to container for validation
    docker cp "$DUMP_PATH" "${PG_CONTAINER}:/tmp/${DUMP_FILENAME}"
    if docker exec "$PG_CONTAINER" pg_restore --list "/tmp/${DUMP_FILENAME}" > /dev/null 2>&1; then
      log "Dump validation passed (after copy-back)"
    else
      log "[ERROR] Dump validation failed - dump is corrupt"
      alert_webhook "备份失败：dump 文件校验不通过"
      exit 1
    fi
    docker exec "$PG_CONTAINER" rm -f "/tmp/${DUMP_FILENAME}"
  fi

  # Step 3: Upload to S3
  log "Step 3: Uploading to S3..."
  if ! upload_to_s3; then
    log "[WARN] S3 upload failed, but local backup exists"
    alert_webhook "备份告警：S3 上传失败，本地备份正常"
  fi

  # Step 4: Cleanup old local backups
  log "Step 4: Cleaning up old backups..."
  cleanup_old_backups

  # Step 5: Cleanup old S3 backups
  log "Step 5: Cleaning up old S3 backups..."
  cleanup_s3_old

  log "========== Backup Complete =========="
  log "Local backup: ${DUMP_PATH}"
}

# Run main
main "$@"
