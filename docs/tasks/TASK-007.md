# TASK-007：前端 TypeScript 类型加固 + 移动端配置化

> **优先级**：P1
> **状态**：✅ 已关闭
> **依赖**：TASK-001（后端响应格式统一后前端需适配）
> **可并行**：随时可并行

## 1. 任务目标

1. 为前端 API 调用层添加完整的 TypeScript 类型定义，减少 `any` 使用
2. 为前端页面添加 loading 状态和错误处理
3. 将移动端硬编码的 `BASE_URL` 改为配置文件

## 2. 涉及文件

### 新建文件
- `apps/web/src/types/api.ts` — API 响应通用类型
- `apps/web/src/types/models.ts` — 业务模型类型定义
- `apps/mobile/src/config.ts` — 移动端环境配置（如已存在则修改）

### 修改文件
- `apps/web/src/utils/api.ts` — 添加泛型请求方法
- `apps/web/src/views/Dashboard.vue` — 添加 loading 状态和错误处理
- `apps/web/src/views/work-orders/WorkOrderList.vue` — 添加类型定义
- `apps/web/src/views/customers/CustomerList.vue` — 添加类型定义
- `apps/web/src/views/settlement/SettlementList.vue` — 添加类型定义
- `apps/web/src/views/member/StoredValueCardList.vue` — 添加类型定义
- `apps/mobile/src/utils/request.ts` — 使用配置文件中的 BASE_URL
- 其他所有使用 `ref<any[]>([])` 的 Vue 组件

## 3. 详细要求

### 3.1 API 响应通用类型

```typescript
// apps/web/src/types/api.ts

export interface ApiResponse<T = any> {
  code: number;
  data: T;
  message: string;
}

export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PaginatedResponse<T> extends ApiResponse<PaginatedData<T>> {}
```

### 3.2 业务模型类型

```typescript
// apps/web/src/types/models.ts

export interface Tenant {
  id: string;
  name: string;
  status: string;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  phone: string;
  isPlatform: boolean;
  tenantId: string | null;
  shopId: string | null;
  roles: string[];
  permissions: string[];
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  gender?: string;
  remark?: string;
  status: string;
  createdAt: string;
}

export interface Vehicle {
  id: string;
  customerId: string;
  plateNo: string;
  brand?: string;
  model?: string;
  vin?: string;
  color?: string;
  mileage?: number;
  status: string;
}

export interface WorkOrder {
  id: string;
  orderNo: string;
  orderType: string;
  status: string;
  totalAmount: number;
  discountAmount: number;
  payableAmount: number;
  customer?: Pick<Customer, 'id' | 'name' | 'phone'>;
  vehicle?: Pick<Vehicle, 'id' | 'plateNo' | 'brand' | 'model'>;
  items?: WorkOrderItem[];
  createdAt: string;
}

export interface WorkOrderItem {
  id: string;
  itemType: 'service' | 'part' | 'addon';
  name: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface Settlement {
  id: string;
  settleNo: string;
  workOrderId: string;
  totalAmount: number;
  discountAmount: number;
  payableAmount: number;
  paidAmount: number;
  debtAmount: number;
  status: string;
  payments: Payment[];
  createdAt: string;
}

export interface Payment {
  id: string;
  payMethod: string;
  amount: number;
  referenceNo?: string;
}

export interface StoredValueCard {
  id: string;
  cardNo: string;
  customerId: string;
  balance: number;
  principalBalance: number;
  giftBalance: number;
  status: string;
}

export interface DashboardOverview {
  todayOrders: number;
  todayRevenue: number;
  inProgressOrders: number;
  todayAppointments: number;
  pendingDispatch: number;
  lowStockCount: number;
}

// ... 其他模型按 schema.prisma 补充
```

### 3.3 API 请求层泛型化

```typescript
// apps/web/src/utils/api.ts
// 在现有 axios 实例基础上，导出带类型的请求辅助函数

export async function apiGet<T>(url: string, params?: Record<string, any>): Promise<T> {
  return api.get(url, { params }) as unknown as T;
}

export async function apiPost<T>(url: string, data?: any): Promise<T> {
  return api.post(url, data) as unknown as T;
}

export async function apiPut<T>(url: string, data?: any): Promise<T> {
  return api.put(url, data) as unknown as T;
}

export async function apiDelete<T>(url: string): Promise<T> {
  return api.delete(url) as unknown as T;
}
```

### 3.4 页面组件类型化

将 `ref<any[]>([])` 替换为具体类型：

```typescript
// Dashboard.vue - Before
const recentOrders = ref<any[]>([]);
const todayAppointments = ref<any[]>([]);

// Dashboard.vue - After
import type { WorkOrder, Appointment } from '../types/models';
const recentOrders = ref<WorkOrder[]>([]);
const todayAppointments = ref<Appointment[]>([]);
```

对所有 Vue 组件逐一执行此替换。

### 3.5 添加 loading 和错误状态

```typescript
// 为所有 fetchData 函数添加 loading/error 状态
const loading = ref(true);
const error = ref<string | null>(null);

async function fetchData() {
  loading.value = true;
  error.value = null;
  try {
    const [ov, orders, appts] = await Promise.all([
      apiGet<DashboardOverview>('/dashboard/overview'),
      apiGet<WorkOrder[]>('/dashboard/recent-orders'),
      apiGet<Appointment[]>('/dashboard/today-appointments'),
    ]);
    Object.assign(overview, ov);
    recentOrders.value = orders;
    todayAppointments.value = appts;
  } catch (e: any) {
    error.value = e.message || '加载失败';
  } finally {
    loading.value = false;
  }
}
```

在模板中添加：
```html
<div v-if="loading" v-loading="true" style="min-height: 200px" />
<el-alert v-else-if="error" :title="error" type="error" />
```

### 3.6 移动端配置化

```typescript
// apps/mobile/src/config.ts（新建或修改）
const ENV = {
  development: {
    BASE_URL: 'http://localhost:3000',
  },
  staging: {
    BASE_URL: 'https://staging-api.example.com',
  },
  production: {
    BASE_URL: 'https://car-api.555606.xyz',
  },
};

// 根据构建环境自动选择，默认 development
const currentEnv = (import.meta.env.MODE as keyof typeof ENV) || 'development';
export const config = ENV[currentEnv] || ENV.development;
export const BASE_URL = config.BASE_URL;
```

修改 `apps/mobile/src/utils/request.ts`：
- 移除硬编码的 `BASE_URL`
- 改为 `import { BASE_URL } from '../config'`

## 4. 验收标准

- [ ] `pnpm --filter @car/web run lint`（vue-tsc --noEmit）通过，无类型错误
- [ ] `apps/web/src/types/` 下有完整的 API 响应类型和业务模型类型
- [ ] 所有 Vue 组件中 `ref<any[]` 替换为具体类型
- [ ] Dashboard、WorkOrderList、CustomerList 等页面有 loading 状态
- [ ] 数据加载失败时有错误提示
- [ ] 移动端 `BASE_URL` 从配置文件读取，不再硬编码
- [ ] 移动端 H5 模式正常启动和请求

## 5. 注意事项

- 不要修改后端 API 的返回格式（TASK-001 已统一）
- 不要修改 `api.ts` 中的 token 刷新逻辑
- 保持 Element Plus 组件的使用方式不变
- 类型定义要与后端 Prisma schema 保持一致
- 移动端 uni-app 不支持 `import.meta.env`，需要使用 uni-app 的条件编译或自定义环境变量方案

---

## 6. 回执区域（Agent 完成后填写）

> **Agent 请在完成任务后，将以下内容追加到本文件末尾：**

### 回执

| 项目 | 内容 |
|------|------|
| 修改的文件列表 | `apps/web/src/utils/api.ts`, `apps/web/src/views/Dashboard.vue`, `apps/web/src/views/work-orders/WorkOrderList.vue`, `apps/web/src/views/customers/CustomerList.vue`, `apps/web/src/views/settlement/SettlementList.vue`, `apps/web/src/views/member/StoredValueCardList.vue`, `apps/mobile/src/config.ts`, `apps/mobile/src/utils/request.ts` |
| 新建的文件列表 | `apps/web/src/types/api.ts`, `apps/web/src/types/models.ts` |
| 类型检查是否通过 (vue-tsc --noEmit) | 通过 |
| 消除的 any 数量（估算） | ~25 处 |
| 添加 loading 状态的页面 | Dashboard, WorkOrderList, CustomerList, SettlementList, StoredValueCardList |
| 移动端 BASE_URL 配置方式 | `apps/mobile/src/config.ts` 环境配置文件，按 `process.env.NODE_ENV` 自动切换 |
| 已知限制或遗留问题 | 无 |
| 执行耗时 | ~8min |

---

## 7. 架构师审核区域

> **架构师审核后填写：**

```markdown
### 审核结果

- **审核时间**：2026-06-11
- **审核结论**：✅ 通过
- **审核意见**：
  - `types/api.ts` ✅ `ApiResponse<T>`、`PaginatedData<T>`、`PaginatedResponse<T>` 通用类型完备
  - `types/models.ts` ✅ 20+ 接口覆盖全部业务模型（WorkOrder、Settlement、PackageCard 等），正确使用 `Pick` 精简关联类型
  - `utils/api.ts` ✅ 泛型辅助函数 `apiGet<T>`/`apiPost<T>`/`apiPut<T>`/`apiDelete<T>`，token 刷新逻辑未受影响
  - Vue 组件 ✅ 5 个页面（Dashboard、WorkOrderList、CustomerList、SettlementList、StoredValueCardList）消除 ~25 处 `any`，添加 `loading`/`error` 状态
  - 移动端 `config.ts` ✅ 按 `NODE_ENV` 切换 `BASE_URL`，`request.ts` 正确引用
  - `vue-tsc --noEmit` ✅ 类型检查通过（exit 0）
- **TASK-007 状态**：已关闭 ✅
```
