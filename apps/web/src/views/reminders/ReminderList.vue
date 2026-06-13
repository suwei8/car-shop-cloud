<template>
  <div class="page-container">
    <div class="page-header">
      <h2>经营提醒</h2>
    </div>

    <el-form :inline="true" style="margin-bottom: 16px">
      <el-form-item>
        <el-select v-model="filters.status" placeholder="状态" clearable style="width: 120px" @change="fetchList">
          <el-option label="待处理" value="pending" />
          <el-option label="已处理" value="done" />
          <el-option label="已忽略" value="ignored" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-select v-model="filters.type" placeholder="类型" clearable style="width: 140px" @change="fetchList">
          <el-option label="保养到期" value="maintenance_due" />
          <el-option label="套餐卡到期" value="card_expiring" />
          <el-option label="储值卡余额低" value="card_low_balance" />
          <el-option label="客户流失" value="customer_churn" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-date-picker v-model="filters.dueDate" type="date" placeholder="日期" value-format="YYYY-MM-DD" @change="fetchList" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="generateReminders">手动生成</el-button>
      </el-form-item>
    </el-form>

    <el-table :data="list" v-loading="loading" border>
      <el-table-column label="类型" width="120">
        <template #default="{ row }">
          <el-tag :type="typeTagColor(row.type)" size="small">{{ typeLabel(row.type) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="客户" width="100">
        <template #default="{ row }">{{ row.customer?.name }}</template>
      </el-table-column>
      <el-table-column label="电话" width="130">
        <template #default="{ row }">{{ row.customer?.phone }}</template>
      </el-table-column>
      <el-table-column label="车牌" width="100">
        <template #default="{ row }">{{ row.vehiclePlateNo || '-' }}</template>
      </el-table-column>
      <el-table-column prop="content" label="提醒内容" min-width="250" />
      <el-table-column label="日期" width="110">
        <template #default="{ row }">{{ new Date(row.dueDate).toLocaleDateString('zh-CN') }}</template>
      </el-table-column>
      <el-table-column label="状态" width="80">
        <template #default="{ row }">
          <el-tag :type="row.status === 'pending' ? 'warning' : row.status === 'done' ? 'success' : 'info'" size="small">
            {{ statusLabel(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="备注" width="150">
        <template #default="{ row }">{{ row.remark || '-' }}</template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <template v-if="row.status === 'pending'">
            <el-button size="small" type="primary" @click="openHandleDialog(row, 'done')">已回访</el-button>
            <el-button size="small" @click="openHandleDialog(row, 'ignored')">忽略</el-button>
          </template>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      style="margin-top: 16px; justify-content: flex-end"
      v-model:current-page="page"
      :page-size="pageSize"
      :total="total"
      layout="total, prev, pager, next"
      @current-change="fetchList"
    />

    <el-dialog v-model="handleDialogVisible" title="回访备注" width="400px">
      <el-form label-width="80px">
        <el-form-item label="处理状态">
          <el-tag :type="handleForm.status === 'done' ? 'success' : 'info'">{{ handleForm.status === 'done' ? '已回访' : '已忽略' }}</el-tag>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="handleForm.remark" type="textarea" :rows="3" placeholder="回访结果" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="handleDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitHandle">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { apiGet, apiPost } from '../../utils/api';
import type { Reminder } from '../../types/models';

const loading = ref(false);
const list = ref<Reminder[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 20;

const filters = reactive({ status: 'pending', type: '', dueDate: '' });

const typeMap: Record<string, string> = {
  maintenance_due: '保养到期',
  card_expiring: '套餐卡到期',
  card_low_balance: '余额低',
  customer_churn: '客户流失',
};
function typeLabel(t: string) { return typeMap[t] || t; }
function typeTagColor(t: string) {
  if (t === 'maintenance_due') return 'warning';
  if (t === 'card_expiring') return '';
  if (t === 'card_low_balance') return 'danger';
  if (t === 'customer_churn') return 'info';
  return '';
}
function statusLabel(s: string) {
  return { pending: '待处理', done: '已处理', ignored: '已忽略' }[s] || s;
}

const handleDialogVisible = ref(false);
const handleForm = reactive({ id: '', status: '' as 'done' | 'ignored', remark: '' });

function openHandleDialog(row: Reminder, status: 'done' | 'ignored') {
  handleForm.id = row.id;
  handleForm.status = status;
  handleForm.remark = '';
  handleDialogVisible.value = true;
}

async function submitHandle() {
  await apiPost(`/reminders/${handleForm.id}/handle`, {
    status: handleForm.status,
    remark: handleForm.remark,
  });
  handleDialogVisible.value = false;
  ElMessage.success('已更新');
  fetchList();
}

async function generateReminders() {
  loading.value = true;
  try {
    await apiPost('/reminders/generate');
    ElMessage.success('生成完毕');
    fetchList();
  } finally {
    loading.value = false;
  }
}

async function fetchList() {
  loading.value = true;
  try {
    const params: Record<string, unknown> = { page: page.value, pageSize };
    if (filters.status) params.status = filters.status;
    if (filters.type) params.type = filters.type;
    if (filters.dueDate) params.dueDate = filters.dueDate;
    const res = await apiGet<{ total: number; items: Reminder[] }>('/reminders', params);
    list.value = res.items;
    total.value = res.total;
  } finally {
    loading.value = false;
  }
}

onMounted(fetchList);
</script>
