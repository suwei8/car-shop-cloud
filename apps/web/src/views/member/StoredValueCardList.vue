<template>
  <div class="page-container">
    <div class="page-header">
      <h2>储值卡管理</h2>
      <el-button type="primary" @click="showDialog()">售卡</el-button>
    </div>

    <el-table :data="list" v-loading="loading" border>
      <el-table-column prop="cardNo" label="卡号" width="150" />
      <el-table-column label="总余额" width="120">
        <template #default="{ row }">¥{{ Number(row.balance).toFixed(2) }}</template>
      </el-table-column>
      <el-table-column label="本金" width="120">
        <template #default="{ row }">¥{{ Number(row.principalBalance).toFixed(2) }}</template>
      </el-table-column>
      <el-table-column label="赠送" width="120">
        <template #default="{ row }">¥{{ Number(row.giftBalance).toFixed(2) }}</template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="80">
        <template #default="{ row }">
          <el-tag :type="row.status === 'active' ? 'success' : 'info'">{{ ({ active: '正常', frozen: '冻结', cancelled: '注销' } as Record<string, string>)[row.status] }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="创建时间" width="180">
        <template #default="{ row }">{{ new Date(row.createdAt).toLocaleString() }}</template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="showRechargeDialog(row)">充值</el-button>
          <el-button link type="primary" @click="showTransactions(row)">流水</el-button>
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

    <!-- 售卡弹窗 -->
    <el-dialog v-model="dialogVisible" title="售卡" width="500px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="卡号" prop="cardNo"><el-input v-model="form.cardNo" /></el-form-item>
        <el-form-item label="客户" prop="customerId">
          <el-select v-model="form.customerId" filterable remote :remote-method="searchCustomer" placeholder="搜索客户" style="width: 100%">
            <el-option v-for="c in customerOptions" :key="c.id" :label="`${c.name} (${c.phone})`" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="充值金额" prop="amount"><el-input-number v-model="form.amount" :min="1" :precision="2" /></el-form-item>
        <el-form-item label="赠送金额"><el-input-number v-model="form.gift" :min="0" :precision="2" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="form.remark" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">确定</el-button>
      </template>
    </el-dialog>

    <!-- 充值弹窗 -->
    <el-dialog v-model="rechargeDialogVisible" title="充值" width="400px">
      <el-form :model="rechargeForm" label-width="80px">
        <el-form-item label="充值金额"><el-input-number v-model="rechargeForm.amount" :min="1" :precision="2" /></el-form-item>
        <el-form-item label="赠送金额"><el-input-number v-model="rechargeForm.gift" :min="0" :precision="2" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="rechargeForm.remark" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rechargeDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleRecharge">确定</el-button>
      </template>
    </el-dialog>

    <!-- 流水弹窗 -->
    <el-dialog v-model="transactionDialogVisible" title="储值流水" width="700px">
      <el-table :data="transactions" border size="small">
        <el-table-column prop="type" label="类型" width="80">
          <template #default="{ row }">{{ ({ recharge: '充值', consume: '消费', refund: '退款', gift: '赠送', adjust: '调整' } as Record<string, string>)[row.type] }}</template>
        </el-table-column>
        <el-table-column label="金额" width="100">
          <template #default="{ row }">¥{{ Number(row.amount).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="余额" width="100">
          <template #default="{ row }">¥{{ Number(row.balanceAfter).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" />
        <el-table-column prop="createdAt" label="时间" width="180">
          <template #default="{ row }">{{ new Date(row.createdAt).toLocaleString() }}</template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import api from '../../utils/api';
import { ElMessage } from 'element-plus';

const list = ref<any[]>([]);
const transactions = ref<any[]>([]);
const customerOptions = ref<any[]>([]);
const loading = ref(false);
const page = ref(1);
const pageSize = 20;
const total = ref(0);
const dialogVisible = ref(false);
const rechargeDialogVisible = ref(false);
const transactionDialogVisible = ref(false);
const saving = ref(false);
const formRef = ref();
const selectedCardId = ref('');

const form = reactive({ cardNo: '', customerId: '', amount: 1000, gift: 0, remark: '' });
const rules = {
  cardNo: [{ required: true, message: '请输入卡号', trigger: 'blur' }],
  customerId: [{ required: true, message: '请选择客户', trigger: 'change' }],
  amount: [{ required: true, message: '请输入金额', trigger: 'blur' }],
};
const rechargeForm = reactive({ amount: 500, gift: 0, remark: '' });

async function fetchList() {
  loading.value = true;
  try {
    const res: any = await api.get('/stored-value-cards', { params: { page: page.value, pageSize } });
    list.value = res.items;
    total.value = res.total;
  } finally {
    loading.value = false;
  }
}

async function searchCustomer(keyword: string) {
  if (!keyword) return;
  const res: any = await api.get('/customers/search', { params: { keyword } });
  customerOptions.value = res;
}

function showDialog() {
  Object.assign(form, { cardNo: '', customerId: '', amount: 1000, gift: 0, remark: '' });
  dialogVisible.value = true;
}

function showRechargeDialog(row: any) {
  selectedCardId.value = row.id;
  Object.assign(rechargeForm, { amount: 500, gift: 0, remark: '' });
  rechargeDialogVisible.value = true;
}

async function showTransactions(row: any) {
  const res: any = await api.get('/stored-value-cards/transactions', { params: { cardId: row.id } });
  transactions.value = res.items;
  transactionDialogVisible.value = true;
}

async function handleSave() {
  await formRef.value?.validate();
  saving.value = true;
  try {
    await api.post('/stored-value-cards', form);
    ElMessage.success('售卡成功');
    dialogVisible.value = false;
    fetchList();
  } finally {
    saving.value = false;
  }
}

async function handleRecharge() {
  saving.value = true;
  try {
    await api.post(`/stored-value-cards/${selectedCardId.value}/recharge`, rechargeForm);
    ElMessage.success('充值成功');
    rechargeDialogVisible.value = false;
    fetchList();
  } finally {
    saving.value = false;
  }
}

onMounted(fetchList);
</script>
