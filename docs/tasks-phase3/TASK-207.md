# TASK-207：移动端完善（简易模式适配 / 工单优化 / 推送通知）

> **优先级**：P1
> **状态**：✅ 已关闭
> **依赖**：TASK-203（简易模式 flag 缓存）
> **可并行**：TASK-205、TASK-206

## 1. 任务目标

当前移动端（`apps/mobile`）已具备基础功能，但未跟进 Phase 2 的核心改动，特别是"简易模式"无法在移动端生效，导致小店技师依然需要面对繁琐的派工流程。此外，日常使用的易用性（扫码录入、推送通知）也有待提升。
本任务旨在将移动端完善为生产可用的版本，提升一线技师的操作体验。

## 2. 涉及文件

### 新建文件
- 视具体页面拆分情况而定，如新增 `pages/marketing/` 相关占位（可选）或推送模块

### 修改文件
- `apps/mobile/src/pages/work-order/list.vue`
- `apps/mobile/src/pages/work-order/detail.vue`
- `apps/mobile/src/pages/work-order/create.vue`
- `apps/mobile/src/store/user.ts` (或保存 feature flag 的地方)
- `apps/mobile/src/App.vue` (全局推送轮询/WebSocket 初始化)

## 3. 详细要求

### 3.1 简易模式适配

移动端需在应用启动或登录后，拉取租户的 `simple_mode` 功能开关状态，并保存在全局状态（如 Pinia store）中。
根据该状态，对 UI 进行裁剪：
- **工单列表**：如果 `simple_mode` 为 true，隐藏"去派工"、"车辆检查"等需要流转状态的按钮。
- **工单详情**：如果 `simple_mode` 为 true，提供"一键完工"按钮，直接调用后端支持简易模式的完工接口（TASK-108 已实现后端的兼容）。

### 3.2 工单流程优化

- **扫码录入 VIN**：在车辆录入或工单创建页面，增加调用 `uni.scanCode` 的能力，自动将扫描到的内容填入 VIN 输入框。
- **状态筛选 Tab**：工单列表页顶部增加滑动 Tab（全部、待派工、施工中、待结算、已完工等），方便技师快速过滤。
- **施工进度展示**：工单详情中，增加配件用量及服务项目的进度勾选或状态展示。

### 3.3 推送通知机制

为保证派工后技师能及时收到通知：
- 采用短轮询（每 1 分钟拉取一次 `/api/notifications/unread`）或 WebSocket（如后端已配网关）。
- 当有分配给当前技师的新工单时，调用 `uni.showToast` 或本地系统通知（条件允许下）。

### 3.4 UI 体验优化

- **底部导航栏**：确保全局包含 工作台 / 工单 / 客户 / 我的 导航。
- **刷新体验**：列表页启用下拉刷新（`onPullDownRefresh`）和上拉加载更多（`onReachBottom`）。
- **离线提示**：监听 `uni.onNetworkStatusChange`，断网时在页面顶部显示红色提示条。

## 4. 验收标准

- [ ] 开启简易模式的租户，技师在移动端创建工单后能直接"一键完工"。
- [ ] 能够成功调用设备摄像头扫码解析字符串填入表单。
- [ ] 工单列表支持按状态 Tab 快速切换，并可上拉加载分页。
- [ ] 模拟新分配工单后，移动端能在 1 分钟内弹出提示。
- [ ] 编译 H5 及 Android 平台均无报错。

## 5. 注意事项

- **技术栈限制**：必须保持纯 Web / uni-app API 实现，**不要**引入复杂的原生插件（除非 uni-app 内置如 scanCode），确保 H5 版本也能大部分兼容。
- 不要在移动端硬编码任何后端逻辑，必须通过已有或新增的 `/api/` 接口交互。

---

## 6. 回执区域（Agent 完成后填写）

> **Agent 请在完成任务后，将以下表格填写完整并追加到本文件此节：**

| 项目 | 内容 |
|------|------|
| 修改的文件列表 | `apps/mobile/src/stores/auth.ts`（新增 simpleMode/flagsLoaded 状态 + fetchFeatureFlags 方法）, `apps/mobile/src/App.vue`（新增通知轮询 + 离线检测 + feature flag 拉取）, `apps/mobile/src/pages.json`（新增 tabBar + workorder/list 路由）, `apps/mobile/src/pages/workorder/create.vue`（新增 VIN 扫码输入 + scanVin 方法）, `apps/mobile/src/pages/workorder/detail.vue`（新增 simpleMode 条件渲染 + quickCompleteOrder + 一键完工按钮 + 样式）, `apps/mobile/src/pages/workorder/list.vue`（新建工单列表页）, `apps/mobile/src/pages/tasks/tasks.vue`（新增下拉刷新 + scroll-view）, `apps/mobile/src/pages/index/index.vue`（菜单项更新为工单管理） |
| 新建的文件列表 | `apps/mobile/src/pages/workorder/list.vue`（工单列表页，含状态 Tab 筛选、简易模式一键完工、下拉刷新、上拉加载）, `apps/mobile/src/static/tabs/home.png`, `apps/mobile/src/static/tabs/work.png`, `apps/mobile/src/static/tabs/customer.png`, `apps/mobile/src/static/tabs/profile.png`（TabBar 占位图标） |
| 构建是否通过（H5 + vue-tsc） | ✅ `npx uni build` (H5) 编译通过；✅ `vue-tsc --noEmit` 通过 |
| 测试是否通过（新增用例数） | ✅ 213 个 API 测试全部通过（24 suites），移动端为 uni-app 无独立测试套件 |
| 已知限制或遗留问题 | 1) TabBar 图标为 1x1 占位 PNG，后续需替换为正式设计图标；2) 推送轮询间隔 60 秒，如后端提供 WebSocket 可升级为实时推送；3) `scanCode` 在 H5 模式下由浏览器 Web API 降级，App 原生模式体验更佳；4) 离线检测依赖 `uni.onNetworkStatusChange`，H5 部分浏览器可能不支持该事件 |
| 执行耗时 | 约 15 分钟 |

### 各项功能实现详情

#### 3.1 简易模式适配
- `stores/auth.ts`：新增 `simpleMode` / `flagsLoaded` ref，登录成功后自动调用 `fetchFeatureFlags()` 拉取 `/api/feature-flags/my` 接口
- `detail.vue`：派工指派表单在 `simpleMode` 时隐藏（`v-if="!simpleMode && ..."`），新增黄色「一键完工」按钮调用 `/api/work-orders/:id/complete`
- `list.vue`：工单卡片在简易模式下底部显示绿色「一键完工」按钮

#### 3.2 工单流程优化
- **扫码录入 VIN**：`create.vue` 新增 VIN 输入框 + 📷 扫码按钮，调用 `uni.scanCode` 解析后自动填入 VIN 字段
- **状态筛选 Tab**：`list.vue` 顶部可横向滚动 Tab（全部/待派工/待开工/施工中/待结算/已完工），切换时重新拉取数据

#### 3.3 推送通知机制
- `App.vue`：应用启动时启动 60 秒定时轮询 `/api/notifications/unread`，检测到新的派工通知时弹出 `uni.showToast` 提示

#### 3.4 UI 体验优化
- **底部导航栏**：`pages.json` 配置 tabBar 四项：工作台 / 工单 / 客户 / 我的
- **下拉刷新**：`list.vue` 和 `tasks.vue` 使用 `scroll-view` + `refresher-enabled` 实现下拉刷新
- **离线提示**：`App.vue` 监听 `uni.onNetworkStatusChange`，断网时顶部显示红色提示条

---

## 7. 架构师审核区域

> 审核人填写，Agent 请勿改动此节。

### 产品经理审核记录（2026-06-13）

- **审核结论**：✅ 通过
- **核对项目**：
  - **简易模式适配**：✅ `stores/auth.ts` 中成功拉取了 `simpleMode` 配置，`detail.vue` 和 `list.vue` 均实现了基于该状态的 UI 裁切与“一键完工”直达。
  - **扫码与交互优化**：✅ `create.vue` 成功对接 `uni.scanCode`，列表状态 Tab 以及下拉刷新均落实。
  - **推送与离线提示**：✅ 采用 60 秒轮询的方式低成本实现了分配通知触达，离线监听 `uni.onNetworkStatusChange` 补充了异常场景体验。
  - **跨平台兼容**：✅ 遵循了 uni-app 开发规范，H5 构建无报错。
- **复核意见**：虽然 WebSocket 是更好的实时推送方案，但目前的 60 秒轮询在初期阶段已经足够解决“技师不知道来了新工单”的核心痛点。任务目标均已达成。
- **TASK-207 状态**：✅ 已关闭
