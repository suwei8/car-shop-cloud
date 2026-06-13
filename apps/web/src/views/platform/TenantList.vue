<template>
  <div class="page-container">
    <div class="page-header">
      <h2>商户管理</h2>
      <el-button type="primary" @click="showDialog()">新增商户</el-button>
    </div>

    <el-table :data="list" v-loading="loading" border>
      <el-table-column prop="name" label="商户名称" min-width="120" />
      <el-table-column prop="contactName" label="联系人" width="100" />
      <el-table-column prop="contactPhone" label="联系电话" width="120" />
      <el-table-column label="订阅状态" width="100">
        <template #default="{ row }">
          <el-tag :type="subStatusType(row.subscriptionStatus)" size="small">
            {{ subStatusLabel(row.subscriptionStatus) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="到期日" width="110">
        <template #default="{ row }">
          {{ row.subscriptionEndAt ? row.subscriptionEndAt.slice(0, 10) : '-' }}
        </template>
      </el-table-column>
      <el-table-column label="状态" width="80">
        <template #default="{ row }">
          <el-tag :type="row.status === 'active' ? 'success' : 'danger'" size="small">
            {{ ({ active: '正常', suspended: '已停用', expired: '已过期' } as Record<string, string>)[row.status] || row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="380" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="showDialog(row)">编辑</el-button>
          <el-button link type="success" @click="showRenewDialog(row)">续费</el-button>
          <el-button link type="warning" @click="showExtendDialog(row)">延期</el-button>
          <el-button link :type="row.subscriptionStatus === 'suspended' ? 'success' : 'danger'" @click="toggleSubscription(row)">
            {{ row.subscriptionStatus === 'suspended' ? '恢复' : '停用' }}
          </el-button>
          <el-button link type="primary" @click="handleImpersonate(row)">代登录</el-button>
          <el-button link type="info" @click="showDetail(row)">详情</el-button>
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

    <!-- 续费 -->
    <el-dialog v-model="renewDialogVisible" title="续费" width="400px">
      <el-form :model="renewForm" label-width="80px">
        <el-form-item label="套餐">
          <el-select v-model="renewForm.planId" placeholder="选择套餐" style="width: 100%">
            <el-option v-for="p in plans" :key="p.id" :label="`${p.name} (¥${p.priceYearly}/年)`" :value="p.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="时长(月)">
          <el-input-number v-model="renewForm.months" :min="1" :max="60" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="renewDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="operating" @click="handleRenew">确认续费</el-button>
      </template>
    </el-dialog>

    <!-- 延期 -->
    <el-dialog v-model="extendDialogVisible" title="延期（赠送天数）" width="400px">
      <el-form :model="extendForm" label-width="80px">
        <el-form-item label="天数">
          <el-input-number v-model="extendForm.days" :min="1" :max="365" />
        </el-form-item>
        <el-form-item label="原因">
          <el-input v-model="extendForm.reason" type="textarea" placeholder="延期原因（必填）" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="extendDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="operating" @click="handleExtend">确认延期</el-button>
      </template>
    </el-dialog>

    <!-- 商户详情抽屉 -->
    <el-drawer v-model="drawerVisible" title="商户详情" size="600px">
      <template v-if="detailTenant">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="商户名称">{{ detailTenant.name }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="detailTenant.status === 'active' ? 'success' : 'danger'" size="small">
              {{ detailTenant.status }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="联系人">{{ detailTenant.contactName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="联系电话">{{ detailTenant.contactPhone || '-' }}</el-descriptions-item>
          <el-descriptions-item label="订阅状态">
            <el-tag :type="subStatusType(detailTenant.subscriptionStatus)" size="small">
              {{ subStatusLabel(detailTenant.subscriptionStatus) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="到期日">{{ detailTenant.subscriptionEndAt?.slice(0, 10) || '-' }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ detailTenant.createdAt?.slice(0, 10) }}</el-descriptions-item>
        </el-descriptions>

        <h4 style="margin: 20px 0 10px">使用统计</h4>
        <el-row :gutter="12" v-loading="statsLoading">
          <el-col :span="8">
            <el-card shadow="never">
              <div class="stat-card">
                <div class="stat-value">{{ stats?.workOrderCount30d ?? '-' }}</div>
                <div class="stat-label">近30天工单</div>
              </div>
            </el-card>
          </el-col>
          <el-col :span="8">
            <el-card shadow="never">
              <div class="stat-card">
                <div class="stat-value">¥{{ stats?.settlementAmount30d ?? '-' }}</div>
                <div class="stat-label">近30天实收</div>
              </div>
            </el-card>
          </el-col>
          <el-col :span="8">
            <el-card shadow="never">
              <div class="stat-card">
                <div class="stat-value">{{ stats?.activeUserCount7d ?? '-' }}</div>
                <div class="stat-label">近7天活跃用户</div>
              </div>
            </el-card>
          </el-col>
          <el-col :span="8" style="margin-top: 12px">
            <el-card shadow="never">
              <div class="stat-card">
                <div class="stat-value">{{ stats?.customerCount ?? '-' }}</div>
                <div class="stat-label">客户总数</div>
              </div>
            </el-card>
          </el-col>
          <el-col :span="8" style="margin-top: 12px">
            <el-card shadow="never">
              <div class="stat-card">
                <div class="stat-value">¥{{ stats?.storedValueBalance ?? '-' }}</div>
                <div class="stat-label">储值卡总余额</div>
              </div>
            </el-card>
          </el-col>
          <el-col :span="8" style="margin-top: 12px">
            <el-card shadow="never">
              <div class="stat-card">
                <div class="stat-value">{{ stats?.lastActiveAt ? stats.lastActiveAt.slice(0, 10) : '-' }}</div>
                <div class="stat-label">最近活跃</div>
              </div>
            </el-card>
          </el-col>
        </el-row>

        <h4 style="margin: 20px 0 10px">订阅历史</h4>
        <el-table :data="detailTenant.subscriptions || []" border size="small">
          <el-table-column label="套餐">
            <template #default="{ row }">{{ row.plan?.name || row.planId }}</template>
          </el-table-column>
          <el-table-column label="状态" width="80">
            <template #default="{ row }">
              <el-tag size="small" :type="row.status === 'active' ? 'success' : 'info'">{{ row.status }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="开始" width="110">
            <template #default="{ row }">{{ row.startAt?.slice(0, 10) }}</template>
          </el-table-column>
          <el-table-column label="结束" width="110">
            <template #default="{ row }">{{ row.endAt?.slice(0, 10) }}</template>
          </el-table-column>
        </el-table>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import api from '../../utils/api';
import { ElMessage, ElMessageBox } from 'element-plus';

const list = ref<any[]>([]);
const plans = ref<any[]>([]);
const loading = ref(false);
const dialogVisible = ref(false);
const renewDialogVisible = ref(false);
const extendDialogVisible = ref(false);
const drawerVisible = ref(false);
const saving = ref(false);
const operating = ref(false);
const statsLoading = ref(false);
const formRef = ref();

const form = reactive({ id: '', name: '', contactName: '', contactPhone: '', password: '' });
const rules = { name: [{ required: true, message: '请输入商户名称', trigger: 'blur' }] };

const renewForm = reactive({ tenantId: '', planId: '', months: 12 });
const extendForm = reactive({ tenantId: '', days: 30, reason: '' });

const detailTenant = ref<any>(null);
const stats = ref<any>(null);

function subStatusType(status: string) {
  const map: Record<string, string> = { active: 'success', trial: 'warning', suspended: 'danger', expired: 'info', grace: 'warning' };
  return (map[status] || 'info') as any;
}

function subStatusLabel(status: string) {
  const map: Record<string, string> = { active: '正常', trial: '试用', suspended: '已停用', expired: '已过期', grace: '宽限期' };
  return map[status] || status || '未开通';
}

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

function showRenewDialog(row: any) {
  renewForm.tenantId = row.id;
  renewForm.planId = row.subscriptions?.[0]?.planId || '';
  renewForm.months = 12;
  renewDialogVisible.value = true;
}

function showExtendDialog(row: any) {
  extendForm.tenantId = row.id;
  extendForm.days = 30;
  extendForm.reason = '';
  extendDialogVisible.value = true;
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

async function handleRenew() {
  if (!renewForm.planId) return ElMessage.warning('请选择套餐');
  operating.value = true;
  try {
    await api.post(`/platform/tenants/${renewForm.tenantId}/renew`, { planId: renewForm.planId, months: renewForm.months });
    ElMessage.success('续费成功');
    renewDialogVisible.value = false;
    fetchList();
  } finally {
    operating.value = false;
  }
}

async function handleExtend() {
  if (!extendForm.reason) return ElMessage.warning('请填写延期原因');
  operating.value = true;
  try {
    await api.post(`/platform/tenants/${extendForm.tenantId}/extend`, { days: extendForm.days, reason: extendForm.reason });
    ElMessage.success('延期成功');
    extendDialogVisible.value = false;
    fetchList();
  } finally {
    operating.value = false;
  }
}

async function toggleSubscription(row: any) {
  const isSuspended = row.subscriptionStatus === 'suspended';
  const action = isSuspended ? '恢复' : '停用';
  await ElMessageBox.confirm(`确认${action}商户「${row.name}」？`, '确认操作', { type: 'warning' });

  if (isSuspended) {
    await api.post(`/platform/tenants/${row.id}/resume`);
  } else {
    await api.post(`/platform/tenants/${row.id}/suspend`, {});
  }
  ElMessage.success(`${action}成功`);
  fetchList();
}

async function handleImpersonate(row: any) {
  await ElMessageBox.confirm(`确认以「${row.name}」管理员身份代登录？`, '代登录确认', { type: 'warning' });
  try {
    const res: any = await api.post(`/platform/tenants/${row.id}/impersonate`);
    const url = `${window.location.origin}/#/dashboard?impersonate_token=${res.accessToken}`;
    window.open(url, '_blank');
    ElMessage.success('代登录成功，已在新标签页打开');
  } catch {
    // error handled by interceptor
  }
}

async function showDetail(row: any) {
  drawerVisible.value = true;
  detailTenant.value = null;
  stats.value = null;

  const [detail, statsData]: any = await Promise.all([
    api.get(`/platform/tenants/${row.id}`),
    api.get(`/platform/tenant-stats/${row.id}`),
  ]);
  detailTenant.value = detail;
  stats.value = statsData;
}

onMounted(() => {
  fetchList();
  fetchPlans();
});
</script>

<style scoped>
.stat-card {
  text-align: center;
  padding: 8px 0;
}
.stat-value {
  font-size: 20px;
  font-weight: 600;
  color: #303133;
}
.stat-label {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}
</style>
