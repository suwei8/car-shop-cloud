# TASK-202：真实短信上线（阿里云 SMS 集成 + 重试 + 费用监控）

> **优先级**：P0
> **状态**：待派发
> **依赖**：TASK-201（生产环境配置）
> **可并行**：TASK-205

## 1. 任务目标

TASK-104 建立了通知基础设施，使用 Provider 模式（`MockSmsProvider` / `AliyunSmsProvider`），当前默认使用 Mock。阿里云 Provider 代码已存在（`apps/api/src/notification/providers/aliyun-sms.provider.ts`）但 SDK 调用被注释，处于占位状态，未经过生产验证。

本任务需要完成：
1. 安装并集成阿里云短信 SDK（`@alicloud/dysmsapi20170525`）
2. 配置短信签名和模板（验证码、完工通知）
3. 实现发送失败指数退避重试（最多 3 次）
4. 发送失败时将错误信息写入 `Notification.failReason`
5. 新增平台级短信统计端点，用于费用监控
6. 通过环境变量 `SMS_PROVIDER` 控制 Provider 切换

做完后，生产环境可一键切换为真实短信发送，开发/测试环境继续使用 Mock。

## 2. 涉及文件

### 新建文件
- `apps/api/src/notification/sms-stats.controller.ts` — 平台短信统计端点
- `apps/api/src/notification/dto/sms-stats.dto.ts` — 统计响应 DTO

### 修改文件
- `apps/api/src/notification/providers/aliyun-sms.provider.ts` — 集成真实 SDK + 重试逻辑
- `apps/api/src/notification/providers/sms.provider.ts` — Provider 接口增加 `retryCount` 返回
- `apps/api/src/notification/notification.service.ts` — 重试调度 + 失败处理增强
- `apps/api/src/notification/notification.module.ts` — 注册新 Controller
- `apps/api/package.json` — 添加 `@alicloud/dysmsapi20170525`、`@alicloud/openapi-client` 依赖
- `.env.example` — 新增模板相关环境变量

## 3. 详细要求

### 3.1 安装阿里云 SDK

```bash
cd apps/api
pnpm add @alicloud/dysmsapi20170525 @alicloud/openapi-client
```

### 3.2 环境变量配置

在 `.env.example` 中，将现有 SMS 区块更新为：

```bash
# SMS (Notification)
SMS_PROVIDER=mock                              # mock | aliyun
# ALIYUN_SMS_ACCESS_KEY_ID=your_access_key_id
# ALIYUN_SMS_ACCESS_KEY_SECRET=your_access_key_secret
# ALIYUN_SMS_SIGN_NAME=车店云管家              # 阿里云短信签名（需先在控制台审核通过）
# ALIYUN_SMS_TEMPLATE_CODE_VERIFY=SMS_00001    # 验证码模板（变量：${code}）
# ALIYUN_SMS_TEMPLATE_CODE_COMPLETE=SMS_00002  # 完工通知模板（变量：${shopName} ${plateNumber}）
# ALIYUN_SMS_REGION=cn-hangzhou                # 阿里云 Region，默认 cn-hangzhou
```

各模板变量映射规则：

| 模板场景 | 环境变量 | 阿里云模板变量 | 调用方传入的 params key |
|---------|---------|--------------|----------------------|
| 验证码 (`sms_verify_code`) | `ALIYUN_SMS_TEMPLATE_CODE_VERIFY` | `${code}` | `{ code: "123456" }` |
| 完工通知 (`work_order_completed`) | `ALIYUN_SMS_TEMPLATE_CODE_COMPLETE` | `${shopName}`, `${plateNumber}` | `{ shopName: "XX汽修", plateNumber: "粤B12345" }` |

### 3.3 SmsProvider 接口更新

更新 `apps/api/src/notification/providers/sms.provider.ts`：

```typescript
export interface SmsResult {
  ok: boolean;
  error?: string;
  retryCount?: number;     // 实际重试次数
  requestId?: string;      // 阿里云 RequestId，用于排障
}

export interface SmsProvider {
  send(phone: string, templateCode: string, params: Record<string, string>): Promise<SmsResult>;
}

// maskPhone 保持不变
export function maskPhone(phone: string): string {
  if (!phone || phone.length < 7) return phone || '';
  return phone.slice(0, 3) + '****' + phone.slice(-4);
}
```

`MockSmsProvider` 需同步更新返回类型为 `SmsResult`（返回 `{ ok: true, retryCount: 0 }`）。

### 3.4 AliyunSmsProvider 重写（SDK 集成 + 重试）

重写 `apps/api/src/notification/providers/aliyun-sms.provider.ts`：

```typescript
import { Logger } from '@nestjs/common';
import Dysmsapi, * as $Dysmsapi from '@alicloud/dysmsapi20170525';
import * as $OpenApi from '@alicloud/openapi-client';
import { SmsProvider, SmsResult, maskPhone } from './sms.provider';

export class AliyunSmsProvider implements SmsProvider {
  private readonly logger = new Logger('AliyunSmsProvider');
  private client: Dysmsapi;
  private signName: string;

  // 重试配置
  private readonly MAX_RETRIES = 3;
  private readonly BASE_DELAY_MS = 1000; // 1s → 2s → 4s 指数退避

  constructor(config: {
    accessKeyId: string;
    accessKeySecret: string;
    signName: string;
    region?: string;
  }) {
    this.signName = config.signName;
    const openApiConfig = new $OpenApi.Config({
      accessKeyId: config.accessKeyId,
      accessKeySecret: config.accessKeySecret,
      endpoint: `dysmsapi.aliyuncs.com`,
    });
    this.client = new Dysmsapi(openApiConfig);
  }

  async send(
    phone: string,
    templateCode: string,
    params: Record<string, string>,
  ): Promise<SmsResult> {
    const request = new $Dysmsapi.SendSmsRequest({
      phoneNumbers: phone,
      signName: this.signName,
      templateCode,
      templateParam: JSON.stringify(params),
    });

    let lastError: string | undefined;
    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        const delay = this.BASE_DELAY_MS * Math.pow(2, attempt - 1);
        this.logger.warn(
          `[Aliyun SMS] Retry ${attempt}/${this.MAX_RETRIES} for ${maskPhone(phone)}, waiting ${delay}ms`,
        );
        await this.sleep(delay);
      }

      try {
        const response = await this.client.sendSms(request);
        const body = response.body;

        if (body.code === 'OK') {
          this.logger.log(
            `[Aliyun SMS] Sent to ${maskPhone(phone)}, requestId: ${body.requestId}, attempt: ${attempt}`,
          );
          return { ok: true, retryCount: attempt, requestId: body.requestId };
        }

        // 不可重试的业务错误码（立即返回，不再重试）
        const nonRetryableCodes = [
          'isv.MOBILE_NUMBER_ILLEGAL',       // 手机号非法
          'isv.TEMPLATE_MISSING_PARAMETERS', // 模板参数缺失
          'isv.BUSINESS_LIMIT_CONTROL',      // 业务限流
          'isv.INVALID_PARAMETERS',          // 参数异常
        ];
        if (nonRetryableCodes.includes(body.code || '')) {
          this.logger.error(
            `[Aliyun SMS] Non-retryable error: ${body.code} - ${body.message}, requestId: ${body.requestId}`,
          );
          return { ok: false, error: `${body.code}: ${body.message}`, retryCount: attempt, requestId: body.requestId };
        }

        lastError = `${body.code}: ${body.message}`;
        this.logger.warn(`[Aliyun SMS] Attempt ${attempt} failed: ${lastError}`);
      } catch (err) {
        lastError = err.message || 'Unknown SDK error';
        this.logger.error(`[Aliyun SMS] SDK exception on attempt ${attempt}: ${lastError}`);
      }
    }

    return { ok: false, error: lastError, retryCount: this.MAX_RETRIES };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

**关键设计决策：**
- 指数退避：1s → 2s → 4s（`BASE_DELAY_MS * 2^(attempt-1)`）
- 不可重试错误码直接返回，避免浪费重试次数
- 每次重试打 warn 日志，便于排障
- `requestId` 透传，阿里云工单排障必需

### 3.5 NotificationService 失败处理增强

修改 `apps/api/src/notification/notification.service.ts`，在 SMS 发送逻辑中：

1. **模板映射**：根据 `scene` 自动查找对应的阿里云模板 Code

```typescript
private getTemplateCode(scene: string): string {
  const templateMap: Record<string, string> = {
    sms_verify_code: this.config.get('ALIYUN_SMS_TEMPLATE_CODE_VERIFY', ''),
    work_order_completed: this.config.get('ALIYUN_SMS_TEMPLATE_CODE_COMPLETE', ''),
  };
  return templateMap[scene] || scene; // Mock 模式下 scene 直接传
}
```

2. **发送调用更新**：将当前的 `this.smsProvider.send(input.recipient, input.scene, { content: input.content })` 改为：

```typescript
const templateCode = this.getTemplateCode(input.scene);
const result = await this.smsProvider.send(input.recipient, templateCode, input.params || { content: input.content });
```

3. **失败记录增强**：失败时将 `retryCount` 和 `requestId` 一并写入 `failReason`：

```typescript
if (!result.ok) {
  const failDetail = [
    result.error || 'unknown',
    result.retryCount !== undefined ? `retries: ${result.retryCount}` : '',
    result.requestId ? `requestId: ${result.requestId}` : '',
  ].filter(Boolean).join(', ');

  await this.prisma.notification.update({
    where: { id: notification.id },
    data: { status: 'failed', failReason: failDetail },
  });
}
```

4. **send 方法签名扩展**：在 `send()` 入参中新增可选的 `params` 字段：

```typescript
async send(input: {
  tenantId: string;
  shopId?: string;
  channel: string;
  scene: string;
  recipient: string;
  content: string;
  params?: Record<string, string>;  // 新增：短信模板变量
  relatedType?: string;
  relatedId?: string;
  failReason?: string;
}): Promise<{ id: string; status: string }>
```

> **注意**：现有调用方（`work-order.service.ts` 完工通知、`sms-code.service.ts` 验证码）都只传 `content`，无需修改——`getTemplateCode` 会根据 scene 自动映射，`params` 不传时降级为 `{ content }`。后续阿里云上线时，调用方按需传入模板变量。

### 3.6 Provider 工厂启动日志

在 `NotificationService.createSmsProvider()` 中增加启动日志：

```typescript
private createSmsProvider(): SmsProvider {
  const provider = this.config.get('SMS_PROVIDER', 'mock');
  this.logger.log(`SMS Provider initializing: ${provider}`);

  if (provider === 'aliyun') {
    const accessKeyId = this.config.get('ALIYUN_SMS_ACCESS_KEY_ID', '');
    const accessKeySecret = this.config.get('ALIYUN_SMS_ACCESS_KEY_SECRET', '');
    const signName = this.config.get('ALIYUN_SMS_SIGN_NAME', '');
    const region = this.config.get('ALIYUN_SMS_REGION', 'cn-hangzhou');
    if (!accessKeyId || !accessKeySecret) {
      this.logger.warn('Aliyun SMS credentials not configured, falling back to MockSmsProvider');
      return new MockSmsProvider();
    }
    if (!signName) {
      this.logger.warn('ALIYUN_SMS_SIGN_NAME not set, falling back to MockSmsProvider');
      return new MockSmsProvider();
    }
    this.logger.log(`Aliyun SMS initialized with sign: ${signName}, region: ${region}`);
    return new AliyunSmsProvider({ accessKeyId, accessKeySecret, signName, region });
  }

  this.logger.log('Using MockSmsProvider');
  return new MockSmsProvider();
}
```

### 3.7 短信统计端点

新建 `apps/api/src/notification/sms-stats.controller.ts`：

```typescript
import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { RequirePermissions } from '../common/decorators';

@ApiTags('platform-sms')
@ApiBearerAuth()
@Controller('platform/sms-stats')
export class SmsStatsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @RequirePermissions('platform:tenant:manage')  // 仅平台管理员
  @ApiOperation({ summary: '短信统计（本月发送量、成功/失败数）' })
  async getStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [total, sent, failed, skipped] = await Promise.all([
      this.prisma.notification.count({
        where: {
          channel: 'sms',
          createdAt: { gte: startOfMonth },
        },
      }),
      this.prisma.notification.count({
        where: {
          channel: 'sms',
          status: 'sent',
          createdAt: { gte: startOfMonth },
        },
      }),
      this.prisma.notification.count({
        where: {
          channel: 'sms',
          status: 'failed',
          createdAt: { gte: startOfMonth },
        },
      }),
      this.prisma.notification.count({
        where: {
          channel: 'sms',
          status: 'skipped',
          createdAt: { gte: startOfMonth },
        },
      }),
    ]);

    // 按 scene 分组统计
    const byScene = await this.prisma.notification.groupBy({
      by: ['scene'],
      where: {
        channel: 'sms',
        createdAt: { gte: startOfMonth },
      },
      _count: true,
    });

    // 最近失败记录（前 10 条）
    const recentFailures = await this.prisma.notification.findMany({
      where: {
        channel: 'sms',
        status: 'failed',
        createdAt: { gte: startOfMonth },
      },
      select: {
        id: true,
        scene: true,
        recipient: true,
        failReason: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return {
      month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      total,
      sent,
      failed,
      skipped,
      successRate: total > 0 ? Number(((sent / total) * 100).toFixed(2)) : 0,
      byScene: byScene.map((s) => ({ scene: s.scene, count: s._count })),
      recentFailures,
    };
  }
}
```

**注意**：`recentFailures` 中的 `recipient`（手机号）在返回给前端前应做脱敏处理。在 Controller 层或 Interceptor 中调用 `maskPhone` 对手机号脱敏：

```typescript
recentFailures: recentFailures.map((f) => ({
  ...f,
  recipient: maskPhone(f.recipient),
})),
```

### 3.8 NotificationModule 更新

修改 `apps/api/src/notification/notification.module.ts`，注册新 Controller：

```typescript
import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { SmsStatsController } from './sms-stats.controller';
import { WechatMpProvider } from './providers/wechat-mp.provider';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [NotificationController, SmsStatsController],
  providers: [NotificationService, WechatMpProvider],
  exports: [NotificationService],
})
export class NotificationModule {}
```

### 3.9 单元测试

- 更新 `apps/api/src/notification/notification.service.spec.ts`：
  - 测试 `getTemplateCode()` 对已知 scene 返回正确模板 Code，未知 scene 返回 scene 本身
  - 测试 SMS 发送失败时 `failReason` 包含 retryCount 和 requestId
  - 测试 `SMS_PROVIDER=mock` 时使用 MockSmsProvider，`SMS_PROVIDER=aliyun` 但缺 Key 时降级为 Mock

- 新建 `apps/api/src/notification/providers/aliyun-sms.provider.spec.ts`：
  - Mock `@alicloud/dysmsapi20170525` 的 `sendSms` 方法
  - 测试首次成功：`retryCount = 0`
  - 测试首次失败 + 第二次成功：`retryCount = 1`
  - 测试不可重试错误码立即返回：不再 retry
  - 测试连续 4 次失败：最终 `ok = false, retryCount = 3`
  - 测试指数退避间隔（通过 mock `sleep` 验证调用参数）

- 新建 `apps/api/src/notification/sms-stats.controller.spec.ts`：
  - Mock PrismaService
  - 测试返回正确的 month 格式、统计数值、successRate 计算
  - 测试手机号脱敏

## 4. 验收标准

- [ ] `pnpm add @alicloud/dysmsapi20170525 @alicloud/openapi-client` 安装成功
- [ ] `SMS_PROVIDER=mock` 时行为与当前完全一致（向后兼容）
- [ ] `SMS_PROVIDER=aliyun` 但环境变量缺少 Key/Secret/SignName 时，自动降级 Mock 并打 warn 日志
- [ ] `AliyunSmsProvider.send()` 失败时自动重试，最多 3 次，间隔为 1s→2s→4s
- [ ] 不可重试错误码（`isv.MOBILE_NUMBER_ILLEGAL` 等）立即返回不重试
- [ ] 发送失败的 Notification 记录 `failReason` 包含错误信息、重试次数、requestId
- [ ] `GET /api/platform/sms-stats` 返回本月发送量、成功数、失败数、成功率、按场景分组、最近失败记录
- [ ] 统计接口仅平台管理员可访问（`platform:tenant:manage` 权限）
- [ ] 统计返回中手机号已脱敏（`138****1234` 格式）
- [ ] `.env.example` 包含所有新增环境变量（含注释说明）
- [ ] `nest build` 编译通过
- [ ] 新增单元测试全部通过

## 5. 注意事项

- **不要修改现有调用方代码**：`work-order.service.ts` 和 `sms-code.service.ts` 中的 `NotificationService.send()` 调用参数不变，通过 `getTemplateCode` 内部映射模板
- **Mock 默认优先**：`SMS_PROVIDER` 默认值为 `mock`，确保开发/测试环境不会误发真实短信
- **阿里云 SDK 注释中的 TODO 要移除**：`aliyun-sms.provider.ts` 中现有的 TODO 注释代码要全部替换为真实实现
- **重试只在 Provider 层**：`NotificationService` 不做重试，重试逻辑封装在 `AliyunSmsProvider` 内部
- **手机号脱敏**：所有日志和 API 返回中的手机号必须使用 `maskPhone()` 脱敏，禁止明文暴露
- **阿里云短信签名和模板需在阿里云控制台提前审核通过**，本任务只做代码集成，不涉及控制台操作
- **金额相关字段保持 Decimal**，不引入 float（本任务不涉及金额，但需遵守全局约束）
- 遵循项目响应格式 `{ code, message, data }` 与现有 DTO 校验规范

---

## 6. 回执区域（Agent 完成后填写）

> **Agent 请在完成任务后，将以下表格填写完整并追加到本文件此节：**

| 项目 | 内容 |
|------|------|
| 修改的文件列表 | |
| 新建的文件列表 | |
| 构建是否通过 | |
| 测试是否通过（新增用例数） | |
| 已知限制或遗留问题 | |
| 执行耗时 | |

---

## 7. 架构师审核区域

> 审核人填写，Agent 请勿改动此节。
