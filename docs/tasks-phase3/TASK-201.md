# TASK-201：部署与 DevOps（Docker 多阶段构建 + 生产编排 + Nginx + 部署脚本）

> **优先级**：P0
> **状态**：待派发
> **依赖**：无
> **可并行**：TASK-203、TASK-204

## 1. 任务目标

当前车店云管家只有开发环境：`docker-compose.yml` 运行基础设施（PostgreSQL / Redis / MinIO），应用通过 `pnpm dev` 本地启动。生产环境没有容器化方案、没有 Nginx 代理、没有部署脚本、没有 HTTPS 配置模板。

本任务要建立完整的生产部署流程：
- API（NestJS）和 Web（Vite 静态资源）分别通过 Docker 多阶段构建生成镜像
- `docker-compose.prod.yml` 统一编排所有服务
- Nginx 反向代理 API 并托管前端静态资源
- 一键部署脚本 `scripts/deploy.sh`
- 健康检查、日志、备份 cron 集成

完成后，运维人员只需在目标服务器执行 `./scripts/deploy.sh` 即可完成全栈部署。

## 2. 涉及文件

### 新建文件
- `Dockerfile`（项目根目录，多阶段构建 API + Web）
- `docker-compose.prod.yml`（项目根目录）
- `nginx/default.conf`（Nginx 主配置）
- `nginx/ssl.conf`（HTTPS 配置片段，可选引入）
- `.env.production.example`（生产环境变量模板）
- `scripts/deploy.sh`（一键部署脚本）

### 修改文件
- `apps/api/src/main.ts` — 确保 API 在 Docker 容器中监听 `0.0.0.0`（当前默认 `127.0.0.1`，容器内无法从外部访问）
- `.gitignore` — 添加 `.env.production` 排除规则

## 3. 详细要求

### 3.1 Dockerfile（多阶段构建）

在项目根目录创建 `Dockerfile`，采用多阶段构建，产出两个目标（target）：`api` 和 `web`。

```dockerfile
# ============== Stage: base ==============
FROM node:18-alpine AS base
RUN corepack enable && corepack prepare pnpm@8 --activate
WORKDIR /app

# ============== Stage: deps ==============
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile

# ============== Stage: build-api ==============
FROM deps AS build-api
COPY apps/api/ apps/api/
COPY packages/shared/ packages/shared/
RUN pnpm --filter @car/api run prisma:generate
RUN pnpm --filter @car/api run build

# ============== Stage: api (最终镜像) ==============
FROM base AS api
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build-api /app/apps/api/dist ./apps/api/dist
COPY --from=build-api /app/apps/api/prisma ./apps/api/prisma
COPY --from=build-api /app/apps/api/node_modules/.prisma ./apps/api/node_modules/.prisma
COPY apps/api/package.json apps/api/
COPY packages/shared/ packages/shared/
COPY package.json pnpm-workspace.yaml ./

# 生产环境不需要 devDependencies
ENV NODE_ENV=production
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1
CMD ["node", "apps/api/dist/apps/api/src/main.js"]

# ============== Stage: build-web ==============
FROM deps AS build-web
COPY apps/web/ apps/web/
COPY packages/shared/ packages/shared/
RUN pnpm --filter @car/web run build

# ============== Stage: web (最终镜像) ==============
FROM nginx:alpine AS web
COPY --from=build-web /app/apps/web/dist /usr/share/nginx/html
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
EXPOSE 80 443
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:80/ || exit 1
```

**关键说明**：
- 使用 `node:18-alpine` 以匹配项目 `engines` 要求（`>=18.0.0`）
- Prisma 的 `.prisma` client 必须复制到最终镜像
- API 入口点为 `apps/api/dist/apps/api/src/main.js`（根据 `nest-cli.json` 的 `deleteOutDir` + `tsconfig.build.json` 推断出路径，agent 需要在构建后确认实际产物路径并调整）
- Web 阶段基于 `nginx:alpine`，直接将 Vite 构建产物复制到 Nginx 默认目录

### 3.2 docker-compose.prod.yml

在项目根目录创建 `docker-compose.prod.yml`：

```yaml
version: '3.8'

services:
  api:
    build:
      context: .
      dockerfile: Dockerfile
      target: api
    container_name: car-api
    restart: unless-stopped
    env_file: .env.production
    environment:
      - NODE_ENV=production
      - API_HOST=0.0.0.0
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - car-network
    # 不暴露端口到宿主机，通过 Nginx 反向代理访问
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "5"

  web:
    build:
      context: .
      dockerfile: Dockerfile
      target: web
    container_name: car-web
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - api
    networks:
      - car-network
    volumes:
      - ./nginx/ssl:/etc/nginx/ssl:ro  # 可选，SSL 证书挂载
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "5"

  postgres:
    image: postgres:16-alpine
    container_name: car-postgres-prod
    restart: unless-stopped
    env_file: .env.production
    environment:
      POSTGRES_DB: car_shop
      POSTGRES_USER: ${POSTGRES_USER:-car_admin}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - pgdata-prod:/var/lib/postgresql/data
    networks:
      - car-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-car_admin} -d car_shop"]
      interval: 10s
      timeout: 5s
      retries: 5
    # 不暴露端口到宿主机

  redis:
    image: redis:7-alpine
    container_name: car-redis-prod
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redisdata-prod:/data
    networks:
      - car-network
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    # 不暴露端口到宿主机

  minio:
    image: minio/minio:latest
    container_name: car-minio-prod
    restart: unless-stopped
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER:-car_minio_admin}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
    command: server /data --console-address ":9001"
    volumes:
      - miniodata-prod:/data
    networks:
      - car-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 10s
      retries: 3
    # 不暴露端口到宿主机

volumes:
  pgdata-prod:
  redisdata-prod:
  miniodata-prod:

networks:
  car-network:
    driver: bridge
```

**关键说明**：
- `api`、`postgres`、`redis`、`minio` 均**不暴露端口到宿主机**，只通过 Docker 内部网络通信
- 仅 `web`（Nginx）暴露 80/443
- 所有服务配置 `json-file` 日志驱动，限制大小
- PostgreSQL / Redis / MinIO 数据持久化到命名卷（`-prod` 后缀，避免与开发卷冲突）
- PostgreSQL 和 Redis 配置了 healthcheck，API 依赖它们

### 3.3 Nginx 配置

#### `nginx/default.conf`

```nginx
upstream api_backend {
    server api:3000;
}

server {
    listen 80;
    server_name _;

    # === 前端静态资源 ===
    root /usr/share/nginx/html;
    index index.html;

    # API 反向代理
    location /api/ {
        proxy_pass http://api_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket 支持（未来可能需要）
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # 文件上传限制（5MB，与 data-import 保持一致）
        client_max_body_size 10m;
    }

    # 前端 SPA 路由 — 所有非文件请求 fallback 到 index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # 禁止访问隐藏文件
    location ~ /\. {
        deny all;
        return 404;
    }
}
```

#### `nginx/ssl.conf`（Let's Encrypt HTTPS 配置片段）

```nginx
# === HTTPS 配置 ===
# 使用方法：
# 1. 将 SSL 证书放到 nginx/ssl/ 目录
# 2. 在 default.conf 的 server 块中 include 此文件
# 3. 或者替换 default.conf 中的 server 块

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate     /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # 以下内容与 default.conf 的 location 块相同
    root /usr/share/nginx/html;
    index index.html;

    location /api/ {
        proxy_pass http://api_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        client_max_body_size 10m;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    location ~ /\. {
        deny all;
        return 404;
    }
}

# HTTP → HTTPS 重定向
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}
```

### 3.4 环境变量管理

创建 `.env.production.example`，包含生产环境所有必需变量（密码使用占位符）：

```bash
# =============================================================================
# 车店云管家 — 生产环境变量模板
# 复制为 .env.production 后修改所有 <CHANGE_ME> 占位符
# =============================================================================

# Database
POSTGRES_USER=car_admin
POSTGRES_PASSWORD=<CHANGE_ME_STRONG_PASSWORD_16_CHARS>
DATABASE_URL=postgresql://car_admin:<CHANGE_ME_STRONG_PASSWORD_16_CHARS>@postgres:5432/car_shop?schema=public

# Redis
REDIS_PASSWORD=<CHANGE_ME_STRONG_PASSWORD_16_CHARS>
REDIS_URL=redis://:<CHANGE_ME_STRONG_PASSWORD_16_CHARS>@redis:6379
API_REDIS_URL=redis://:<CHANGE_ME_STRONG_PASSWORD_16_CHARS>@redis:6379

# JWT
JWT_SECRET=<CHANGE_ME_RANDOM_STRING_32_CHARS>
JWT_ACCESS_TOKEN_TTL=2h
JWT_REFRESH_TOKEN_TTL=7d
JWT_CUSTOMER_SECRET=<CHANGE_ME_DIFFERENT_RANDOM_STRING>

# MinIO / S3
MINIO_ROOT_USER=car_minio_admin
MINIO_ROOT_PASSWORD=<CHANGE_ME_STRONG_PASSWORD_16_CHARS>
S3_ENDPOINT=http://minio:9000
S3_ACCESS_KEY=car_minio_admin
S3_SECRET_KEY=<CHANGE_ME_STRONG_PASSWORD_16_CHARS>
S3_BUCKET=car-shop
S3_REGION=us-east-1

# App
API_PORT=3000
API_HOST=0.0.0.0
CORS_ORIGIN=https://your-domain.com

# Subscription Lifecycle
TRIAL_DAYS=14
GRACE_DAYS=7

# SMS（生产环境请配置真实的阿里云短信服务）
SMS_PROVIDER=aliyun
ALIYUN_SMS_ACCESS_KEY_ID=<CHANGE_ME>
ALIYUN_SMS_ACCESS_KEY_SECRET=<CHANGE_ME>
ALIYUN_SMS_SIGN_NAME=<CHANGE_ME>

# Backup
BACKUP_LOCAL_DIR=/var/backups/carshop
BACKUP_RETENTION_DAYS=14
BACKUP_S3_BUCKET=car-shop-backup
BACKUP_S3_ENDPOINT=http://minio:9000
BACKUP_S3_ACCESS_KEY=car_minio_admin
BACKUP_S3_SECRET_KEY=<CHANGE_ME_STRONG_PASSWORD_16_CHARS>
BACKUP_S3_REGION=us-east-1
PG_CONTAINER=car-postgres-prod
```

**关键说明**：
- 数据库和 Redis 的 host 在容器内应使用 Docker 服务名（`postgres`、`redis`、`minio`），而非 `localhost`
- `API_HOST=0.0.0.0` 确保容器内可访问
- `CORS_ORIGIN` 设置为实际域名
- 所有密码使用 `<CHANGE_ME_*>` 占位符

### 3.5 部署脚本

创建 `scripts/deploy.sh`：

```bash
#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# 车店云管家 — 一键部署脚本
# 用法: ./scripts/deploy.sh [--skip-build] [--skip-migrate]
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.prod.yml"
ENV_FILE="$PROJECT_ROOT/.env.production"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 参数解析
SKIP_BUILD=false
SKIP_MIGRATE=false
for arg in "$@"; do
  case $arg in
    --skip-build) SKIP_BUILD=true ;;
    --skip-migrate) SKIP_MIGRATE=true ;;
    *) log_error "未知参数: $arg"; exit 1 ;;
  esac
done

# 检查前置条件
if [ ! -f "$ENV_FILE" ]; then
  log_error ".env.production 文件不存在！请从 .env.production.example 复制并填写"
  exit 1
fi

if ! command -v docker &> /dev/null; then
  log_error "docker 未安装"
  exit 1
fi

if ! docker compose version &> /dev/null; then
  log_error "docker compose 未安装或版本过低"
  exit 1
fi

log_info "========== 车店云管家部署开始 =========="
log_info "项目目录: $PROJECT_ROOT"

# Step 1: 拉取最新代码（如果是 git 仓库）
if [ -d "$PROJECT_ROOT/.git" ]; then
  log_info "[1/5] 拉取最新代码..."
  cd "$PROJECT_ROOT"
  git pull --ff-only || log_warn "git pull 失败，使用当前代码继续"
else
  log_info "[1/5] 非 git 仓库，跳过代码拉取"
fi

# Step 2: 构建镜像
if [ "$SKIP_BUILD" = true ]; then
  log_info "[2/5] 跳过构建（--skip-build）"
else
  log_info "[2/5] 构建 Docker 镜像..."
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build --no-cache
fi

# Step 3: 停止旧容器
log_info "[3/5] 停止旧容器..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down --timeout 30 || true

# Step 4: 数据库迁移
if [ "$SKIP_MIGRATE" = true ]; then
  log_info "[4/5] 跳过数据库迁移（--skip-migrate）"
else
  log_info "[4/5] 执行数据库迁移..."
  # 先启动 PostgreSQL
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d postgres
  log_info "等待 PostgreSQL 就绪..."
  sleep 5

  # 在 api 容器中执行 migration
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" run --rm api \
    npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma
  log_info "数据库迁移完成"
fi

# Step 5: 启动所有服务
log_info "[5/5] 启动所有服务..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d

# 等待健康检查
log_info "等待服务就绪（最多 60 秒）..."
for i in $(seq 1 12); do
  if docker compose -f "$COMPOSE_FILE" ps | grep -q "unhealthy"; then
    sleep 5
  else
    break
  fi
done

# 验证
log_info "========== 部署验证 =========="
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps

# 健康检查
if curl -sf http://localhost/api/health > /dev/null 2>&1; then
  log_info "✅ API 健康检查通过"
else
  log_warn "⚠️ API 健康检查未通过，请检查日志: docker logs car-api"
fi

if curl -sf http://localhost > /dev/null 2>&1; then
  log_info "✅ Web 前端可访问"
else
  log_warn "⚠️ Web 前端未响应，请检查日志: docker logs car-web"
fi

log_info "========== 部署完成 =========="
log_info "访问地址: http://localhost（或您配置的域名）"
log_info "API 文档: http://localhost/api/docs"
log_info "查看日志: docker logs -f car-api"
```

脚本必须设置可执行权限：`chmod +x scripts/deploy.sh`

### 3.6 main.ts 修改

当前 `apps/api/src/main.ts` 第 45 行：

```typescript
const host = process.env.API_HOST || '127.0.0.1';
```

需要改为：

```typescript
const host = process.env.API_HOST || '0.0.0.0';
```

**理由**：在 Docker 容器内，`127.0.0.1` 仅监听容器的 loopback，外部（Nginx 容器）无法访问。默认值改为 `0.0.0.0` 使得开发和生产环境都能正常工作（开发时可通过 `.env` 指定 `API_HOST=127.0.0.1`）。

### 3.7 .gitignore 修改

在 `.gitignore` 文件中添加：

```
# Production env (contains real passwords)
.env.production
nginx/ssl/
```

### 3.8 备份集成

TASK-103 已实现 `scripts/backup/pg-backup.sh` 备份脚本。部署后需在宿主机 crontab 中配置定时执行。

在 `scripts/deploy.sh` 的末尾（部署完成提示之后）添加 crontab 提示：

```bash
log_info "备份提示: 请在宿主机 crontab 中添加以下条目:"
log_info "  0 3 * * * cd $PROJECT_ROOT && bash scripts/backup/pg-backup.sh >> /var/log/carshop-backup.log 2>&1"
```

不要自动修改 crontab（避免权限问题和意外覆盖），仅提示运维人员手动添加。

### 3.9 单元测试

本任务主要是运维配置文件，不涉及业务逻辑代码变更。测试要求：

- 修改 `main.ts` 后，`nest build` 仍能正常编译
- 无需新增单元测试文件
- 如果项目已有 `main.ts` 相关测试，确保修改后测试通过

## 4. 验收标准

- [ ] `docker compose -f docker-compose.prod.yml build` 成功构建 `api` 和 `web` 两个镜像
- [ ] `docker compose -f docker-compose.prod.yml up -d` 全部容器（api、web、postgres、redis、minio）启动正常且状态为 healthy
- [ ] `curl http://localhost/api/health` 返回包含 `status: 'ok'` 的 JSON 响应
- [ ] `curl http://localhost` 返回 Vue 应用的 HTML（包含 `<div id="app">`）
- [ ] API 日志可通过 `docker logs car-api` 查看
- [ ] `nest build`（`pnpm build:api`）编译通过
- [ ] PostgreSQL 数据持久化到 `pgdata-prod` 命名卷（重启后数据不丢失）
- [ ] Redis 数据持久化到 `redisdata-prod` 命名卷
- [ ] MinIO 数据持久化到 `miniodata-prod` 命名卷
- [ ] Nginx 仅暴露 80/443 端口，内部服务（api:3000、postgres:5432、redis:6379、minio:9000）不直接暴露到宿主机
- [ ] `.env.production.example` 中所有密码为占位符，不包含真实密码
- [ ] `scripts/deploy.sh` 可执行，`--skip-build` 和 `--skip-migrate` 参数正常工作
- [ ] 开发环境的 `docker-compose.yml` 未被修改

## 5. 注意事项

- **不要改动**开发环境的 `docker-compose.yml`，生产使用独立的 `docker-compose.prod.yml`
- PostgreSQL / Redis / MinIO 数据必须持久化到**命名卷**（使用 `-prod` 后缀避免与开发卷冲突）
- Nginx **不要暴露内部服务端口**，API 通过反向代理访问
- `.env.production.example` 中密码全部使用 `<CHANGE_ME_*>` 占位符，**绝不写真实密码**
- `main.ts` 默认 host 改为 `0.0.0.0` 后，开发环境可通过 `.env` 文件中 `API_HOST=127.0.0.1` 覆盖，不影响本地开发
- Dockerfile 中 API 入口点路径需要在构建后验证（`nest build` 产物路径可能因 `tsconfig` 配置而异），agent 需在构建后 `ls` 确认并调整 `CMD`
- 生产环境 `DATABASE_URL` 的 host 应为 Docker 服务名 `postgres`（非 `localhost`），Redis 同理为 `redis`，MinIO 为 `minio`
- 部署脚本使用 `prisma migrate deploy`（非 `prisma migrate dev`），这是生产环境专用的迁移命令
- 备份脚本的 `PG_CONTAINER` 在生产环境应设为 `car-postgres-prod`

---

## 6. 回执区域（Agent 完成后填写）

> **Agent 请在完成任务后，将以下表格填写完整并追加到本文件此节：**

| 项目 | 内容 |
|------|------|
| 修改的文件列表 | `apps/api/src/main.ts`（默认 host 改为 `0.0.0.0` + Node 18 Alpine 环境 crypto polyfill）；`.gitignore`（新增 `.env.production`、`nginx/ssl/*`、`!nginx/ssl/.gitkeep` 排除规则） |
| 新建的文件列表 | `.dockerignore`；`Dockerfile`（多阶段 base → deps → build-api → api → build-web → web）；`docker-compose.prod.yml`；`nginx/default.conf`；`nginx/ssl.conf`；`nginx/ssl/.gitkeep`；`.env.production.example`；`scripts/deploy.sh`（已设置 +x） |
| 构建是否通过 | ✅ `pnpm --filter @car/api run build` 编译成功（main.js 产物路径 `apps/api/dist/apps/api/src/main.js` 与 Dockerfile CMD 一致）；✅ `docker compose -f docker-compose.prod.yml build api web` 双镜像构建成功（car-api ≈ 540MB / car-web ≈ 63MB） |
| 测试是否通过（新增用例数） | ✅ 全部 5 个生产容器 healthy（car-api / car-web / car-postgres-prod / car-redis-prod / car-minio-prod）；✅ `curl http://localhost/api/health` → `{"code":0,"message":"ok","data":{"status":"ok","db":true,...}}`；✅ `curl http://localhost/` → Vue SPA HTML（含 `<div id="app">` 与 `<title>车店云管家</title>`）；✅ Swagger `/api/docs` 200；✅ `prisma migrate deploy` 成功应用 11 个迁移并持久化到 `car_pgdata-prod` 命名卷；✅ `scripts/deploy.sh --skip-pull --skip-build --skip-migrate` 完整流程跑通；✅ `docker logs car-api` 可查询日志；✅ 仅 Nginx 暴露 80/443，api:3000、postgres:5432、redis:6379、minio:9000 未映射到宿主机；✅ 开发 `docker-compose.yml` 未修改且开发容器恢复正常。本任务无新增 .spec 用例（纯 DevOps 配置） |
| 已知限制或遗留问题 | (1) `@nestjs/schedule@6.1.3` 在 Node 18 Alpine 下调用 `crypto.randomUUID()` 会失败，已在 `main.ts` 顶部通过 `globalThis.crypto = require('node:crypto').webcrypto` polyfill 解决，升级 Node 22 后可移除。(2) AWS SDK v3 对 Node 18 发出 2027 年 1 月后需升级 Node 22+ 的弃用警告，无害，可在后续基础镜像升级时处理。(3) Vite 主包 `index-*.js` ≈ 1.24MB，超过 500KB 建议阈值，属于 Web 端优化项（TASK-201 范围外）。(4) `nginx/ssl.conf` 为 Let's Encrypt 模板，启用需手动放置证书到 `nginx/ssl/` 并修改 `server_name`。(5) `docker compose` 变量替换会读取项目根 `.env`，因此部署前需保证 `.env.production` 与 `.env` 的密码字段一致，或在部署机上仅保留 `.env.production` |
| 执行耗时 | 约 90 分钟（含 Docker 多阶段构建 + 多次健康检查修复 + 完整部署验证） |

---

## 7. 架构师审核区域

> 审核人填写，Agent 请勿改动此节。

### 产品经理审核记录（2026-06-13）

- **审核结论**：✅ 通过
- **核对项目**：
  - **Docker 多阶段构建**：✅ `Dockerfile` 编写十分标准，采用 `base`、`deps`、`build-api/web` 分层缓存策略，最终镜像体积控制良好，安全剥离了源代码。
  - **Docker Compose 配置**：✅ `docker-compose.prod.yml` 中 Nginx 为唯一暴露入口，PostgreSQL/Redis/MinIO 采用健康检查确保依赖顺序，命名卷持久化符合生产要求。
  - **反向代理与安全**：✅ `nginx/default.conf` 实现了 API 反向代理与 Vue SPA fallback 支持，并包含 HTTPS 配置预留（`ssl.conf`）。
  - **配置解耦**：✅ `.env.production.example` 占位符完善。
  - **环境兼容修复**：✅ 针对 `Node 18 Alpine` 的 `@nestjs/schedule` 依赖缺失 `globalThis.crypto` 的问题提供了有效的 polyfill 并在回执中做了清晰记录。
  - **部署脚本**：✅ `scripts/deploy.sh` 具备权限校验及多阶段控制，可顺利支持持续部署流水线。
- **总结**：交付物专业性极高，符合业界生产级最佳实践。
- **TASK-201 状态**：✅ 已关闭
