# 车店云管家 — 项目分析报告

> 生成时间：2026-06-10
> 分析人：成品架构师

## 一、项目概览

**项目名称**：车店云管家 (car-shop-cloud)
**定位**：SaaS 多商户汽服门店管理系统
**版本**：v0.1.0 (MVP 阶段)

| 端 | 技术栈 | 文件数 | 代码行数 |
|---|---|---|---|
| 后端 API | NestJS + Prisma + PostgreSQL | 125 | ~7,077 |
| Web 前端 | Vue 3 + Element Plus + Vite | 27 | ~3,416 |
| 移动端 APP | uni-app (H5 + Android WebView) | 17 | ~5,735 |
| 共享包 | @car/shared (types/constants) | 3 | 少量 |

**代码总量**：约 **16,200+ 行**（不含 Prisma schema 和迁移文件）

## 二、开发进度评估

### Sprint 完成度

| Sprint | 模块 | 完成度 | 备注 |
|---|---|---|---|
| Sprint 0 | 工程基础 / 鉴权 / 租户隔离 / 角色权限 | ~85% | 基础底座完整，JWT+Refresh Token 完备 |
| Sprint 1 | 客户车辆 / 预约接待 | ~75% | API 完整，前端页面为基础列表 |
| Sprint 2 | 维修工单 / 派工 / 健康检查 | ~70% | 状态流转、派工已实现，打印有模块 |
| Sprint 2 | 库存管理 | ~60% | 有表结构和模块目录，库存服务未见独立完整实现 |
| Sprint 3 | 结算 / 储值卡 / 套餐卡 | ~70% | 结算+储值卡逻辑较完整，套餐卡核销待完善 |
| Sprint 4 | 工作台 / 报表 | ~50% | Dashboard 已实现基础面板，报表初步 |
| Sprint 4 | APP 端 | ~55% | 登录/工单/派工/任务/搜索/会员卡 |
| 平台后台 | 商户管理 / 套餐管理 | ~60% | 有页面和 API |

**总体进度估算**：MVP 功能约完成 **65-70%**。

### 数据库设计

Prisma schema 包含 **36 个 model**，覆盖全部计划表：

- 平台级：Tenant、SubscriptionPlan、FeatureFlag
- 商户级：Shop、User、Employee、Role、Permission
- 业务级：Customer、Vehicle、Appointment、WorkOrder、DispatchTask
- 库存：Part、Supplier、Warehouse、StockBalance、StockBill、StockMovement
- 结算会员：Settlement、Payment、StoredValueCard、PackageCard
- 系统：Dictionary、SystemParameter、File、AuditLog、Sequence

Schema 设计规范：所有业务表带 `tenantId`，合理使用索引，金额字段用 `Decimal(12,2)`，有 6 个迁移文件记录演进过程。

## 三、代码质量评估

### 做得好的方面

1. **架构清晰**：monorepo 结构合理，`apps/api`、`apps/web`、`apps/mobile`、`packages/shared` 职责分明
2. **租户隔离一致**：后端所有查询强制带 `tenantId: user.tenantId!`，从 JWT 提取而非前端传入
3. **认证体系完整**：JWT + Refresh Token 双令牌机制，前端/移动端都实现了 token 自动刷新队列
4. **金额处理正确**：全局使用 `Decimal` 类型，未使用 float
5. **事务使用得当**：结算、储值卡、工单创建等关键操作都使用了 `$transaction`
6. **储值卡流水完整**：区分本金/赠送余额，消费/充值/退款均记录流水
7. **权限装饰器**：`@RequirePermissions`、`@TenantRequired`、`@CurrentUser` 等自定义装饰器，代码简洁
8. **Swagger 文档**：API 有 `@nestjs/swagger` 注解
9. **文档齐全**：6 份产品/架构文档 + 交接说明，对后续开发非常友好

### 需要改进的方面

#### 1. 零测试覆盖 — 严重

整个项目没有任何 `.spec.ts`、`.test.ts` 或 `.e2e-spec.ts` 文件。对于一个涉及金融（储值卡、结算、库存）的 SaaS 系统，这是最大的风险。

#### 2. 缺少全局异常过滤器和响应拦截器

Controller 直接返回数据，未见统一的 `{ code: 0, data, message }` 响应包装中间件（前端 `api.ts` 期望这个格式）。

#### 3. 输入校验不够严格

- Controller 层部分使用 DTO（如 `CreateWorkOrderDto`），但很多端点直接用 `@Body() body: { ... }` 内联类型
- `addItems` 端点接收 `body.items: any[]`，完全没有类型安全和校验
- `updateStatus` 接受任意字符串 status，缺少状态机校验

#### 4. 工单状态机缺失

`updateStatus` 方法只做了简单赋值，没有实现状态流转校验。产品定义了完整的状态机（draft → confirmed → dispatching → in_progress → completed → settled），但代码中任何状态都可以跳转到任何状态。

#### 5. 库存扣减未与工单施工联动

产品要求"工单确认施工/出库时直接扣库存"，但 `work-order.service.ts` 的 `updateStatus` 中未触发库存变动。

#### 6. 套餐卡核销逻辑不完整

结算服务中只处理了储值卡支付，未实现套餐卡核销（按产品要求，套餐卡应在结算时抵扣服务项目次数）。

#### 7. 移动端请求层有冗余实现

`mobile/src/utils/request.ts` 中同时实现了 XHR 和 `uni.request` 两套请求逻辑，且 `BASE_URL` 硬编码，不利于多环境部署。

#### 8. 前端缺少错误边界和加载状态

Dashboard 等页面的 `fetchData()` 没有 loading 状态和错误处理，`any` 类型使用较多。

#### 9. 缺少数据权限（行级隔离）

当前只有租户级隔离（`tenantId`），但产品要求数据范围权限：本人、所在门店、全部门店。

#### 10. CI/CD 不完整

仅有一个 `build-apk.yml` 工作流，缺少 API/Web 的构建/测试 CI 和代码质量检查。

## 四、改进建议（按优先级排序）

### P0 — 必须立即修复

| 项 | 建议 |
|---|---|
| 测试覆盖 | 优先为结算、储值卡、工单服务编写单元测试 |
| 输入校验 | 所有 Controller 端点统一使用 DTO + `class-validator` |
| 工单状态机 | 实现状态流转校验表，拒绝非法跳转 |
| 全局响应包装 | 添加 NestJS `Interceptor` 统一返回格式 |

### P1 — 短期改进

| 项 | 建议 |
|---|---|
| 库存联动 | 工单状态变更时自动扣减库存 |
| 套餐卡核销 | 结算流程中增加套餐卡次数抵扣逻辑 |
| 数据权限 | 加入 `shopId` 数据范围过滤 |
| 移动端配置化 | `BASE_URL` 改为环境变量 |
| TypeScript 严格模式 | 减少 `any` |

### P2 — 中期完善

| 项 | 建议 |
|---|---|
| CI/CD | 添加 lint → typecheck → test → build 流水线 |
| 审计日志 | 关键操作自动写入 `audit_logs` |
| 软删除 | 财务和库存相关表添加 `deletedAt` 字段 |
| 反结算权限 | 校验操作权限并记录原因 |

## 五、总结

架构设计扎实、产品规划清晰的 SaaS 汽服管理系统。数据库设计完整度高（36 表），后端模块划分合理（22 个 tenant 子模块），认证和租户隔离基础功做得到位。文档质量优秀。

主要短板：零测试覆盖是最大技术债，其次是输入校验不严、状态机缺失、库存与工单联动未打通。按当前进度，完成后续任务书后再经一轮质量加固，可达到 MVP 可用状态。
