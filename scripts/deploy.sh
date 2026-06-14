#!/usr/bin/env bash
# =============================================================================
# 车店云管家 — 一键生产部署脚本
# 用法:
#   ./scripts/deploy.sh                     # 完整部署: 拉代码 + 构建 + 迁移 + 启动
#   ./scripts/deploy.sh --skip-build        # 跳过镜像构建 (复用已有镜像)
#   ./scripts/deploy.sh --skip-migrate      # 跳过数据库迁移
#   ./scripts/deploy.sh --skip-pull         # 跳过 git pull
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.prod.yml"
ENV_FILE="$PROJECT_ROOT/.env.production"

# -----------------------------------------------------------------------------
# 颜色输出
# -----------------------------------------------------------------------------
if [ -t 1 ]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; BLUE=''; NC=''
fi
log_info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }
log_step()  { echo -e "\n${BLUE}====>${NC} $*"; }

# -----------------------------------------------------------------------------
# 参数解析
# -----------------------------------------------------------------------------
SKIP_BUILD=false
SKIP_MIGRATE=false
SKIP_PULL=false
for arg in "$@"; do
  case "$arg" in
    --skip-build)   SKIP_BUILD=true ;;
    --skip-migrate) SKIP_MIGRATE=true ;;
    --skip-pull)    SKIP_PULL=true ;;
    -h|--help)
      sed -n '2,9p' "$0"
      exit 0
      ;;
    *) log_error "未知参数: $arg"; exit 2 ;;
  esac
done

# -----------------------------------------------------------------------------
# 前置条件检查
# -----------------------------------------------------------------------------
log_step "前置条件检查"

if [ ! -f "$ENV_FILE" ]; then
  log_error ".env.production 不存在: $ENV_FILE"
  log_error "请先执行: cp .env.production.example .env.production && vi .env.production"
  exit 1
fi

# 检测是否仍有占位符 (忽略 # 开头的注释行)
if grep -v '^\s*#' "$ENV_FILE" | grep -q "<CHANGE_ME"; then
  log_error ".env.production 中仍包含未替换的 <CHANGE_ME_*> 占位符, 请先填写完整"
  exit 1
fi

for cmd in docker; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    log_error "未安装 $cmd, 请先安装"
    exit 1
  fi
done

if ! docker compose version >/dev/null 2>&1; then
  log_error "docker compose 未安装或版本过低 (需要 v2+)"
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  log_error "docker 守护进程未运行, 请先启动"
  exit 1
fi

log_info "项目目录: $PROJECT_ROOT"

# 统一 compose 调用
dc() {
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

# -----------------------------------------------------------------------------
# Step 1: 拉取最新代码
# -----------------------------------------------------------------------------
log_step "[1/5] 同步源代码"
cd "$PROJECT_ROOT"
if [ "$SKIP_PULL" = true ]; then
  log_info "跳过 ( --skip-pull )"
elif [ -d "$PROJECT_ROOT/.git" ]; then
  log_info "执行 git pull --ff-only ..."
  if ! git pull --ff-only; then
    log_warn "git pull 失败, 使用当前代码继续 (请人工检查)"
  fi
else
  log_info "非 git 仓库, 跳过代码拉取"
fi

# -----------------------------------------------------------------------------
# Step 2: 构建镜像
# -----------------------------------------------------------------------------
log_step "[2/5] 构建 Docker 镜像"
if [ "$SKIP_BUILD" = true ]; then
  log_info "跳过 ( --skip-build )"
else
  log_info "构建 api + web (这可能需要几分钟)..."
  dc build --pull
fi

# -----------------------------------------------------------------------------
# Step 3: 停止旧容器 (保留数据卷)
# -----------------------------------------------------------------------------
log_step "[3/5] 停止旧容器"
dc down --timeout 30 --remove-orphans || log_warn "down 过程有警告, 继续部署"

# -----------------------------------------------------------------------------
# Step 4: 数据库迁移
# -----------------------------------------------------------------------------
log_step "[4/5] 数据库迁移"
if [ "$SKIP_MIGRATE" = true ]; then
  log_info "跳过 ( --skip-migrate )"
else
  log_info "启动 PostgreSQL..."
  dc up -d postgres
  log_info "等待 PostgreSQL 就绪..."
  for i in $(seq 1 30); do
    if dc exec -T postgres pg_isready -U "${POSTGRES_USER:-car_admin}" -d car_shop >/dev/null 2>&1; then
      log_info "PostgreSQL 已就绪"
      break
    fi
    if [ "$i" -eq 30 ]; then
      log_error "PostgreSQL 启动超时 (150s), 请检查: docker logs car-postgres-prod"
      exit 1
    fi
    sleep 5
  done

  log_info "执行 prisma migrate deploy..."
  dc run --rm -T api npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma
  log_info "数据库迁移完成"
fi

# -----------------------------------------------------------------------------
# Step 5: 启动所有服务
# -----------------------------------------------------------------------------
log_step "[5/5] 启动所有服务"
dc up -d

log_info "等待服务健康检查 (最多 90 秒)..."
for i in $(seq 1 18); do
  unhealthy=$(dc ps --format json 2>/dev/null | grep -c '"Health":"unhealthy"' || true)
  starting=$(dc ps --format json 2>/dev/null | grep -c '"Health":"starting"' || true)
  if [ "$unhealthy" -eq 0 ] && [ "$starting" -eq 0 ]; then
    break
  fi
  sleep 5
done

# -----------------------------------------------------------------------------
# 部署验证
# -----------------------------------------------------------------------------
log_step "部署验证"
dc ps

HEALTH_OK=true
if curl -sf --max-time 5 http://localhost/api/health >/dev/null 2>&1; then
  log_info "API 健康检查通过 (/api/health)"
else
  log_warn "API 健康检查未通过, 请检查: docker logs car-api"
  HEALTH_OK=false
fi

if curl -sf --max-time 5 -o /dev/null http://localhost/; then
  log_info "Web 前端可访问 (/)"
else
  log_warn "Web 前端未响应, 请检查: docker logs car-web"
  HEALTH_OK=false
fi

# -----------------------------------------------------------------------------
# 完成提示
# -----------------------------------------------------------------------------
log_step "部署完成"
log_info "访问地址:  http://<YOUR_DOMAIN> (或 http://localhost)"
log_info "API 文档:  http://<YOUR_DOMAIN>/api/docs"
log_info "查看日志:  docker logs -f car-api | car-web | car-postgres-prod"
log_info "停止服务:  docker compose -f docker-compose.prod.yml down"
log_info "重启服务:  docker compose -f docker-compose.prod.yml restart"

log_info ""
log_info "备份提示: 请在宿主机 crontab 中添加以下条目 (每日 03:00 自动备份):"
log_info "  0 3 * * * cd $PROJECT_ROOT && bash scripts/backup/pg-backup.sh >> /var/log/carshop-backup.log 2>&1"

if [ "$HEALTH_OK" = false ]; then
  log_warn "部分健康检查未通过, 请以非零状态退出"
  exit 1
fi

exit 0
