<template>
  <div class="page-container">
    <div class="page-header">
      <h2>车辆档案</h2>
      <el-button type="primary" @click="showDialog()">新增车辆</el-button>
    </div>

    <el-form :inline="true" style="margin-bottom: 16px">
      <el-form-item>
        <el-input v-model="keyword" placeholder="搜索车牌/VIN/客户姓名/手机号" clearable @clear="fetchList" @keyup.enter="fetchList" style="width: 300px" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="fetchList">搜索</el-button>
      </el-form-item>
    </el-form>

    <el-table :data="list" v-loading="loading" border>
      <el-table-column prop="plateNo" label="车牌号" width="120" />
      <el-table-column label="车型" min-width="240" show-overflow-tooltip>
        <template #default="{ row }">{{ row.model || '-' }}</template>
      </el-table-column>
      <el-table-column prop="color" label="颜色" width="80" />
      <el-table-column prop="vin" label="VIN" width="180" show-overflow-tooltip />
      <el-table-column label="车主" width="100">
        <template #default="{ row }">{{ row.customer?.name || '-' }}</template>
      </el-table-column>
      <el-table-column label="车主电话" width="130">
        <template #default="{ row }">{{ row.customer?.phone || '-' }}</template>
      </el-table-column>
      <el-table-column prop="mileage" label="里程(km)" width="90">
        <template #default="{ row }">{{ row.mileage || '-' }}</template>
      </el-table-column>
      <el-table-column label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="showDialog(row)">编辑</el-button>
          <el-button link type="primary" @click="$router.push(`/customers?keyword=${row.customer?.phone}`)">车主</el-button>
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

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑车辆' : '新增车辆'" width="580px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="车主" prop="customerId" v-if="!form.id">
          <el-select v-model="form.customerId" filterable remote :remote-method="searchCustomer" placeholder="搜索手机号/姓名" style="width: 100%">
            <el-option v-for="c in customerOptions" :key="c.id" :label="`${c.name} (${c.phone})`" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="车牌号" prop="plateNo">
          <el-input v-model="form.plateNo" placeholder="如：京A12345" />
        </el-form-item>
        <el-form-item label="车型">
          <VehicleModelInput v-model="form.model" />
        </el-form-item>
        <el-form-item label="颜色">
          <el-input v-model="form.color" placeholder="如：白色" />
        </el-form-item>
        <el-form-item label="VIN">
          <el-input v-model="form.vin" placeholder="车辆识别代号" />
        </el-form-item>
        <el-form-item label="里程(km)">
          <el-input-number v-model="form.mileage" :min="0" :step="1000" style="width: 100%" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import api from '../../utils/api';
import { ElMessage } from 'element-plus';
import VehicleModelInput from '../../components/VehicleModelInput.vue';

const list = ref<any[]>([]);
const customerOptions = ref<any[]>([]);
const loading = ref(false);
const page = ref(1);
const pageSize = 20;
const total = ref(0);
const keyword = ref('');
const dialogVisible = ref(false);
const saving = ref(false);
const formRef = ref();

const form = reactive({
  id: '', customerId: '', plateNo: '', model: '',
  color: '', vin: '', mileage: undefined as number | undefined, remark: '',
});

const rules = {
  customerId: [{ required: true, message: '请选择车主', trigger: 'change' }],
  plateNo: [{ required: true, message: '请输入车牌号', trigger: 'blur' }],
};

async function fetchList() {
  loading.value = true;
  try {
    const res: any = await api.get('/vehicles', {
      params: { page: page.value, pageSize, keyword: keyword.value || undefined },
    });
    list.value = res.items;
    total.value = res.total;
  } finally {
    loading.value = false;
  }
}

async function searchCustomer(kw: string) {
  if (!kw) return;
  const res: any = await api.get('/customers/search', { params: { keyword: kw } });
  customerOptions.value = res;
}

function showDialog(row?: any) {
  if (row) {
    Object.assign(form, {
      id: row.id, customerId: row.customerId, plateNo: row.plateNo,
      model: row.model || '', color: row.color,
      vin: row.vin, mileage: row.mileage, remark: row.remark,
    });
  } else {
    Object.assign(form, {
      id: '', customerId: '', plateNo: '', model: '',
      color: '', vin: '', mileage: undefined, remark: '',
    });
  }
  dialogVisible.value = true;
}

async function handleSave() {
  await formRef.value?.validate();
  saving.value = true;
  try {
    if (form.id) {
      await api.put(`/vehicles/${form.id}`, form);
    } else {
      await api.post('/vehicles', form);
    }
    ElMessage.success('保存成功');
    dialogVisible.value = false;
    fetchList();
  } finally {
    saving.value = false;
  }
}

onMounted(fetchList);
</script>
