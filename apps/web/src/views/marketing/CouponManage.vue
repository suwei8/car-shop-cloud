<template>
  <div>
    <el-card shadow="never" style="margin-bottom: 16px">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span>优惠券管理</span>
          <el-button type="primary" @click="showCreateDialog = true">创建优惠券</el-button>
        </div>
      </template>

      <el-table :data="coupons" v-loading="loading" border>
        <el-table-column prop="name" label="名称" width="180" />
        <el-table-column label="类型" width="120">
          <template #default="{ row }">
            <el-tag :type="row.type === 'full_reduction' ? 'warning' : 'success'" size="small">
              {{ row.type === 'full_reduction' ? '满减' : '折扣' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="优惠值" width="120">
          <template #default="{ row }">
            {{ row.type === 'full_reduction' ? `减¥${row.discountValue}` : `${(row.discountValue * 10).toFixed(1)}折` }}
          </template>
        </el-table-column>
        <el-table-column label="门槛" width="100">
          <template #default="{ row }">
            {{ row.conditionAmount > 0 ? `满¥${row.conditionAmount}` : '无门槛' }}
          </template>
        </el-table-column>
        <el-table-column label="发放/使用" width="120">
          <template #default="{ row }">
            {{ row.issuedQuantity }} / {{ row.usedQuantity }}
          </template>
        </el-table-column>
        <el-table-column label="有效天数" width="100">
          <template #default="{ row }">{{ row.validDays }}天</template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'info'" size="small">
              {{ row.status === 'active' ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openDistribute(row)">发放</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-if="total > pageSize"
        style="margin-top: 16px; justify-content: flex-end"
        :current-page="page"
        :page-size="pageSize"
        :total="total"
        layout="total, prev, pager, next"
        @current-change="handlePageChange"
      />
    </el-card>

    <!-- 创建优惠券弹窗 -->
    <el-dialog v-model="showCreateDialog" title="创建优惠券" width="500px">
      <el-form :model="createForm" label-width="100px">
        <el-form-item label="名称">
          <el-input v-model="createForm.name" placeholder="优惠券名称" />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="createForm.type">
            <el-option label="满减" value="full_reduction" />
            <el-option label="折扣" value="discount" />
          </el-select>
        </el-form-item>
        <el-form-item :label="createForm.type === 'full_reduction' ? '减免金额' : '折扣率'">
          <el-input-number v-model="createForm.discountValue" :min="0.01" :precision="2" />
        </el-form-item>
        <el-form-item v-if="createForm.type === 'full_reduction'" label="满减门槛">
          <el-input-number v-model="createForm.conditionAmount" :min="0" :precision="2" />
        </el-form-item>
        <el-form-item label="有效天数">
          <el-input-number v-model="createForm.validDays" :min="1" :max="365" />
        </el-form-item>
        <el-form-item label="总发行量">
          <el-input-number v-model="createForm.totalQuantity" :min="0" />
          <span style="margin-left: 8px; color: #999">0=不限</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="handleCreate">确定</el-button>
      </template>
    </el-dialog>

    <!-- 发放优惠券弹窗 -->
    <el-dialog v-model="showDistributeDialog" title="发放优惠券" width="500px">
      <el-form label-width="100px">
        <el-form-item label="优惠券">
          <span>{{ distributingCoupon?.name }}</span>
        </el-form-item>
        <el-form-item label="目标客户ID">
          <el-input v-model="distributeCustomerIds" type="textarea" :rows="4" placeholder="每行一个客户ID" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDistributeDialog = false">取消</el-button>
        <el-button type="primary" :loading="distributing" @click="handleDistribute">确定发放</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { apiGet, apiPost } from '../../utils/api';

const loading = ref(false);
const coupons = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 20;

const showCreateDialog = ref(false);
const creating = ref(false);
const createForm = reactive({
  name: '',
  type: 'full_reduction',
  discountValue: 20,
  conditionAmount: 100,
  validDays: 30,
  totalQuantity: 0,
});

const showDistributeDialog = ref(false);
const distributing = ref(false);
const distributingCoupon = ref<any>(null);
const distributeCustomerIds = ref('');

async function fetchCoupons() {
  loading.value = true;
  try {
    const result = await apiGet<any>('/marketing/coupons', { page: page.value, pageSize });
    coupons.value = result.items || [];
    total.value = result.total || 0;
  } catch (e) {
    console.error('Failed to fetch coupons:', e);
  } finally {
    loading.value = false;
  }
}

function handlePageChange(p: number) {
  page.value = p;
  fetchCoupons();
}

async function handleCreate() {
  if (!createForm.name) {
    ElMessage.warning('请输入优惠券名称');
    return;
  }
  creating.value = true;
  try {
    await apiPost('/marketing/coupons', createForm);
    ElMessage.success('优惠券创建成功');
    showCreateDialog.value = false;
    fetchCoupons();
  } catch (e) {
    console.error('Failed to create coupon:', e);
  } finally {
    creating.value = false;
  }
}

function openDistribute(coupon: any) {
  distributingCoupon.value = coupon;
  distributeCustomerIds.value = '';
  showDistributeDialog.value = true;
}

async function handleDistribute() {
  const ids = distributeCustomerIds.value.split('\n').map(s => s.trim()).filter(Boolean);
  if (ids.length === 0) {
    ElMessage.warning('请输入至少一个客户ID');
    return;
  }
  distributing.value = true;
  try {
    await apiPost(`/marketing/coupons/${distributingCoupon.value.id}/distribute`, { customerIds: ids });
    ElMessage.success('优惠券发放成功');
    showDistributeDialog.value = false;
    fetchCoupons();
  } catch (e) {
    console.error('Failed to distribute coupon:', e);
  } finally {
    distributing.value = false;
  }
}

onMounted(fetchCoupons);
</script>
