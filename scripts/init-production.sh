#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# 车店云管家 — 生产环境初始化脚本
# 执行数据库迁移 + 种子数据（幂等，可重复执行）
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

cd "$PROJECT_ROOT"

log_info "===== 生产环境初始化开始 ====="

# Step 1: 数据库迁移
log_info "[1/2] 执行数据库迁移 (prisma migrate deploy)..."
npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma
log_info "数据库迁移完成"

# Step 2: 种子数据（幂等 upsert）
log_info "[2/2] 执行种子数据初始化..."
npx ts-node apps/api/prisma/seed.ts
log_info "种子数据初始化完成"

log_info "===== 生产环境初始化完成 ====="
