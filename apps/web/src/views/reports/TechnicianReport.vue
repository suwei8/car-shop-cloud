<template>
  <div class="page-container">
    <div class="page-header">
      <h2>技师产值</h2>
    </div>

    <el-form :inline="true" style="margin-bottom: 16px">
      <el-form-item>
        <el-date-picker v-model="dateRange" type="daterange" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" value-format="YYYY-MM-DD" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="fetchReport">查询</el-button>
      </el-form-item>
    </el-form>

    <el-table :data="report" v-loading="loading" border>
      <el-table-column prop="technicianName" label="技师" width="120" />
      <el-table-column prop="totalTasks" label="总任务数" width="100" />
      <el-table-column prop="completedTasks" label="已完成" width="100" />
      <el-table-column label="完成率" width="100">
        <template #default="{ row }">
          {{ row.totalTasks > 0 ? ((row.completedTasks / row.totalTasks) * 100).toFixed(0) : 0 }}%
        </template>
      </el-table-column>
      <el-table-column label="产值金额" width="150">
        <template #default="{ row }">¥{{ row.totalAmount.toFixed(2) }}</template>
      </el-table-column>
      <el-table-column label="排名" width="80">
        <template #default="{ $index }">
          <el-tag :type="$index < 3 ? 'danger' : ''" size="small">{{ $index + 1 }}</el-tag>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import api from '../../utils/api';

const report = ref<any[]>([]);
const loading = ref(false);
const dateRange = ref<string[]>([]);

async function fetchReport() {
  if (!dateRange.value || dateRange.value.length !== 2) return;
  loading.value = true;
  try {
    report.value = await api.get('/reports/technician', {
      params: { startDate: dateRange.value[0], endDate: dateRange.value[1] },
    }) as any;
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  const today = new Date().toISOString().slice(0, 10);
  const firstDay = today.slice(0, 7) + '-01';
  dateRange.value = [firstDay, today];
  fetchReport();
});
</script>
