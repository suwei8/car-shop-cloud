# TASK-001：基础设施 — 全局响应拦截器 + 异常过滤器 + DTO 校验加固

> **优先级**：P0
> **状态**：✅ 已关闭
> **依赖**：无（本任务为基础设施，后续所有任务依赖此项）

## 1. 任务目标

为 NestJS 后端建立统一的响应格式、异常处理和输入校验规范，使所有 API 端点返回一致的 `{ code, data, message }` 结构，并确保所有 Controller 端点使用 DTO + class-validator 进行输入校验。

## 2. 涉及文件

### 新建文件
- `apps/api/src/common/interceptors/response.interceptor.ts` — 全局响应拦截器
- `apps/api/src/common/filters/http-exception.filter.ts` — 全局异常过滤器
- `apps/api/src/common/pipes/validation.pipe.ts` — 全局校验管道（如尚未建立）

### 修改文件
- `apps/api/src/main.ts` — 注册全局拦截器、异常过滤器、校验管道
- `apps/api/src/tenant/work-order/work-order.controller.ts` — 将内联类型改为 DTO
- `apps/api/src/tenant/work-order/dto/work-order.dto.ts` — 补充完整校验装饰器
- `apps/api/src/tenant/settlement/settlement.controller.ts` — 将内联类型改为 DTO
- 所有其他 Controller 中使用 `@Body() body: { ... }` 内联类型的端点

## 3. 详细要求

### 3.1 全局响应拦截器

```typescript
// response.interceptor.ts
// 将 Controller 返回值包装为：
// { code: 0, data: <原始返回值>, message: 'success' }
// 如果返回值已经是 { code, data, message } 格式则不重复包装
```

### 3.2 全局异常过滤器

```typescript
// http-exception.filter.ts
// 捕获所有异常并返回：
// { code: <HTTP状态码或业务错误码>, data: null, message: <错误信息> }
// HttpException: 使用原始状态码和 message
// PrismaClientKnownRequestError: P2002→409冲突, P2025→404未找到, 其他→500
// 未知异常: 500, message 为 "服务器内部错误"（不暴露堆栈给客户端）
// 开发环境下可以在 console.error 打印完整错误
```

### 3.3 全局校验管道

- 使用 `ValidationPipe`，配置 `whitelist: true, forbidNonWhitelisted: true, transform: true`
- 确保所有 DTO 的 `class-validator` 装饰器生效

### 3.4 DTO 校验加固

**需要补全校验的端点清单**：

| Controller | 端点 | 当前问题 | 要求 |
|---|---|---|---|
| `work-order.controller.ts` | `addItems` | `@Body() body: { items: any[] }` | 创建 `AddWorkOrderItemsDto`，每个 item 校验 itemType/name/quantity/unitPrice |
| `work-order.controller.ts` | `updateStatus` | `@Body() body: { status: string }` | 创建 `UpdateWorkOrderStatusDto`，status 用 `@IsIn([...])` 限制合法值 |
| `settlement.controller.ts` | `settle` | 检查是否已有完整 DTO | 确保 payments 数组每项有 `@IsString/@IsNumber/@IsOptional` 校验 |
| `settlement.controller.ts` | `reverse` | 检查是否需要 DTO | 至少校验 settlementId 为 UUID/cuid 格式 |
| 其他所有 Controller | 逐一检查 | 内联 `@Body() body: {...}` | 全部替换为 DTO 类 |

**DTO 校验规则**：
- 所有字符串字段：`@IsString()` + `@IsNotEmpty()` 或 `@IsOptional()`
- 所有数字字段：`@IsNumber()` + `@Min(0)` 等
- 枚举字段：`@IsIn([...])`
- 数组字段：`@IsArray()` + `@ValidateNested({ each: true })` + `@Type(() => ChildDto)`
- ID 字段：`@IsString()` + `@IsNotEmpty()`

## 4. 验收标准

- [ ] 所有 API 响应格式统一为 `{ code, data, message }`
- [ ] 异常响应格式统一，不暴露堆栈信息
- [ ] `POST /auth/login` 传入错误格式数据时返回 400 校验错误而非 500
- [ ] `PUT /work-orders/:id/status` 传入非法 status 时返回 400 并列出合法值
- [ ] `POST /work-orders/:id/items` 传入空 items 数组或不合法字段时返回 400
- [ ] 所有 Controller 端点无内联 `@Body()` 类型，全部使用 DTO 类
- [ ] `npm run build` (nest build) 编译通过，无 TypeScript 错误
- [ ] 前端 `apps/web/src/utils/api.ts` 的 token 刷新逻辑与新响应格式兼容（`res.data.data` 取值路径不变）

## 5. 注意事项

- 不要破坏现有的前端 token 刷新逻辑（`api.ts` 中的 `response.data.data` 解构）
- 不要修改 `apps/api/src/auth/auth.service.ts` 的业务逻辑
- 保持现有的 `@RequirePermissions`、`@TenantRequired`、`@CurrentUser` 装饰器不变
- Swagger 文档注解保持不变

---

## 6. 回执区域（Agent 完成后填写）

> **Agent 请在完成任务后，将以下内容追加到本文件末尾：**

```markdown
### 回执

| 项目 | 内容 |
|------|------|
| 修改的文件列表 | （待填写） |
| 新建的文件列表 | （待填写） |
| 构建是否通过 (nest build) | （待填写） |
| 已知限制或遗留问题 | （待填写） |
| 执行耗时 | （待填写） |
```

### 回执

| 项目 | 内容 |
|------|------|
| 修改的文件列表 | `apps/api/src/common/filters/http-exception.filter.ts`（新增 Prisma 错误处理）、`apps/api/src/main.ts`（改用 createValidationPipe）、`apps/api/src/tenant/work-order/dto/work-order.dto.ts`（新增 UpdateWorkOrderStatusDto、AddWorkOrderItemsDto）、`apps/api/src/tenant/work-order/work-order.controller.ts`、`apps/api/src/tenant/settlement/settlement.controller.ts`、`apps/api/src/tenant/customer/dto/customer.dto.ts`（新增 CreateCustomerDto）、`apps/api/src/tenant/customer/customer.controller.ts`、`apps/api/src/tenant/user/dto/user.dto.ts`（新增 CreateUserDto、UpdateUserStatusDto）、`apps/api/src/tenant/user/user.controller.ts`、`apps/api/src/tenant/role/dto/role.dto.ts`（新增 CreateRoleDto）、`apps/api/src/tenant/role/role.controller.ts`、`apps/api/src/tenant/dictionary/dto/dictionary.dto.ts`（新增 CreateDictionaryDto）、`apps/api/src/tenant/dictionary/dictionary.controller.ts`、`apps/api/src/tenant/dispatch/dispatch.controller.ts`、`apps/api/src/tenant/stock/stock.controller.ts`、`apps/api/src/tenant/stored-value-card/stored-value-card.controller.ts`、`apps/api/src/tenant/package-card/dto/package-card.dto.ts`（新增 ConsumePackageCardDto）、`apps/api/src/tenant/package-card/package-card.controller.ts`、`apps/api/src/tenant/system-parameter/system-parameter.controller.ts`、`apps/api/src/file/file.controller.ts`、`apps/api/src/platform/feature-flag/feature-flag.controller.ts`、`apps/api/src/platform/tenant/dto/tenant.dto.ts`（新增 CreateTenantDto）、`apps/api/src/platform/tenant/tenant.controller.ts`、`apps/api/src/tenant/appointment/dto/appointment.dto.ts`（新增 UpdateAppointmentStatusDto）、`apps/api/src/tenant/appointment/appointment.controller.ts`、`apps/api/src/tenant/shop/dto/shop.dto.ts`（新增 CreateShopDto）、`apps/api/src/tenant/shop/shop.controller.ts` |
| 新建的文件列表 | `apps/api/src/common/pipes/validation.pipe.ts`、`apps/api/src/tenant/settlement/dto/settlement.dto.ts`、`apps/api/src/tenant/dispatch/dto/dispatch.dto.ts`、`apps/api/src/tenant/stock/dto/stock.dto.ts`、`apps/api/src/tenant/stored-value-card/dto/stored-value-card.dto.ts`、`apps/api/src/tenant/system-parameter/dto/system-parameter.dto.ts`、`apps/api/src/file/dto/file.dto.ts`、`apps/api/src/platform/feature-flag/dto/feature-flag.dto.ts` |
| 构建是否通过 (nest build) | ✅ 通过，零 TypeScript 错误 |
| 已知限制或遗留问题 | 1. `@Query()` 内联类型未替换为 DTO（任务范围为 `@Body()` 类型）；2. 现有拦截器文件名为 `transform.interceptor.ts`（任务描述为 `response.interceptor.ts`），功能一致未重命名以避免破坏性变更 |
| 执行耗时 | ~15 分钟 |

**变更摘要**：
- 全局异常过滤器新增 `Prisma.PrismaClientKnownRequestError` 处理：P2002→409、P2025→404
- 全局校验管道提取为独立文件 `validation.pipe.ts`，main.ts 改用 `createValidationPipe()`
- 22 个内联 `@Body()` 类型全部替换为带 class-validator 装饰器的 DTO 类
- 新增 8 个 DTO 文件，更新 9 个已有 DTO 文件
- 更新 16 个 Controller 文件
- 前端响应格式 `{ code, data, message }` 和 token 刷新逻辑完全兼容，无破坏性变更

---

## 7. 架构师审核区域

> **架构师审核后填写：**

```markdown
### 审核结果

- **审核时间**：2026-06-11
- **审核结论**：通过（整改完成）
- **审核意见**：
  - 全局异常过滤器 ✅ Prisma P2002→409、P2025→404 处理正确
  - 全局校验管道 ✅ whitelist/forbidNonWhitelisted/transform 配置完整
  - main.ts 注册 ✅ pipe/interceptor/filter 三者已全局注册
  - DTO 质量 ✅ class-validator 装饰器、ApiProperty、嵌套校验均到位
  - 构建 ✅ nest build 零错误通过
  - 整改 ✅ 3 处遗漏已修复：
    1. `platform/tenant/tenant.controller.ts` — `CreateTenantDto` 已创建并替换
    2. `tenant/appointment/appointment.controller.ts` — `UpdateAppointmentStatusDto` 已创建并替换（@IsIn 限制合法值）
    3. `tenant/shop/shop.controller.ts` — `CreateShopDto` 已创建并替换
- **整改提示词**：见下方

---

### 整改提示词（复制给 Agent）

> TASK-001 审核发现 3 个 Controller 仍有内联 `@Body()` 类型，请补充 DTO 替换。请你根据 @docs/tasks/TASK-001.md 的整改要求，修复以下 3 处遗漏：
>
> 1. `apps/api/src/platform/tenant/tenant.controller.ts` 第 34 行 — `create(@Body() body: { name: string; contactName?: string; contactPhone?: string })`，创建 `CreateTenantDto` 类并替换
> 2. `apps/api/src/tenant/appointment/appointment.controller.ts` 第 42 行 — `updateStatus(@Body() body: { status: string })`，创建 `UpdateAppointmentStatusDto` 类并替换（status 用 `@IsIn` 限制合法值）
> 3. `apps/api/src/tenant/shop/shop.controller.ts` 第 35 行 — `create(@Body() body: { name: string; address?: string; phone?: string })`，创建 `CreateShopDto` 类并替换
>
> 每个 DTO 需添加 `class-validator` 装饰器和 `@nestjs/swagger` 的 `ApiProperty` 注解。完成后确认 `nest build` 编译通过。
```
