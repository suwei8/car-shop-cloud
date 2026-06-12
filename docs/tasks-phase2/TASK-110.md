# TASK-110：经营提醒（保养 / 续卡 / 流失预警）+ 报表 Excel 导出

> **优先级**：P2
> **状态**：待派发
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
| 修改的文件列表 | （填写） |
| 新建的文件列表 | （填写） |
| 提醒规则验证过程（构造数据→生成→核对） | （填写，必填） |
| 幂等性验证 | （填写） |
| 导出文件验证 | （填写） |
| 构建是否通过（nest build + vue-tsc） | （填写） |
| 测试是否通过（新增用例数） | （填写） |
| 已知限制或遗留问题 | （填写） |
| 执行耗时 | （填写） |

---

## 7. 架构师审核区域

> 审核人填写，Agent 请勿改动此节。

（待审核）
