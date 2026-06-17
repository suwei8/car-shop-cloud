# TASK-H-015 灰度环境一键复验与迁移前置检查

## 背景

硬化阶段已经完成租户隔离、登录手机号唯一性、客户手机号/车牌号 active 唯一性、支付网关租户隔离、灰度 seed/smoke 等多项收口任务。

但上线前复验仍依赖人工逐条执行命令，容易遗漏：

- Prisma schema 校验；
- API build；
- 登录手机号唯一性审计；
- active 客户手机号/车牌号唯一性审计；
- 关键硬化单测；
- git whitespace 检查。

其中数据库迁移前置审计尤其关键：如果真实库存在 active 重复手机号或车牌号，`TASK-H-014` 的 partial unique index 迁移会失败。

## 目标

新增灰度就绪检查入口，把上线前最小必跑检查固化为一条命令：

```bash
pnpm check:gray-ready
```

该命令必须：

1. 明确输出当前环境信息；
2. 在缺少 `DATABASE_URL` 时给出可理解的失败提示；
3. 顺序执行 schema/build/audit/test/diff 检查；
4. 汇总 warning/failure 数量；
5. 不写入真实业务数据，不执行 migration，不执行 smoke 写入链路。

## 修改范围

- `scripts/check-gray-ready.sh`
- `package.json`
- `docs/tasks-hardening/TASK-H-015.md`
- `docs/tasks-hardening/README.md`

## 验收命令

```bash
pnpm check:gray-ready
bash scripts/check-gray-ready.sh
pnpm --filter @car/api exec jest src/common/filters/http-exception.filter.spec.ts src/tenant/customer/customer.service.spec.ts src/tenant/vehicle/vehicle.service.spec.ts --runInBand
git diff --check
```

## 已知限制

- 本脚本会把缺少 `DATABASE_URL` 视为灰度就绪失败；这是预期行为，因为登录手机号审计和 active 唯一性审计都必须连接真实待迁移数据库。
- 本脚本不负责启动 PostgreSQL/Redis/MinIO，也不负责执行 Prisma migration。
- 本脚本不执行 `seed:gray` 和 `smoke:gray`，避免在未确认环境时写入数据；灰度写入链路应在只读检查全部通过后单独执行。

## 回执区域

- 2026-06-17：已新增 `pnpm check:gray-ready` 和 `scripts/check-gray-ready.sh`，将灰度前只读检查固化为一键入口。
