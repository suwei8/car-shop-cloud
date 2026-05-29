<template>
  <div class="page-container">
    <div class="page-header">
      <h2>供货商管理</h2>
      <el-button type="primary" @click="showDialog()">新增供货商</el-button>
    </div>

    <el-form :inline="true" style="margin-bottom: 16px">
      <el-form-item>
        <el-input v-model="keyword" placeholder="搜索名称/联系人/电话" clearable @clear="fetchList" @keyup.enter="fetchList" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="fetchList">搜索</el-button>
      </el-form-item>
    </el-form>

    <el-table :data="list" v-loading="loading" border>
      <el-table-column prop="name" label="供货商名称" />
      <el-table-column prop="contactName" label="联系人" width="120" />
      <el-table-column prop="phone" label="电话" width="140" />
      <el-table-column prop="address" label="地址" show-overflow-tooltip />
      <el-table-column label="供货配件数" width="100">
        <template #default="{ row }">{{ row._count?.parts || 0 }}</template>
      </el-table-column>
      <el-table-column prop="remark" label="备注" show-overflow-tooltip />
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="showDialog(row)">编辑</el-button>
          <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑供货商' : '新增供货商'" width="500px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="名称" prop="name"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="联系人"><el-input v-model="form.contactName" /></el-form-item>
        <el-form-item label="电话"><el-input v-model="form.phone" /></el-form-item>
        <el-form-item label="地址"><el-input v-model="form.address" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="form.remark" type="textarea" /></el-form-item>
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
import { ElMessage, ElMessageBox } from 'element-plus';

const list = ref<any[]>([]);
const loading = ref(false);
const keyword = ref('');
const dialogVisible = ref(false);
const saving = ref(false);
const formRef = ref();

const form = reactive({ id: '', name: '', contactName: '', phone: '', address: '', remark: '' });
const rules = { name: [{ required: true, message: '请输入供货商名称', trigger: 'blur' }] };

async function fetchList() {
  loading.value = true;
  try {
    list.value = await api.get('/suppliers', { params: { keyword: keyword.value || undefined } }) as any;
  } finally {
    loading.value = false;
  }
}

function showDialog(row?: any) {
  if (row) {
    Object.assign(form, { id: row.id, name: row.name, contactName: row.contactName, phone: row.phone, address: row.address, remark: row.remark });
  } else {
    Object.assign(form, { id: '', name: '', contactName: '', phone: '', address: '', remark: '' });
  }
  dialogVisible.value = true;
}

async function handleSave() {
  await formRef.value?.validate();
  saving.value = true;
  try {
    if (form.id) {
      await api.put(`/suppliers/${form.id}`, form);
    } else {
      await api.post('/suppliers', form);
    }
    ElMessage.success('保存成功');
    dialogVisible.value = false;
    fetchList();
  } finally {
    saving.value = false;
  }
}

async function handleDelete(row: any) {
  await ElMessageBox.confirm('确认删除该供货商？', '提示', { type: 'warning' });
  await api.delete(`/suppliers/${row.id}`);
  ElMessage.success('删除成功');
  fetchList();
}

onMounted(fetchList);
</script>
