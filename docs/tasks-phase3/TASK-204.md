# TASK-204：安全加固（Helmet + CORS + 限流 + 文件上传 + 密码策略）

> **优先级**：P0
> **状态**：待派发
> **依赖**：无
> **可并行**：TASK-201、TASK-203

## 1. 任务目标

当前项目在开发环境运行，存在以下安全薄弱点：

1. **无安全头**：缺少 X-Content-Type-Options、X-Frame-Options、CSP 等标准 Web 安全头
2. **CORS 全开**：`main.ts` 中 `enableCors({ origin: true })` 允许任意来源跨域，已定义的 `corsOrigin` 变量未被使用
3. **无全局限流**：除 SMS 验证码（TASK-106 在 Redis 层做了限流）外，其余端点均无频率限制
4. **文件上传无校验**：`file.controller.ts` 接收任意 MIME 类型和文件大小，存在滥用风险
5. **密码策略过弱**：`CreateTenantDto` 密码仅要求 `MinLength(6)`，注册 DTO 已有较好的密码策略（8 位 + 字母数字），需统一
6. **JWT_SECRET 无强度校验**：启动时仅检查是否存在，未检查长度

做完后，系统具备生产级基本安全防护，不影响现有 API 兼容性。

## 2. 涉及文件

### 新建文件
- `apps/api/src/common/validators/password.validator.ts` — 自定义密码校验装饰器（可复用）
- `apps/api/src/common/validators/password.validator.spec.ts` — 校验器单元测试

### 修改文件
- `apps/api/src/main.ts` — Helmet 集成、CORS 白名单配置
- `apps/api/src/app.module.ts` — ThrottlerModule 注册
- `apps/api/src/auth/auth.controller.ts` — 登录接口限流装饰器
- `apps/api/src/file/file.controller.ts` — 文件上传限流装饰器
- `apps/api/src/file/file.service.ts` — MIME 类型校验 + 文件大小校验 + 文件名消毒
- `apps/api/src/file/dto/file.dto.ts` — 新增 MIME / size 校验规则
- `apps/api/src/platform/tenant/dto/tenant.dto.ts` — 密码策略升级
- `apps/api/src/auth/auth.module.ts` — JWT_SECRET 强度检查（启动警告）
- `apps/api/package.json` — 添加 `helmet`、`@nestjs/throttler` 依赖
- `.env.example` — 新增 CORS_ORIGINS

## 3. 详细要求

### 3.1 Helmet.js 安全头

安装依赖：

```bash
cd apps/api
pnpm add helmet
```

在 `apps/api/src/main.ts` 中启用 Helmet，**但排除 Swagger UI 路径**（Helmet 的 CSP 会阻止 Swagger 的内联脚本和样式）：

```typescript
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Helmet — 安全头
  // Swagger UI 需要 inline script/style，对 /api/docs 路径放宽 CSP
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/docs')) {
      // Swagger UI 路径不加 CSP 限制
      helmet({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false,
      })(req, res, next);
    } else {
      helmet()(req, res, next);
    }
  });

  // ... 其余代码
}
```

### 3.2 CORS 白名单

修改 `apps/api/src/main.ts`，用环境变量 `CORS_ORIGINS` 替代当前的 `origin: true`：

```typescript
// 当前代码（需替换）：
// const corsOrigin = process.env.CORS_ORIGIN
//   ? process.env.CORS_ORIGIN.split(',')
//   : ['http://localhost:5173', 'http://localhost:5174'];
// app.enableCors({ origin: true, credentials: true });

// 替换为：
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim())
  : ['http://localhost:5173', 'http://localhost:5174'];

app.enableCors({
  origin: (origin, callback) => {
    // 允许无 origin 的请求（如服务端到服务端、curl 测试）
    if (!origin || corsOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: Origin ${origin} not allowed`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
```

在 `.env.example` 中更新：

```bash
# 将现有的 CORS_ORIGIN 改为 CORS_ORIGINS（复数形式，逗号分隔多个域名）
CORS_ORIGINS=http://127.0.0.1:5173
# 生产环境示例：CORS_ORIGINS=https://app.example.com,https://admin.example.com
```

> **注意**：环境变量名从 `CORS_ORIGIN`（单数）改为 `CORS_ORIGINS`（复数），保留对旧名的兼容读取：

```typescript
const corsOrigins = (process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
if (corsOrigins.length === 0) {
  corsOrigins.push('http://localhost:5173', 'http://localhost:5174');
}
```

### 3.3 全局限流（@nestjs/throttler）

安装依赖：

```bash
cd apps/api
pnpm add @nestjs/throttler
```

#### 3.3.1 全局默认限流

修改 `apps/api/src/app.module.ts`：

```typescript
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

@Module({
  imports: [
    // ...existing imports
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,   // 60 秒
        limit: 100,   // 最多 100 次
      },
    ]),
  ],
  providers: [
    // ...existing providers
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
```

> **注意 Guard 顺序**：`ThrottlerGuard` 应在 `JwtAuthGuard` **之前**注册，这样限流在认证前生效，可防止未认证的暴力请求：

```typescript
providers: [
  { provide: APP_GUARD, useClass: ThrottlerGuard },  // 限流最先
  { provide: APP_GUARD, useClass: JwtAuthGuard },
  { provide: APP_GUARD, useClass: TenantGuard },
  { provide: APP_GUARD, useClass: SubscriptionGuard },
  { provide: APP_GUARD, useClass: RolesGuard },
  { provide: APP_GUARD, useClass: PermissionsGuard },
],
```

#### 3.3.2 登录接口细化限流

修改 `apps/api/src/auth/auth.controller.ts`，对 `login` 端点施加更严格的限流：

```typescript
import { Throttle, SkipThrottle } from '@nestjs/throttler';

// 登录：60 秒内最多 5 次（防暴力破解）
@Public()
@Throttle([{ name: 'default', ttl: 60000, limit: 5 }])
@Post('login')
@HttpCode(HttpStatus.OK)
@ApiOperation({ summary: '登录' })
async login(@Body() dto: LoginDto) {
  return this.authService.login(dto.phone, dto.password);
}
```

#### 3.3.3 文件上传限流

修改 `apps/api/src/file/file.controller.ts`，对 `upload-url` 端点限流：

```typescript
import { Throttle } from '@nestjs/throttler';

// 文件上传：60 秒内最多 10 次
@Throttle([{ name: 'default', ttl: 60000, limit: 10 }])
@Post('upload-url')
@ApiOperation({ summary: '获取文件上传预签名 URL' })
getUploadUrl(...) { ... }
```

#### 3.3.4 验证码限流确认

TASK-106 已在 `SmsCodeService` 中实现了 Redis 级限流（同一手机号 60 秒 1 条，每日上限 10 条，同一 IP 每日上限 20 条）。这比 ThrottlerGuard 的全局限流更精细。确认 `registration.controller.ts` 的 `send-code` 端点上，**不覆盖**更宽松的 Throttle，保留现有 Redis 限流即可。如 `send-code` 需要 `@SkipThrottle()` 以避免全局限流与 Redis 限流叠加冲突，可添加。

**具体做法**：检查 `registration.controller.ts`（TASK-106 创建），如已有限流装饰器则保持不动。如没有，添加 `@Throttle([{ name: 'default', ttl: 60000, limit: 10 }])` 作为基本防护层（Redis 限流是更精细的业务层限流）。

### 3.4 文件上传安全

#### 3.4.1 MIME 类型白名单

修改 `apps/api/src/file/dto/file.dto.ts`，增加 MIME 类型校验：

```typescript
import {
  IsString, IsOptional, IsNumber, Min, Max, IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// 允许的 MIME 类型
const ALLOWED_MIME_TYPES = [
  // 图片
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
  // PDF
  'application/pdf',
  // Excel
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  // CSV（数据导入用）
  'text/csv',
];

export const ALLOWED_MIME_TYPES_LIST = ALLOWED_MIME_TYPES;

export class GetUploadUrlDto {
  @ApiProperty()
  @IsString()
  originalName: string;

  @ApiProperty({ description: '文件 MIME 类型，仅允许图片/PDF/Excel' })
  @IsString()
  @IsIn(ALLOWED_MIME_TYPES, {
    message: `不支持的文件类型，允许：${ALLOWED_MIME_TYPES.join(', ')}`,
  })
  mimeType: string;

  @ApiProperty({ description: '文件大小（字节），最大 10MB' })
  @IsNumber()
  @Min(1, { message: '文件大小不能为 0' })
  @Max(10 * 1024 * 1024, { message: '文件大小不能超过 10MB' })
  size: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  businessType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  businessId?: string;
}
```

#### 3.4.2 文件名消毒

修改 `apps/api/src/file/file.service.ts`，在 `getUploadUrl` 方法中对文件名进行消毒：

```typescript
/**
 * 消毒文件名：去除路径穿越字符、特殊字符，仅保留字母数字中文下划线点号
 */
private sanitizeFileName(name: string): string {
  // 去除路径分隔符
  let sanitized = name.replace(/[\/\\]/g, '');
  // 去除特殊字符，仅保留：字母、数字、中文、下划线、连字符、点号
  sanitized = sanitized.replace(/[^a-zA-Z0-9\u4e00-\u9fa5._-]/g, '');
  // 防止空文件名
  if (!sanitized || sanitized === '.') {
    sanitized = 'unnamed';
  }
  // 限制长度
  if (sanitized.length > 200) {
    const ext = sanitized.split('.').pop() || '';
    sanitized = sanitized.slice(0, 200 - ext.length - 1) + '.' + ext;
  }
  return sanitized;
}
```

在 `getUploadUrl` 方法开头调用：

```typescript
async getUploadUrl(user: JwtPayload, data: { originalName: string; ... }) {
  const safeName = this.sanitizeFileName(data.originalName);
  const ext = safeName.split('.').pop();
  // ... 后续使用 safeName
}
```

同时将 `originalName` 存库时也使用消毒后的名称：

```typescript
originalName: safeName,
```

### 3.5 密码策略统一

#### 3.5.1 自定义密码校验装饰器

新建 `apps/api/src/common/validators/password.validator.ts`：

```typescript
import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ async: false })
export class IsStrongPasswordConstraint implements ValidatorConstraintInterface {
  validate(value: any): boolean {
    if (typeof value !== 'string') return false;
    if (value.length < 8) return false;
    // 至少包含一个字母
    if (!/[a-zA-Z]/.test(value)) return false;
    // 至少包含一个数字
    if (!/\d/.test(value)) return false;
    return true;
  }

  defaultMessage(): string {
    return '密码至少8位，且必须包含字母和数字';
  }
}

export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsStrongPasswordConstraint,
    });
  };
}
```

#### 3.5.2 统一密码 DTO

修改 `apps/api/src/platform/tenant/dto/tenant.dto.ts`：

```typescript
import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsStrongPassword } from '../../../common/validators/password.validator';

export class CreateTenantDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiProperty({ description: '管理员初始密码（至少8位，必须包含字母和数字）' })
  @IsString()
  @IsStrongPassword()
  password: string;
}

export class UpdateTenantDto {
  // ... name/contactName/contactPhone 不变

  @ApiPropertyOptional({ description: '留空则不修改密码（至少8位，必须包含字母和数字）' })
  @IsOptional()
  @IsString()
  @IsStrongPassword()
  password?: string;

  // ... status 不变
}
```

> **注意**：`RegisterDto`（`apps/api/src/auth/dto/registration.dto.ts`）已经有 `@MinLength(8)` + `@Matches(/^(?=.*[a-zA-Z])(?=.*\d).+$/)` 的密码校验规则，可以选择替换为 `@IsStrongPassword()` 以统一，也可以保持不动（行为等价）。推荐统一替换以减少规则散落。

### 3.6 JWT_SECRET 强度检查

修改 `apps/api/src/auth/auth.module.ts`，在 JWT 配置初始化时增加强度检查：

```typescript
const secret = config.get<string>('JWT_SECRET');
if (!secret) {
  throw new Error('JWT_SECRET environment variable is required');
}
if (secret.length < 32) {
  const logger = new Logger('AuthModule');
  logger.warn(
    `⚠️ JWT_SECRET 长度为 ${secret.length}，建议至少 32 个字符以确保安全强度`,
  );
}
```

同样检查 `JWT_CUSTOMER_SECRET`（车主小程序用）：

```typescript
// 在 customer-portal 模块的 JWT 配置中也做类似检查
const customerSecret = config.get<string>('JWT_CUSTOMER_SECRET') || (secret + ':customer');
if (customerSecret.length < 32) {
  const logger = new Logger('CustomerPortalModule');
  logger.warn(
    `⚠️ JWT_CUSTOMER_SECRET 实际长度为 ${customerSecret.length}，建议独立配置且至少 32 个字符`,
  );
}
```

这是**警告日志**而非启动拦截——开发环境允许用短 secret 快速测试。

### 3.7 单元测试

#### 3.7.1 密码校验器测试

新建 `apps/api/src/common/validators/password.validator.spec.ts`：

覆盖场景：
- `''` → 失败
- `'12345678'`（纯数字） → 失败
- `'abcdefgh'`（纯字母） → 失败
- `'abc123'`（6位） → 失败（长度不足）
- `'Abc12345'` → 成功
- `'a1234567'` → 成功
- `'ABCD1234'` → 成功
- `'ab12中文xx'` → 成功（包含中文也行，只要有字母 + 数字 + 8位以上）

#### 3.7.2 文件名消毒测试

在 `apps/api/src/file/file.service.spec.ts`（新建或追加）中：

覆盖场景：
- `'normal.jpg'` → `'normal.jpg'`
- `'../../../etc/passwd'` → `'etc/passwd'`（移除路径穿越字符后 → `'etcpasswd'`）
- `'file<script>.jpg'` → `'filescript.jpg'`
- `'a'.repeat(300) + '.pdf'` → 截断至 200 字符
- `''` → `'unnamed'`
- `'测试文件.png'` → `'测试文件.png'`（中文保留）
- `'file name (1).jpg'` → `'filename1.jpg'`（空格和括号去除）

## 4. 验收标准

- [ ] `pnpm add helmet @nestjs/throttler` 安装成功
- [ ] HTTP 响应头包含 Helmet 默认安全头（X-Content-Type-Options: nosniff, X-Frame-Options 等）
- [ ] Swagger UI (`/api/docs`) 可正常访问，不被 CSP 阻断
- [ ] CORS 仅允许 `CORS_ORIGINS` 指定的域名，其他域名返回 CORS 错误
- [ ] `CORS_ORIGINS` 未配置时默认允许 `localhost:5173` 和 `localhost:5174`
- [ ] 兼容旧环境变量 `CORS_ORIGIN`（单数形式）
- [ ] 全局默认限流生效：60 秒内同一 IP 超过 100 次请求返回 429
- [ ] 登录接口限流：60 秒内超过 5 次返回 429（HTTP 429 Too Many Requests）
- [ ] 文件上传限流：60 秒内超过 10 次返回 429
- [ ] 上传不允许的 MIME 类型（如 `application/x-executable`）返回 400 校验错误
- [ ] 上传超过 10MB 的文件返回 400 校验错误
- [ ] 文件名中的路径穿越字符和特殊字符被消毒
- [ ] `CreateTenantDto` 密码要求至少 8 位，包含字母和数字（`MinLength(6)` 被替换）
- [ ] 密码 `'123456'` 被 DTO 校验拒绝，`'Abc12345'` 被接受
- [ ] 启动时 `JWT_SECRET` 长度 < 32 打印 warn 日志（不阻断启动）
- [ ] 现有 API 功能不受影响（登录、CRUD、文件上传等正常使用）
- [ ] `nest build` 编译通过
- [ ] 新增单元测试全部通过

## 5. 注意事项

- **Helmet 对 Swagger UI 的影响**：Swagger UI 使用内联脚本和样式，Helmet 默认的 CSP 会阻止。必须对 `/api/docs` 路径关闭 CSP 或配置 nonce。推荐方案是路径判断，对 Swagger 路径放宽 CSP（见 3.1）
- **限流使用内存存储**：当前单实例部署，ThrottlerModule 默认内存存储即可。未来多实例部署时需切换为 Redis 存储（`@nestjs/throttler-storage-redis`），本任务不需要
- **ThrottlerGuard 与 @Public() 装饰器**：ThrottlerGuard 不读取 `@Public()` 元数据，它独立于 JwtAuthGuard。所有端点（包括 Public 端点）都受全局限流约束，这是期望行为
- **不要破坏现有 API 兼容性**：所有修改仅做安全增强，不改变业务逻辑。现有前端代码无需修改即可正常工作
- **CORS_ORIGIN（单数）向后兼容**：已有 `.env` 可能使用 `CORS_ORIGIN`，需兼容读取
- **密码策略仅约束新建/修改**：现有弱密码的用户不会被锁定，只在下次修改密码时强制升级策略
- 遵循项目响应格式 `{ code, message, data }` 与现有 DTO 校验规范
- 金额相关字段保持 Decimal，不引入 float（本任务不涉及金额，但需遵守全局约束）

---

## 6. 回执区域（Agent 完成后填写）

> **Agent 请在完成任务后，将以下表格填写完整并追加到本文件此节：**

| 项目 | 内容 |
|------|------|
| 修改的文件列表 | `apps/api/src/main.ts`（Helmet + CORS 白名单 + express 类型）；`apps/api/src/app.module.ts`（`ThrottlerModule.forRoot` + 全局 `ThrottlerGuard` 作为首个 `APP_GUARD`）；`apps/api/src/auth/auth.controller.ts`（login 5/min，refresh 10/min）；`apps/api/src/auth/registration.controller.ts`（register / send-code 各 10/min）；`apps/api/src/customer-portal/customer-portal.controller.ts`（wx-login / send-code 10/min，bind 5/min）；`apps/api/src/file/file.controller.ts`（upload-url 10/min）；`apps/api/src/file/file.service.ts`（MIME / size 服务端双校验 + `FileService.sanitizeFileName`）；`apps/api/src/file/dto/file.dto.ts`（MIME 白名单 + 10MB 上限 + `Min(1)`）；`apps/api/src/platform/tenant/dto/tenant.dto.ts`（`CreateTenantDto` / `UpdateTenantDto` 密码 `MinLength(6)` → `@IsStrongPassword()`）；`apps/api/src/auth/dto/registration.dto.ts`（`RegisterDto` 密码 inline 规则替换为 `@IsStrongPassword()`）；`apps/api/src/auth/auth.module.ts`（`JWT_SECRET` 长度 < 32 打印 warn）；`apps/api/src/customer-portal/customer-portal.module.ts`（`JWT_CUSTOMER_SECRET` 长度 < 32 打印 warn）；`.env.example`（`CORS_ORIGIN` → `CORS_ORIGINS` 并说明兼容旧名）；`.env.production.example`（同上）；`apps/api/package.json`（`helmet@^8.2.0` + `@nestjs/throttler@^6.5.0`） |
| 新建的文件列表 | `apps/api/src/common/validators/password.validator.ts`（`@IsStrongPassword()` 自定义装饰器）；`apps/api/src/common/validators/password.validator.spec.ts`（10 个用例）；`apps/api/src/file/file.service.sanitize.spec.ts`（9 个用例） |
| 构建是否通过 | ✅ `pnpm --filter @car/api run build` 通过（首次出现 `main.ts` 中间件参数隐式 any 错误，补 `express` 类型后修复）；✅ `nest start`（通过 `node dist/apps/api/src/main.js`）启动成功，3 秒内完成模块初始化 |
| 测试是否通过（新增用例数） | ✅ Jest：24 suites / 213 tests 全部通过。新增 19 个用例（`password.validator.spec.ts` 10 个：空串 / 纯数字 / 纯字母 / 6 位混合 / 7 位混合 / 8 位混合三种组合 / 中文混合 / 非字符串 / 默认错误信息；`file.service.sanitize.spec.ts` 9 个：正常名 / 路径穿越 / 特殊字符 / 中文保留 / 空回退 unnamed / 前导点 / 超长截断且保留扩展名 / 非字符串 / 下划线连字符数字）。**线上 Smoke Test**（node 启动真实 API）：① `/api/docs` 返回 `X-Frame-Options: SAMEORIGIN` + `X-Content-Type-Options: nosniff` 且**无 CSP**；② `/api/health` 返回完整 CSP（`default-src 'self'` 等）+ HSTS；③ CORS allowed origin 返回 `Access-Control-Allow-Origin: http://127.0.0.1:5173` + Credentials；④ blocked origin 返回 HTTP 500；⑤ `/api/auth/login` 第 6 次返回 429；⑥ `/api/auth/register` 密码 `'123456'` → 400 + 自定义消息 `"密码至少8位，且必须包含字母和数字"`，密码 `'Abc12345'` 通过校验进入业务逻辑；⑦ register 第 9 次开始返回 429（含前期调用已消耗配额） |
| 已知限制或遗留问题 | (1) `ThrottlerModule` 默认内存存储，单实例可；多实例横向扩展时需切 `@nestjs/throttler-storage-redis`。(2) CORS 被拒时 NestJS 透传 `new Error(...)` 为 HTTP 500，可后续在 `AllExceptionsFilter` 中加一条匹配规则改成 403，本任务按规范实现未做额外改写。(3) Helmet 默认 CSP 对 Swagger UI 的内联脚本/样式不友好，已通过 `req.path.startsWith('/api/docs')` 对该路径关闭 CSP + COEP；如生产环境关闭 Swagger，可去除该分支改用全量 CSP。(4) 全局限流对 `@Public()` 端点同样生效，符合"未认证也能防暴力"的安全目标；若某些端点需豁免可加 `@SkipThrottle()`。(5) `JWT_SECRET` / `JWT_CUSTOMER_SECRET` 强度检查为 warn 级，不阻断开发启动；生产环境 `.env.production.example` 模板已强调 ≥ 32 字符占位符 |
| 执行耗时 | 约 45 分钟（依赖安装 + 11 处代码改动 + 2 个 spec 文件 + nest build + 213 测试 + 真实 API 启动 smoke test） |

---

## 7. 架构师审核区域

> 审核人填写，Agent 请勿改动此节。

### 产品经理审核记录（2026-06-13）

- **审核结论**：✅ 通过
- **核对项目**：
  - **Helmet.js 与 CORS**：✅ 成功集成了 Helmet，并且精细处理了 Swagger UI (`/api/docs`) 的 CSP 问题，避免了前端文档的展示异常。CORS 白名单配置合理，并考虑了老旧环境变量的向下兼容。
  - **全局及端点级限流**：✅ `@nestjs/throttler` 配置标准。全局防护（100次/60秒）+ 高危接口细粒度防护（登录/发验证码 5-10次/60秒）结合得很好。
  - **文件上传安全**：✅ 服务端双重校验（MIME和大小）以及对文件名的全面消毒（移除路径穿越、隐藏前导点等），大大降低了安全风险。
  - **弱密码防护**：✅ 统一使用了自定义装饰器 `@IsStrongPassword()`，逻辑清晰严谨。
  - **JWT 强度告警**：✅ 柔性阻断（仅打印 Warn），兼顾了本地开发体验和生产环境警示。
  - **测试覆盖**：✅ 补充了密码校验与文件名消毒的核心边界测试用例。
- **总结**：安全加固涉及的防御面很广，Agent 实现得非常细腻，不仅满足了硬性指标，也在可用性（如兼容 Swagger）和向前兼容性上考虑得十分周全。
- **TASK-204 状态**：✅ 已关闭
