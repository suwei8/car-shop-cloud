<template>
  <div class="page-container">
    <div class="page-header">
      <h2>套餐管理</h2>
      <el-button type="primary" @click="showDialog()">新增套餐</el-button>
    </div>

    <el-table :data="list" v-loading="loading" border>
      <el-table-column prop="name" label="套餐名称" />
      <el-table-column prop="description" label="描述" />
      <el-table-column label="年费">
        <template #default="{ row }">¥{{ row.priceYearly }}</template>
      </el-table-column>
      <el-table-column prop="maxShops" label="最大门店数" />
      <el-table-column prop="maxEmployees" label="最大员工数" />
      <el-table-column prop="status" label="状态">
        <template #default="{ row }">
          <el-tag :type="row.status === 'active' ? 'success' : 'info'">
            {{ row.status === 'active' ? '启用' : '停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="120">
        <template #default="{ row }">
          <el-button link type="primary" @click="showDialog(row)">编辑</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑套餐' : '新增套餐'" width="500px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" />
        </el-form-item>
        <el-form-item label="年费(元)" prop="priceYearly">
          <el-input-number v-model="form.priceYearly" :min="0" :precision="2" />
        </el-form-item>
        <el-form-item label="最大门店数" prop="maxShops">
          <el-input-number v-model="form.maxShops" :min="1" />
        </el-form-item>
        <el-form-item label="最大员工数" prop="maxEmployees">
          <el-input-number v-model="form.maxEmployees" :min="1" />
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

const list = ref<any[]>([]);
const loading = ref(false);
const dialogVisible = ref(false);
const saving = ref(false);
const formRef = ref();
const form = reactive({ id: '', name: '', description: '', priceYearly: 2980, maxShops: 1, maxEmployees: 5 });
const rules = {
  name: [{ required: true, message: '请输入套餐名称', trigger: 'blur' }],
  priceYearly: [{ required: true, message: '请输入年费', trigger: 'blur' }],
};

async function fetchList() {
  loading.value = true;
  try {
    list.value = await api.get('/platform/subscription-plans');
  } finally {
    loading.value = false;
  }
}

function showDialog(row?: any) {
  if (row) {
    Object.assign(form, { id: row.id, name: row.name, description: row.description, priceYearly: Number(row.priceYearly), maxShops: row.maxShops, maxEmployees: row.maxEmployees });
  } else {
    Object.assign(form, { id: '', name: '', description: '', priceYearly: 2980, maxShops: 1, maxEmployees: 5 });
  }
  dialogVisible.value = true;
}

async function handleSave() {
  await formRef.value?.validate();
  saving.value = true;
  try {
    if (form.id) {
      await api.put(`/platform/subscription-plans/${form.id}`, form);
    } else {
      await api.post('/platform/subscription-plans', form);
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
