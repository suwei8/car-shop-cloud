# TASK-H-016 小程序主路径 API 对齐审计与一键完工修正

## 背景

当前产品方向要求小程序承接门店日常 90% 高频操作：注册开户、客户车辆、快速开单、服务/配件、完工、收款/欠款、库存、老板看账和订阅续费。

硬化任务完成到 `TASK-H-015` 后，下一步需要从“后端约束正确”推进到“小程序主路径能按现有 API 真实走通”。本任务先做轻量审计，并修正审计中发现的高影响接口不一致问题。

## 审计结论

### 已覆盖主路径

| 主路径环节 | 小程序页面 | 后端 API | 结论 |
| --- | --- | --- | --- |
| 登录/微信登录/注册开户 | `pages/login/login.vue`, `pages/onboarding/index.vue` | `POST /api/auth/login`, `POST /api/auth/wechat/login`, `POST /api/auth/register/send-code`, `POST /api/auth/wechat/bind` | 已接入 |
| 老板工作台 | `pages/index/index.vue` | `GET /api/dashboard/overview`, `GET /api/dashboard/recent-orders` | 已接入 |
| 客户车辆查询 | `pages/search/search.vue` | `GET /api/vehicles`, `GET /api/vehicles/search`, `GET /api/work-orders?vehicleId=...` | 已接入 |
| 快速开单 | `pages/workorder/create.vue` | `POST /api/customers`, `POST /api/vehicles`, `POST /api/work-orders` | 已接入 |
| 服务/配件选择 | `pages/workorder/create.vue` | `GET /api/service-items`, `GET /api/parts` | 已接入 |
| 工单列表/详情 | `pages/workorder/list.vue`, `pages/workorder/detail.vue` | `GET /api/work-orders`, `GET /api/work-orders/:id` | 已接入 |
| 派工/施工 | `pages/tasks/tasks.vue`, `pages/workorder/detail.vue` | `GET /api/dispatch/my-tasks`, `PUT /api/dispatch/:id/start`, `PUT /api/dispatch/:id/complete` | 已接入 |
| 收款/反结算 | `pages/workorder/detail.vue` | `POST /api/settlements`, `POST /api/settlements/:id/reverse` | 已接入 |
| 储值/次卡 | `pages/member/card.vue`, `pages/search/search.vue` | `GET /api/stored-value-cards`, `POST /api/stored-value-cards/:id/recharge`, `GET /api/package-cards` | 已接入 |
| 库存 | `pages/stock/list.vue` | `GET /api/parts`, `POST /api/parts`, `PUT /api/parts/:id`, `POST /api/stock/in` | 已接入 |
| 订阅续费 | `pages/profile/profile.vue` | `GET /api/subscription/current`, `GET /api/subscription/plans`, `POST /api/subscription/orders`, `POST /api/subscription/orders/:id/pay` | 已接入 |

### 本次发现并修正的问题

小程序“一键完工”原先调用：

```text
PUT /api/work-orders/:id/complete
```

但后端 `WorkOrderController` 实际提供的是：

```text
PUT /api/work-orders/:id/status
body: { "status": "completed" }
```

因此本任务已将：

- `pages/workorder/list.vue` 的一键完工；
- `pages/workorder/detail.vue` 的一键完工；

统一改为调用 `PUT /api/work-orders/:id/status` 并传入 `{ status: 'completed' }`。

## 后续建议

下一步建议开 `TASK-H-017`：灰度 smoke 链路补强。重点不是继续人工审计页面，而是让 smoke 脚本覆盖小程序主路径对应的后端 API 链路：

1. 注册/登录；
2. 创建客户/车辆；
3. 创建工单；
4. 添加服务/配件；
5. 完工；
6. 结算收款；
7. 查询老板工作台关键指标；
8. 查询库存和质保记录。

## 修改范围

- `apps/mobile/src/pages/workorder/list.vue`
- `apps/mobile/src/pages/workorder/detail.vue`
- `docs/tasks-hardening/TASK-H-016.md`
- `docs/tasks-hardening/README.md`

## 验收命令

```bash
rg -n "work-orders/.+complete" apps/mobile/src
rg -n "work-orders/.+status" apps/mobile/src/pages/workorder/list.vue apps/mobile/src/pages/workorder/detail.vue
pnpm --filter @car/mobile run build:h5
git diff --check
```

## 回执区域

- 2026-06-17：已完成小程序主路径 API 对齐审计，并修正工单列表/详情页“一键完工”调用不存在接口的问题。
