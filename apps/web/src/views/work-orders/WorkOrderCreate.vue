<template>
  <div class="page-container">
    <div class="page-header">
      <h2>接车开单</h2>
      <el-button @click="$router.back()">返回</el-button>
    </div>

    <el-form ref="formRef" :model="form" :rules="rules" label-width="100px" style="max-width: 800px">
      <el-card style="margin-bottom: 16px">
        <template #header>客户车辆信息</template>
        <el-form-item label="客户" prop="customerId">
          <el-select v-model="form.customerId" filterable remote :remote-method="searchCustomer" placeholder="搜索手机号/姓名" style="width: 100%">
            <el-option v-for="c in customerOptions" :key="c.id" :label="`${c.name} (${c.phone})`" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="车辆" prop="vehicleId">
          <el-select v-model="form.vehicleId" placeholder="选择车辆" style="width: 100%">
            <el-option v-for="v in vehicleOptions" :key="v.id" :label="`${v.plateNo} ${v.model || ''}`" :value="v.id" />
          </el-select>
        </el-form-item>
      </el-card>

      <el-card style="margin-bottom: 16px">
        <template #header>工单信息</template>
        <el-form-item label="工单类型" prop="orderType">
          <el-radio-group v-model="form.orderType">
            <el-radio-button value="repair">维修</el-radio-button>
            <el-radio-button value="wash">洗美</el-radio-button>
            <el-radio-button value="quick">快单</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="故障描述">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="客户描述的故障或服务要求" />
        </el-form-item>
        <el-form-item label="进店里程">
          <el-input-number v-model="form.vehicleMileage" :min="0" :step="100" />
          <span style="margin-left: 8px">公里</span>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-card>

      <el-card style="margin-bottom: 16px">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center">
            <span>服务项目</span>
            <el-button size="small" @click="addItem">添加项目</el-button>
          </div>
        </template>
        <el-table :data="form.items" border size="small">
          <el-table-column label="项目名称" min-width="200">
            <template #default="{ row }">
              <el-input v-model="row.name" size="small" />
            </template>
          </el-table-column>
          <el-table-column label="类型" width="100">
            <template #default="{ row }">
              <el-select v-model="row.itemType" size="small">
                <el-option label="工时" value="service" />
                <el-option label="配件" value="part" />
                <el-option label="其他" value="addon" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="数量" width="100">
            <template #default="{ row }">
              <el-input-number v-model="row.quantity" size="small" :min="0.01" :precision="2" controls-position="right" style="width: 80px" />
            </template>
          </el-table-column>
          <el-table-column label="单价" width="120">
            <template #default="{ row }">
              <el-input-number v-model="row.unitPrice" size="small" :min="0" :precision="2" controls-position="right" style="width: 100px" />
            </template>
          </el-table-column>
          <el-table-column label="金额" width="100">
            <template #default="{ row }">¥{{ (row.quantity * row.unitPrice).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="60">
            <template #default="{ $index }">
              <el-button link type="danger" size="small" @click="form.items.splice($index, 1)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div style="text-align: right; margin-top: 12px; font-size: 16px">
          合计：<strong style="color: #f56c6c">¥{{ totalAmount.toFixed(2) }}</strong>
        </div>
      </el-card>

      <el-form-item>
        <el-button type="primary" size="large" :loading="saving" @click="handleSave">保存工单</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import api from '../../utils/api';
import { ElMessage } from 'element-plus';

const router = useRouter();
const formRef = ref();
const saving = ref(false);
const customerOptions = ref<any[]>([]);
const vehicleOptions = ref<any[]>([]);

const form = reactive({
  customerId: '',
  vehicleId: '',
  orderType: 'repair',
  description: '',
  vehicleMileage: undefined as number | undefined,
  remark: '',
  shopId: '',
  items: [] as any[],
});

const rules = {
  customerId: [{ required: true, message: '请选择客户', trigger: 'change' }],
  vehicleId: [{ required: true, message: '请选择车辆', trigger: 'change' }],
  orderType: [{ required: true, message: '请选择工单类型', trigger: 'change' }],
};

const totalAmount = computed(() =>
  form.items.reduce((sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0), 0)
);

async function searchCustomer(keyword: string) {
  if (!keyword) return;
  const res: any = await api.get('/customers/search', { params: { keyword } });
  customerOptions.value = res;
}

watch(() => form.customerId, async (id) => {
  if (!id) { vehicleOptions.value = []; return; }
  const res: any = await api.get('/vehicles', { params: { customerId: id } });
  vehicleOptions.value = res.items;
  if (vehicleOptions.value.length === 1) {
    form.vehicleId = vehicleOptions.value[0].id;
  }
});

function addItem() {
  form.items.push({ name: '', itemType: 'service', quantity: 1, unitPrice: 0 });
}

async function handleSave() {
  await formRef.value?.validate();
  saving.value = true;
  try {
    const res: any = await api.post('/work-orders', form);
    ElMessage.success('工单创建成功');
    router.push(`/work-orders/${res.id}`);
  } finally {
    saving.value = false;
  }
}
</script>
