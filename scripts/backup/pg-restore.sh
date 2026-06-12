#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# PostgreSQL Restore Script for 车店云管家
# Restores a pg_dump to a NEW database. Refuses to overwrite production.
# =============================================================================

# --- Usage ---
usage() {
  echo "Usage: $0 <dump文件路径> <目标数据库名>"
  echo ""
  echo "  dump文件路径   pg_dump 产出的 .dump 文件完整路径"
  echo "  目标数据库名   恢复目标数据库名称（不能与生产库同名）"
  echo ""
  echo "Example:"
  echo "  $0 /var/backups/carshop/carshop_20260101_033000.dump carshop_restore_test"
  exit 1
}

# --- Validate arguments ---
if [ $# -ne 2 ]; then
  usage
fi

DUMP_FILE="$1"
TARGET_DB="$2"

# --- Environment Variables ---
PG_USER="${POSTGRES_USER:-car_admin}"
PG_CONTAINER="${PG_CONTAINER:-car-postgres}"

# Parse production DB name from DATABASE_URL
if [ -z "${DATABASE_URL:-}" ]; then
  echo "[ERROR] DATABASE_URL is not set"
  exit 1
fi

PROD_DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|.*\/\([^?]*\).*|\1|p')
PROD_DB_NAME="${PROD_DB_NAME:-car_shop}"

# --- Safety Check: refuse to overwrite production ---
if [ "$TARGET_DB" = "$PROD_DB_NAME" ]; then
  echo "[ERROR] 目标数据库名 '${TARGET_DB}' 与生产库名相同！"
  echo "        恢复脚本禁止直接覆盖生产库。"
  echo "        请使用不同的目标库名，例如: carshop_restore_test"
  exit 1
fi

# --- Validate dump file exists ---
if [ ! -f "$DUMP_FILE" ]; then
  echo "[ERROR] Dump 文件不存在: ${DUMP_FILE}"
  exit 1
fi

echo "========== Restore Start =========="
echo "Dump file:  ${DUMP_FILE}"
echo "Target DB:  ${TARGET_DB}"
echo "Production DB (protected): ${PROD_DB_NAME}"

# Step 1: Create target database (drop if exists)
echo ""
echo "Step 1: Creating target database '${TARGET_DB}'..."
docker exec "$PG_CONTAINER" \
  psql -U "$PG_USER" -d postgres -c "DROP DATABASE IF EXISTS \"${TARGET_DB}\";" 2>&1
docker exec "$PG_CONTAINER" \
  psql -U "$PG_USER" -d postgres -c "CREATE DATABASE \"${TARGET_DB}\";" 2>&1
echo "Database '${TARGET_DB}' created."

# Step 2: Copy dump into container
echo ""
echo "Step 2: Copying dump into container..."
docker cp "$DUMP_FILE" "${PG_CONTAINER}:/tmp/restore.dump"
echo "Dump copied."

# Step 3: Restore
echo ""
echo "Step 3: Restoring dump to '${TARGET_DB}'..."
docker exec "$PG_CONTAINER" \
  pg_restore -U "$PG_USER" -d "$TARGET_DB" --no-owner --no-privileges --verbose \
  "/tmp/restore.dump" 2>&1 || {
    # pg_restore may return non-zero for warnings; check if data was actually restored
    echo "[WARN] pg_restore returned non-zero exit code (may be warnings)"
  }

# Step 4: Cleanup temp file
docker exec "$PG_CONTAINER" rm -f "/tmp/restore.dump"

# Step 5: Verify restore
echo ""
echo "Step 5: Verifying restore..."
echo "--- Row counts in '${TARGET_DB}' ---"
docker exec "$PG_CONTAINER" \
  psql -U "$PG_USER" -d "$TARGET_DB" -c "
SELECT 'tenants' as tbl, count(*) FROM tenants
UNION ALL SELECT 'work_orders', count(*) FROM work_orders
UNION ALL SELECT 'stored_value_cards', count(*) FROM stored_value_cards;
"

echo ""
echo "--- Row counts in production '${PROD_DB_NAME}' ---"
docker exec "$PG_CONTAINER" \
  psql -U "$PG_USER" -d "$PROD_DB_NAME" -c "
SELECT 'tenants' as tbl, count(*) FROM tenants
UNION ALL SELECT 'work_orders', count(*) FROM work_orders
UNION ALL SELECT 'stored_value_cards', count(*) FROM stored_value_cards;
"

echo ""
echo "========== Restore Complete =========="
echo "Restored to: ${TARGET_DB}"
echo "Production DB '${PROD_DB_NAME}' is UNCHANGED."
