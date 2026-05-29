<template>
  <div class="page-container">
    <div class="page-header">
      <h2>派工管理</h2>
    </div>

    <el-form :inline="true" style="margin-bottom: 16px">
      <el-form-item>
        <el-select v-model="status" placeholder="状态" clearable>
          <el-option label="待处理" value="pending" />
          <el-option label="进行中" value="in_progress" />
          <el-option label="已暂停" value="paused" />
          <el-option label="已完成" value="completed" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="fetchList">查询</el-button>
      </el-form-item>
    </el-form>

    <el-table :data="list" v-loading="loading" border>
      <el-table-column label="工单号" width="180">
        <template #default="{ row }">{{ row.workOrder?.orderNo }}</template>
      </el-table-column>
      <el-table-column label="车牌" width="120">
        <template #default="{ row }">{{ row.workOrder?.vehiclePlateNo }}</template>
      </el-table-column>
      <el-table-column label="类型" width="80">
        <template #default="{ row }">{{ { repair: '维修', wash: '洗美', quick: '快单' }[row.workOrder?.orderType] }}</template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="taskStatusType(row.status)">{{ taskStatusLabel(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="startAt" label="开工时间" width="180">
        <template #default="{ row }">{{ row.startAt ? new Date(row.startAt).toLocaleString() : '-' }}</template>
      </el-table-column>
      <el-table-column prop="endAt" label="完工时间" width="180">
        <template #default="{ row }">{{ row.endAt ? new Date(row.endAt).toLocaleString() : '-' }}</template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button v-if="row.status === 'pending'" link type="primary" @click="handleStart(row)">开工</el-button>
          <el-button v-if="row.status === 'in_progress'" link type="warning" @click="handlePause(row)">暂停</el-button>
          <el-button v-if="row.status === 'in_progress'" link type="success" @click="handleComplete(row)">完工</el-button>
          <el-button v-if="row.status === 'paused'" link type="primary" @click="handleStart(row)">继续</el-button>
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
import { ref, onMounted } from 'vue';
import api from '../../utils/api';
import { ElMessage } from 'element-plus';

const list = ref<any[]>([]);
const loading = ref(false);
const page = ref(1);
const pageSize = 20;
const total = ref(0);
const status = ref('');

const taskStatusMap: Record<string, string> = {
  pending: '待处理', in_progress: '进行中', paused: '已暂停', completed: '已完成',
};
function taskStatusLabel(s: string) { return taskStatusMap[s] || s; }
function taskStatusType(s: string) {
  if (s === 'completed') return 'success';
  if (s === 'in_progress') return 'warning';
  return '';
}

async function fetchList() {
  loading.value = true;
  try {
    const res: any = await api.get('/dispatch', {
      params: { page: page.value, pageSize, status: status.value || undefined },
    });
    list.value = res.items;
    total.value = res.total;
  } finally {
    loading.value = false;
  }
}

async function handleStart(row: any) {
  await api.put(`/dispatch/${row.id}/start`);
  ElMessage.success('已开工');
  fetchList();
}

async function handlePause(row: any) {
  await api.put(`/dispatch/${row.id}/pause`);
  ElMessage.success('已暂停');
  fetchList();
}

async function handleComplete(row: any) {
  await api.put(`/dispatch/${row.id}/complete`);
  ElMessage.success('已完工');
  fetchList();
}

onMounted(fetchList);
</script>
