<template>
  <div class="page-container">
    <div class="page-header">
      <h2>客户档案</h2>
      <el-button type="primary" @click="showDialog()">新增客户</el-button>
    </div>

    <el-form :inline="true" style="margin-bottom: 16px">
      <el-form-item>
        <el-input v-model="keyword" placeholder="搜索姓名/手机号" clearable @clear="fetchList" @keyup.enter="fetchList" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="fetchList">搜索</el-button>
      </el-form-item>
    </el-form>

    <el-table :data="list" v-loading="loading" border>
      <el-table-column prop="name" label="姓名" width="120" />
      <el-table-column prop="phone" label="手机号" width="140" />
      <el-table-column label="性别" width="80">
        <template #default="{ row }">{{ ({ male: '男', female: '女' } as Record<string, string>)[row.gender] || '-' }}</template>
      </el-table-column>
      <el-table-column label="车辆数" width="80">
        <template #default="{ row }">{{ row.vehicles?.length || 0 }}</template>
      </el-table-column>
      <el-table-column label="车牌号">
        <template #default="{ row }">
          <el-tag v-for="v in row.vehicles" :key="v.id" size="small" style="margin-right: 4px">{{ v.plateNo }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="remark" label="备注" show-overflow-tooltip />
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="showDialog(row)">编辑</el-button>
          <el-button link type="primary" @click="showVehicleDialog(row)">添加车辆</el-button>
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

    <!-- 客户弹窗 -->
    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑客户' : '新增客户'" width="500px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="姓名" prop="name"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="手机号" prop="phone"><el-input v-model="form.phone" /></el-form-item>
        <el-form-item label="性别">
          <el-radio-group v-model="form.gender">
            <el-radio value="male">男</el-radio>
            <el-radio value="female">女</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="备注"><el-input v-model="form.remark" type="textarea" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>

    <!-- 添加车辆弹窗 -->
    <el-dialog v-model="vehicleDialogVisible" title="添加车辆" width="580px">
      <el-form ref="vehicleFormRef" :model="vehicleForm" :rules="vehicleRules" label-width="80px">
        <el-form-item label="车牌号" prop="plateNo"><el-input v-model="vehicleForm.plateNo" placeholder="如：京A12345" /></el-form-item>
        <el-form-item label="车型">
          <VehicleModelInput v-model="vehicleForm.model" />
        </el-form-item>
        <el-form-item label="颜色"><el-input v-model="vehicleForm.color" placeholder="如：白色" /></el-form-item>
        <el-form-item label="VIN"><el-input v-model="vehicleForm.vin" placeholder="车辆识别代号" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="vehicleDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSaveVehicle">保存</el-button>
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
const loading = ref(false);
const page = ref(1);
const pageSize = 20;
const total = ref(0);
const keyword = ref('');
const dialogVisible = ref(false);
const vehicleDialogVisible = ref(false);
const saving = ref(false);
const formRef = ref();
const vehicleFormRef = ref();
const selectedCustomerId = ref('');

const form = reactive({ id: '', name: '', phone: '', gender: '', remark: '' });
const rules = {
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  phone: [{ required: true, message: '请输入手机号', trigger: 'blur' }],
};

const vehicleForm = reactive({ plateNo: '', model: '', color: '', vin: '' });

const vehicleRules = {
  plateNo: [{ required: true, message: '请输入车牌号', trigger: 'blur' }],
};

async function fetchList() {
  loading.value = true;
  try {
    const res: any = await api.get('/customers', { params: { page: page.value, pageSize, keyword: keyword.value || undefined } });
    list.value = res.items;
    total.value = res.total;
  } finally {
    loading.value = false;
  }
}

function showDialog(row?: any) {
  if (row) {
    Object.assign(form, { id: row.id, name: row.name, phone: row.phone, gender: row.gender, remark: row.remark });
  } else {
    Object.assign(form, { id: '', name: '', phone: '', gender: '', remark: '' });
  }
  dialogVisible.value = true;
}

function showVehicleDialog(row: any) {
  selectedCustomerId.value = row.id;
  Object.assign(vehicleForm, { plateNo: '', model: '', color: '', vin: '' });
  vehicleDialogVisible.value = true;
}

async function handleSave() {
  await formRef.value?.validate();
  saving.value = true;
  try {
    if (form.id) {
      await api.put(`/customers/${form.id}`, form);
    } else {
      await api.post('/customers', form);
    }
    ElMessage.success('保存成功');
    dialogVisible.value = false;
    fetchList();
  } finally {
    saving.value = false;
  }
}

async function handleSaveVehicle() {
  await vehicleFormRef.value?.validate();
  saving.value = true;
  try {
    await api.post('/vehicles', { ...vehicleForm, customerId: selectedCustomerId.value });
    ElMessage.success('车辆添加成功');
    vehicleDialogVisible.value = false;
    fetchList();
  } finally {
    saving.value = false;
  }
}

onMounted(fetchList);
</script>
