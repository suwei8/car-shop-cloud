# TASK-209：数据分析看板（ECharts 可视化 + 后端统计 API）

> **优先级**：P2
> **状态**：✅ 已关闭
> **依赖**：无
> **可并行**：TASK-208、TASK-210

## 1. 任务目标

当前 Dashboard（`apps/api/src/tenant/dashboard/dashboard.service.ts`）仅提供简单的今日统计数字（今日工单数、今日营收、进行中工单数等），缺乏趋势分析、分布分析等多维度数据洞察。

商户需要更丰富的经营数据来优化运营决策，包括：
- 营收趋势（按日/周/月查看收入变化）
- 工单分布（按状态、类型分析工单结构）
- 技师产能（排行榜、工单数/营收/完工率）
- 客户分析（新客/回头客比例、回头率趋势）
- 配件消耗 TOP 10

完成后效果：新增独立的「数据分析」页面，使用 ECharts 图表展示各维度数据，支持日期范围筛选，帮助商户用数据驱动运营。

## 2. 涉及文件

### 新建文件
- `apps/api/src/tenant/analytics/analytics.module.ts`
- `apps/api/src/tenant/analytics/analytics.controller.ts`
- `apps/api/src/tenant/analytics/analytics.service.ts`
- `apps/api/src/tenant/analytics/dto/analytics-query.dto.ts`
- `apps/api/src/tenant/analytics/analytics.service.spec.ts`
- `apps/web/src/views/analytics/AnalyticsDashboard.vue` — 数据分析主页面
- `apps/web/src/views/analytics/components/RevenueChart.vue` — 营收趋势折线图
- `apps/web/src/views/analytics/components/WorkOrderChart.vue` — 工单统计图（饼图 + 柱状图）
- `apps/web/src/views/analytics/components/TechnicianChart.vue` — 技师排行榜柱状图
- `apps/web/src/views/analytics/components/CustomerChart.vue` — 客户分析图
- `apps/web/src/views/analytics/components/PartsChart.vue` — 配件消耗排行

### 修改文件
- `apps/api/src/app.module.ts` — 注册 AnalyticsModule
- `apps/web/src/router/index.ts` — 新增数据分析路由
- `apps/web/src/layouts/MainLayout.vue` — 侧边栏菜单新增「数据分析」
- `apps/web/package.json` — 安装 echarts + vue-echarts 依赖

## 3. 详细要求

### 3.1 安装前端依赖

```bash
cd apps/web
pnpm add echarts vue-echarts
```

### 3.2 后端 Analytics 模块

#### 3.2.1 DTO 定义

`apps/api/src/tenant/analytics/dto/analytics-query.dto.ts`：

```typescript
import { IsOptional, IsDateString, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AnalyticsQueryDto {
  @ApiProperty({ description: '开始日期', required: false, example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ description: '结束日期', required: false, example: '2026-06-30' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ description: '时间维度（营收趋势用）', required: false, enum: ['day', 'week', 'month'] })
  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  dimension?: 'day' | 'week' | 'month';

  @ApiProperty({ description: '门店 ID 筛选', required: false })
  @IsOptional()
  shopId?: string;
}
```

#### 3.2.2 Controller 端点定义

`apps/api/src/tenant/analytics/analytics.controller.ts`：

```typescript
@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private service: AnalyticsService) {}

  @Get('revenue')
  @ApiOperation({ summary: '营收趋势' })
  async getRevenue(@CurrentUser() user: JwtPayload, @Query() query: AnalyticsQueryDto) {
    return this.service.getRevenueTrend(user, query);
  }

  @Get('work-orders')
  @ApiOperation({ summary: '工单统计' })
  async getWorkOrders(@CurrentUser() user: JwtPayload, @Query() query: AnalyticsQueryDto) {
    return this.service.getWorkOrderStats(user, query);
  }

  @Get('technicians')
  @ApiOperation({ summary: '技师产能排行' })
  async getTechnicians(@CurrentUser() user: JwtPayload, @Query() query: AnalyticsQueryDto) {
    return this.service.getTechnicianRanking(user, query);
  }

  @Get('customers')
  @ApiOperation({ summary: '客户分析' })
  async getCustomers(@CurrentUser() user: JwtPayload, @Query() query: AnalyticsQueryDto) {
    return this.service.getCustomerAnalysis(user, query);
  }

  @Get('parts')
  @ApiOperation({ summary: '配件消耗 TOP 10' })
  async getParts(@CurrentUser() user: JwtPayload, @Query() query: AnalyticsQueryDto) {
    return this.service.getPartsConsumption(user, query);
  }
}
```

#### 3.2.3 Service 实现

`apps/api/src/tenant/analytics/analytics.service.ts`：

**a) 营收趋势 `getRevenueTrend`**

```typescript
async getRevenueTrend(user: JwtPayload, query: AnalyticsQueryDto) {
  const tenantId = user.tenantId!;
  const { startDate, endDate, dimension = 'day', shopId } = query;
  const { start, end } = this.getDateRange(startDate, endDate, 30); // 默认最近 30 天

  // 使用 Prisma 原生查询按维度聚合
  // dimension: day → DATE(created_at), week → DATE_TRUNC('week', created_at), month → DATE_TRUNC('month', created_at)
  const truncFn = dimension === 'day' ? 'DATE' : `DATE_TRUNC('${dimension}',`;
  const truncEnd = dimension === 'day' ? '' : ')';

  const result = await this.prisma.$queryRaw`
    SELECT
      ${dimension === 'day'
        ? Prisma.sql`DATE(p.created_at)`
        : Prisma.sql`DATE_TRUNC(${dimension}, p.created_at)`
      } AS period,
      COALESCE(SUM(p.amount), 0) AS total_revenue,
      COUNT(DISTINCT s.id) AS order_count
    FROM payments p
    JOIN settlements s ON p.settlement_id = s.id
    WHERE p.tenant_id = ${tenantId}
      AND p.created_at >= ${start}
      AND p.created_at < ${end}
      ${shopId ? Prisma.sql`AND s.shop_id = ${shopId}` : Prisma.empty}
    GROUP BY period
    ORDER BY period ASC
  `;

  return {
    dimension,
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    data: (result as any[]).map(row => ({
      period: row.period,
      totalRevenue: String(row.total_revenue),  // Decimal 序列化为 string
      orderCount: Number(row.order_count),
    })),
  };
}
```

**b) 工单统计 `getWorkOrderStats`**

```typescript
async getWorkOrderStats(user: JwtPayload, query: AnalyticsQueryDto) {
  const tenantId = user.tenantId!;
  const { start, end } = this.getDateRange(query.startDate, query.endDate, 30);

  // 按状态分布
  const statusDistribution = await this.prisma.workOrder.groupBy({
    by: ['status'],
    where: {
      tenantId,
      createdAt: { gte: start, lt: end },
      ...(query.shopId ? { shopId: query.shopId } : {}),
    },
    _count: { id: true },
  });

  // 按类型分布
  const typeDistribution = await this.prisma.workOrder.groupBy({
    by: ['orderType'],
    where: {
      tenantId,
      createdAt: { gte: start, lt: end },
      ...(query.shopId ? { shopId: query.shopId } : {}),
    },
    _count: { id: true },
  });

  // 完工率趋势（按天）
  const totalByDay = await this.prisma.$queryRaw`
    SELECT
      DATE(created_at) AS period,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status IN ('completed', 'settled')) AS completed
    FROM work_orders
    WHERE tenant_id = ${tenantId}
      AND created_at >= ${start}
      AND created_at < ${end}
      ${query.shopId ? Prisma.sql`AND shop_id = ${query.shopId}` : Prisma.empty}
    GROUP BY period
    ORDER BY period ASC
  `;

  return {
    statusDistribution: statusDistribution.map(s => ({
      status: s.status,
      count: s._count.id,
    })),
    typeDistribution: typeDistribution.map(t => ({
      type: t.orderType,
      count: t._count.id,
    })),
    completionRateTrend: (totalByDay as any[]).map(row => ({
      period: row.period,
      total: Number(row.total),
      completed: Number(row.completed),
      rate: row.total > 0 ? Number(row.completed) / Number(row.total) : 0,
    })),
  };
}
```

**c) 技师产能 `getTechnicianRanking`**

```typescript
async getTechnicianRanking(user: JwtPayload, query: AnalyticsQueryDto) {
  const tenantId = user.tenantId!;
  const { start, end } = this.getDateRange(query.startDate, query.endDate, 30);

  // 从 DispatchTask 聚合技师的工单数和完工数
  const result = await this.prisma.$queryRaw`
    SELECT
      dt.technician_id,
      u.name AS technician_name,
      COUNT(DISTINCT dt.work_order_id) AS order_count,
      COUNT(DISTINCT dt.work_order_id) FILTER (WHERE dt.status = 'completed') AS completed_count,
      COALESCE(SUM(woi.amount), 0) AS total_revenue
    FROM dispatch_tasks dt
    JOIN users u ON dt.technician_id = u.id
    LEFT JOIN work_order_items woi ON woi.technician_id = dt.technician_id
      AND woi.work_order_id = dt.work_order_id
      AND woi.tenant_id = ${tenantId}
    WHERE dt.tenant_id = ${tenantId}
      AND dt.created_at >= ${start}
      AND dt.created_at < ${end}
    GROUP BY dt.technician_id, u.name
    ORDER BY total_revenue DESC
    LIMIT 20
  `;

  return {
    data: (result as any[]).map(row => ({
      technicianId: row.technician_id,
      technicianName: row.technician_name,
      orderCount: Number(row.order_count),
      completedCount: Number(row.completed_count),
      totalRevenue: String(row.total_revenue),
    })),
  };
}
```

**d) 客户分析 `getCustomerAnalysis`**

```typescript
async getCustomerAnalysis(user: JwtPayload, query: AnalyticsQueryDto) {
  const tenantId = user.tenantId!;
  const { start, end } = this.getDateRange(query.startDate, query.endDate, 30);

  // 新客 vs 回头客
  const customerStats = await this.prisma.$queryRaw`
    WITH period_customers AS (
      SELECT DISTINCT customer_id
      FROM work_orders
      WHERE tenant_id = ${tenantId}
        AND created_at >= ${start}
        AND created_at < ${end}
    ),
    first_orders AS (
      SELECT customer_id, MIN(created_at) AS first_order_at
      FROM work_orders
      WHERE tenant_id = ${tenantId}
      GROUP BY customer_id
    )
    SELECT
      COUNT(*) FILTER (WHERE fo.first_order_at >= ${start}) AS new_customers,
      COUNT(*) FILTER (WHERE fo.first_order_at < ${start}) AS returning_customers
    FROM period_customers pc
    JOIN first_orders fo ON pc.customer_id = fo.customer_id
  `;

  // 客户增长趋势（新客户按天）
  const growthTrend = await this.prisma.$queryRaw`
    SELECT
      DATE(MIN(created_at)) AS period,
      COUNT(*) AS new_count
    FROM (
      SELECT customer_id, MIN(created_at) AS created_at
      FROM work_orders
      WHERE tenant_id = ${tenantId}
        AND created_at >= ${start}
        AND created_at < ${end}
      GROUP BY customer_id
      HAVING MIN(created_at) >= ${start}
    ) first_visits
    GROUP BY DATE(created_at)
    ORDER BY period ASC
  `;

  // 客户来源分布（通过 Appointment.source 或直接到店）
  const sourceDist = await this.prisma.$queryRaw`
    SELECT
      COALESCE(a.source, 'walk_in') AS source,
      COUNT(DISTINCT wo.customer_id) AS customer_count
    FROM work_orders wo
    LEFT JOIN appointments a ON a.customer_id = wo.customer_id
      AND a.tenant_id = wo.tenant_id
      AND DATE(a.appoint_time) = DATE(wo.created_at)
    WHERE wo.tenant_id = ${tenantId}
      AND wo.created_at >= ${start}
      AND wo.created_at < ${end}
    GROUP BY source
  `;

  const stats = (customerStats as any[])[0] || { new_customers: 0, returning_customers: 0 };

  return {
    newCustomers: Number(stats.new_customers),
    returningCustomers: Number(stats.returning_customers),
    growthTrend: (growthTrend as any[]).map(row => ({
      period: row.period,
      newCount: Number(row.new_count),
    })),
    sourceDistribution: (sourceDist as any[]).map(row => ({
      source: row.source,
      count: Number(row.customer_count),
    })),
  };
}
```

**e) 配件消耗 TOP 10 `getPartsConsumption`**

```typescript
async getPartsConsumption(user: JwtPayload, query: AnalyticsQueryDto) {
  const tenantId = user.tenantId!;
  const { start, end } = this.getDateRange(query.startDate, query.endDate, 30);

  const result = await this.prisma.$queryRaw`
    SELECT
      woi.part_id,
      p.name AS part_name,
      p.code AS part_code,
      SUM(woi.quantity) AS total_quantity,
      SUM(woi.amount) AS total_amount
    FROM work_order_items woi
    JOIN parts p ON woi.part_id = p.id
    JOIN work_orders wo ON woi.work_order_id = wo.id
    WHERE woi.tenant_id = ${tenantId}
      AND woi.item_type = 'part'
      AND woi.part_id IS NOT NULL
      AND wo.created_at >= ${start}
      AND wo.created_at < ${end}
      ${query.shopId ? Prisma.sql`AND wo.shop_id = ${query.shopId}` : Prisma.empty}
    GROUP BY woi.part_id, p.name, p.code
    ORDER BY total_amount DESC
    LIMIT 10
  `;

  return {
    data: (result as any[]).map(row => ({
      partId: row.part_id,
      partName: row.part_name,
      partCode: row.part_code,
      totalQuantity: String(row.total_quantity),
      totalAmount: String(row.total_amount),
    })),
  };
}
```

**f) 通用日期范围辅助方法**

```typescript
private getDateRange(startDate?: string, endDate?: string, defaultDays = 30): { start: Date; end: Date } {
  const end = endDate ? new Date(endDate + 'T23:59:59.999Z') : new Date();
  const start = startDate
    ? new Date(startDate + 'T00:00:00.000Z')
    : new Date(end.getTime() - defaultDays * 24 * 60 * 60 * 1000);
  return { start, end };
}
```

#### 3.2.4 Module 注册

`apps/api/src/tenant/analytics/analytics.module.ts`：

```typescript
import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
```

在 `app.module.ts` 中注册：

```typescript
import { AnalyticsModule } from './tenant/analytics/analytics.module';

@Module({
  imports: [
    // ... 现有模块
    AnalyticsModule,
  ],
})
export class AppModule {}
```

### 3.3 前端数据分析页面

#### 3.3.1 路由注册

在 `apps/web/src/router/index.ts` 的 `children` 数组中新增：

```typescript
{
  path: 'analytics',
  name: 'Analytics',
  component: () => import('../views/analytics/AnalyticsDashboard.vue'),
  meta: { title: '数据分析', permission: 'tenant:report:view' },
},
```

#### 3.3.2 侧边栏菜单

在 `MainLayout.vue` 的菜单配置中，在「经营提醒」之后新增：

```typescript
{
  title: '数据分析',
  icon: 'TrendCharts',  // Element Plus 图标
  path: '/analytics',
  permission: 'tenant:report:view',
}
```

#### 3.3.3 主页面 AnalyticsDashboard.vue

```vue
<template>
  <div class="analytics-dashboard">
    <!-- 日期范围选择器 -->
    <el-card class="filter-card" shadow="never">
      <el-row :gutter="16" align="middle">
        <el-col :span="8">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            :shortcuts="dateShortcuts"
            @change="onDateChange"
          />
        </el-col>
        <el-col :span="4">
          <el-select v-model="shopId" placeholder="全部门店" clearable @change="fetchAll">
            <el-option v-for="s in shops" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-col>
      </el-row>
    </el-card>

    <!-- 图表网格 -->
    <el-row :gutter="16" class="chart-row">
      <el-col :xs="24" :lg="12">
        <RevenueChart :start-date="startDate" :end-date="endDate" :shop-id="shopId" />
      </el-col>
      <el-col :xs="24" :lg="12">
        <WorkOrderChart :start-date="startDate" :end-date="endDate" :shop-id="shopId" />
      </el-col>
    </el-row>
    <el-row :gutter="16" class="chart-row">
      <el-col :xs="24" :lg="12">
        <TechnicianChart :start-date="startDate" :end-date="endDate" :shop-id="shopId" />
      </el-col>
      <el-col :xs="24" :lg="12">
        <CustomerChart :start-date="startDate" :end-date="endDate" :shop-id="shopId" />
      </el-col>
    </el-row>
    <el-row :gutter="16" class="chart-row">
      <el-col :xs="24" :lg="12">
        <PartsChart :start-date="startDate" :end-date="endDate" :shop-id="shopId" />
      </el-col>
    </el-row>
  </div>
</template>
```

#### 3.3.4 图表组件规范

每个图表组件接收 `startDate`, `endDate`, `shopId` 三个 props，组件内部负责调用对应 API 并渲染 ECharts 图表。

**RevenueChart.vue（营收趋势折线图）**：
- 使用 `vue-echarts` 的 `<v-chart>` 组件
- X 轴：日期，Y 轴：营收金额（万元）
- 支持 day/week/month 切换（通过组件内 dimension 选项卡）
- 折线图 + 面积填充 + tooltip 显示具体金额和工单数

**WorkOrderChart.vue（工单统计）**：
- 左侧：饼图（按状态分布：进行中/已完成/已结算/已取消）
- 右侧：柱状图（按类型分布：维修/洗车/快修）
- 使用 `el-row` + `el-col` 左右布局

**TechnicianChart.vue（技师排行榜）**：
- 水平柱状图，按营收降序排列
- 每条柱显示技师姓名 + 营收金额 + 工单数
- 最多显示 TOP 10

**CustomerChart.vue（客户分析）**：
- 上方：饼图（新客/回头客比例）
- 下方：折线图（每日新客增长趋势）

**PartsChart.vue（配件消耗排行）**：
- 水平柱状图，按消耗金额降序
- 显示配件名称 + 消耗数量 + 金额

#### 3.3.5 日期快捷选项

```typescript
const dateShortcuts = [
  { text: '最近7天', value: () => [new Date(Date.now() - 7 * 86400000), new Date()] },
  { text: '最近30天', value: () => [new Date(Date.now() - 30 * 86400000), new Date()] },
  { text: '最近90天', value: () => [new Date(Date.now() - 90 * 86400000), new Date()] },
  { text: '本月', value: () => {
    const now = new Date();
    return [new Date(now.getFullYear(), now.getMonth(), 1), now];
  }},
  { text: '上月', value: () => {
    const now = new Date();
    return [new Date(now.getFullYear(), now.getMonth() - 1, 1), new Date(now.getFullYear(), now.getMonth(), 0)];
  }},
];
```

#### 3.3.6 API 调用封装

在 `apps/web/src/api/` 下新建 `analytics.ts`（如 api 目录不存在可直接在组件中用 axios/fetch）：

```typescript
import request from '@/utils/request';

export const getRevenueTrend = (params: { startDate: string; endDate: string; dimension?: string; shopId?: string }) =>
  request.get('/analytics/revenue', { params });

export const getWorkOrderStats = (params: { startDate: string; endDate: string; shopId?: string }) =>
  request.get('/analytics/work-orders', { params });

export const getTechnicianRanking = (params: { startDate: string; endDate: string; shopId?: string }) =>
  request.get('/analytics/technicians', { params });

export const getCustomerAnalysis = (params: { startDate: string; endDate: string; shopId?: string }) =>
  request.get('/analytics/customers', { params });

export const getPartsConsumption = (params: { startDate: string; endDate: string; shopId?: string }) =>
  request.get('/analytics/parts', { params });
```

### 3.4 单元测试

新建 `apps/api/src/tenant/analytics/analytics.service.spec.ts`：

- 测试 `getRevenueTrend`：验证返回数据结构正确（含 period、totalRevenue、orderCount）
- 测试 `getWorkOrderStats`：验证按状态/类型分组正确
- 测试 `getTechnicianRanking`：验证按营收降序排列
- 测试 `getCustomerAnalysis`：验证新客/回头客计算逻辑
- 测试 `getPartsConsumption`：验证 TOP 10 排序
- 测试 `getDateRange`：默认 30 天、自定义日期范围
- 测试所有接口的 tenant_id 隔离（传入 user 的 tenantId 用于 WHERE 条件）
- Mock Prisma `$queryRaw` 和 `groupBy`

## 4. 验收标准

- [ ] `GET /api/analytics/revenue` 返回按日/周/月聚合的营收趋势数据，金额序列化为 string
- [ ] `GET /api/analytics/work-orders` 返回状态分布、类型分布、完工率趋势
- [ ] `GET /api/analytics/technicians` 返回技师排行（按营收降序，最多 20 条）
- [ ] `GET /api/analytics/customers` 返回新客/回头客数量 + 客户增长趋势
- [ ] `GET /api/analytics/parts` 返回配件消耗 TOP 10
- [ ] 所有接口支持 `startDate`、`endDate`、`shopId` 筛选参数
- [ ] 所有接口严格按 `tenantId` 隔离数据
- [ ] 平台用户（`isPlatform: true`）访问分析接口返回空数据或合理处理（不报错）
- [ ] 前端新增「数据分析」菜单项，点击进入分析页面
- [ ] 营收趋势折线图正常渲染，支持 day/week/month 切换
- [ ] 工单状态饼图、类型柱状图正常渲染
- [ ] 技师排行水平柱状图正常渲染
- [ ] 客户分析饼图 + 折线图正常渲染
- [ ] 配件消耗排行水平柱状图正常渲染
- [ ] 日期范围选择器工作正常，切换日期自动刷新所有图表
- [ ] 页面响应式布局：大屏 2 列、小屏 1 列
- [ ] 新增单元测试全部通过
- [ ] `npx nest build` 编译通过
- [ ] `vue-tsc --noEmit` 类型检查通过
- [ ] 不影响现有 Dashboard 功能

## 5. 注意事项

- **不要修改现有 Dashboard 页面和 API**，数据分析是独立的新页面
- 统计查询使用 Prisma `$queryRaw` 或 `groupBy/aggregate`，**严禁 N+1 查询**（如先查所有工单再在内存中聚合）
- 大时间范围（90 天以上）查询可能较慢，可考虑：
  - 使用 `DATE()` 或 `DATE_TRUNC()` 在数据库层聚合
  - 后续可引入预聚合表（物化视图），但本任务不要求实现
- 金额字段（`Decimal`）在 `$queryRaw` 返回结果中可能是 `bigint` 或 `Decimal`，统一转为 `String()` 后返回前端
- ECharts 图表组件应在 `onMounted` 中调用 API，并处理 loading 状态和空数据状态
- 所有图表组件应支持 `resize`（使用 `vue-echarts` 内置的 `autoresize` prop）
- 权限复用现有 `tenant:report:view`，不新增权限码
- 前端 API 请求使用项目现有的 `request` 工具函数或 axios 实例，不要新引 HTTP 库

---

## 6. 回执区域（Agent 完成后填写）

> **Agent 请在完成任务后，将以下表格填写完整并追加到本文件此节：**

| 项目 | 内容 |
|------|------|
| 修改的文件列表 | `apps/api/src/app.module.ts`（注册 AnalyticsModule）, `apps/web/src/router/index.ts`（新增 analytics 路由）, `apps/web/src/layouts/MainLayout.vue`（侧边栏新增「数据分析」菜单）, `apps/web/package.json`（安装 echarts + vue-echarts）, `apps/api/prisma/schema.prisma`（新增 Coupon/CouponClaim 模型）, `apps/api/prisma/migrations/20260613180000_add_coupon_marketing/migration.sql`（迁移文件）, `apps/api/prisma/seed-data/permissions.ts`（新增 tenant:marketing:manage 权限） |
| 新建的文件列表 | `apps/api/src/tenant/analytics/analytics.module.ts`, `apps/api/src/tenant/analytics/analytics.controller.ts`, `apps/api/src/tenant/analytics/analytics.service.ts`, `apps/api/src/tenant/analytics/dto/analytics-query.dto.ts`, `apps/api/src/tenant/analytics/analytics.service.spec.ts`（11个测试用例）, `apps/api/src/tenant/marketing/marketing.module.ts`, `apps/api/src/tenant/marketing/marketing.controller.ts`, `apps/api/src/tenant/marketing/marketing.service.ts`, `apps/api/src/tenant/marketing/dto/segment.dto.ts`, `apps/api/src/tenant/marketing/dto/campaign.dto.ts`, `apps/api/src/tenant/marketing/dto/coupon.dto.ts`, `apps/api/src/tenant/marketing/marketing.service.spec.ts`（10个测试用例）, `apps/web/src/api/analytics.ts`（API 调用封装）, `apps/web/src/views/analytics/AnalyticsDashboard.vue`, `apps/web/src/views/analytics/components/RevenueChart.vue`, `apps/web/src/views/analytics/components/WorkOrderChart.vue`, `apps/web/src/views/analytics/components/TechnicianChart.vue`, `apps/web/src/views/analytics/components/CustomerChart.vue`, `apps/web/src/views/analytics/components/PartsChart.vue`, `apps/web/src/views/marketing/CampaignManage.vue`, `apps/web/src/views/marketing/CouponManage.vue` |
| 构建是否通过 | ✅ `nest build` 通过, ✅ `vue-tsc --noEmit` 通过, ✅ `vite build` 通过 |
| 测试是否通过（新增用例数） | ✅ 全部 241 个测试通过（25 个 suite），新增 21 个用例（analytics 11 + marketing 10） |
| 已知限制或遗留问题 | 1. 源分布(sourceDistribution)字段因 Appointment.source 字段已移除，暂时返回空数组；2. 营销短信实际发送为模拟实现，需对接 TASK-202 的阿里云短信服务；3. 客户分群的来源筛选因 Appointment.source 已移除暂时不可用 |
| 执行耗时 | 约 25 分钟 |

## 7. 架构师审核区域

> 审核人填写，Agent 请勿改动此节。

### 产品经理审核记录（2026-06-13）

- **审核结论**：✅ 通过
- **核对项目**：
  - **性能与聚合**：✅ 分析模块后端所有聚合操作均合理使用了 `$queryRaw` 与 `GROUP BY`，完全规避了低效的内存聚合问题。且通过全局携带 `tenantId`，确保了数据隐私红线不被破坏。
  - **可视化呈现**：✅ 前端对 ECharts 的集成到位，按业务维度的拆分使得代码具备了很好的维护性。
  - **测试覆盖率**：✅ 联合任务中新增了 21 个核心测试，总测试绿灯数达到 241，验证了限流、统计、金额抵扣等场景的可靠性。
- **复核意见**：TASK-209 及 TASK-210 的完成标志着整个系统从业务闭环正式跨入了“商业增值闭环”。干得极其漂亮！
- **TASK-209 状态**：✅ 已关闭
