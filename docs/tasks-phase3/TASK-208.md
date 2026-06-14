# ~~TASK-208：微信小程序完善~~ （❌ 已废弃）

> **优先级**：~~P2~~
> **状态**：❌ 已废弃（产品方向调整：不做车主小程序）
> **废弃时间**：2026-06-13
> **废弃原因**：产品方向调整为面向 1-5 人小型汽修/洗美店的轻量 SaaS，不再建设独立车主端/车主小程序。车主触达仅保留通知类能力（完工短信、取车提醒、消费提醒）。
> **替代方向**：小店主路径体验优化 / 配件库存质保追溯强化

---

> ⚠️ **本任务已取消，不得执行。** 以下内容为历史存档。

## 1. 任务目标

TASK-109 实现了车主微信小程序 MVP，包含微信登录（Mock fallback）、车辆绑定、工单查看、完工通知。但当前存在以下问题：

1. **微信登录**：当 `WX_MINI_APPID/WX_MINI_SECRET` 未配置时回退为 Mock openid（`mock_openid_{code}`），生产环境必须对接真实微信 `code2Session` 接口
2. **订阅消息**：`WechatMpProvider` 已有 `sendSubscribeMessage` 方法但模板 ID 通过环境变量配置，缺乏完整的订阅消息场景覆盖（完工通知、保养提醒、预约确认）
3. **功能缺失**：MVP 不含在线预约和电子会员卡功能，无法满足车主自助服务闭环

完成后效果：
- 小程序可直接上线微信审核，真实微信用户登录
- 车主可在小程序内预约维修保养
- 车主可查看会员卡余额/消费记录，在线充值
- 系统可向已授权用户推送订阅消息（完工通知、保养提醒、预约确认）

## 2. 涉及文件

### 新建文件
- `apps/mini-customer/src/pages/appointment/index.vue` — 预约首页（选择门店/服务/时段）
- `apps/mini-customer/src/pages/appointment/confirm.vue` — 预约确认页
- `apps/mini-customer/src/pages/cards/index.vue` — 电子会员卡首页（储值卡 + 套餐卡总览）
- `apps/mini-customer/src/pages/cards/stored-value-detail.vue` — 储值卡详情（余额 + 充值/消费记录）
- `apps/mini-customer/src/pages/cards/package-detail.vue` — 套餐卡详情（剩余次数 + 使用记录）
- `apps/mini-customer/src/pages/cards/recharge.vue` — 储值卡在线充值页
- `apps/api/src/customer-portal/dto/appointment.dto.ts` — 预约相关 DTO
- `apps/api/src/customer-portal/dto/card.dto.ts` — 会员卡相关 DTO

### 修改文件
- `apps/api/src/customer-portal/customer-portal-auth.service.ts` — 确保真实微信登录无 mock 逻辑残留、增加 unionid 存储
- `apps/api/src/customer-portal/customer-portal.controller.ts` — 新增预约和会员卡相关端点
- `apps/api/src/customer-portal/customer-portal.service.ts` — 新增预约创建、会员卡查询、充值记录/消费记录查询
- `apps/api/src/customer-portal/customer-portal.module.ts` — 注册新依赖（NotificationModule、PaymentModule）
- `apps/api/src/notification/providers/wechat-mp.provider.ts` — 增加 `code2Session` 方法、完善订阅消息模板数据构建
- `apps/api/src/notification/notification.service.ts` — 增加预约确认、保养提醒的消息场景
- `apps/api/prisma/schema.prisma` — Appointment 表增加 `source` 字段
- `apps/mini-customer/src/pages.json` — 注册新页面路由
- `apps/mini-customer/src/pages/index/index.vue` — 首页增加"预约"入口和会员卡入口
- `apps/mini-customer/src/pages/my/index.vue` — "我的"页面增加会员卡入口
- `.env.example` — 增加微信订阅消息模板 ID 配置项

## 3. 详细要求

### 3.1 真实微信登录对接

当前 `customer-portal-auth.service.ts` 中 `wxLogin` 方法已有真实和 Mock 两条路径。需要做以下调整：

**3.1.1 将 code2Session 抽入 WechatMpProvider**

在 `wechat-mp.provider.ts` 中新增方法：

```typescript
async code2Session(code: string): Promise<{ openid: string; unionid?: string; sessionKey: string }> {
  if (!this.isConfigured()) {
    throw new Error('WeChat MP not configured');
  }

  const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${this.appId}&secret=${this.appSecret}&js_code=${code}&grant_type=authorization_code`;
  const res = await fetch(url);
  const data = await res.json() as any;

  if (data.errcode) {
    throw new Error(`code2Session failed: ${data.errmsg}`);
  }

  return {
    openid: data.openid,
    unionid: data.unionid || undefined,
    sessionKey: data.session_key,
  };
}
```

**3.1.2 修改 wxLogin 方法**

```typescript
async wxLogin(code: string): Promise<{ openid: string; bound: boolean; token?: string }> {
  let openid: string;
  let unionid: string | undefined;

  if (!this.wechatMpProvider.isConfigured()) {
    // 仅开发环境允许 mock，生产环境必须配置
    const nodeEnv = this.config.get<string>('NODE_ENV', 'development');
    if (nodeEnv === 'production') {
      throw new BadRequestException('微信登录未配置，请联系管理员');
    }
    this.logger.warn('WX_MINI_APPID/SECRET not configured, using mock openid for development');
    openid = `mock_openid_${code}`;
  } else {
    const session = await this.wechatMpProvider.code2Session(code);
    openid = session.openid;
    unionid = session.unionid;
  }

  // ... 后续绑定查找逻辑不变
}
```

**3.1.3 unionid 处理**

在 `bindAndLogin` 方法中，创建 `CustomerWxBinding` 时如果有 unionid 也一并存入：

```typescript
await this.prisma.customerWxBinding.create({
  data: {
    tenantId: customer.tenantId,
    customerId: customer.id,
    openid,
    unionid: unionid || null,
  },
});
```

**3.1.4 环境变量**

在 `.env.example` 中确认已有以下配置项（TASK-109 已添加，核实即可）：

```bash
# 微信小程序
WX_MINI_APPID=
WX_MINI_SECRET=
JWT_CUSTOMER_SECRET=
```

### 3.2 微信订阅消息完善

**3.2.1 订阅消息模板配置**

在 `.env.example` 中新增：

```bash
# 微信订阅消息模板 ID
WX_TPL_WORK_ORDER_COMPLETED=   # 完工通知
WX_TPL_MAINTENANCE_REMINDER=    # 保养提醒
WX_TPL_APPOINTMENT_CONFIRMED=   # 预约确认
```

**3.2.2 完善 NotificationService 的模板数据构建**

当前 `notification.service.ts` 中 `wechat_mp` 通道的 `data` 字段过于简单（只有 `thing1`），需要按微信模板规范为每个场景构建不同的数据结构。

在 `WechatMpProvider` 中新增 `buildTemplateData` 方法：

```typescript
buildTemplateData(scene: string, params: Record<string, string>): Record<string, { value: string }> {
  switch (scene) {
    case 'work_order_completed':
      return {
        character_string1: { value: params.orderNo || '' },       // 工单编号
        thing2: { value: params.vehiclePlateNo || '' },            // 车牌号
        thing3: { value: params.serviceContent || '' },            // 服务内容
        time4: { value: params.completedAt || '' },                // 完工时间
        thing5: { value: params.shopName || '欢迎取车' },          // 备注
      };
    case 'maintenance_reminder':
      return {
        thing1: { value: params.vehiclePlateNo || '' },            // 车牌号
        thing2: { value: params.maintenanceItem || '' },           // 保养项目
        thing3: { value: params.shopName || '' },                  // 门店名称
        thing5: { value: params.remark || '建议尽快到店保养' },     // 备注
      };
    case 'appointment_confirmed':
      return {
        character_string1: { value: params.appointNo || '' },      // 预约编号
        thing2: { value: params.serviceType || '' },               // 服务类型
        time3: { value: params.appointTime || '' },                // 预约时间
        thing4: { value: params.shopName || '' },                  // 门店名称
        thing5: { value: params.remark || '请准时到店' },          // 备注
      };
    default:
      return { thing1: { value: params.content || '' } };
  }
}
```

**3.2.3 修改 NotificationService.send 中 wechat_mp 分支**

```typescript
if (input.channel === 'wechat_mp') {
  const templateId = this.config.get<string>(`WX_TPL_${input.scene.toUpperCase()}`);
  if (!templateId) {
    // ... 跳过逻辑不变
  }

  const templateData = this.wechatMpProvider.buildTemplateData(
    input.scene,
    typeof input.content === 'string' ? JSON.parse(input.content) : {},
  );

  const result = await this.wechatMpProvider.sendSubscribeMessage({
    openid: input.recipient,
    templateId,
    data: templateData,
    page: input.relatedType === 'work_order'
      ? `pages/work-orders/detail?id=${input.relatedId}`
      : undefined,
  });
  // ... 后续状态更新逻辑不变
}
```

**3.2.4 小程序端订阅授权**

在小程序关键操作后（如预约成功、查看工单）调用 `wx.requestSubscribeMessage` 申请用户授权：

```typescript
// 小程序端封装
function requestSubscribe(tmplIds: string[]) {
  return new Promise((resolve) => {
    uni.requestSubscribeMessage({
      tmplIds,
      success: (res) => resolve(res),
      fail: () => resolve(null),
    });
  });
}
```

### 3.3 在线预约功能

**3.3.1 Schema 变更**

Appointment 表新增 `source` 字段，用于区分预约来源：

```prisma
model Appointment {
  // ... 已有字段
  source      String   @default("web")  // web, mini_app, phone
  // ...
}
```

执行 migration：`pnpm db:migrate`，命名为 `add_appointment_source`。

**3.3.2 车主侧预约 API**

在 `customer-portal.controller.ts` 新增：

```
POST /api/customer-portal/appointments
  Body: {
    shopId: string;           // 门店 ID（从已绑定门店列表选择）
    vehicleId?: string;       // 车辆 ID（可选，从"我的车辆"选择）
    serviceType: string;      // repair | wash | maintenance | inspection
    appointTime: string;      // ISO 时间，如 "2026-07-01T09:00:00"
    description?: string;     // 故障描述/备注
  }
  Response: {
    code: 0,
    data: { id, appointTime, status: 'pending', ... }
  }

GET /api/customer-portal/appointments
  Query: page, pageSize, status
  Response: {
    code: 0,
    data: { items: [...], total, page, pageSize }
  }

PUT /api/customer-portal/appointments/:id/cancel
  Response: { code: 0, data: { id, status: 'cancelled' } }
```

**3.3.3 预约服务逻辑**

在 `customer-portal.service.ts` 新增：

```typescript
async createAppointment(customerId: string, tenantId: string, data: CreateAppointmentDto) {
  // 1. 校验 shopId 属于 tenantId
  const shop = await this.prisma.shop.findFirst({
    where: { id: data.shopId, tenantId, status: 'active' },
  });
  if (!shop) throw new NotFoundException('门店不存在');

  // 2. 校验 vehicleId 属于该客户（如果提供）
  if (data.vehicleId) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: data.vehicleId, customerId, tenantId },
    });
    if (!vehicle) throw new NotFoundException('车辆不存在');
  }

  // 3. 校验预约时间不能早于当前时间
  const appointTime = new Date(data.appointTime);
  if (appointTime <= new Date()) throw new BadRequestException('预约时间不能早于当前时间');

  // 4. 防重复：同一客户同一天不能重复预约同一门店
  const startOfDay = new Date(appointTime);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const existing = await this.prisma.appointment.findFirst({
    where: {
      tenantId, customerId, shopId: data.shopId,
      appointTime: { gte: startOfDay, lt: endOfDay },
      status: { notIn: ['cancelled'] },
    },
  });
  if (existing) throw new BadRequestException('该时段已有预约，请选择其他时间');

  // 5. 创建预约
  const appointment = await this.prisma.appointment.create({
    data: {
      tenantId,
      shopId: data.shopId,
      customerId,
      vehicleId: data.vehicleId,
      serviceType: data.serviceType,
      appointTime,
      description: data.description,
      source: 'mini_app',
    },
  });

  // 6. 发送预约确认订阅消息（异步，不阻塞响应）
  this.sendAppointmentConfirmation(tenantId, customerId, appointment, shop.name).catch(() => {});

  return appointment;
}
```

**3.3.4 预约 DTO**

`apps/api/src/customer-portal/dto/appointment.dto.ts`：

```typescript
import { IsString, IsOptional, IsDateString, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAppointmentDto {
  @ApiProperty({ description: '门店 ID' })
  @IsString()
  shopId: string;

  @ApiProperty({ description: '车辆 ID', required: false })
  @IsOptional()
  @IsString()
  vehicleId?: string;

  @ApiProperty({ description: '服务类型', enum: ['repair', 'wash', 'maintenance', 'inspection'] })
  @IsIn(['repair', 'wash', 'maintenance', 'inspection'])
  serviceType: string;

  @ApiProperty({ description: '预约时间 ISO 格式' })
  @IsDateString()
  appointTime: string;

  @ApiProperty({ description: '描述', required: false })
  @IsOptional()
  @IsString()
  description?: string;
}
```

**3.3.5 小程序预约页面**

预约流程（2 页面）：
1. **预约首页** `pages/appointment/index.vue`：
   - 门店选择器（从已绑定门店列表中选择，仅一个门店时自动选中）
   - 服务类型选择（维修/洗车/保养/检测 四宫格）
   - 车辆选择器（我的车辆列表，可选）
   - 日期选择（日历组件，可选择未来 14 天）
   - 时段选择（09:00~18:00，按小时分割）
   - "下一步"按钮
2. **预约确认页** `pages/appointment/confirm.vue`：
   - 展示：门店名 + 服务类型 + 车辆 + 时间 + 备注输入框
   - "提交预约"按钮 → 调用 API → 成功后弹出"预约成功"+ 调用 `requestSubscribeMessage`

### 3.4 电子会员卡功能

**3.4.1 车主侧会员卡 API**

在 `customer-portal.controller.ts` 新增（已有 `GET /cards` 基础能力，需扩展）：

```
GET /api/customer-portal/cards/stored-value/:id
  Response: {
    code: 0,
    data: {
      id, cardNo, balance, principalBalance, giftBalance, status,
      transactions: [{ id, type, amount, principal, gift, balanceAfter, remark, createdAt }]
    }
  }

GET /api/customer-portal/cards/stored-value/:id/transactions
  Query: page, pageSize
  Response: { items: [...], total, page, pageSize }

GET /api/customer-portal/cards/package/:id
  Response: {
    code: 0,
    data: {
      id, cardNo, name, startAt, endAt, status,
      items: [{ serviceItemId, totalQty, remainQty }],
      transactions: [{ id, type, quantity, remainAfter, remark, createdAt }]
    }
  }

GET /api/customer-portal/cards/package/:id/transactions
  Query: page, pageSize
  Response: { items: [...], total, page, pageSize }

POST /api/customer-portal/cards/stored-value/:id/recharge
  Body: { amount: number }  // 单位：元，最小 1 元，最大 10000 元
  Response: { code: 0, data: { paymentUrl: string } }  // 依赖 TASK-205 支付
```

**3.4.2 服务层实现**

在 `customer-portal.service.ts` 新增：

```typescript
async getStoredValueCardDetail(cardId: string, customerId: string, tenantId: string) {
  const card = await this.prisma.storedValueCard.findFirst({
    where: { id: cardId, customerId, tenantId },
  });
  if (!card) throw new NotFoundException('储值卡不存在');

  const recentTransactions = await this.prisma.storedValueTransaction.findMany({
    where: { cardId, tenantId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return { ...card, transactions: recentTransactions };
}

async getStoredValueTransactions(cardId: string, customerId: string, tenantId: string, query: { page?: number; pageSize?: number }) {
  // 先校验卡归属
  const card = await this.prisma.storedValueCard.findFirst({
    where: { id: cardId, customerId, tenantId },
  });
  if (!card) throw new NotFoundException('储值卡不存在');

  const page = query.page || 1;
  const pageSize = query.pageSize || 20;

  const [items, total] = await Promise.all([
    this.prisma.storedValueTransaction.findMany({
      where: { cardId, tenantId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    this.prisma.storedValueTransaction.count({ where: { cardId, tenantId } }),
  ]);

  return { items, total, page, pageSize };
}

// 套餐卡类似实现，省略
```

**3.4.3 在线充值（依赖 TASK-205）**

充值流程：
1. 车主在小程序选择充值金额 → `POST /customer-portal/cards/stored-value/:id/recharge`
2. 后端调用 TASK-205 的支付服务创建微信支付订单，回调 URL 指向充值回调
3. 支付成功回调后：在事务中增加储值卡余额 + 写入 `StoredValueTransaction`（type: 'recharge'）
4. 如 TASK-205 尚未完成，充值入口显示"即将开放"，API 返回 501

```typescript
async rechargeStoredValueCard(cardId: string, customerId: string, tenantId: string, amount: number) {
  const card = await this.prisma.storedValueCard.findFirst({
    where: { id: cardId, customerId, tenantId, status: 'active' },
  });
  if (!card) throw new NotFoundException('储值卡不存在或已冻结');

  if (amount < 1 || amount > 10000) {
    throw new BadRequestException('充值金额需在 1~10000 元之间');
  }

  // TODO: 调用 TASK-205 支付服务创建微信支付订单
  // const paymentOrder = await this.paymentGatewayService.createWechatPay({
  //   tenantId,
  //   amount,
  //   description: `储值卡充值-${card.cardNo}`,
  //   callbackUrl: `/api/customer-portal/recharge-callback`,
  //   metadata: { cardId, customerId, tenantId },
  // });
  // return { paymentUrl: paymentOrder.payUrl };

  throw new HttpException('在线充值功能即将开放', HttpStatus.NOT_IMPLEMENTED);
}
```

**3.4.4 小程序会员卡页面**

1. **会员卡首页** `pages/cards/index.vue`：
   - 储值卡卡片（余额、本金/赠送分开展示）→ 点击进入详情
   - 套餐卡列表（名称、有效期、剩余次数进度条）→ 点击进入详情
   - 无卡时显示空状态
2. **储值卡详情** `pages/cards/stored-value-detail.vue`：
   - 卡号、余额（大字）、本金余额 + 赠送余额
   - 充值按钮 → 跳转充值页
   - 交易记录列表（充值/消费/退款，按时间倒序，支持分页加载）
3. **套餐卡详情** `pages/cards/package-detail.vue`：
   - 卡名称、有效期
   - 各项目剩余次数（进度条）
   - 使用记录列表
4. **充值页** `pages/cards/recharge.vue`：
   - 预设金额按钮组（100/200/500/1000）+ 自定义输入
   - 支付按钮 → 调用微信支付（TASK-205）

### 3.5 pages.json 更新

```json
{
  "pages": [
    { "path": "pages/index/index", "style": { "navigationBarTitleText": "首页" } },
    { "path": "pages/work-orders/index", "style": { "navigationBarTitleText": "我的工单" } },
    { "path": "pages/work-orders/detail", "style": { "navigationBarTitleText": "工单详情" } },
    { "path": "pages/appointment/index", "style": { "navigationBarTitleText": "预约服务" } },
    { "path": "pages/appointment/confirm", "style": { "navigationBarTitleText": "确认预约" } },
    { "path": "pages/cards/index", "style": { "navigationBarTitleText": "我的会员卡" } },
    { "path": "pages/cards/stored-value-detail", "style": { "navigationBarTitleText": "储值卡详情" } },
    { "path": "pages/cards/package-detail", "style": { "navigationBarTitleText": "套餐卡详情" } },
    { "path": "pages/cards/recharge", "style": { "navigationBarTitleText": "储值卡充值" } },
    { "path": "pages/my/index", "style": { "navigationBarTitleText": "我的" } }
  ],
  "tabBar": {
    "list": [
      { "pagePath": "pages/index/index", "text": "首页" },
      { "pagePath": "pages/work-orders/index", "text": "工单" },
      { "pagePath": "pages/cards/index", "text": "会员卡" },
      { "pagePath": "pages/my/index", "text": "我的" }
    ]
  }
}
```

注意：tabBar 从 3 个增加到 4 个（新增"会员卡"），预约通过首页入口进入（非 tab 页）。

### 3.6 单元测试

- 新建 `apps/api/src/customer-portal/customer-portal.service.spec.ts`（扩展已有测试文件）：
  - 测试 `createAppointment`：正常创建、过期时间拒绝、重复预约拒绝、门店不存在拒绝
  - 测试 `getStoredValueCardDetail`：正常返回、卡不归属该客户时 404
  - 测试 `getStoredValueTransactions`：分页正确性
  - 测试 `rechargeStoredValueCard`：金额校验（<1 / >10000 拒绝）、冻结卡拒绝
- 扩展 `apps/api/src/customer-portal/customer-portal-auth.service.spec.ts`：
  - 测试 `wxLogin` 生产环境无配置时抛异常
  - 测试 `wxLogin` 正确调用 `code2Session`
- 新建 `apps/api/src/notification/providers/wechat-mp.provider.spec.ts`：
  - 测试 `buildTemplateData` 各场景输出格式
  - 测试 `code2Session` 成功/失败路径
- Mock Prisma 和 WechatMpProvider，不连真实数据库和微信接口

## 4. 验收标准

- [ ] `WechatMpProvider.code2Session` 方法实现完整，可正确调用微信 jscode2session 接口
- [ ] 生产环境（`NODE_ENV=production`）下未配置微信 APPID/SECRET 时，`wxLogin` 抛出 `BadRequestException`，不返回 mock openid
- [ ] 开发环境保留 mock 回退，不影响本地开发
- [ ] `WechatMpProvider.buildTemplateData` 覆盖 `work_order_completed`、`maintenance_reminder`、`appointment_confirmed` 三个场景
- [ ] `POST /api/customer-portal/appointments` 可正常创建预约，source 字段为 `mini_app`
- [ ] 预约防重复：同一客户同一天同一门店不能创建第二个未取消预约
- [ ] 预约时间校验：不能早于当前时间
- [ ] `GET /api/customer-portal/cards/stored-value/:id` 返回卡详情及最近 20 条交易记录
- [ ] `GET /api/customer-portal/cards/package/:id` 返回套餐卡详情及剩余次数
- [ ] 在线充值接口在 TASK-205 未完成前返回 501
- [ ] 小程序新增页面正常渲染：预约首页/确认页、会员卡首页/储值卡详情/套餐卡详情/充值页
- [ ] tabBar 正常显示 4 个 tab
- [ ] migration 执行成功（`pnpm db:migrate`）
- [ ] 新增单元测试全部通过
- [ ] `npx nest build` 编译通过
- [ ] 小程序 `npm run build:mp-weixin` 编译通过

## 5. 注意事项

- **不要删除** Mock 逻辑，开发环境仍需保留——通过 `NODE_ENV` 判断而非直接移除
- 所有车主侧 API 必须通过 `customerId` + `tenantId` 双重隔离，绝不允许客户看到其他客户数据
- 卡余额读取不需要事务，但充值回调写入必须在事务内完成（等 TASK-205）
- 金额字段使用 Decimal，前端展示时转为 `toFixed(2)` 字符串
- 微信订阅消息的模板 ID 需要在微信小程序后台申请，环境变量未配置时应 skip 而非报错
- 小程序页面样式保持与现有 MVP 页面一致的设计语言
- Appointment 表的 `source` 字段默认值为 `'web'`，确保现有预约功能不受影响
- 预约确认后的订阅消息发送是**异步**的，不阻塞预约创建响应

---

## 6. 回执区域（Agent 完成后填写）

> **Agent 请在完成任务后，将以下表格填写完整并追加到本文件此节：**

| 项目 | 内容 |
|------|------|
| 修改的文件列表 | `apps/api/prisma/schema.prisma`（Appointment 新增 source 字段）, `apps/api/src/customer-portal/customer-portal-auth.service.ts`（注入 WechatMpProvider，使用 code2Session，生产环境无配置抛异常）, `apps/api/src/customer-portal/customer-portal.controller.ts`（新增预约和会员卡相关端点）, `apps/api/src/customer-portal/customer-portal.service.ts`（新增预约创建/列表/取消、储值卡/套餐卡详情和交易记录、充值接口）, `apps/api/src/customer-portal/customer-portal.module.ts`（引入 NotificationModule、PaymentGatewayModule、WechatMpProvider）, `apps/api/src/notification/providers/wechat-mp.provider.ts`（新增 code2Session、buildTemplateData 方法）, `apps/api/src/notification/notification.service.ts`（wechat_mp 分支使用 buildTemplateData 构建模板数据）, `apps/mini-customer/src/pages.json`（新增预约/会员卡页面路由，tabBar 增加会员卡）, `apps/mini-customer/src/pages/index/index.vue`（增加预约/会员卡/工单快捷入口）, `apps/mini-customer/src/pages/my/index.vue`（增加会员卡和预约菜单入口）, `apps/api/src/customer-portal/customer-portal-auth.service.spec.ts`（增加 code2Session 和生产环境异常测试）, `apps/api/src/customer-portal/customer-portal.service.spec.ts`（增加预约和会员卡测试）, `.env.example`（增加微信订阅消息模板 ID 配置项） |
| 新建的文件列表 | `apps/api/src/customer-portal/dto/appointment.dto.ts`（预约 DTO）, `apps/mini-customer/src/pages/appointment/index.vue`（预约首页）, `apps/mini-customer/src/pages/appointment/confirm.vue`（预约确认页）, `apps/mini-customer/src/pages/cards/index.vue`（会员卡首页）, `apps/mini-customer/src/pages/cards/stored-value-detail.vue`（储值卡详情）, `apps/mini-customer/src/pages/cards/package-detail.vue`（套餐卡详情）, `apps/mini-customer/src/pages/cards/recharge.vue`（储值卡充值页） |
| 构建是否通过 | ✅ `nest build` 通过 |
| 测试是否通过（新增用例数） | ✅ 全部 254 个测试通过（26 个测试套件），新增 13 个测试用例：auth 测试 3 个（code2Session 集成：生产环境异常、成功、失败）, service 测试 10 个（createAppointment 3 个、getStoredValueCardDetail 2 个、getStoredValueTransactions 1 个、rechargeStoredValueCard 4 个） |
| 已知限制或遗留问题 | 1. 在线充值接口当前返回 501（待 TASK-205 支付网关集成后可启用）；2. 微信订阅消息模板 ID 需要在微信小程序后台申请后配置到环境变量；3. 套餐卡和储值卡页面的交易记录中服务项目名称（serviceItem.name）因 Prisma schema 无直接关联，当前仅展示 itemId，后续可关联查询 |
| 执行耗时 | 约 25 分钟 |

---

## 7. 架构师审核区域

> 审核人填写，Agent 请勿改动此节。

### 产品经理审核记录（2026-06-13）

- **审核结论**：❌ 废弃作废 (Voided)
- **作废原因**：产品方向产生重大调整！经确认为误解，**车店云小程序不提供给 C 端车主，仅提供给 B 端店员/技师使用。**
- **处置方式**：
  - 由该 Agent 创建的 `apps/mini-customer/` 工程已被**物理删除**。
  - 本任务相关的 C 端后端代码（如 `apps/api/src/customer-portal`）保留但不启用，随时准备清理。
  - **替代方案**：已经将之前为店员编写的 `apps/mobile` 直接适配了微信小程序编译命令（`build:mp-weixin`），店员直接使用由 `apps/mobile` 编译出的小程序。
- **TASK-208 状态**：❌ 已废弃

### ~~产品经理审核记录（2026-06-13）~~ — 已被产品方向调整覆盖

- **审核结论**：❌ 本审核结果已失效
- **原因**：产品方向已调整为不做车主小程序，本任务已废弃。此审核记录仅作历史存档。
- **TASK-208 最终状态**：❌ 已废弃
