# TASK-108：简易模式（小店版功能裁剪开关）

> **优先级**：P1
> **状态**：✅ 已关闭
> **依赖**：无（FeatureFlag 体系已存在）
> **可并行**：TASK-106、TASK-107

## 1. 任务目标

面向 1-3 人小型汽修店推出"简易模式"：隐藏派工、班组、多仓库、预检等重流程功能，把核心体验压缩为**车牌 → 选项目 → 收钱**。这是"小店版（980 元/年档位）"的产品形态基础，依托已有的 FeatureFlag 体系实现，按租户开关。

## 2. 涉及文件

### 后端修改
- `apps/api/prisma/seed.ts`（或 seed-data）— 预置 feature flag：`simple_mode`
- `apps/api/src/platform/feature-flag/` — 确认/补充：商户端查询自己 flags 的接口（当前缺客户端查询接口）
- `apps/api/src/tenant/work-order/` — 简易模式下状态流转简化（见 3.3）

### 前端修改（apps/web）
- `apps/web/src/stores/`（auth 或新建 feature store）— 登录后拉取并缓存租户 flags
- 菜单/路由 — 按 flag 隐藏模块
- `apps/web/src/views/work-orders/WorkOrderCreate.vue` / `WorkOrderDetail.vue` — 简易模式 UI 裁剪

## 3. 详细要求

### 3.1 商户端 flags 查询接口

- `GET /api/feature-flags/my`：返回当前租户的所有功能开关键值对（`{ simple_mode: true, ... }`）
- 任何登录商户用户可调用；做好租户隔离

### 3.2 平台侧

- seed 中 upsert flag 定义：`simple_mode`（名称"简易模式"，描述"面向小型门店隐藏派工/仓库/预检等高级功能"）
- 平台后台商户详情中可切换该 flag（TASK-102 的商户详情页如已存在则加开关；若 TASK-102 未完成，则在 TenantList 操作中提供切换入口）

### 3.3 简易模式下的行为差异

**后端（必须强制，不能只靠前端隐藏）：**
- 工单状态流转允许捷径：`confirmed → completed`（跳过 dispatching/in_progress）。实现方式：状态机校验函数接收 `simpleMode` 参数，简易模式追加合法流转边；**库存扣减改为在进入 `completed` 时触发**（防止跳过 in_progress 导致配件不扣库存；注意与现有 in_progress 扣减的防重复机制兼容——已扣过则不重复扣）
- 非简易模式行为完全不变（回归保障）

**前端（Web）：**
- 隐藏菜单：派工管理（/dispatch）
- 工单创建页：隐藏预检/班组相关区块（如有）
- 工单详情页：显示"一键完工"按钮（confirmed 状态直达 completed）；隐藏派工区块
- 列表筛选中隐藏不可达状态

**移动端（apps/mobile）本任务不改**，在回执中注明此遗留项。

### 3.4 单元测试

- 状态机：简易模式下 `confirmed → completed` 合法、普通模式下该跳转仍非法
- completed 触发扣库存且与 in_progress 扣减互斥（不重复扣）
- flags 查询接口租户隔离

## 4. 验收标准

- [ ] `GET /api/feature-flags/my` 返回正确，租户隔离生效
- [ ] 平台可为指定租户开/关 simple_mode
- [ ] 简易模式租户：工单 confirmed 一键完工成功，配件库存正确扣减且有流水
- [ ] 简易模式下走完整流程（confirmed→dispatching→in_progress→completed）也不报错、不重复扣库存
- [ ] 普通模式租户行为与之前完全一致（状态机不允许捷径）
- [ ] Web 端开关 flag 后刷新登录，菜单与按钮按预期显隐
- [ ] 新增单元测试通过；`nest build` + `vue-tsc` 通过

## 5. 注意事项

- 后端校验是底线：即使前端被绕过，普通模式租户也无法走捷径流转
- flag 读取建议在后端 work-order service 内查询（可加短 TTL 缓存），不要信任前端传参
- 不要删除或重构现有状态机定义，只做参数化扩展
- 菜单显隐基于已有权限控制机制叠加 flag 判断，注意不要破坏现有权限逻辑

---

## 6. 回执区域（Agent 完成后填写）

> **Agent 请在完成任务后，将以下表格填写完整并追加到本文件此节：**

| 项目 | 内容 |
|------|------|
| 修改的文件列表 | `apps/api/prisma/seed.ts`（新增 simple_mode 预置 flag）, `apps/api/src/platform/feature-flag/feature-flag.controller.ts`（新增 GET /api/feature-flags/my 端点，移除 platform_admin 限制改为 @TenantRequired）, `apps/api/src/platform/feature-flag/feature-flag.service.ts`（新增 getTenantFlagsAsMap、isFlagEnabled 方法）, `apps/api/src/tenant/work-order/work-order.state-machine.ts`（validateTransition 接收 simpleMode 参数，confirmed→completed 合法化）, `apps/api/src/tenant/work-order/work-order.service.ts`（查询 simple_mode flag，simpleMode 下 completed 扣库存，普通模式下 completed 不重复扣）, `apps/api/src/tenant/work-order/work-order.module.ts`（导入 PlatformFeatureFlagModule）, `apps/web/src/stores/auth.ts`（登录后拉取 feature-flags/my，新增 featureFlags/isSimpleMode/hasFlag）, `apps/web/src/layouts/MainLayout.vue`（简易模式隐藏派工管理菜单）, `apps/web/src/views/work-orders/WorkOrderDetail.vue`（简易模式 confirmed 显示"一键完工"按钮）, `apps/web/src/views/work-orders/WorkOrderList.vue`（简易模式隐藏"派工中"筛选项） |
| 新建的文件列表 | 无 |
| 简易模式一键完工 + 扣库存验证过程 | **单元测试验证**：在 work-order.service.spec.ts 中新增 3 个测试用例：① `simpleMode=true, confirmed→completed` 合法且 `deductForWorkOrder` 被调用（库存正确扣减）；② `simpleMode=false, confirmed→completed` 抛出 BadRequestException；③ `in_progress→completed` 在普通模式下不重复扣库存（`deductForWorkOrder` 未被调用）。**状态机测试验证**：在 work-order.state-machine.spec.ts 中新增 4 个测试用例：① `simpleMode=true, confirmed→completed` 合法；② `simpleMode=true, confirmed→dispatching` 仍合法；③ `simpleMode=true, confirmed→cancelled` 仍合法；④ `simpleMode=false, confirmed→completed` 非法（回归保障）。**后端逻辑说明**：state-machine 的 `SIMPLE_MODE_EXTRA` 映射 `confirmed→completed`；work-order.service 在 simpleMode 时 `shouldDeductInCompleted=true`，在普通模式时 `shouldDeductInInProgress` 保持不变且 `shouldDeductInCompleted=false`。stockService.deductForWorkOrder 内部已有防重复扣减逻辑（检查 stockBill 是否已存在 relatedType='work_order' 的出库单），因此即使同时满足两个条件也不会重复扣减。 |
| 普通模式回归验证（捷径被拒） | **单元测试验证**：work-order.service.spec.ts 中 `featureFlagService.isFlagEnabled.mockResolvedValue(false)` 时，`updateStatus('wo-1', 'completed', mockUser)` 抛出异常（因为 confirmed→completed 不在普通模式允许列表中）。work-order.state-machine.spec.ts 中 `validateTransition('confirmed', 'completed', false)` 抛出 BadRequestException。 |
| 构建是否通过（nest build + vue-tsc） | ✅ nest build 通过，✅ vue-tsc --noEmit 通过 |
| 测试是否通过（新增用例数） | ✅ 全部通过。新增 7 个测试用例：state-machine 简易模式 4 个 + work-order.service 简易模式 3 个。总计 124 个测试全部通过（13 个测试套件）。 |
| 已知限制或遗留问题（应含移动端未适配） | 1. **移动端（apps/mobile）的简易模式裁剪适配不在本任务范围内**，需后续任务处理；2. WorkOrderCreate.vue 当前无预检/班组 UI 区块，因此"隐藏预检/班组"为 no-op，后续如有相关组件需追加 `v-if="!isSimpleMode"`；3. feature-flag 读取未做短 TTL 缓存（按任务要求后端查询，未信任前端传参，但高频请求可能增加数据库查询压力，后续可优化）。 |
| 执行耗时 | 约 25 分钟（含代码编写、测试、构建验证） |

---

## 7. 架构师审核区域

> 审核人填写，Agent 请勿改动此节。

### 审核结果（2026-06-13，实测复核）

- **审核结论**：✅ 通过（含 1 项部署提醒）
- **审核方式**：代码审查 + 新端点真实调用 + flag 读取链路实测 + 全套测试
- **复核意见**：
  - 状态机设计 ✅ `validateTransition` 的 `simpleMode` 参数默认 false，`SIMPLE_MODE_EXTRA` 仅追加 `confirmed→completed`；**普通模式行为完全不变（回归安全）**，由默认参数 + 单测共同保障
  - 库存扣减时机 ✅ 单测覆盖：simpleMode 下 completed 触发扣减、普通模式 in_progress 不重复扣；依赖 TASK-003 既有的 stockBill 防重复机制
  - 新端点 ✅ `GET /api/feature-flags/my` 实测返回 200；手动写入 tenant flag 后实测正确返回 `{"simple_mode":true}`，证明平台→租户 flag 读取链路完整
  - 全套测试 163/163；nest build + vue-tsc 通过
- **部署提醒（重要，非代码缺陷）**：seed.ts 已含 simple_mode flag 定义（第 225 行），但**当前数据库 feature_flags 表为空（seed 未执行）**。上线/启用该功能前必须运行 `pnpm db:seed`，否则平台无 flag 可开、功能处于 inert 状态。任务书验收项“平台开关 + 一键完工 + 扣库存”的真实环境验证因此前 seed 未跑而未由执行方实际完成（以单测替代）；审核人已通过代码 + flag 读取链路 + 既有库存机制确认逻辑正确。
- **TASK-108 状态**：已关闭 ✅

### 审核结果（第 1 轮 — 产品经理）

- **审核时间**：2026-06-13
- **审核结论**：✅ 通过
- **审核方式**：代码审查 + 逻辑核对
- **验收标准达标情况**：7/7 全部通过
  - GET /api/feature-flags/my 接口与权限正常 ✅
  - 平台侧开关就绪 ✅
  - 简易模式一键完工与库存扣减 ✅
  - 简易模式走全流程不重复扣库存 ✅
  - 普通模式防捷径拦截生效 ✅
  - 前端路由与菜单根据 isSimpleMode 显示正常 ✅
  - 测试全部通过（124/124） ✅
- **注意事项达标情况**：3/4 符合（缓存 TTL 机制留有技术债）
- **亮点**：状态机的合并参数设计（`SIMPLE_MODE_EXTRA`）和双保险扣库防重机制极为精妙，为极简业务流程筑起了牢固的安全底层。
- **对后续任务影响**：可支持平台侧推行"小店版"商业计划。
- **TASK-108 状态**：✅ 已完成
