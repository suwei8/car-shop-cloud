<template>
  <div class="page-container">
    <div class="page-header">
      <h2>工单管理</h2>
      <el-button type="primary" @click="$router.push('/work-orders/create')">接车开单</el-button>
    </div>

    <el-form :inline="true" style="margin-bottom: 16px">
      <el-form-item>
        <el-select v-model="status" placeholder="状态" clearable>
          <el-option v-for="[k, v] in visibleStatusEntries" :key="k" :label="v" :value="k" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-select v-model="orderType" placeholder="类型" clearable>
          <el-option label="维修" value="repair" />
          <el-option label="洗美" value="wash" />
          <el-option label="快单" value="quick" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="fetchList">查询</el-button>
      </el-form-item>
    </el-form>

    <el-table :data="list" v-loading="loading" border>
      <el-table-column prop="orderNo" label="工单号" width="180" />
      <el-table-column label="类型" width="80">
        <template #default="{ row }">{{ ({ repair: '维修', wash: '洗美', quick: '快单' } as Record<string, string>)[row.orderType] }}</template>
      </el-table-column>
      <el-table-column label="客户" width="120">
        <template #default="{ row }">{{ row.customer?.name }}</template>
      </el-table-column>
      <el-table-column label="车牌" width="120">
        <template #default="{ row }">{{ row.vehiclePlateNo }}</template>
      </el-table-column>
      <el-table-column label="金额" width="100">
        <template #default="{ row }">¥{{ Number(row.payableAmount).toFixed(2) }}</template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="创建时间" width="180">
        <template #default="{ row }">{{ new Date(row.createdAt).toLocaleString() }}</template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="$router.push(`/work-orders/${row.id}`)">详情</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-if="total > pageSize"
      style="margin-top: 16px; justify-content: flex-end"
      :current-page="page"
      :page-size="pageSize"
      :total="total"
      @current-change="(p: number) => { page = p; fetchList(); }"
      layout="total, prev, pager, next"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { apiGet } from '../../utils/api';
import type { WorkOrder } from '../../types/models';
import type { PaginatedData } from '../../types/api';
import { useAuthStore } from '../../stores/auth';

const auth = useAuthStore();
const isSimpleMode = computed(() => auth.isSimpleMode);

const list = ref<WorkOrder[]>([]);
const loading = ref(false);
const page = ref(1);
const pageSize = 20;
const total = ref(0);
const status = ref('');
const orderType = ref('');

const statusMap: Record<string, string> = {
  draft: '草稿', quoted: '已报价', confirmed: '已确认', dispatching: '派工中',
  in_progress: '施工中', completed: '已完成', settled: '已结算', cancelled: '已取消',
};

// 简易模式下隐藏不可达状态（派工中）
const simpleModeHiddenStatuses = new Set(['dispatching']);
const visibleStatusEntries = computed(() =>
  Object.entries(statusMap).filter(([k]) => !isSimpleMode.value || !simpleModeHiddenStatuses.has(k))
);

function statusLabel(s: string) { return statusMap[s] || s; }
function statusTagType(s: string) {
  if (['completed', 'settled'].includes(s)) return 'success';
  if (['cancelled'].includes(s)) return 'info';
  if (['in_progress'].includes(s)) return 'warning';
  return '';
}

async function fetchList() {
  loading.value = true;
  try {
    const res = await apiGet<PaginatedData<WorkOrder>>('/work-orders', {
      page: page.value, pageSize, status: status.value || undefined, orderType: orderType.value || undefined,
    });
    list.value = res.items;
    total.value = res.total;
  } finally {
    loading.value = false;
  }
}

onMounted(fetchList);
</script>
