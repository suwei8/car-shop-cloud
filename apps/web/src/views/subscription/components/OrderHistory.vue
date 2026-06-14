<template>
  <div>
    <el-table :data="orders" v-loading="loading" border size="small">
      <el-table-column prop="orderNo" label="订单号" width="200" />
      <el-table-column label="套餐" width="120">
        <template #default="{ row }">{{ row.plan?.name }}</template>
      </el-table-column>
      <el-table-column label="时长" width="100">
        <template #default="{ row }">{{ row.months }}个月</template>
      </el-table-column>
      <el-table-column label="金额" width="120">
        <template #default="{ row }">
          <span style="color: #f56c6c">¥{{ Number(row.amount).toFixed(2) }}</span>
          <span v-if="Number(row.discountRate) < 1" style="color: #909399; font-size: 12px; margin-left: 4px">
            ({{ (Number(row.discountRate) * 10).toFixed(1) }}折)
          </span>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="statusType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="支付方式" width="100">
        <template #default="{ row }">{{ payMethodLabel(row.paymentMethod) }}</template>
      </el-table-column>
      <el-table-column label="支付时间" width="180">
        <template #default="{ row }">{{ row.paidAt ? new Date(row.paidAt).toLocaleString() : '-' }}</template>
      </el-table-column>
      <el-table-column label="创建时间" width="180">
        <template #default="{ row }">{{ new Date(row.createdAt).toLocaleString() }}</template>
      </el-table-column>
    </el-table>
    <el-pagination
      v-if="total > pageSize"
      style="margin-top: 16px; justify-content: flex-end"
      :current-page="page"
      :page-size="pageSize"
      :total="total"
      @current-change="(p: number) => { page = p; fetchOrders(); }"
      layout="total, prev, pager, next"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import api from '../../../utils/api';

const orders = ref<any[]>([]);
const loading = ref(false);
const page = ref(1);
const pageSize = 10;
const total = ref(0);

const statusMap: Record<string, string> = {
  pending: '待支付', paid: '已支付', cancelled: '已取消', refunded: '已退款',
};
function statusLabel(s: string) { return statusMap[s] || s; }
function statusType(s: string): string {
  const map: Record<string, string> = { pending: 'warning', paid: 'success', cancelled: 'info', refunded: 'danger' };
  return map[s] || '';
}

const payMethodMap: Record<string, string> = { wechat: '微信', alipay: '支付宝' };
function payMethodLabel(m: string) { return payMethodMap[m] || m || '-'; }

async function fetchOrders() {
  loading.value = true;
  try {
    const res: any = await api.get('/subscription/history', { params: { page: page.value, pageSize } });
    orders.value = res.items || [];
    total.value = res.total || 0;
  } finally {
    loading.value = false;
  }
}

onMounted(fetchOrders);
</script>
