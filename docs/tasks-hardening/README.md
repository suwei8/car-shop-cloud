# 技术收口与上线硬化任务总览

> 来源：2026-06-16 架构复核
> 阶段目标：停止继续扩功能，先把当前小程序优先 SaaS 收口到可灰度、可上线、可维护状态。
> 产品依据：`docs/09-current-product-direction.md`

## 任务列表

| 任务 | 标题 | 优先级 | 状态 | 说明 |
|------|------|--------|------|------|
| TASK-H-001 | 低风险技术收口 | P0 | ✅ 已关闭 | shared lint、守卫去重、DTO 状态一致、环境配置、mock 支付隔离、金额解析 |
| TASK-H-002 | 租户隔离强约束设计与第一阶段落地 | P0 | ✅ 已关闭 | 统一 tenant scope/helper、迁移核心 service、增加审计脚本 |
| TASK-H-003 | 文档与任务状态二次审计 | P1 | ✅ 已关闭 | 历史任务状态已审计同步，TASK-202/H-004/H-005 继续承接上线收口 |
| TASK-H-004 | 真实短信上线验证 | P1 | ⏸ 暂缓 | 生产使用前再对接真实短信供应商；当前不执行 |
| TASK-H-005 | 灰度验收链路 | P1 | ✅ 已关闭 | 注册/登录→开单→扣库存→收款→质保→续费的灰度验收清单与脚本 |
| TASK-H-006 | 支付网关租户隔离补强 | P0 | ✅ 已关闭 | 消除 payment-gateway 三处无 tenantId 查询 warning，audit warning 降为 0 |
| TASK-H-007 | 灰度测试租户初始化 | P1 | ✅ 已关闭 | 为 smoke:gray 准备可登录测试租户/账号和基础数据，不依赖真实短信 |
| TASK-H-008 | 登录手机号归属确定性 | P0 | ✅ 已关闭 | 后端统一阻止跨租户同手机号造成登录 findFirst 不确定 |
| TASK-H-009 | 历史重复登录手机号审计 | P0 | ✅ 已关闭 | 上线前只读扫描历史重复登录手机号，输出人工处理清单 |
| TASK-H-010 | 登录手机号数据库唯一约束 | P0 | ✅ 已关闭 | 用 DB 唯一索引兜底登录手机号全局唯一，消除并发竞态 |
| TASK-H-011 | 登录手机号唯一约束错误统一映射 | P0 | ✅ 已关闭 | 把数据库手机号唯一冲突统一映射为明确业务提示 |
| TASK-H-012 | 唯一约束业务文案集中映射 | P1 | ✅ 已关闭 | 扩展 filter，对配件编码和卡号等唯一约束返回明确业务提示 |
| TASK-H-013 | 客户手机号与车牌号唯一规则对齐 | P1 | ✅ 已关闭 | 先补齐 update 路径和只读审计，再决定是否上数据库 partial unique |
| TASK-H-014 | 客户手机号与车牌号数据库兜底约束 | P0 | ✅ 已关闭 | 增加 PostgreSQL partial unique index，兜底同租户 active 手机号和车牌号唯一 |
| TASK-H-015 | 灰度环境一键复验与迁移前置检查 | P0 | ✅ 已关闭 | 新增 check:gray-ready，将 schema/build/audit/test/diff 灰度前检查固化为一键入口 |
| TASK-H-016 | 小程序主路径 API 对齐审计与一键完工修正 | P0 | ✅ 已关闭 | 审计小程序核心闭环 API，修正一键完工调用不存在接口的问题 |
| TASK-H-017 | 灰度 smoke 脚本可编译检查与链路入口补强 | P0 | ✅ 已关闭 | 修复 smoke 编译阻断，新增 smoke:gray:check 并纳入 check:gray-ready |
| TASK-H-018 | 老板首页指标数据范围收口 | P0 | ✅ 已关闭 | 补齐 dashboard 概览、最近工单和今日预约的数据范围过滤 |
| TASK-H-019 | 欠款与收款记录数据范围收口 | P0 | ✅ 已关闭 | 补齐结算详情、收款记录、支付状态和退款入口的数据范围过滤 |
| TASK-H-020 | API build 阻塞审计 | P0 | ✅ 已关闭 | 审计 pnpm build:api 的 129 个历史 TS 严格模式错误并拆分后续修复任务 |
| TASK-H-021 | Prisma Client 生成门禁补强 | P0 | ✅ 已关闭 | 新增 prisma:generate 并纳入 check:gray-ready，避免 stale client 导致 build 误报 |
| TASK-H-022 | 认证与开户 JWT payload 类型收口 | P0 | ✅ 已关闭 | 抽取 auth-payload util，统一 roles/permissions 去重、dataScope 推导和 employee audience |
| TASK-H-023 | Prisma 错误类型导入修复 | P0 | ✅ 已关闭 | 改用 runtime PrismaClientKnownRequestError，恢复全局异常过滤器编译与单测覆盖 |
| TASK-H-024 | 灰度脚本与开户订阅路径类型补强 | P0 | ✅ 已关闭 | 为登录审计、灰度 seed、微信开户注册和订阅 transaction 补齐最小类型，继续降低 API build 错误数 |
| TASK-H-025 | 平台租户概览统计类型收口 | P0 | ✅ 已关闭 | 为 tenant-stats 聚合结果补齐最小类型，消除平台概览统计隐式 any build 阻塞 |
| TASK-H-026 | 平台租户管理类型收口 | P0 | ✅ 已关闭 | 为 platform tenant transaction 和 impersonate JWT payload 复用补齐类型，消除该模块 build 阻塞 |
| TASK-H-027 | Analytics raw SQL 与聚合结果类型修复 | P0 | ✅ 已关闭 | 改用 runtime raw SQL helper 并收口工单分布聚合结果类型，消除 analytics build 阻塞 |
| TASK-H-028 | 数据导入 preview/execute 类型收口 | P0 | ✅ 已关闭 | 为客户/车辆查询结果、Set 和导入 transaction 补齐类型，消除 data-import build 阻塞 |
| TASK-H-029 | 派工 transaction 与任务状态类型收口 | P0 | ✅ 已关闭 | 为派工 create/start/complete transaction 和任务完成判断补齐类型，消除 dispatch build 阻塞 |
| TASK-H-030 | 打印数据映射类型收口 | P0 | ✅ 已关闭 | 为工单/结算打印 items、inspections、payments 映射补齐类型，消除 print build 阻塞 |
| TASK-H-031 | 提醒任务与列表映射类型收口 | P0 | ✅ 已关闭 | 为 reminder 任务生成和列表车辆映射补齐类型，消除 reminder build 阻塞 |
| TASK-H-032 | 报表服务聚合与映射类型收口 | P0 | ✅ 已关闭 | 为日报、技师、库存、客户、储值和套餐报表补齐聚合/映射类型，消除 report build 阻塞 |
| TASK-H-033 | 角色管理 transaction 类型收口 | P0 | ✅ 已关闭 | 为角色 create/update transaction 补齐 Prisma.TransactionClient，消除 role build 阻塞 |
| TASK-H-034 | 库存服务 transaction 与出入库明细类型收口 | P0 | ✅ 已关闭 | 为库存余额、工单配件行、出入库明细和 transaction 补齐类型，消除 stock build 阻塞 |
| TASK-H-035 | 储值卡 transaction 类型收口 | P0 | ✅ 已关闭 | 为售卡、充值、消费、退款 transaction 补齐 Prisma.TransactionClient，消除 stored-value-card build 阻塞 |
| TASK-H-036 | 订阅套餐与订单类型收口 | P0 | ✅ 已关闭 | 为套餐展示、订单历史和支付回调 transaction 补齐类型，消除 subscription build 阻塞 |

## MiMo 派发约定

后续可由架构师直接使用 MiMo Code 派发任务：

```bash
mimo run --dir /home/sw/dev_root/car "$(cat docs/tasks-hardening/TASK-H-001.md)"
```

如任务需要自动执行命令但边界清楚，可追加：

```bash
--dangerously-skip-permissions
```

使用该参数前必须确认任务书范围足够窄、禁止破坏性 git 命令、禁止写真实密钥、禁止改动任务书审核区。

## 验收规则

每个任务完成后，执行 Agent 必须把回执追加到任务书的“回执区域”，包括：

- 修改文件清单；
- 实际执行的命令；
- 测试结果；
- 已知限制；
- 未完成项。

架构师审核后在“审核区域”写明通过、整改或暂停。
