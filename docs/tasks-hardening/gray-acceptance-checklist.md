# 灰度验收清单

> 适用版本：v0.1.0 灰度发布  
> 更新时间：2026-06-17  
> 前置说明：本轮不接入真实短信供应商（TASK-H-004 已暂缓），不接入真实支付网关。注册、验证码、支付环节均使用 mock/sandbox 方式。

---

## 1. 适用环境

| 环境 | API 地址示例 | 说明 |
|------|-------------|------|
| 本地开发环境 | `http://127.0.0.1:3000/api` | `pnpm dev:api` 启动 |
| 内部测试环境 | 由运维提供 | 部署在内网测试服务器 |
| 未来灰度环境 | 由运维提供 | 小范围门店试用 |

## 2. 前置要求

### 2.1 环境变量

```bash
# 必须
DATABASE_URL=postgresql://...    # 测试数据库
JWT_SECRET=...                   # JWT 签名密钥
SMS_PROVIDER=mock                # 短信使用 mock 模式
PAYMENT_PROVIDER=mock            # 支付使用 mock 模式

# Smoke 脚本专用
API_BASE_URL=http://127.0.0.1:3000/api
SMOKE_ALLOW_WRITE=1
SMOKE_PHONE=18800000001
SMOKE_PASSWORD=Test123456
SMOKE_CODE=123456
SMOKE_SHOP_NAME=灰度验收门店
SMOKE_SIMPLE_MODE=1               # 默认简易模式；设为 0 时按标准工单流转
```

### 2.2 灰度测试租户初始化（推荐）

运行 `seed:gray` 脚本自动创建灰度测试租户、管理员账号、门店、仓库、角色、服务项目和字典数据：

```bash
# 必须显式设置 GRAY_SEED_ALLOW_WRITE=1 才能写入数据库
GRAY_SEED_ALLOW_WRITE=1 pnpm seed:gray
```

脚本行为：
- 默认拒绝写入；不设置 `GRAY_SEED_ALLOW_WRITE=1` 时安全退出
- `NODE_ENV=production` 时默认拒绝，需额外设置 `GRAY_SEED_ALLOW_PRODUCTION=1`
- 检查手机号全库唯一，已有其他租户/平台账号占用时报错退出
- 幂等：重复执行不会创建重复租户、角色、门店、仓库、账号
- 创建完成后输出可直接执行的 `smoke:gray` 命令
- 默认启用简易模式，工单验收流转为 `confirmed → completed`；标准模式可设置 `SMOKE_SIMPLE_MODE=0`

推荐默认值：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `SMOKE_PHONE` | `18800000001` | 灰度管理员手机号 |
| `SMOKE_PASSWORD` | `Test123456` | 灰度管理员密码 |
| `SMOKE_SHOP_NAME` | `灰度验收门店` | 租户/门店名称 |
| `SMOKE_SIMPLE_MODE` | `1` | 简易模式工单流转；设为 `0` 时走标准流转 |

### 2.3 测试数据准备

| 数据项 | 要求 | 备注 |
|--------|------|------|
| 测试手机号 | 11 位中国大陆手机号 | 用于注册/登录 |
| 测试验证码 | 开发环境默认 `123456` | SMS_PROVIDER=mock 时 |
| 测试密码 | 至少 8 位，含大小写+数字 | 需满足强度校验 |
| 测试门店名 | 任意字符串 ≥2 字符 | 注册时自动创建 |
| 测试商品/配件 | 可由 smoke 脚本自动创建 | SMOKE_ALLOW_WRITE=1 时 |

### 2.4 真实短信与支付说明

- **本轮不接入真实短信供应商**。注册验证码使用 mock 模式（`SMS_PROVIDER=mock`），测试验证码为 `123456`。
- **本轮不接入真实支付网关**。支付流程使用 mock 模式（`PAYMENT_PROVIDER=mock`），不会触发真实扣款。
- 未来对接真实短信/支付时需修改 TASK-H-004 和相关配置。

---

## 3. 验收步骤

### 3.1 健康检查

| # | 操作 | 命令/API | 预期结果 | 通过 |
|---|------|----------|----------|------|
| 1 | API 健康检查 | `GET /api/health` | HTTP 200，返回 `{ status: 'ok' }` | ☐ |

### 3.2 注册/登录

| # | 操作 | 命令/API | 预期结果 | 通过 |
|---|------|----------|----------|------|
| 2 | 发送验证码 | `POST /api/auth/register/send-code` body: `{ "phone": "18800000001" }` | HTTP 200，返回成功消息 | ☐ |
| 3 | 商户注册 | `POST /api/auth/register` body: `{ "shopName": "灰度验收门店", "phone": "18800000001", "code": "123456", "password": "Test123456", "businessType": "repair", "employeeCount": 3 }` | HTTP 200，返回 token 和租户信息 | ☐ |
| 4 | 密码登录 | `POST /api/auth/login` body: `{ "phone": "18800000001", "password": "Test123456" }` | HTTP 200，返回 accessToken 和 refreshToken | ☐ |
| 5 | 获取当前用户 | `POST /api/auth/me` Header: `Authorization: Bearer <token>` | HTTP 200，返回用户信息包含 tenantId、shopId | ☐ |
| 6 | 刷新 token | `POST /api/auth/refresh` body: `{ "refreshToken": "<refreshToken>" }` | HTTP 200，返回新 token | ☐ |

**排查点**：
- 注册失败检查 `SMS_PROVIDER` 是否为 `mock`
- 登录失败检查密码强度是否满足要求（大小写+数字，≥8位）
- 401 错误检查 token 是否正确传递

### 3.3 门店基础信息

| # | 操作 | 命令/API | 预期结果 | 通过 |
|---|------|----------|----------|------|
| 7 | 查看门店列表 | `GET /api/shops` | HTTP 200，返回注册时创建的门店 | ☐ |
| 8 | 查看门店详情 | `GET /api/shops/<shopId>` | HTTP 200，返回门店详细信息 | ☐ |

**排查点**：
- 403 错误检查权限配置
- 空列表检查 tenantId 是否正确关联

### 3.4 客户与车辆建档

| # | 操作 | 命令/API | 预期结果 | 通过 |
|---|------|----------|----------|------|
| 9 | 创建客户 | `POST /api/customers` body: `{ "name": "测试客户", "phone": "13900001111", "gender": "male" }` | HTTP 201，返回客户 ID | ☐ |
| 10 | 查询客户列表 | `GET /api/customers` | HTTP 200，包含刚创建的客户 | ☐ |
| 11 | 搜索客户 | `GET /api/customers/search?keyword=13900001111` | HTTP 200，返回匹配结果 | ☐ |
| 12 | 创建车辆 | `POST /api/vehicles` body: `{ "customerId": "<customerId>", "plateNo": "京A12345", "brand": "大众", "model": "帕萨特", "vin": "LSVNF4NC5PN000001", "mileage": 50000 }` | HTTP 201，返回车辆 ID | ☐ |
| 13 | 查询车辆列表 | `GET /api/vehicles` | HTTP 200，包含刚创建的车辆 | ☐ |
| 14 | 查看车型库 | `GET /api/vehicles/brand-library` | HTTP 200，返回品牌列表 | ☐ |

**排查点**：
- 客户手机号重复检查唯一约束
- 车辆关联客户 ID 是否有效
- VIN 码格式校验

### 3.5 商品/配件入库

| # | 操作 | 命令/API | 预期结果 | 通过 |
|---|------|----------|----------|------|
| 15 | 创建配件 | `POST /api/parts` body: `{ "code": "SMOKE-001", "name": "机油滤芯", "category": "保养件", "brand": "曼牌", "unit": "个", "costPrice": 25, "salePrice": 45, "minStock": 5 }` | HTTP 201，返回配件 ID | ☐ |
| 16 | 创建服务项目 | `POST /api/service-items` body: `{ "name": "常规保养", "category": "maintenance", "unitPrice": 80 }` | HTTP 201，返回服务项目 ID | ☐ |
| 17 | 入库操作 | `POST /api/stock/in` body: `{ "shopId": "<shopId>", "items": [{ "partId": "<partId>", "quantity": 20, "unitPrice": 25 }] }` | HTTP 201，返回入库单 | ☐ |
| 18 | 查看库存余额 | `GET /api/stock/balances` | HTTP 200，对应配件库存为 20 | ☐ |
| 19 | 查看库存流水 | `GET /api/stock/movements` | HTTP 200，包含入库记录 | ☐ |
| 20 | 查看库存单据 | `GET /api/stock/bills` | HTTP 200，包含入库单 | ☐ |

**排查点**：
- 入库需要 `shopId`，确认门店已创建
- 库存数量是否正确累加
- 流水记录是否包含操作人和时间

### 3.6 创建工单

| # | 操作 | 命令/API | 预期结果 | 通过 |
|---|------|----------|----------|------|
| 21 | 创建工单 | `POST /api/work-orders` body: `{ "shopId": "<shopId>", "orderType": "maintenance", "customerId": "<customerId>", "vehicleId": "<vehicleId>", "description": "常规保养", "items": [{ "itemType": "service", "serviceItemId": "<serviceItemId>", "name": "常规保养", "quantity": 1, "unitPrice": 80 }, { "itemType": "part", "partId": "<partId>", "name": "机油滤芯", "quantity": 1, "unitPrice": 45 }] }` | HTTP 201，返回工单 ID，状态为 draft | ☐ |
| 22 | 查看工单列表 | `GET /api/work-orders` | HTTP 200，包含刚创建的工单 | ☐ |
| 23 | 查看工单详情 | `GET /api/work-orders/<workOrderId>` | HTTP 200，包含项目明细 | ☐ |

**排查点**：
- 工单项目中引用的 `partId` 和 `serviceItemId` 是否有效
- 工单状态初始值是否为 `draft`
- 客户和车辆是否正确关联

### 3.7 工单状态推进

| # | 操作 | 命令/API | 预期结果 | 通过 |
|---|------|----------|----------|------|
| 24 | 确认工单 | `PUT /api/work-orders/<workOrderId>/status` body: `{ "status": "confirmed" }` | HTTP 200，状态变为 confirmed | ☐ |
| 25 | 开始施工 | `PUT /api/work-orders/<workOrderId>/status` body: `{ "status": "in_progress" }` | HTTP 200，状态变为 in_progress | ☐ |
| 26 | 工单完工 | `PUT /api/work-orders/<workOrderId>/status` body: `{ "status": "completed" }` | HTTP 200，状态变为 completed | ☐ |

**排查点**：
- 状态流转必须按顺序：draft → confirmed → in_progress → completed
- 跳过中间状态应返回错误
- 已完工工单不可回退

### 3.8 工单出库

| # | 操作 | 命令/API | 预期结果 | 通过 |
|---|------|----------|----------|------|
| 27 | 工单出库 | `POST /api/stock/out/work-order/<workOrderId>` | HTTP 200，库存扣减 | ☐ |
| 28 | 确认库存变化 | `GET /api/stock/balances` | HTTP 200，对应配件库存减少 | ☐ |
| 29 | 确认出库流水 | `GET /api/stock/movements` | HTTP 200，包含出库记录，关联工单号 | ☐ |

**排查点**：
- 库存不足时是否正确拒绝
- 出库数量是否与工单项目一致
- 流水记录是否包含工单关联

### 3.9 结算与线下收款

| # | 操作 | 命令/API | 预期结果 | 通过 |
|---|------|----------|----------|------|
| 30 | 工单结算 | `POST /api/settlements` body: `{ "workOrderId": "<workOrderId>", "payments": [{ "payMethod": "cash", "amount": 125 }] }` | HTTP 201，返回结算单 ID | ☐ |
| 31 | 查看结算列表 | `GET /api/settlements` | HTTP 200，包含刚创建的结算单 | ☐ |
| 32 | 查看结算详情 | `GET /api/settlements/<settlementId>` | HTTP 200，包含支付明细 | ☐ |
| 33 | 查看支付状态 | `GET /api/settlements/<settlementId>/payment-status` | HTTP 200，状态为已支付 | ☐ |
| 34 | 查看收款记录 | `GET /api/settlements/payments` | HTTP 200，包含现金收款记录 | ☐ |

**排查点**：
- 线下收款（cash）不需要调用支付网关
- 结算金额是否与工单项目合计一致（扣除折扣后）
- 结算后工单状态应变为 settled

### 3.10 质保记录

| # | 操作 | 命令/API | 预期结果 | 通过 |
|---|------|----------|----------|------|
| 35 | 查询车辆质保 | `GET /api/warranty/vehicle/<vehicleId>` | HTTP 200，返回已换配件质保信息 | ☐ |
| 36 | 查询客户质保 | `GET /api/warranty/customer/<customerId>` | HTTP 200，返回客户所有车辆质保 | ☐ |

**排查点**：
- 质保记录是否在工单结算后自动生成
- 质保期限是否与配件 `warrantyMonths` 一致
- 无质保配件时应返回空列表而非错误

### 3.11 SaaS 订阅

| # | 操作 | 命令/API | 预期结果 | 通过 |
|---|------|----------|----------|------|
| 37 | 查询套餐列表 | `GET /api/subscription/plans` | HTTP 200，返回可用套餐 | ☐ |
| 38 | 查看当前订阅 | `GET /api/subscription/current` | HTTP 200，返回试用期或套餐信息 | ☐ |
| 39 | 创建订阅订单 | `POST /api/subscription/orders` body: `{ "planId": "<planId>", "months": 1, "paymentMethod": "wechat" }` | HTTP 201，返回订单 ID | ☐ |
| 40 | 发起支付 | `POST /api/subscription/orders/<orderId>/pay` body: `{ "paymentMethod": "wechat" }` | HTTP 200（mock 模式返回模拟支付链接或成功） | ☐ |
| 41 | 查询订单状态 | `GET /api/subscription/orders/<orderId>` | HTTP 200，返回订单状态 | ☐ |
| 42 | 查看订阅历史 | `GET /api/subscription/history` | HTTP 200，返回订阅记录 | ☐ |

**排查点**：
- mock 模式下支付不会真实扣款
- 新注册租户应有 30 天试用期（TRIAL_DAYS=30）
- 套餐到期后应有 7 天宽限期（GRACE_DAYS=7）

### 3.12 工作台与报表

| # | 操作 | 命令/API | 预期结果 | 通过 |
|---|------|----------|----------|------|
| 43 | 工作台概览 | `GET /api/dashboard/overview` | HTTP 200，返回今日数据 | ☐ |
| 44 | 最近工单 | `GET /api/dashboard/recent-orders` | HTTP 200，返回最近工单列表 | ☐ |
| 45 | 今日预约 | `GET /api/dashboard/today-appointments` | HTTP 200 | ☐ |
| 46 | 营业日报 | `GET /api/reports/daily?startDate=2026-01-01&endDate=2026-12-31` | HTTP 200，返回日报数据 | ☐ |

---

## 4. 自动化 Smoke 脚本

### 4.1 运行方式

```bash
# 只读检查（默认）
pnpm --filter @car/api smoke:gray

# 允许写操作（完整链路）
SMOKE_ALLOW_WRITE=1 API_BASE_URL=http://127.0.0.1:3000/api pnpm --filter @car/api smoke:gray
```

### 4.2 脚本覆盖的步骤

当 `SMOKE_ALLOW_WRITE=1` 时，脚本自动执行以下步骤：

1. 健康检查
2. 登录（使用已有测试账号）
3. 获取当前用户
4. 创建客户
5. 创建车辆
6. 创建配件
7. 创建服务项目
8. 入库操作
9. 创建工单（含项目）
10. 工单状态推进
11. 工单出库
12. 结算
13. 查询库存余额和流水
14. 查询质保
15. 查询订阅套餐

### 4.3 脚本未覆盖的人工步骤

以下步骤需人工在浏览器或 Swagger UI 中验收：

- 微信小程序登录流程
- OCR 车牌识别
- 文件上传（MinIO）
- 报表导出 Excel 下载
- 数据导入功能
- 打印功能
- 预约管理
- 调度管理
- 提醒通知
- 储值卡/套餐卡售卡和消费
- 前端页面交互体验
- 权限边界测试（不同角色访问控制）

---

## 5. 通过/失败判定

### 通过标准

- 步骤 1-46 全部通过，或明确记录为"不适用/阻塞"
- Smoke 脚本无异常退出
- 无 P0 级别 bug（核心业务流程断裂）

### 失败处理

1. 记录失败步骤编号和错误信息
2. 截图或保存 API 响应
3. 分类：环境问题 / 数据问题 / 代码 bug
4. 代码 bug 提交 issue 并标记优先级

---

## 6. 验收结果记录

| 验收人 | 日期 | 环境 | 结果 | 备注 |
|--------|------|------|------|------|
| | | | ☐ 通过 ☐ 未通过 | |

---

## 7. 风险与限制

1. **无真实短信**：注册环节使用 mock 验证码，无法验证短信通道连通性
2. **无真实支付**：支付环节使用 mock，无法验证真实资金流转
3. **无前端验收**：本清单仅覆盖 API 层面，前端 UI 交互需另行验收
4. **无并发测试**：本清单为单用户串行操作，不覆盖并发场景
5. **无数据迁移验证**：不涉及历史数据迁移场景
