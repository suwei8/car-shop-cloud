# 数据库备份与恢复操作手册

## 概述

本目录包含 PostgreSQL 数据库的自动备份与恢复脚本，用于保障车店云管家的数据安全。

### 文件清单

| 文件 | 用途 |
|------|------|
| `pg-backup.sh` | 自动备份脚本（pg_dump + gzip 校验 + S3 上传 + 旧文件清理） |
| `pg-restore.sh` | 恢复脚本（恢复到新库，拒绝覆盖生产库） |
| `backup-cron.example` | crontab 定时任务配置示例 |

## 备份原理

1. 使用 `pg_dump -Fc` 导出自定义格式 dump（支持并行恢复、选择性恢复）
2. 通过 `pg_restore --list` 校验 dump 文件完整性
3. 双份留存：
   - 本地目录 `BACKUP_LOCAL_DIR`（默认 `/var/backups/carshop`），保留最近 **14 天**
   - S3/MinIO 对象存储 `BACKUP_S3_BUCKET/backups/`，保留最近 **90 天**
4. 失败时退出码非 0，错误写入日志 `backup.log`，并可选通过 webhook 告警

## 环境变量配置

在 `.env` 或 export 中配置以下变量：

```bash
# 必需（通常已存在于 .env）
DATABASE_URL=postgresql://car_admin:xxx@localhost:5432/car_shop?schema=public
POSTGRES_USER=car_admin
POSTGRES_PASSWORD=xxx

# 备份目录（可选，默认 /var/backups/carshop）
BACKUP_LOCAL_DIR=/var/backups/carshop

# 本地保留天数（可选，默认 14）
BACKUP_RETENTION_DAYS=14

# S3/MinIO 配置（可选，不设置则跳过 S3 上传）
BACKUP_S3_BUCKET=car-shop
BACKUP_S3_ENDPOINT=http://localhost:9000
BACKUP_S3_ACCESS_KEY=car_minio_admin
BACKUP_S3_SECRET_KEY=xxx
BACKUP_S3_REGION=us-east-1

# 失败告警 webhook（可选，为空则跳过）
BACKUP_ALERT_WEBHOOK=https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx

# Docker 容器名（可选，默认 car-postgres）
PG_CONTAINER=car-postgres
```

## 使用方法

### 执行备份

```bash
# 方式一：直接执行
source .env
./scripts/backup/pg-backup.sh

# 方式二：通过 docker 执行（推荐生产环境）
docker exec -i car-postgres bash -c 'source /env.sh && /scripts/backup/pg-backup.sh'
```

### 执行恢复

```bash
# 恢复到新库
source .env
./scripts/backup/pg-restore.sh /var/backups/carshop/carshop_20260101_033000.dump carshop_restore_test

# 脚本会自动：
# 1. 检查目标库名 ≠ 生产库名（否则拒绝执行）
# 2. 创建目标数据库
# 3. pg_restore 恢复数据
# 4. 对比关键表行数
```

### 灾难恢复演练步骤

> 建议每月至少执行一次灾难恢复演练。

1. **获取最新备份**：
   ```bash
   ls -lt /var/backups/carshop/carshop_*.dump | head -1
   ```

2. **恢复到测试库**：
   ```bash
   source .env
   ./scripts/backup/pg-restore.sh /var/backups/carshop/carshop_YYYYMMDD_HHMMSS.dump carshop_restore_test
   ```

3. **抽查关键表行数**：
   ```bash
   docker exec car-postgres psql -U car_admin -d carshop_restore_test -c "
   SELECT 'tenants' as tbl, count(*) FROM tenants
   UNION ALL SELECT 'work_orders', count(*) FROM work_orders
   UNION ALL SELECT 'stored_value_cards', count(*) FROM stored_value_cards;
   "
   ```

4. **与生产库对比**：
   ```bash
   docker exec car-postgres psql -U car_admin -d car_shop -c "
   SELECT 'tenants' as tbl, count(*) FROM tenants
   UNION ALL SELECT 'work_orders', count(*) FROM work_orders
   UNION ALL SELECT 'stored_value_cards', count(*) FROM stored_value_cards;
   "
   ```

5. **确认行数一致后清理测试库**：
   ```bash
   docker exec car-postgres psql -U car_admin -d postgres -c "DROP DATABASE carshop_restore_test;"
   ```

## 安装 crontab 定时任务

```bash
# 编辑 crontab
crontab -e

# 添加以下行（每日 03:30 自动备份）
30 3 * * * cd /home/sw/dev_root/car && source .env && ./scripts/backup/pg-backup.sh >> /var/backups/carshop/cron.log 2>&1
```

> 参考 `backup-cron.example` 获取完整配置。

## 外部拨测告警

### 方案一：UptimeRobot（推荐）

1. 注册 [UptimeRobot](https://uptimerobot.com/)
2. 添加 HTTP(s) 监控：
   - URL: `https://your-api.com/api/health`
   - Interval: 5 minutes
3. 配置通知渠道（邮件、企业微信等）

### 方案二：cron + curl

```bash
# 每 5 分钟检查健康状态
*/5 * * * * curl -sf https://your-api.com/api/health | jq -e '.status == "ok"' || curl -X POST "$ALERT_WEBHOOK" -d '{"text":"API 健康检查失败"}'
```
