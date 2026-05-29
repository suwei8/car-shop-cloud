<template>
  <div class="page-container">
    <div class="page-header">
      <h2>角色权限</h2>
      <el-button type="primary" @click="showDialog()">新增角色</el-button>
    </div>

    <el-table :data="list" v-loading="loading" border>
      <el-table-column prop="name" label="角色名称" />
      <el-table-column prop="code" label="标识" />
      <el-table-column label="权限数">
        <template #default="{ row }">{{ row.rolePermissions?.length || 0 }}</template>
      </el-table-column>
      <el-table-column prop="isBuiltIn" label="内置">
        <template #default="{ row }">
          <el-tag v-if="row.isBuiltIn" type="info" size="small">内置</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200">
        <template #default="{ row }">
          <el-button link type="primary" @click="showDialog(row)" :disabled="row.isBuiltIn">编辑</el-button>
          <el-button link type="danger" @click="handleDelete(row)" :disabled="row.isBuiltIn">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑角色' : '新增角色'" width="600px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="标识" prop="code">
          <el-input v-model="form.code" :disabled="!!form.id" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" />
        </el-form-item>
        <el-form-item label="权限">
          <el-checkbox-group v-model="form.permissionIds">
            <div v-for="(perms, module) in groupedPermissions" :key="module" style="margin-bottom: 12px">
              <div style="font-weight: bold; margin-bottom: 4px">{{ module }}</div>
              <el-checkbox v-for="p in perms" :key="p.id" :label="p.id">{{ p.name }}</el-checkbox>
            </div>
          </el-checkbox-group>
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
import { ElMessage, ElMessageBox } from 'element-plus';

const list = ref<any[]>([]);
const groupedPermissions = ref<Record<string, any[]>>({});
const loading = ref(false);
const dialogVisible = ref(false);
const saving = ref(false);
const formRef = ref();
const form = reactive({ id: '', name: '', code: '', description: '', permissionIds: [] as string[] });
const rules = {
  name: [{ required: true, message: '请输入角色名称', trigger: 'blur' }],
  code: [{ required: true, message: '请输入标识', trigger: 'blur' }],
};

async function fetchList() {
  loading.value = true;
  try {
    const res: any = await api.get('/roles');
    list.value = res.items || res;
  } finally {
    loading.value = false;
  }
}

async function fetchPermissions() {
  const res: any = await api.get('/permissions/grouped');
  groupedPermissions.value = res;
}

function showDialog(row?: any) {
  if (row) {
    Object.assign(form, {
      id: row.id, name: row.name, code: row.code, description: row.description,
      permissionIds: row.rolePermissions?.map((rp: any) => rp.permissionId) || [],
    });
  } else {
    Object.assign(form, { id: '', name: '', code: '', description: '', permissionIds: [] });
  }
  dialogVisible.value = true;
}

async function handleSave() {
  await formRef.value?.validate();
  saving.value = true;
  try {
    if (form.id) {
      await api.put(`/roles/${form.id}`, form);
    } else {
      await api.post('/roles', form);
    }
    ElMessage.success('保存成功');
    dialogVisible.value = false;
    fetchList();
  } finally {
    saving.value = false;
  }
}

async function handleDelete(row: any) {
  await ElMessageBox.confirm('确认删除该角色？', '提示', { type: 'warning' });
  await api.delete(`/roles/${row.id}`);
  ElMessage.success('删除成功');
  fetchList();
}

onMounted(() => {
  fetchList();
  fetchPermissions();
});
</script>
