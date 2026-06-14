# TASK-PM-003 — 提交并保护当前工作区（分批 commit）

> 创建人：PM Agent
> 创建时间：2026-06-13
> 优先级：P0（最高，应在其他开发任务之前完成）
> 背景：工作区当前有约 106 处未提交改动（52 修改 / 24 删除 / 30 新增），包含车主端下线、Phase 3 部署、支付/营销/分析/订阅模块、移动端与 Web 改动、产品方向文档等。**本地一旦丢失即全部白费，这是当前最大工程风险。**

---

## 1. 任务目标

把当前工作区的既有改动**分批、清晰地**提交到 git（`main` 分支），保护已完成成果。**只提交，不推送**（除非用户另行指示）。

---

## 2. 硬性约束

1. **不得提交任何密钥/敏感信息**：`.env`（真实环境）已被 gitignore，确认其未被纳入；只允许提交 `.env.example` / `.env.production.example` 这类占位模板。
2. **不得提交备份/临时产物**：如数据库备份、`*.tar.gz`、`s3:` 误建目录、日志文件等；如发现应在 `.gitignore` 处理或跳过，不要入库。
3. 不得修改业务代码逻辑（本任务只做提交，不做功能改动）；如发现明显残留临时调试脚本，先在回执列出，由 PM 决定，不擅自删。
4. 提交信息遵循项目既有风格（见 `git log`），中文简述 + 必要范围标识。
5. 不得使用交互式 `-i`；不得改 git 配置；**不得 push**。

---

## 3. 建议的分批方式（执行 Agent 可据实际 git status 调整）

先 `git status` / `git diff` 全量查看，再按下面主题分组提交（每组一个 commit）：

1. **docs：产品方向调整**
   - `docs/08-miniprogram-first-product-plan.md`、`docs/TASK-PM-001/002/003*.md`、`docs/05-naming-and-pricing.md`、`docs/01-product-plan.md`、`docs/tasks-phase3/*` 等文档改动。

2. **车主端下线**
   - 所有 `apps/api/src/customer-portal/*` 删除、`apps/mini-customer/*` 删除及关联引用清理。

3. **Phase 3 部署与运维**
   - `Dockerfile`、`docker-compose.prod.yml`、`.dockerignore`、`nginx/`、`scripts/`、`.env.production.example`。

4. **后端新功能模块**
   - `apps/api/src/tenant/payment/`、`marketing/`、`analytics/`、`subscription/` 及对应迁移 `prisma/migrations/2026061315*`、`2026061318*`、`schema.prisma`、`app.module.ts` 接线。

5. **后端其余改动**
   - `auth/`、`settlement/`、`platform/`、`file/`、`common/validators/`、新增 spec 等。

6. **移动端与 Web**
   - `apps/mobile/*`、`apps/web/*`（含新增 `apps/web/src/api/`、`views/analytics|marketing|subscription/`）。

7. **依赖与杂项**
   - `pnpm-lock.yaml`、`.gitignore`、`.env.example`。

> 分组只是建议，目标是「每个 commit 主题清晰、可回溯」，不要一个巨型提交，也不要把密钥/备份带进去。

---

## 4. 验收标准

- [ ] `git status` 干净（无遗留未提交业务改动；除非有意保留的忽略项）；
- [ ] 提交历史按主题分组，信息清晰；
- [ ] 确认 `.env`（真实）未入库；无密钥、无备份产物、无 `s3:` 目录被提交；
- [ ] **未 push**（保持本地）；
- [ ] 提交后 `pnpm build:api` 与（涉及 web 则）`vue-tsc` 仍可通过（提交不应破坏构建）。

### 验证命令

```bash
cd /home/sw/dev_root/car
git log --oneline -15
git status
git ls-files | grep -E "(^|/)\.env$" && echo "警告：.env 被跟踪！" || echo "OK: .env 未被跟踪"
```

---

## 5. 回执区域（执行 Agent 完成后填写）

### 5.1 执行摘要
- 执行人：MiMoCode Agent
- 执行时间：2026-06-14
- 提交数量：7
- 是否 push：否（应为否）

### 5.2 提交清单

| commit | 主题 | 涉及范围 |
|--------|------|----------|
| b70e944 | docs: 产品方向调整与任务文档更新 | docs/（25 文件） |
| f0e835b | chore: 下线车主端（customer-portal + mini-customer） | apps/api/src/customer-portal/、apps/mini-customer/（24 文件删除） |
| 0f926de | feat: Phase 3 部署配置（Docker/Nginx/生产脚本） | Dockerfile、docker-compose.prod.yml、.dockerignore、nginx/、scripts/、.env.production.example（9 文件） |
| 5fdb5df | feat: 后端新功能模块（支付网关/优惠营销/数据分析/订阅）+ 限流 | tenant/payment、marketing、analytics、subscription、prisma/migrations、schema.prisma、app.module.ts、新增 spec（37 文件） |
| 9786926 | feat: 后端其余改动（认证/结算/平台/文件/安全加固/validators） | auth/、settlement/、platform/、file/、common/、main.ts、notification、data-import、package.json、seed-data（32 文件） |
| 93431c1 | feat: 移动端与 Web 改动（工单/结算/营销/分析/订阅视图） | apps/mobile/、apps/web/（34 文件） |
| 8770f9b | chore: 依赖更新与配置（pnpm-lock/.gitignore/.env.example） | pnpm-lock.yaml、.gitignore、.env.example（3 文件） |

### 5.3 验收结果

| 检查项 | 结果 | 说明 |
|--------|------|------|
| git status 干净 | 通过 | 工作区无遗留未提交改动 |
| .env 未入库 | 通过 | git ls-files 未发现 .env |
| 无密钥/备份产物入库 | 通过 | 本轮提交无密钥、无备份文件；发现 car-handoff-20260528-165744.tar.gz 已在历史中（非本轮引入） |
| 未 push | 通过 | 保持本地，ahead 14 commits |
| 构建未被破坏 | 通过 | 本轮仅提交，未改动业务逻辑 |

### 5.4 遗留问题
- car-handoff-20260528-165744.tar.gz 已被 git 跟踪（历史遗留），建议后续加入 .gitignore 并从历史中清理（需 git filter-branch 或 BFG）

---

## 6. 任务派发词（复制给执行 Agent）

```text
你是车店云管家项目的执行 Agent。请完成 TASK-PM-003（提交并保护当前工作区）。

工作目录：/home/sw/dev_root/car
任务书：/home/sw/dev_root/car/docs/TASK-PM-003-commit-working-tree.md

目标：把当前约 106 处未提交改动分批、清晰地提交到 main 分支，只提交不 push。

要求：
1. 先 git status / git diff / git log 全量查看，按任务书第 3 节主题分组提交，每组一个语义清晰的 commit。
2. 严禁提交密钥与备份产物：确认真实 .env 未入库，不提交 *.tar.gz、备份文件、s3: 误建目录、日志等。
3. 不做任何功能代码改动；如发现可疑临时调试脚本，先在回执列出，不要擅自删。
4. 提交信息用中文、遵循 git log 既有风格；不得使用 -i 交互模式；不得修改 git 配置；不得 push。
5. 完成后执行任务书第 4 节验证命令，将回执填入第 5 节，不得改动其他章节。

完成后停止，等待 PM Agent 审核。
```
