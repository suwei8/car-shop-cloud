<template>
  <div class="page-container">
    <h2>工作台</h2>
    <div v-if="loading" v-loading="true" style="min-height: 200px" />
    <el-alert v-else-if="error" :title="error" type="error" show-icon style="margin-bottom: 16px" />
    <template v-else>
      <el-row :gutter="20" style="margin-top: 20px">
        <el-col :span="4">
          <el-card shadow="hover" class="stat-card">
            <div class="stat-label">今日工单</div>
            <div class="stat-value">{{ overview.todayOrders }}</div>
          </el-card>
        </el-col>
        <el-col :span="4">
          <el-card shadow="hover" class="stat-card">
            <div class="stat-label">今日营收</div>
            <div class="stat-value money">¥{{ overview.todayRevenue.toFixed(2) }}</div>
          </el-card>
        </el-col>
        <el-col :span="4">
          <el-card shadow="hover" class="stat-card">
            <div class="stat-label">在修车辆</div>
            <div class="stat-value warning">{{ overview.inProgressOrders }}</div>
          </el-card>
        </el-col>
        <el-col :span="4">
          <el-card shadow="hover" class="stat-card">
            <div class="stat-label">今日预约</div>
            <div class="stat-value">{{ overview.todayAppointments }}</div>
          </el-card>
        </el-col>
        <el-col :span="4">
          <el-card shadow="hover" class="stat-card">
            <div class="stat-label">待派工</div>
            <div class="stat-value danger">{{ overview.pendingDispatch }}</div>
          </el-card>
        </el-col>
        <el-col :span="4">
          <el-card shadow="hover" class="stat-card">
            <div class="stat-label">库存预警</div>
            <div class="stat-value danger">{{ overview.lowStockCount }}</div>
          </el-card>
        </el-col>
      </el-row>

      <el-row :gutter="20" style="margin-top: 20px">
        <el-col :span="14">
          <el-card>
            <template #header>最近工单</template>
            <el-table :data="recentOrders" size="small" max-height="400">
              <el-table-column prop="orderNo" label="工单号" width="180" />
              <el-table-column label="客户" width="100">
                <template #default="{ row }">{{ row.customer?.name }}</template>
              </el-table-column>
              <el-table-column label="车牌" width="100">
                <template #default="{ row }">{{ row.vehicle?.plateNo }}</template>
              </el-table-column>
              <el-table-column label="状态" width="100">
                <template #default="{ row }">
                  <el-tag :type="statusType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="金额" width="100">
                <template #default="{ row }">¥{{ Number(row.totalAmount).toFixed(2) }}</template>
              </el-table-column>
            </el-table>
          </el-card>
        </el-col>
        <el-col :span="10">
          <el-card>
            <template #header>今日预约</template>
            <el-table :data="todayAppointments" size="small" max-height="400">
              <el-table-column label="时间" width="100">
                <template #default="{ row }">{{ new Date(row.appointTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }}</template>
              </el-table-column>
              <el-table-column label="客户" width="80">
                <template #default="{ row }">{{ row.customer?.name }}</template>
              </el-table-column>
              <el-table-column label="车牌" width="80">
                <template #default="{ row }">{{ row.vehicle?.plateNo }}</template>
              </el-table-column>
              <el-table-column label="状态" width="80">
                <template #default="{ row }">
                  <el-tag :type="row.status === 'arrived' ? 'success' : ''" size="small">
                    {{ ({ pending: '待确认', confirmed: '已确认', arrived: '已到店' } as Record<string, string>)[row.status] }}
                  </el-tag>
                </template>
              </el-table-column>
            </el-table>
          </el-card>
        </el-col>
      </el-row>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { apiGet } from '../utils/api';
import type { WorkOrder, Appointment, DashboardOverview } from '../types/models';

const loading = ref(true);
const error = ref<string | null>(null);

const overview = reactive<DashboardOverview>({
  todayOrders: 0,
  todayRevenue: 0,
  inProgressOrders: 0,
  todayAppointments: 0,
  pendingDispatch: 0,
  lowStockCount: 0,
});
const recentOrders = ref<WorkOrder[]>([]);
const todayAppointments = ref<Appointment[]>([]);

const statusMap: Record<string, string> = {
  draft: '草稿', confirmed: '已确认', dispatching: '派工中', in_progress: '施工中', completed: '已完成', settled: '已结算', cancelled: '已作废',
};
function statusLabel(s: string) { return statusMap[s] || s; }
function statusType(s: string) {
  if (['completed', 'settled'].includes(s)) return 'success';
  if (s === 'in_progress') return 'warning';
  if (s === 'cancelled') return 'info';
  return '';
}

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
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '加载失败';
  } finally {
    loading.value = false;
  }
}

onMounted(fetchData);
</script>

<style scoped>
.stat-card {
  text-align: center;
}
.stat-label {
  font-size: 14px;
  color: #909399;
  margin-bottom: 8px;
}
.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #409eff;
}
.stat-value.money {
  color: #67c23a;
}
.stat-value.warning {
  color: #e6a23c;
}
.stat-value.danger {
  color: #f56c6c;
}
</style>
