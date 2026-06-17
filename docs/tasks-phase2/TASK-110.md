# TASK-110：经营提醒（保养 / 续卡 / 流失预警）+ 报表 Excel 导出

> **优先级**：P2
> **状态**：✅ 已关闭
> **依赖**：TASK-101（定时任务框架）、TASK-104（通知基础设施）
> **可并行**：TASK-109

## 1. 任务目标

给小店老板"主动营销能力"：系统每天自动生成一份**今日待办回访清单**（该保养的车、快到期的卡、好久没来的客户），老板照单打电话即可。这是小店最缺、也最能体现系统价值（帮老板赚钱）的功能。同时补齐报表 Excel 导出。

## 2. 涉及文件

### 后端新建
- `apps/api/src/tenant/reminder/` — module/controller/service
- `apps/api/src/tenant/reminder/reminder-task.service.ts` — 每日生成任务（@Cron）
- Prisma migration：`Reminder` 模型

### 后端修改
- `apps/api/src/tenant/report/` — 增加导出端点（exceljs 复用 TASK-107 引入的依赖）

### 前端新建/修改（apps/web）
- `apps/web/src/views/reminders/ReminderList.vue` — 待办回访清单页 + 菜单
- `apps/web/src/views/Dashboard.vue` — 工作台增加"今日待回访"卡片
- 报表页面增加"导出 Excel"按钮

## 3. 详细要求

### 3.1 Reminder 模型

```prisma
model Reminder {
  id          String   @id @default(cuid())
  tenantId    String
  shopId      String?
  type        String   // maintenance_due, card_expiring, card_low_balance, customer_churn
  customerId  String
  vehicleId   String?
  relatedId   String?  // 套餐卡id 等
  content     String   // 提醒文案
  dueDate     DateTime // 提醒归属日期
  status      String   @default("pending") // pending, done, ignored
  handledBy   String?
  handledAt   DateTime?
  remark      String?  // 回访结果备注
  createdAt   DateTime @default(now())
  @@index([tenantId, shopId, status, dueDate])
  @@map("reminders")
}
```

### 3.2 每日生成规则（@Cron 每日 06:00，幂等：同 type+customerId+vehicleId+relatedId+dueDate 不重复生成）

| 类型 | 规则 |
|------|------|
| `maintenance_due` | 车辆最近一次保养类工单（业务类型为保养）结算日距今 ≥ 150 天（约 5 个月），或最近工单里程 + 5000km 推算到期（里程规则数据不足时仅按时间） |
| `card_expiring` | 套餐卡 `expireAt` 在未来 14 天内且剩余次数 > 0 |
| `card_low_balance` | 储值卡余额 < 100 元且状态正常 |
| `customer_churn` | 客户最近一次工单结算日距今 ≥ 90 天 |

天数阈值全部做成 SystemParameter 可配置（给默认值即可）。

### 3.3 接口与页面

- `GET /api/reminders`：按状态/类型/日期筛选，分页，带客户姓名/手机号/车牌（join 查询）；数据范围遵循现有 dataScope 规则
- `POST /api/reminders/:id/handle`：标记 done/ignored + 回访备注
- 页面：清单表格（类型徽章、客户、电话、车牌、内容、操作：标记已回访/忽略 + 备注弹窗）；一键拨号不做（Web 端），显示手机号即可
- Dashboard 卡片：今日 pending 提醒数，点击跳转清单页

### 3.4 报表 Excel 导出

- `GET /api/reports/daily/export?from=&to=` — 营业日报导出
- `GET /api/reports/technician/export?from=&to=` — 技师产值导出
- 用 exceljs 生成，响应为文件流（Content-Disposition attachment），列与页面表格一致，金额保留两位小数
- 前端按钮触发下载

### 3.5 测试

- 各提醒规则的边界测试（149/150 天、过期 13/15 天等），mock prisma
- 幂等性：同日重复运行不重复生成
- 导出：生成的 buffer 可被 exceljs 重新读取且行数正确

## 4. 验收标准

- [ ] migration 成功；手动触发生成任务（提供 `POST /api/reminders/generate` 管理端点或复用定时任务手动触发）后按规则正确产生提醒
- [ ] 重复触发不产生重复提醒
- [ ] 清单页可筛选、可标记处理并留备注；Dashboard 卡片数字正确
- [ ] 阈值通过 SystemParameter 可调
- [ ] 两个报表导出文件可正常打开且数据与页面一致
- [ ] 数据范围/租户隔离正确
- [ ] 新增测试通过；`nest build` + `vue-tsc` 通过

## 5. 注意事项

- 生成任务按租户分批处理，单租户失败不影响其他租户（try/catch 每租户）
- join 查询注意 N+1；清单接口一次查询带出客户/车辆信息
- 不在本任务实现"自动发短信给客户"——提醒是给老板看的清单；短信营销涉及合规，后续单独评估
- 金额导出使用 Decimal 转换，不出现浮点尾差

---

## 6. 回执区域（Agent 完成后填写）

> **Agent 请在完成任务后，将以下表格填写完整并追加到本文件此节：**

| 项目 | 内容 |
|------|------|
| 修改的文件列表 | `apps/api/prisma/schema.prisma`（Reminder 模型 + Customer 反向关联）, `apps/api/src/app.module.ts`（注册 ReminderModule）, `apps/api/src/tenant/report/report.service.ts`（增加 exportDailyReport / exportTechnicianReport）, `apps/api/src/tenant/report/report.controller.ts`（增加 daily/export、technician/export 端点）, `apps/api/src/tenant/dashboard/dashboard.service.ts`（增加 pendingReminders 计数）, `apps/web/src/types/models.ts`（增加 Reminder 接口、DashboardOverview 增加 pendingReminders）, `apps/web/src/views/Dashboard.vue`（增加"今日待回访"卡片）, `apps/web/src/views/reports/DailyReport.vue`（增加导出按钮）, `apps/web/src/views/reports/TechnicianReport.vue`（增加导出按钮）, `apps/web/src/router/index.ts`（增加 /reminders 路由）, `apps/web/src/layouts/MainLayout.vue`（增加经营提醒菜单项） |
| 新建的文件列表 | `apps/api/src/tenant/reminder/reminder-task.service.ts`（@Cron 每日生成 4 类提醒）, `apps/api/src/tenant/reminder/reminder.service.ts`（列表查询 + 标记处理）, `apps/api/src/tenant/reminder/reminder.controller.ts`（GET list / POST handle / POST generate）, `apps/api/src/tenant/reminder/reminder.module.ts`, `apps/api/src/tenant/reminder/reminder-task.service.spec.ts`（13 个测试）, `apps/api/src/tenant/report/report-export.service.spec.ts`（4 个测试）, `apps/web/src/views/reminders/ReminderList.vue`（提醒清单页面） |
| 提醒规则验证过程（构造数据→生成→核对） | 4 条规则均已实现并通过单测：maintenance_due（160天触发/149天不触发/无工单不触发）、card_expiring（7天到期+有余量触发/余量为0不触发/超14天窗口不触发）、card_low_balance（余额50触发/无匹配卡不触发）、customer_churn（100天触发/89天不触发/无工单不触发）。阈值通过 SystemParameter(group='reminder') 可配置。 |
| 幂等性 | 通过 findFirst+create/update 模式实现（同 type+customerId+vehicleId+relatedId+dueDate 不重复生成），单测验证已有记录时不 create 而是 update。 |
| 导出文件验证 | exceljs 生成 xlsx buffer，单测验证 buffer 可被 exceljs 重新读取且工作表数量、行数正确（营业日报含 3 个 sheet，技师产值含排名列）。前端通过 blob 下载。 |
| 构建是否通过（nest build + vue-tsc） | nest build ✅ 通过；vue-tsc --noEmit ✅ 通过 |
| 测试是否通过（新增用例数） | 17 个新测试全部通过（reminder-task: 13, report-export: 4） |
| 已知限制或遗留问题 | 1) 提醒生成是全租户串行，租户数量多时可考虑分批并发；2) Prisma migration 未执行（仅 generate），部署时需运行 `prisma migrate dev`；3) 提醒是给商户老板看的清单，自动发短信给客户不在本任务范围内。 |
| 执行耗时 | 约 15 分钟 |

### 第 2 轮整改回执

| 项目 | 内容 |
|------|------|
| 整改项 1：Prisma migration | ✅ 已完成。因 `prisma migrate dev` 在非交互环境不可用，改用 `prisma migrate diff --from-schema-datasource --to-schema-datamodel --script` 生成 SQL，手动创建 `apps/api/prisma/migrations/20260613130200_add_reminders/migration.sql`，再通过 `prisma migrate deploy` 成功应用。reminders 表已在真实数据库中创建。 |
| 整改项 2：导出日期校验→400 | ✅ 已完成。`report.controller.ts` 新增 `validateDates()` 方法，对所有接受 startDate/endDate 的端点（daily、daily/export、technician、technician/export、package-card）统一校验：缺参数返回 400「缺少 startDate 或 endDate 参数」，格式非法返回 400「startDate 或 endDate 格式无效」。E2E 实测：`curl /reports/daily/export` 无参数→HTTP 400；`?startDate=invalid`→HTTP 400。 |
| 整改项 3：真实 DB E2E 验证 | ✅ 全部通过（以下为实际执行记录，非 mock）： |
| ├ 3a. migration 建表 | `SELECT count(*) FROM reminders` → 0（表存在且为空） |
| ├ 3b. 构造数据 | INSERT customers(id='e2e-customer-1', status='active') + vehicles(id='e2e-vehicle-1') + work_orders(id='e2e-wo-1', status='settled', updatedAt=NOW()-150days) |
| ├ 3c. POST /api/reminders/generate | HTTP 200 `{"code":0,"data":{"message":"生成完毕"}}`。DB 查询结果：1 条 customer_churn 提醒，content=`E2E测试客户 已 149 天未到店消费，建议回访`，status=pending，dueDate=2026-06-13 |
| ├ 3d. 幂等验证 | 第二次 POST /api/reminders/generate → HTTP 200。DB 查询 `SELECT count(*) FROM reminders` → 仍为 1（未重复创建） |
| ├ 3e. GET /api/reminders | HTTP 200，返回分页列表含 1 条记录，customer 关联正确（name=E2E测试客户，phone=130****1111） |
| ├ 3f. GET /api/reports/daily/export?startDate=2026-06-01&endDate=2026-06-13 | HTTP 200，Content-Type=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet，Size=8271 bytes，`file` 命令识别为 Microsoft Excel 2007+ |
| ├ 3g. GET /api/reports/technician/export?startDate=2026-06-01&endDate=2026-06-13 | HTTP 200，6697 bytes，Microsoft Excel 2007+ |
| ├ 3h. 日期校验 | 缺参数→400；`startDate=invalid`→400 |
| 环境阻断修复（TASK-109 DI） | ✅ 已完成。`notification.module.ts` 注册 `WechatMpProvider` 到 providers 数组；`notification.service.ts` 构造参数加 `@Optional()` 装饰器。API 启动正常，无 DI 报错。 |
| nest build | ✅ 通过 |
| vue-tsc --noEmit | ✅ 通过 |
| 测试套件 | 18 个测试套件全部通过，163 个测试用例全部通过（含 reminder-task 13 个 + report-export 4 个） |
| E2E 测试后清理 | ✅ 已删除 e2e-customer-1 及关联的 vehicle、work_order、reminder 记录；demo 租户 subscriptionStatus 已还原为 suspended |
| 新增/修改文件（本轮新增） | `apps/api/prisma/migrations/20260613130200_add_reminders/migration.sql`（新建），`apps/api/src/tenant/report/report.controller.ts`（增加 validateDates 校验），`apps/api/src/notification/notification.module.ts`（注册 WechatMpProvider），`apps/api/src/notification/notification.service.ts`（加 @Optional()） |

---

## 7. 架构师审核区域

> 审核人填写，Agent 请勿改动此节。

### 审核结果（第 1 轮）

- **审核时间**：2026-06-13
- **审核结论**：❌ 需整改
- **审核方式**：代码审查 + 单测复跑(17/17) + nest build + 真实 HTTP 端到端实测（审核人临时建表/临时修复 DI 后跑通，事后已全部还原）
- **TASK-110 自身逻辑评价：良好**。我临时建表后实测：
  - 手动触发生成 ✅ 回溯 200 天的已结算工单正确生成 1 条 customer_churn 提醒，文案正确
  - 幂等 ✅ 二次触发仍为 1 条
  - 列表 / 标记处理(done+备注) ✅ 正常，租户隔离生效
  - 日报 / 技师产值导出 ✅ 用正确参数(startDate/endDate)返回合法 xlsx（Microsoft Excel 2007+）
  - 4 类提醒规则逻辑、阈值 SystemParameter 可配置、单租户失败隔离 ✅
- **必须整改项**：
  1. **【缺失交付物 + 必填验证未做】未生成 Prisma migration，reminders 表在数据库中不存在**。验收标准"migration 成功；手动触发生成任务后按规则正确产生提醒"未达成。回执"提醒规则验证过程"仅以 mock 单测代替真实 DB 验证，实际无法执行（表不存在）。需执行 `prisma migrate dev` 生成并提交 migration 文件，并补真实 DB 端到端验证。
- **环境阻断级问题（非 110 引入，但必须先解决，否则 110 无法上线/验证）**：
  2. **当前 API 无法启动**。工作区未提交的 TASK-109 改动给 `notification.service.ts` 注入了 `WechatMpProvider`，但 `notification.module.ts` 未注册该 provider，运行时 Nest DI 报错 `Nest can't resolve dependencies of the NotificationService ... WechatMpProvider at index [2]`。`nest build` 仅转译可通过，但 `node dist/.../main.js` 启动即崩溃。审核期间审核人临时在 module 注册该 provider 才得以启动，验证后已 git checkout 还原。此问题属 TASK-109，需在 TASK-109 复审中修复（注册 WechatMpProvider 或为构造参数加 @Optional()）。
- **次要建议（非阻塞）**：
  - 导出端点用 startDate/endDate（与现有 getDailyReport 一致）而非任务书的 from/to，属合理对齐现有约定，可接受；但建议对缺失/非法日期返回 400 而非 500（当前传 Invalid Date 会抛 Prisma 500）。
  - reminder.controller 的 handle 用内联 body 类型，建议改 DTO 以符合项目 class-validator 约定。
- **TASK-110 状态**：需整改（第 1 轮）

### 复审结果（第 2 轮 — 2026-06-13，整改后实测复核）

- **审核结论**：✅ 通过（整改通过）
- **审核方式**：真实 DB migration + API 启动 + 真实 HTTP 端到端 + 全套测试
- **复核意见**：
  - migration ✅ `20260613130200_add_reminders` 已提交，reminders 表真实存在于数据库
  - 真实端到端 ✅ 回溯 200 天工单 → POST /api/reminders/generate 真实产生 1 条 customer_churn 提醒
  - 幂等 ✅ 二次生成仍为 1 条
  - 导出 ✅ 日报导出返回合法 xlsx（Microsoft Excel 2007+）
  - 日期校验修复 ✅ 缺参数返回 400（不再 500）
  - 全套测试 ✅ 163/163 通过；nest build + vue-tsc 通过
- **TASK-110 状态**：✅ 已关闭

> 备注：审核中临时操作（建表、回溯某工单 updatedAt、置 demo 租户 active、临时改 module）均已还原：reminders 表已 DROP、临时 migration 已删、module 已 git checkout、demo 租户恢复 suspended。
