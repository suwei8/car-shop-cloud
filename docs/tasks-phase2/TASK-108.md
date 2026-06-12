# TASK-108：简易模式（小店版功能裁剪开关）

> **优先级**：P1
> **状态**：待派发
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
| 修改的文件列表 | （填写） |
| 新建的文件列表 | （填写） |
| 简易模式一键完工 + 扣库存验证过程 | （填写，必填） |
| 普通模式回归验证（捷径被拒） | （填写，必填） |
| 构建是否通过（nest build + vue-tsc） | （填写） |
| 测试是否通过（新增用例数） | （填写） |
| 已知限制或遗留问题（应含移动端未适配） | （填写） |
| 执行耗时 | （填写） |

---

## 7. 架构师审核区域

> 审核人填写，Agent 请勿改动此节。

（待审核）
