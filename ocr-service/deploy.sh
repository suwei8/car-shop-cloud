#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# 车店云管家 - OCR 车牌识别服务部署脚本
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

cd "$SCRIPT_DIR"

log_info "========== OCR 服务部署开始 =========="

# 检查 Docker
if ! command -v docker &> /dev/null; then
  log_error "docker 未安装"
  exit 1
fi

if ! docker compose version &> /dev/null; then
  log_error "docker compose 未安装"
  exit 1
fi

# 构建镜像
log_info "[1/3] 构建 OCR 服务镜像..."
docker compose build --no-cache

# 停止旧容器
log_info "[2/3] 停止旧容器..."
docker compose down || true

# 启动服务
log_info "[3/3] 启动 OCR 服务..."
docker compose up -d

# 等待服务就绪
log_info "等待服务就绪（模型加载需要时间）..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:8080/health > /dev/null 2>&1; then
    log_info "✅ OCR 服务启动成功"
    break
  fi
  sleep 5
done

# 验证
log_info "========== 部署验证 =========="
docker compose ps

if curl -sf http://localhost:8080/health > /dev/null 2>&1; then
  log_info "✅ 健康检查通过"
else
  log_warn "⚠️ 服务可能还在启动中，请稍后检查"
fi

log_info "========== 部署完成 =========="
log_info "服务地址: http://localhost:8080"
log_info "API 文档: http://localhost:8080/docs"
log_info "健康检查: http://localhost:8080/health"
log_info ""
log_info "测试命令:"
log_info "  curl -X POST http://localhost:8080/recognize \\"
log_info "    -H 'Content-Type: application/json' \\"
log_info "    -d '{\"image_base64\": \"你的图片base64\"}'"
