<template>
  <div class="page-container">
    <div class="page-header">
      <h2>配件管理</h2>
      <div>
        <el-button type="success" @click="showStockInDialog">入库</el-button>
        <el-button type="primary" @click="showDialog()">新增配件</el-button>
      </div>
    </div>

    <el-form :inline="true" style="margin-bottom: 16px">
      <el-form-item>
        <el-input v-model="keyword" placeholder="搜索编码/名称/品牌" clearable @clear="fetchList" @keyup.enter="fetchList" />
      </el-form-item>
      <el-form-item>
        <el-select v-model="filterSupplier" placeholder="按供货商筛选" clearable @change="fetchList" style="width: 180px">
          <el-option v-for="s in suppliers" :key="s.id" :label="s.name" :value="s.id" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="fetchList">搜索</el-button>
      </el-form-item>
    </el-form>

    <el-table :data="list" v-loading="loading" border>
      <el-table-column prop="code" label="编码" width="120" />
      <el-table-column prop="name" label="名称" min-width="160" />
      <el-table-column prop="category" label="分类" width="100" />
      <el-table-column prop="brand" label="品牌" width="100" />
      <el-table-column label="供货商" width="120">
        <template #default="{ row }">{{ row.supplier?.name || '-' }}</template>
      </el-table-column>
      <el-table-column label="质保" width="80">
        <template #default="{ row }">{{ row.warrantyMonths > 0 ? row.warrantyMonths + '月' : '无' }}</template>
      </el-table-column>
      <el-table-column prop="unit" label="单位" width="60" />
      <el-table-column label="成本价" width="100">
        <template #default="{ row }">¥{{ Number(row.costPrice).toFixed(2) }}</template>
      </el-table-column>
      <el-table-column label="售价" width="100">
        <template #default="{ row }">¥{{ Number(row.salePrice).toFixed(2) }}</template>
      </el-table-column>
      <el-table-column prop="minStock" label="预警库存" width="80" />
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="showDialog(row)">编辑</el-button>
          <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
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

    <!-- 配件弹窗 -->
    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑配件' : '新增配件'" width="550px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="编码" prop="code"><el-input v-model="form.code" :disabled="!!form.id" /></el-form-item>
        <el-form-item label="名称" prop="name"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="分类"><el-input v-model="form.category" placeholder="如：油品、滤芯、刹车片" /></el-form-item>
        <el-form-item label="品牌"><el-input v-model="form.brand" /></el-form-item>
        <el-form-item label="供货商">
          <el-select v-model="form.supplierId" placeholder="选择供货商" clearable style="width: 100%">
            <el-option v-for="s in suppliers" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="质保月数">
          <el-input-number v-model="form.warrantyMonths" :min="0" :max="120" />
          <span style="margin-left: 8px; color: #909399">0 = 无质保</span>
        </el-form-item>
        <el-form-item label="单位"><el-input v-model="form.unit" placeholder="个" /></el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="成本价"><el-input-number v-model="form.costPrice" :min="0" :precision="2" style="width: 100%" /></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="售价"><el-input-number v-model="form.salePrice" :min="0" :precision="2" style="width: 100%" /></el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="预警库存"><el-input-number v-model="form.minStock" :min="0" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="form.remark" type="textarea" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>

    <!-- 入库弹窗 -->
    <el-dialog v-model="stockInDialogVisible" title="入库" width="650px">
      <el-form :model="stockInForm" label-width="80px">
        <el-form-item label="供货商">
          <el-select v-model="stockInForm.supplierId" placeholder="选择供货商" clearable style="width: 100%">
            <el-option v-for="s in suppliers" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-table :data="stockInForm.items" border size="small">
          <el-table-column label="配件" min-width="200">
            <template #default="{ row }">
              <el-select v-model="row.partId" filterable placeholder="选择配件" size="small">
                <el-option v-for="p in partsList" :key="p.id" :label="`${p.code} - ${p.name}`" :value="p.id" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="数量" width="100">
            <template #default="{ row }"><el-input-number v-model="row.quantity" size="small" :min="1" controls-position="right" style="width: 80px" /></template>
          </el-table-column>
          <el-table-column label="单价" width="120">
            <template #default="{ row }"><el-input-number v-model="row.unitPrice" size="small" :min="0" :precision="2" controls-position="right" style="width: 100px" /></template>
          </el-table-column>
          <el-table-column label="操作" width="60">
            <template #default="{ $index }"><el-button link type="danger" size="small" @click="stockInForm.items.splice($index, 1)">删</el-button></template>
          </el-table-column>
        </el-table>
        <el-button style="margin-top: 8px" size="small" @click="stockInForm.items.push({ partId: '', quantity: 1, unitPrice: 0 })">添加一行</el-button>
      </el-form>
      <template #footer>
        <el-button @click="stockInDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleStockIn">确认入库</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import api from '../../utils/api';
import { ElMessage, ElMessageBox } from 'element-plus';

const list = ref<any[]>([]);
const partsList = ref<any[]>([]);
const suppliers = ref<any[]>([]);
const loading = ref(false);
const page = ref(1);
const pageSize = 20;
const total = ref(0);
const keyword = ref('');
const filterSupplier = ref('');
const dialogVisible = ref(false);
const stockInDialogVisible = ref(false);
const saving = ref(false);
const formRef = ref();

const form = reactive({
  id: '', code: '', name: '', category: '', brand: '',
  supplierId: '', warrantyMonths: 0,
  unit: '个', costPrice: 0, salePrice: 0, minStock: 0, remark: '',
});
const rules = {
  code: [{ required: true, message: '请输入编码', trigger: 'blur' }],
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
};

const stockInForm = reactive({ supplierId: '', items: [{ partId: '', quantity: 1, unitPrice: 0 }] });

async function fetchList() {
  loading.value = true;
  try {
    const params: any = { page: page.value, pageSize, keyword: keyword.value || undefined };
    if (filterSupplier.value) params.supplierId = filterSupplier.value;
    const res: any = await api.get('/parts', { params });
    list.value = res.items;
    total.value = res.total;
  } finally {
    loading.value = false;
  }
}

async function fetchSuppliers() {
  suppliers.value = await api.get('/suppliers') as any;
}

async function fetchParts() {
  const res: any = await api.get('/parts', { params: { pageSize: 1000 } });
  partsList.value = res.items;
}

function showDialog(row?: any) {
  if (row) {
    Object.assign(form, {
      id: row.id, code: row.code, name: row.name, category: row.category, brand: row.brand,
      supplierId: row.supplierId || '', warrantyMonths: row.warrantyMonths || 0,
      unit: row.unit, costPrice: Number(row.costPrice), salePrice: Number(row.salePrice),
      minStock: row.minStock, remark: row.remark,
    });
  } else {
    Object.assign(form, {
      id: '', code: '', name: '', category: '', brand: '',
      supplierId: '', warrantyMonths: 0,
      unit: '个', costPrice: 0, salePrice: 0, minStock: 0, remark: '',
    });
  }
  dialogVisible.value = true;
}

function showStockInDialog() {
  stockInForm.supplierId = '';
  stockInForm.items = [{ partId: '', quantity: 1, unitPrice: 0 }];
  fetchParts();
  stockInDialogVisible.value = true;
}

async function handleSave() {
  await formRef.value?.validate();
  saving.value = true;
  try {
    if (form.id) {
      await api.put(`/parts/${form.id}`, form);
    } else {
      await api.post('/parts', form);
    }
    ElMessage.success('保存成功');
    dialogVisible.value = false;
    fetchList();
  } finally {
    saving.value = false;
  }
}

async function handleDelete(row: any) {
  await ElMessageBox.confirm('确认删除该配件？', '提示', { type: 'warning' });
  await api.delete(`/parts/${row.id}`);
  ElMessage.success('删除成功');
  fetchList();
}

async function handleStockIn() {
  saving.value = true;
  try {
    await api.post('/stock/in', { shopId: '', supplierId: stockInForm.supplierId || undefined, items: stockInForm.items });
    ElMessage.success('入库成功');
    stockInDialogVisible.value = false;
    fetchList();
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  fetchList();
  fetchSuppliers();
});
</script>
