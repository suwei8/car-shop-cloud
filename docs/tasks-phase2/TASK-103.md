# TASK-103：数据库自动备份与基础健康监控

> **优先级**：P0
> **状态**：✅ 已关闭（2026-06-12 审核通过）
> **依赖**：无（完全独立，可立即派发）
> **可并行**：TASK-101、TASK-102、TASK-104

## 1. 任务目标

建立数据安全底线：PostgreSQL 每日自动备份（含异地/对象存储留存）+ 可验证的恢复流程 + API 健康检查端点。商户的客户档案和储值卡余额（预收款）存在本系统中，数据丢失会直接导致商业信誉破产和法律风险。

## 2. 涉及文件

### 新建文件
- `scripts/backup/pg-backup.sh` — 备份脚本
- `scripts/backup/pg-restore.sh` — 恢复脚本
- `scripts/backup/README.md` — 备份与恢复操作手册
- `scripts/backup/backup-cron.example` — crontab 配置示例
- `apps/api/src/health/health.controller.ts` + `health.module.ts` — 健康检查端点

### 修改文件
- `docker-compose.yml` — 如需增加备份相关 volume 或服务
- `.env.example` — 备份相关环境变量
- `apps/api/src/app.module.ts` — 注册 HealthModule

## 3. 详细要求

### 3.1 备份脚本（pg-backup.sh）

- 使用 `pg_dump` 自定义格式（`-Fc`）导出，文件名含时间戳：`carshop_YYYYMMDD_HHMMSS.dump`
- 连接信息从环境变量读取（与 `.env` 共用 `DATABASE_URL` 或拆分变量），**脚本中不得硬编码密码**
- 备份后用 gzip 校验完整性（`pg_restore --list` 验证 dump 可读）
- 双份留存：
  1. 本地目录 `BACKUP_LOCAL_DIR`（默认 `/var/backups/carshop`），保留最近 14 天，过期自动清理
  2. 上传至 S3 兼容对象存储（项目已有 MinIO，使用 `mc` 或 `aws s3 cp`；bucket 通过 `BACKUP_S3_BUCKET` 配置），保留最近 90 天
- 失败时退出码非 0，并将错误写入日志文件 `BACKUP_LOCAL_DIR/backup.log`
- 可选：失败时调用 webhook 通知（`BACKUP_ALERT_WEBHOOK`，为空则跳过）——curl 一个 POST 即可，便于以后接企业微信/钉钉机器人

### 3.2 恢复脚本（pg-restore.sh）

- 用法：`pg-restore.sh <dump文件路径> <目标数据库名>`
- **必须恢复到新数据库名**，不允许直接覆盖生产库；脚本内对目标库名为生产库名（从 DATABASE_URL 解析）时直接报错退出
- README 中写明完整的"灾难恢复演练"步骤：取最新备份 → 恢复到 `carshop_restore_test` → 抽查关键表行数

### 3.3 定时调度

- 提供 `backup-cron.example`：每日 03:30 执行备份
- README 说明如何安装 crontab（不要求 agent 实际安装到系统）

### 3.4 健康检查端点（API）

- `GET /api/health`：标记 `@Public()`，返回 `{ status: 'ok', db: true|false, uptime: <秒> }`
  - db 检查：执行 `SELECT 1`（Prisma `$queryRaw`），失败时 `status: 'degraded'`、HTTP 仍返回 200 但 db: false（便于外部拨测区分进程死/库死）
- README 中说明可配合 UptimeRobot / cron + curl 做外部拨测告警

### 3.5 验证要求

Agent 必须实际执行一次完整验证（本机 docker-compose 的 PostgreSQL）：

1. 运行备份脚本生成 dump
2. 运行恢复脚本恢复到 `carshop_restore_test` 库
3. 对比源库与恢复库中 `tenants`、`work_orders`、`stored_value_cards` 三张表的行数一致
4. 将验证输出（命令与行数对比）写入回执

## 4. 验收标准

- [ ] 备份脚本可成功执行，产出可被 `pg_restore --list` 读取的 dump
- [ ] 本地保留策略（14 天清理逻辑）在脚本中实现
- [ ] S3/MinIO 上传逻辑实现（本机验证可用 docker-compose 中的 MinIO）
- [ ] 恢复脚本拒绝恢复到生产库名；恢复到新库验证通过（三表行数一致）
- [ ] 脚本无硬编码密码，全部走环境变量
- [ ] `GET /api/health` 正常返回，停掉数据库后 db 字段为 false 且不抛 500
- [ ] README 操作手册完整（备份原理、恢复演练步骤、cron 安装、告警接入）
- [ ] `nest build` 通过

## 5. 注意事项

- 脚本用 bash 编写，开头 `set -euo pipefail`
- 不要把任何备份产物提交进 git（更新 `.gitignore` 排除备份目录）
- 健康检查端点不要泄露敏感信息（不返回数据库连接串、版本细节）
- 不修改任何业务模块

---

## 6. 回执区域（Agent 完成后填写）

> **Agent 请在完成任务后，将以下表格填写完整并追加到本文件此节：**

| 项目 | 内容 |
|------|------|
| 新建的文件列表 | `scripts/backup/pg-backup.sh`, `scripts/backup/pg-restore.sh`, `scripts/backup/README.md`, `scripts/backup/backup-cron.example`, `apps/api/src/health/health.controller.ts`, `apps/api/src/health/health.service.ts`, `apps/api/src/health/health.module.ts` |
| 修改的文件列表 | `apps/api/src/app.module.ts`（注册 HealthModule）, `.env.example`（新增备份相关环境变量）, `.gitignore`（排除 `*.dump` 和 `/var/backups/carshop/`） |
| 备份→恢复验证过程与三表行数对比结果 | **验证通过**。执行步骤：① `pg-backup.sh` 执行备份，生成 `carshop_20260612_230212.dump`（147831 bytes），`pg_restore --list` 校验通过；② `pg-restore.sh /var/backups/carshop/carshop_20260612_230212.dump carshop_restore_test` 恢复到新库；③ 三表行数对比：源库 `car_shop` → tenants=2, work_orders=9, stored_value_cards=8；恢复库 `carshop_restore_test` → tenants=2, work_orders=9, stored_value_cards=8。**行数完全一致**。验证完成后已清理测试库 `carshop_restore_test`。 |
| MinIO 上传验证结果 | **验证通过**。使用 docker-compose 中的本地 MinIO（127.0.0.1:9000），mc alias set s3 指向本地 MinIO，上传至 bucket `carshop-backup/backups/carshop_20260612_230212.dump`（144.37 KiB），mc ls 确认文件已存在。 |
| /api/health 验证结果（含停库场景） | **验证通过**。① DB 正常时：`GET /api/health` 返回 HTTP 200，`{"status":"ok","db":true,"uptime":2}`；② 停止 PostgreSQL 容器后：返回 HTTP 200（非 500），`{"status":"degraded","db":false,"uptime":4}`；③ 重启 PostgreSQL 后：恢复为 `{"status":"ok","db":true,"uptime":7}`。全程未抛 500 错误。 |
| 构建是否通过 (nest build) | **通过**。`npx nest build` 无报错，产出 `dist/apps/api/src/main.js`。 |
| 已知限制或遗留问题 | 1. 宿主机 `pg_dump` 版本为 14.23，容器内 PostgreSQL 为 16；脚本通过 `docker exec` 在容器内执行 pg_dump/pg_restore，避免版本不兼容问题。2. 备份脚本的 S3 上传功能依赖 `mc` CLI 工具，生产环境需预装 mc 或改用 aws cli。3. crontab 未实际安装（任务书不要求），仅提供 `backup-cron.example` 配置示例。 |
| 执行耗时 | 约 25 分钟（含环境探查、脚本编写、备份/恢复验证、健康端点测试） |

---

## 7. 架构师审核区域

> 审核人填写，Agent 请勿改动此节。

### 审核结果

- **审核时间**：2026-06-12
- **审核结论**：✅ 通过（首轮通过）
- **审核方式**：全部独立实测复核，未依赖回执声明
- **审核意见**：
  - 备份脚本 ✅ 独立重跑成功：pg_dump(-Fc) → pg_restore --list 校验 → MinIO 上传（144.37 KiB）→ 本地 14 天清理 → S3 90 天清理，全链路通过；`set -euo pipefail`、无硬编码密码均符合要求
  - 恢复脚本 ✅ 独立验证：恢复到 carshop_restore_audit 后三表行数与生产库一致（tenants=2 / work_orders=9 / stored_value_cards=8）；以生产库名为目标时被正确拒绝
  - 版本兼容 ✅ 宿主机 pg_dump 14 vs 容器 PG 16 的问题通过 docker exec 容器内执行规避，处理得当且在回执中如实说明
  - /api/health ✅ 独立验证：DB 正常返回 `{status:'ok',db:true}`；停库后返回 `{status:'degraded',db:false}` 且 HTTP 200 不抛 500；未泄露敏感信息；@Public 标记正确
  - 工程边界 ✅ app.module.ts 仅新增 HealthModule（JwtAuthGuard 改动为本任务前已存在的未提交修改，非本任务产物）；.gitignore 排除备份产物；.env.example 已更新；无范围外改动
  - nest build ✅ 独立执行通过
- **非阻塞备注**（无需整改，记录备查）：
  1. 恢复脚本对目标库执行 `DROP DATABASE IF EXISTS`，对非生产库名有覆盖能力，操作手册使用时需注意目标库名拼写
  2. mc 上传目标写法为 `s3://bucket` 风格，实测可用；如未来更换 mc 版本需留意
- **TASK-103 状态**：已关闭 ✅
