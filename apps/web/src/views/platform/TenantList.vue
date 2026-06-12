<template>
  <div class="page-container">
    <div class="page-header">
      <h2>商户管理</h2>
      <el-button type="primary" @click="showDialog()">新增商户</el-button>
    </div>

    <el-table :data="list" v-loading="loading" border>
      <el-table-column prop="name" label="商户名称" />
      <el-table-column prop="contactName" label="联系人" />
      <el-table-column prop="contactPhone" label="联系电话" />
      <el-table-column label="套餐">
        <template #default="{ row }">
          {{ row.subscriptions?.[0]?.plan?.name || '未开通' }}
        </template>
      </el-table-column>
      <el-table-column prop="status" label="状态">
        <template #default="{ row }">
          <el-tag :type="row.status === 'active' ? 'success' : 'danger'">
            {{ ({ active: '正常', suspended: '已停用', expired: '已过期' } as Record<string, string>)[row.status] || row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="280">
        <template #default="{ row }">
          <el-button link type="primary" @click="showDialog(row)">编辑</el-button>
          <el-button link type="warning" @click="showSubscribeDialog(row)">分配套餐</el-button>
          <el-button link :type="row.status === 'active' ? 'danger' : 'success'" @click="toggleStatus(row)">
            {{ row.status === 'active' ? '停用' : '启用' }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 新增/编辑商户 -->
    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑商户' : '新增商户'" width="500px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="联系人">
          <el-input v-model="form.contactName" />
        </el-form-item>
        <el-form-item label="联系电话">
          <el-input v-model="form.contactPhone" />
        </el-form-item>
        <el-form-item label="密码" :prop="form.id ? '' : 'password'" :rules="form.id ? [] : [{ required: true, message: '请输入初始密码', trigger: 'blur' }, { min: 6, message: '密码至少6位', trigger: 'blur' }]">
          <el-input v-model="form.password" type="password" show-password :placeholder="form.id ? '留空则不修改密码' : '管理员初始密码（至少6位）'" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>

    <!-- 分配套餐 -->
    <el-dialog v-model="subscribeDialogVisible" title="分配套餐" width="400px">
      <el-select v-model="selectedPlanId" placeholder="选择套餐" style="width: 100%">
        <el-option v-for="p in plans" :key="p.id" :label="`${p.name} (¥${p.priceYearly}/年)`" :value="p.id" />
      </el-select>
      <template #footer>
        <el-button @click="subscribeDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="subscribing" @click="handleSubscribe">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import api from '../../utils/api';
import { ElMessage } from 'element-plus';

const list = ref<any[]>([]);
const plans = ref<any[]>([]);
const loading = ref(false);
const dialogVisible = ref(false);
const subscribeDialogVisible = ref(false);
const saving = ref(false);
const subscribing = ref(false);
const formRef = ref();
const selectedTenantId = ref('');
const selectedPlanId = ref('');
const form = reactive({ id: '', name: '', contactName: '', contactPhone: '', password: '' });
const rules = { name: [{ required: true, message: '请输入商户名称', trigger: 'blur' }] };

async function fetchList() {
  loading.value = true;
  try {
    const res: any = await api.get('/platform/tenants');
    list.value = res.items || res;
  } finally {
    loading.value = false;
  }
}

async function fetchPlans() {
  const res: any = await api.get('/platform/subscription-plans');
  plans.value = res;
}

function showDialog(row?: any) {
  if (row) {
    Object.assign(form, { id: row.id, name: row.name, contactName: row.contactName, contactPhone: row.contactPhone, password: '' });
  } else {
    Object.assign(form, { id: '', name: '', contactName: '', contactPhone: '', password: '' });
  }
  dialogVisible.value = true;
}

function showSubscribeDialog(row: any) {
  selectedTenantId.value = row.id;
  selectedPlanId.value = row.subscriptions?.[0]?.planId || '';
  subscribeDialogVisible.value = true;
}

async function handleSave() {
  await formRef.value?.validate();
  saving.value = true;
  try {
    const payload: Record<string, string> = { name: form.name, contactName: form.contactName, contactPhone: form.contactPhone };
    if (form.password) payload.password = form.password;
    if (form.id) {
      await api.put(`/platform/tenants/${form.id}`, payload);
    } else {
      await api.post('/platform/tenants', { ...payload, password: form.password });
    }
    ElMessage.success('保存成功');
    dialogVisible.value = false;
    fetchList();
  } finally {
    saving.value = false;
  }
}

async function handleSubscribe() {
  if (!selectedPlanId.value) return;
  subscribing.value = true;
  try {
    await api.post(`/platform/subscription-plans/${selectedPlanId.value}/subscribe/${selectedTenantId.value}`);
    ElMessage.success('分配成功');
    subscribeDialogVisible.value = false;
    fetchList();
  } finally {
    subscribing.value = false;
  }
}

async function toggleStatus(row: any) {
  const newStatus = row.status === 'active' ? 'suspended' : 'active';
  await api.put(`/platform/tenants/${row.id}`, { status: newStatus });
  ElMessage.success('操作成功');
  fetchList();
}

onMounted(() => {
  fetchList();
  fetchPlans();
});
</script>
