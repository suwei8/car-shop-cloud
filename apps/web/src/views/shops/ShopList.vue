<template>
  <div class="page-container">
    <div class="page-header">
      <h2>门店管理</h2>
      <el-button type="primary" @click="showDialog()">新增门店</el-button>
    </div>

    <el-table :data="list" v-loading="loading" border>
      <el-table-column prop="name" label="门店名称" />
      <el-table-column prop="address" label="地址" />
      <el-table-column prop="phone" label="电话" />
      <el-table-column prop="status" label="状态">
        <template #default="{ row }">
          <el-tag :type="row.status === 'active' ? 'success' : 'danger'">
            {{ row.status === 'active' ? '营业中' : '已停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180">
        <template #default="{ row }">
          <el-button link type="primary" @click="showDialog(row)">编辑</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑门店' : '新增门店'" width="500px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="地址" prop="address">
          <el-input v-model="form.address" />
        </el-form-item>
        <el-form-item label="电话" prop="phone">
          <el-input v-model="form.phone" />
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
const form = reactive({ id: '', name: '', address: '', phone: '' });
const rules = { name: [{ required: true, message: '请输入门店名称', trigger: 'blur' }] };

async function fetchList() {
  loading.value = true;
  try {
    const res: any = await api.get('/shops');
    list.value = res.items || res;
  } finally {
    loading.value = false;
  }
}

function showDialog(row?: any) {
  if (row) {
    Object.assign(form, { id: row.id, name: row.name, address: row.address, phone: row.phone });
  } else {
    Object.assign(form, { id: '', name: '', address: '', phone: '' });
  }
  dialogVisible.value = true;
}

async function handleSave() {
  await formRef.value?.validate();
  saving.value = true;
  try {
    if (form.id) {
      await api.put(`/shops/${form.id}`, form);
    } else {
      await api.post('/shops', form);
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
