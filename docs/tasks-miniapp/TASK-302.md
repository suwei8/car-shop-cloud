# TASK-302 — 商户端小程序注册流程（mp-weixin）

> 优先级：P0　依赖：TASK-301　关联方案：`docs/08-miniprogram-first-product-plan.md` 第 5 节

## 1. 背景与现状

- 移动端 `apps/mobile` 为 uni-app，**已配置微信小程序编译**：`manifest.json` 含 `mp-weixin` 与 appid；`package.json` 含 `dev:mp-weixin` / `build:mp-weixin`。
- 已有登录页 `apps/mobile/src/pages/login/login.vue`、`stores/auth.ts`。
- 本任务在小程序端实现「注册/开户 onboarding」流程，对接 TASK-301 的后端接口。

## 2. 注册流程（实现目标）

```
1. 打开小程序「车店管家」
2. 微信登录（调 wx.login 拿 code → POST /auth/wechat/login）
   - 已绑定 → 直接登录进首页
   - 未绑定 → 进入 onboarding
3. 输入手机号 → 发送短信验证码（/auth/register/send-code）→ 校验
4. 选择经营类型（汽修 / 洗美快修 / 综合汽服）
5. 填写店名（必填）、员工数（必填）、地址/联系电话（选填）
6. 提交注册（/auth/register，携带 businessType/employeeCount/openid，password 不传）
7. 自动登录 → 进入首页，引导「开第一张单」
```

## 3. 详细要求

- 新增 onboarding 页面（如 `pages/onboarding/index.vue`），注册到 `pages.json`；
- 复用/扩展 `stores/auth.ts` 保存 token、租户与试用状态、简易模式 flag；
- **不采用**微信「手机号快速验证（getPhoneNumber）」组件（按次计费）；手机号一律用「手输 + 短信验证码」；
- 表单校验：手机号格式、验证码、店名长度、员工数为正整数、经营类型必选；
- 发码按钮 60s 倒计时，防重复点击；错误提示友好；
- 注册成功后跳转首页，并触发「开第一张单」引导（可为弹窗/高亮，简单即可）；
- 适配小程序端 API 请求封装（沿用现有移动端 request 封装）。

## 4. 约束

- 只做商户端，不含任何车主端内容；
- UI 面向小店老板，文案口语化、步骤短；
- 不写死后端域名/密钥，走现有配置；
- 保证 `npm run build:mp-weixin`（或 `pnpm --filter @car/mobile build:mp-weixin`）可编译通过。

## 5. 验收标准

- [ ] onboarding 页面与路由完成，流程符合第 2 节；
- [ ] 微信登录、发码、注册、自动登录链路打通（对接 TASK-301）；
- [ ] 未采用 getPhoneNumber 付费组件；
- [ ] 发码倒计时、表单校验、错误提示完善；
- [ ] `build:mp-weixin` 可编译；
- [ ] **必填验证**：在微信开发者工具或 H5 模式下，演示「微信登录→发码→注册→进首页」，过程/截图说明写入回执。

## 6. 回执区域（执行 Agent 填写）
### 6.1 执行摘要
- 执行人 / 时间 / 结论：
### 6.2 修改文件清单
| 文件 | 操作 | 说明 |
|------|------|------|
| | | |
### 6.3 验收结果
| 检查项 | 结果 | 证据 |
|--------|------|------|
| onboarding 流程 | | |
| 与后端链路打通 | | |
| 未用付费手机号组件 | | |
| build:mp-weixin | | |
| 端到端演示(必填) | | |
### 6.4 遗留问题
-

## 7. 派发词
```text
你是车店云管家项目的执行 Agent。请完成 TASK-302（商户端小程序注册流程）。
工作目录：/home/sw/dev_root/car　任务书：docs/tasks-miniapp/TASK-302.md
1. 先读 AGENTS.md 与 docs/08-miniprogram-first-product-plan.md 第 5 节；确认 TASK-301 已完成。
2. 在 apps/mobile（uni-app, mp-weixin）实现 onboarding：微信登录→手机号+短信验证码→选经营类型→填店名/员工数→注册→自动登录进首页。
3. 不采用微信 getPhoneNumber 付费组件；手机号用手输+短信验证码。只做商户端，不含车主端。
4. 确保 build:mp-weixin 可编译；在开发者工具/H5 演示端到端流程并写入回执（必填）。
5. 回执填入任务书第 6 节，勿改其他章节。完成后停止等待审核。
```
