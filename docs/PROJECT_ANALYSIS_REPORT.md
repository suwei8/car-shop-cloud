# 车店云管家 项目分析报告

> 分析时间：2026-06-14
> 分析对象：`/home/sw/dev_root/car/`（车店云管家 SaaS 多商户汽修门店管理系统）
> 远程服务器：`batam2-arm-ssh.555606.xyz`（Oracle Cloud ARM64, Ubuntu 22.04）
> 分析方式：通过 cloudflared 隧道 SSH 登录后实际构建、测试、读源码
> 当前状态说明：本文是 2026-06-14 的历史分析快照，不作为最新任务状态来源。最新产品方向以 `docs/09-current-product-direction.md` 为准，最新任务状态以 `docs/tasks-hardening/task-status-audit.md` 与 `docs/tasks-hardening/README.md` 为准。

---

## 一、项目概况

这是一个**质量相当高、工程化非常规范**的 SaaS 多商户汽修门店管理系统（"车店云管家"）。

| 维度 | 现状 |
|------|------|
| **技术栈** | NestJS 10 + Prisma 5 + PostgreSQL 16 + Redis 7；Vue 3 + Element Plus + Pinia；uni-app（移动端）；Docker Compose 部署 |
| **Monorepo** | pnpm workspaces：`apps/api`、`apps/web`、`apps/mobile`、`packages/shared` |
| **代码规模** | 后端 216 个 TS 文件、47 个 Prisma 模型、1051 行 schema、12 次迁移；Web 33 个 Vue 组件；移动端 8 个页面组 |
| **开发周期** | 2026-05-29 ~ 06-13（约 15 天），21 次提交，单人开发（suwei8） |
| **构建状态** | ✅ `nest build` 通过、✅ `vue-tsc` 通过 |
| **测试状态** | ✅ **26 个测试套件、254 个用例全部通过**（约 15 秒） |

---

## 二、做得好的地方（明显优于一般"开发中项目"）

1. **架构纪律性强。** 产品决策、信息架构、任务拆分、硬约束都白纸黑字写在 `docs/` 里，并按 Phase 1/2/3 + TASK 编号管理。Phase 1（7/7）和 Phase 2（11/11）任务**全部审核关闭**，有完整的"派发→执行→回执→审核→整改"闭环。

2. **硬约束被严格遵守**——这是最难做到的：
   - ✅ 所有金额字段都是 `Decimal(12,2)`，**没有任何 float 金额字段**（专门扫描了 schema）。
   - ✅ 资金相关实体都有独立流水表：`StockBill/StockMovement`、`StoredValueTransaction`、`PackageCardTransaction`、`AuditLog`，满足"资金类操作必须写流水"。
   - ✅ 租户隔离在每个 service 里**逐查询强制**（`tenantId: user.tenantId!`），并有 `applyDataScope` 做门店/员工级数据权限，不依赖前端传值。
   - ✅ 工单状态机清晰，终态（`settled`/`cancelled`）不允许流转，支持简易模式参数化。

3. **代码干净。** 全工程仅 **1 个 TODO**（阿里云短信 SDK，按 Phase 3 计划合理推迟）；非测试代码里只有一个合理的 `console.error`。

4. **生产化准备扎实。** 多阶段 Dockerfile、生产专用 `docker-compose.prod.yml`（健康检查、日志轮转、命名卷、独立网络）、`.env.production.example`（占位符模板 + `chmod 600` 提示）、一键 `scripts/deploy.sh`（参数解析 + 前置检查）。

5. **安全细节到位。** Helmet、CORS 白名单、验证码一次性消费、短信失败不影响主流程、手机号脱敏、车主 JWT 与员工 JWT 完全隔离并有测试验证。

---

## 三、需要关注的问题（按优先级）

> 本节为历史快照问题清单。部分事项已由后续 PM 任务和 hardening 任务处理，当前执行前必须先查最新任务状态。

### 🔴 P0 — 上线前必须处理

1. **75 个文件未提交、未推送。** 工作区有 +2055 行未提交改动（含 Phase 3 的 Dockerfile、支付网关迁移、部署脚本等）。本地代码丢失即全部白费，**这是当前最大风险**。建议尽快分任务提交。

2. **`apps/api/src/test-business.ts`（443 行）和 `test-new-features.ts`（311 行）是孤立临时脚本**，没有任何地方 import，却躺在源码树里。这是典型的调试残留，上线前应删除。

3. **`.env` 里存有真实开发环境密钥**（数据库密码、Redis 密码、Oracle S3 密钥、GitHub Token）。虽然 `.env` 已被 gitignore、未入库（已确认），但建议核对：这台服务器若多人可登录，明文密钥风险较高，考虑用 `chmod 600` 或迁到 secrets 管理。

### 🟡 P1 — 尽快处理

4. **没有 CI 跑测试/lint/build。** 只有 `build-apk.yml` 一个 Action（且它用的是 pnpm 8，而本地是 pnpm 10）。建议加一个 PR/push 触发的 workflow 跑 `pnpm test` + `pnpm lint` + `pnpm build`，防止回归。TASK-203 技术债清理可一并处理。

5. **奇怪的 `s3:` 目录**（根目录下名为 `s3:` 的文件夹）。这几乎肯定是某条 `aws s3` / `rclone` 命令把 `s3://bucket` 误当成本地路径建出来的。应删除，并检查上传逻辑是否有 bug。

6. **`packages/shared` 没有 `node_modules`、`tsc` 找不到**，`pnpm --filter @car/shared lint` 直接失败。需要在 shared 的 package.json 加 `typescript` devDependency 或确认 hoisting 配置。这是唯一一处"lint 跑不起来"的地方。

7. **Node 版本与声明不符。** 本地跑的是 Node v24.12.0、pnpm 10.33.0，但 `engines` 声明 `node>=18 / pnpm>=8`，CI 也用 Node 20。建议统一（要么放宽 engines，要么固定到实际运行版本）。

### 🟢 P2 — 可优化

8. **Web 端业务逻辑几乎全在 `.vue` 里**（只有 7 个独立 TS 文件）。随着复杂度增长，建议把 API 封装、类型、工具函数更多地抽到 `src/` 下的 TS 模块，便于测试和复用。

9. **测试覆盖集中在 service 层**（26 个 spec 主要覆盖核心服务）。guard、controller、端到端流程的覆盖还可加强；E2E 测试目前没有。

10. **`RELEASE_NOTES.md` 里写了演示账号密码**。对 demo 可接受，但正式上线前应清掉或改为仅 seed 时随机生成。

---

## 四、总体评价

> **这是一个完成度很高、工程素养明显超出"开发中项目"平均水平的产品。** 截至本报告生成时，项目已具备完整的多租户/SaaS 商业化基建（订阅生命周期、自助注册、数据导入、经营提醒），且硬约束执行得非常彻底。后续状态已推进到 hardening 队列：优先完成文档收口、租户隔离强约束、支付网关隔离、真实短信验证和灰度验收。产品方向已明确为面向 1-5 人小型汽修/洗美/快保店的轻量 SaaS，不做车主小程序，配件库存/供应商/质保追溯为核心能力。

**最关键的建议**：先解决 P0 的三条——**提交并推送代码**、删除孤立测试脚本、收紧 `.env` 权限，然后再按 Phase 3 的 TASK-201→203→204 最短路径上线。Phase 3 的任务拆分已经很合理，照着执行即可。

---

## 附：关键数据快照（分析当日）

| 项目 | 数值 |
|------|------|
| Git 提交数 | 21 |
| 首次提交 | 2026-05-29 |
| 最近提交 | 2026-06-13 |
| 业务模块数（apps/api/src/tenant） | 26 |
| 平台模块数（apps/api/src/platform） | 5 |
| Prisma 模型数 | 47 |
| 数据库迁移数 | 12 |
| 测试套件 / 用例 | 26 / 254（全通过） |
| 未提交改动文件数 | 75 |
| 未提交改动行数 | +2055 / -147 |
| TODO/FIXME 数（生产代码） | 1 |
