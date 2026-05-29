<template>
  <div class="page-container">
    <div class="page-header">
      <h2>员工管理</h2>
      <el-button type="primary" @click="showDialog()">新增员工</el-button>
    </div>

    <el-table :data="list" v-loading="loading" border>
      <el-table-column prop="name" label="姓名" width="100" />
      <el-table-column prop="phone" label="手机号" width="130" />
      <el-table-column label="门店" width="120">
        <template #default="{ row }">{{ row.employee?.shop?.name || '-' }}</template>
      </el-table-column>
      <el-table-column label="职位" width="100">
        <template #default="{ row }">{{ row.employee?.position || '-' }}</template>
      </el-table-column>
      <el-table-column label="角色">
        <template #default="{ row }">
          <el-tag v-for="ur in row.userRoles" :key="ur.role.id" size="small" style="margin-right: 4px">
            {{ ur.role.name }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="80">
        <template #default="{ row }">
          <el-tag :type="row.status === 'active' ? 'success' : 'danger'">
            {{ row.status === 'active' ? '正常' : '已禁用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="showDialog(row)">编辑</el-button>
          <el-button link :type="row.status === 'active' ? 'danger' : 'success'" @click="toggleStatus(row)">
            {{ row.status === 'active' ? '禁用' : '启用' }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑员工' : '新增员工'" width="500px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="姓名" prop="name">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="form.phone" />
        </el-form-item>
        <el-form-item label="密码" :prop="form.id ? '' : 'password'">
          <el-input v-model="form.password" type="password" show-password :placeholder="form.id ? '留空则不修改密码' : ''" />
        </el-form-item>
        <el-form-item label="门店" prop="shopId">
          <el-select v-model="form.shopId" placeholder="选择门店">
            <el-option v-for="s in shops" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="职位">
          <el-input v-model="form.position" />
        </el-form-item>
        <el-form-item label="角色" prop="roleIds">
          <el-select v-model="form.roleIds" multiple placeholder="选择角色">
            <el-option v-for="r in roles" :key="r.id" :label="r.name" :value="r.id" />
          </el-select>
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
const shops = ref<any[]>([]);
const roles = ref<any[]>([]);
const loading = ref(false);
const dialogVisible = ref(false);
const saving = ref(false);
const formRef = ref();
const form = reactive({ id: '', name: '', phone: '', password: '', shopId: '', position: '', roleIds: [] as string[] });

const rules = {
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  phone: [{ required: true, message: '请输入手机号', trigger: 'blur' }],
  shopId: [{ required: true, message: '请选择门店', trigger: 'change' }],
  roleIds: [{ required: true, message: '请选择角色', trigger: 'change' }],
};

async function fetchList() {
  loading.value = true;
  try {
    const res: any = await api.get('/users');
    list.value = res.items || res;
  } finally {
    loading.value = false;
  }
}

async function fetchOptions() {
  const [shopRes, roleRes]: any = await Promise.all([
    api.get('/shops'),
    api.get('/roles'),
  ]);
  shops.value = shopRes.items || shopRes;
  roles.value = roleRes.items || roleRes;
}

function showDialog(row?: any) {
  if (row) {
    form.id = row.id;
    form.name = row.name;
    form.phone = row.phone;
    form.password = '';
    form.shopId = row.employee?.shopId || '';
    form.position = row.employee?.position || '';
    form.roleIds = row.userRoles?.map((ur: any) => ur.role.id) || [];
  } else {
    Object.assign(form, { id: '', name: '', phone: '', password: '', shopId: '', position: '', roleIds: [] });
  }
  dialogVisible.value = true;
}

async function handleSave() {
  await formRef.value?.validate();
  saving.value = true;
  try {
    if (form.id) {
      const data: any = { name: form.name, phone: form.phone, shopId: form.shopId, position: form.position, roleIds: form.roleIds };
      if (form.password) data.password = form.password;
      await api.put(`/users/${form.id}`, data);
      ElMessage.success('保存成功');
    } else {
      await api.post('/users', form);
      ElMessage.success('创建成功');
    }
    dialogVisible.value = false;
    fetchList();
  } finally {
    saving.value = false;
  }
}

async function toggleStatus(row: any) {
  const newStatus = row.status === 'active' ? 'disabled' : 'active';
  await api.put(`/users/${row.id}/status`, { status: newStatus });
  ElMessage.success('操作成功');
  fetchList();
}

onMounted(() => {
  fetchList();
  fetchOptions();
});
</script>
