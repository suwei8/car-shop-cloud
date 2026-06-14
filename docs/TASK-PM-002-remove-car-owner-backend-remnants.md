# TASK-PM-002 — 彻底移除车主端后端尾巴（微信MP推送 + CustomerWxBinding + 车主配置）

> 创建人：PM Agent
> 创建时间：2026-06-13
> 优先级：P0（方向收口配套清理）
> 关联：`docs/08-miniprogram-first-product-plan.md`（小程序优先、不做车主端）、`docs/TASK-PM-001-product-direction-correction.md`
> 决策依据：产品已确定**不做车主小程序/车主端**。车主端后端主体（customer-portal 模块、车主 JWT）已删除。本任务清理剩余的车主端尾巴。

---

## 1. 背景

车主端已下线。当前仍残留**仅服务于车主端**的后端代码与配置：

- 给车主推送微信模板消息的 Provider；
- 车主微信绑定数据模型；
- 车主小程序相关的环境变量与 JWT 密钥配置。

产品已确认**彻底移除**这些尾巴。

> 重要边界：**短信通知能力必须保留**（完工短信、取车提醒等走自有短信通道，与本任务无关）。本任务只移除“微信 MP 推送给车主”这条链路，不得影响短信链路。

---

## 2. 移除清单（已定位，按此执行）

### 2.1 删除文件

- `apps/api/src/notification/providers/wechat-mp.provider.ts`（约 138 行，仅被通知模块使用）。

### 2.2 `apps/api/src/notification/notification.module.ts`

- 移除 `import { WechatMpProvider } ...`；
- 从 `providers: [...]` 中移除 `WechatMpProvider`。

### 2.3 `apps/api/src/notification/notification.service.ts`

- 移除 `import { WechatMpProvider } ...`；
- 移除字段 `private wechatMpProvider: WechatMpProvider;`；
- 移除构造函数中的 `@Optional() wechatMpProvider?` 参数及 `this.wechatMpProvider = ...` 赋值；
- 移除 `send()` 方法中的 `if (input.channel === 'wechat_mp') { ... }` 整个分支；
- 移除方法 `sendWechatMpOrFallback(...)`（约第 228 行起，**经核查无任何外部调用方**，可安全删除）；
- 保留 `sms` 分支与 `skip()` 等短信相关逻辑不变。

> 注意：删除 `wechat_mp` 分支后，若 `send()` 收到非 `sms` 渠道，应走原有的兜底/skip 逻辑或明确返回；执行 Agent 需保证 `send()` 对未知 channel 的行为合理且不抛未捕获异常。

### 2.4 `apps/api/src/notification/notification.service.spec.ts`

- 移除/调整所有微信 MP（wechat_mp、openid、WxBinding、sendWechatMpOrFallback）相关用例；
- 保留并确保短信相关用例全部通过。

### 2.5 Prisma schema：`apps/api/prisma/schema.prisma`

- 删除 `model CustomerWxBinding { ... }`（约第 1012 行）；
- 删除其反向关系字段：
  - 第 57 行附近：`customerWxBindings CustomerWxBinding[]`；
  - 第 410 行附近：`wxBindings  CustomerWxBinding[]`；
  - 执行 Agent 需确认这两处所属模型（Tenant / Customer 等），删除对应关系行，确保 schema 校验通过。
- 生成迁移：`prisma migrate dev --name remove_customer_wx_binding`（在本机 docker-compose 的 PostgreSQL 上执行，**不得对生产库操作**）。
- 确认迁移只 DROP `customer_wx_binding` 表及相关外键，不误伤其他表。

### 2.6 环境变量配置

- `.env.example`：删除“车主小程序 JWT 密钥”“车主微信小程序”及 `WX_MINI_*`、车主端 JWT 等相关块（约第 16、45 行附近）；
- `.env.production.example`：删除对应块（约第 30、68 行附近）；
- 检查 `WX_MINI_APPID` / `WX_MINI_SECRET` / `WX_TPL_*` 等仅服务于车主微信推送的变量，一并清理；
- 确认 `.env.example` / `.env.production.example` 删除后无悬空引用（全仓 grep 这些变量名应无代码引用）。

---

## 3. 禁止事项

1. 不得影响短信通知链路（完工短信、取车提醒、注册验证码等）；
2. 不得删除 `Notification` 模型本身（短信记录仍用它）；
3. 不得改动与本任务无关的业务模块；
4. 迁移只能在本地/测试库执行，严禁操作生产库；
5. 不得提交真实密钥。

---

## 4. 验收标准

- [ ] `wechat-mp.provider.ts` 已删除；
- [ ] 全仓 grep `WechatMp|wechat-mp|CustomerWxBinding|customerWxBinding|sendWechatMpOrFallback` 在 `apps/api/src`（排除 dist/node_modules）**无残留引用**；
- [ ] `schema.prisma` 中 `CustomerWxBinding` 模型及其反向关系已删除，`prisma validate` 通过；
- [ ] 新增迁移已生成，仅 DROP 车主绑定表；
- [ ] `.env.example`、`.env.production.example` 车主端配置块已删除，且无代码引用悬空变量；
- [ ] 短信通知相关测试全部通过；
- [ ] `pnpm build:api` 通过；
- [ ] 受影响的测试套件全部通过（含 notification.service.spec.ts 调整后）。

### 验证命令

```bash
cd /home/sw/dev_root/car
grep -rn "WechatMp\|wechat-mp\|CustomerWxBinding\|sendWechatMpOrFallback\|WX_MINI" apps/api/src apps/api/prisma .env.example .env.production.example | grep -v node_modules
pnpm --filter @car/api run prisma:validate || npx prisma validate --schema apps/api/prisma/schema.prisma
pnpm build:api
pnpm --filter @car/api test
```

---

## 5. 回执区域（执行 Agent 完成后填写，勿改动以上内容）

### 5.1 执行摘要

- 执行人：
- 执行时间：
- 总体结论：

### 5.2 修改/删除文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| | | |

### 5.3 验收结果

| 检查项 | 结果 | 证据/说明 |
|--------|------|-----------|
| wechat-mp.provider.ts 删除 | 通过/未通过 | |
| 无残留引用(grep) | 通过/未通过 | 附 grep 输出 |
| CustomerWxBinding 删除 + prisma validate | 通过/未通过 | |
| 迁移仅 DROP 绑定表 | 通过/未通过 | 附迁移 SQL |
| .env 配置清理 | 通过/未通过 | |
| 短信链路不受影响 | 通过/未通过 | |
| pnpm build:api | 通过/未通过 | |
| 测试套件 | 通过/未通过 | 附通过数 |

### 5.4 遗留问题与建议

-

---

## 6. 任务派发词（复制给执行 Agent）

```text
你是车店云管家项目的执行 Agent。请完成清理任务 TASK-PM-002（彻底移除车主端后端尾巴）。

工作目录：/home/sw/dev_root/car
任务书：/home/sw/dev_root/car/docs/TASK-PM-002-remove-car-owner-backend-remnants.md

背景：产品已确定不做车主小程序/车主端。需移除仅服务于车主端的：微信MP推送Provider、CustomerWxBinding模型、车主小程序相关env配置。务必保留短信通知能力（完工短信/取车提醒/验证码），不得影响短信链路。

执行要求：
1. 先读 /home/sw/dev_root/car/AGENTS.md 遵守硬约束。
2. 完整阅读任务书，严格按第 2 节移除清单执行，按第 3 节禁止事项约束。
3. Prisma 迁移只在本机 docker-compose 的 PostgreSQL 执行，严禁操作生产库；备份产物不得入库。
4. 完成后执行第 4 节全部验证命令，确保 build 与测试通过、grep 无残留引用。
5. 将回执填入任务书第 5 节回执区域，不得改动其他章节。回执需附 grep 输出、迁移 SQL、测试通过数。

完成后停止，等待 PM Agent 审核。
```
