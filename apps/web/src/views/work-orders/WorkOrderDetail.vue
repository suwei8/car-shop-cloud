<template>
  <div class="page-container" v-loading="loading">
    <div class="page-header">
      <h2>工单详情 {{ order?.orderNo }}</h2>
      <el-button @click="$router.back()">返回</el-button>
    </div>

    <template v-if="order">
      <el-row :gutter="16" style="margin-bottom: 16px">
        <el-col :span="12">
          <el-card>
            <template #header>客户信息</template>
            <el-descriptions :column="1" border size="small">
              <el-descriptions-item label="客户姓名">{{ order.customer?.name }}</el-descriptions-item>
              <el-descriptions-item label="手机号">{{ order.customer?.phone }}</el-descriptions-item>
              <el-descriptions-item label="车牌号">{{ order.vehiclePlateNo }}</el-descriptions-item>
              <el-descriptions-item label="车型">{{ order.vehicle?.model || '-' }}</el-descriptions-item>
              <el-descriptions-item label="进店里程">{{ order.vehicleMileage ? order.vehicleMileage + ' km' : '-' }}</el-descriptions-item>
            </el-descriptions>
          </el-card>
        </el-col>
        <el-col :span="12">
          <el-card>
            <template #header>工单信息</template>
            <el-descriptions :column="1" border size="small">
              <el-descriptions-item label="工单号">{{ order.orderNo }}</el-descriptions-item>
              <el-descriptions-item label="类型">{{ ({ repair: '维修', wash: '洗美', quick: '快单' } as Record<string, string>)[order.orderType] }}</el-descriptions-item>
              <el-descriptions-item label="状态">
                <el-tag>{{ statusLabel(order.status) }}</el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="创建时间">{{ new Date(order.createdAt).toLocaleString() }}</el-descriptions-item>
              <el-descriptions-item label="故障描述">{{ order.description || '-' }}</el-descriptions-item>
            </el-descriptions>
          </el-card>
        </el-col>
      </el-row>

      <el-card style="margin-bottom: 16px">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center">
            <span>服务项目</span>
            <el-button size="small" @click="showAddItem = true" v-if="!['settled', 'cancelled'].includes(order.status)">添加项目</el-button>
          </div>
        </template>
        <el-table :data="order.items" border size="small">
          <el-table-column prop="name" label="项目名称" />
          <el-table-column label="类型" width="80">
            <template #default="{ row }">{{ ({ service: '工时', part: '配件', addon: '其他' } as Record<string, string>)[row.itemType] }}</template>
          </el-table-column>
          <el-table-column prop="quantity" label="数量" width="80" />
          <el-table-column label="单价" width="100">
            <template #default="{ row }">¥{{ Number(row.unitPrice).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column label="金额" width="100">
            <template #default="{ row }">¥{{ Number(row.amount).toFixed(2) }}</template>
          </el-table-column>
        </el-table>
        <div style="text-align: right; margin-top: 12px; font-size: 18px">
          合计：<strong style="color: #f56c6c">¥{{ Number(order.totalAmount).toFixed(2) }}</strong>
        </div>
      </el-card>

      <el-card v-if="!['settled', 'cancelled'].includes(order.status)">
        <template #header>操作</template>
        <el-space>
          <el-button v-if="order.status === 'draft'" type="primary" @click="updateStatus('confirmed')">确认工单</el-button>
          <el-button v-if="order.status === 'confirmed'" type="warning" @click="updateStatus('in_progress')">开始施工</el-button>
          <el-button v-if="order.status === 'in_progress'" type="success" @click="updateStatus('completed')">施工完成</el-button>
        </el-space>
      </el-card>

      <!-- 添加项目弹窗 -->
      <el-dialog v-model="showAddItem" title="添加服务项目" width="600px">
        <el-form :model="itemForm" label-width="80px">
          <el-table :data="itemForm.items" border size="small">
            <el-table-column label="项目名称" min-width="180">
              <template #default="{ row }"><el-input v-model="row.name" size="small" /></template>
            </el-table-column>
            <el-table-column label="类型" width="100">
              <template #default="{ row }">
                <el-select v-model="row.itemType" size="small">
                  <el-option label="工时" value="service" /><el-option label="配件" value="part" /><el-option label="其他" value="addon" />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="数量" width="100">
              <template #default="{ row }"><el-input-number v-model="row.quantity" size="small" :min="0.01" :precision="2" controls-position="right" style="width: 80px" /></template>
            </el-table-column>
            <el-table-column label="单价" width="120">
              <template #default="{ row }"><el-input-number v-model="row.unitPrice" size="small" :min="0" :precision="2" controls-position="right" style="width: 100px" /></template>
            </el-table-column>
            <el-table-column label="操作" width="60">
              <template #default="{ $index }"><el-button link type="danger" size="small" @click="itemForm.items.splice($index, 1)">删</el-button></template>
            </el-table-column>
          </el-table>
          <el-button style="margin-top: 8px" size="small" @click="itemForm.items.push({ name: '', itemType: 'service', quantity: 1, unitPrice: 0 })">添加一行</el-button>
        </el-form>
        <template #footer>
          <el-button @click="showAddItem = false">取消</el-button>
          <el-button type="primary" :loading="saving" @click="handleAddItems">确定</el-button>
        </template>
      </el-dialog>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import api from '../../utils/api';
import { ElMessage } from 'element-plus';

const route = useRoute();
const order = ref<any>(null);
const loading = ref(false);
const saving = ref(false);
const showAddItem = ref(false);
const itemForm = reactive({ items: [{ name: '', itemType: 'service', quantity: 1, unitPrice: 0 }] });

const statusMap: Record<string, string> = {
  draft: '草稿', quoted: '已报价', confirmed: '已确认', dispatching: '派工中',
  in_progress: '施工中', completed: '已完成', settled: '已结算', cancelled: '已取消',
};
function statusLabel(s: string) { return statusMap[s] || s; }

async function fetchOrder() {
  loading.value = true;
  try {
    order.value = await api.get(`/work-orders/${route.params.id}`);
  } finally {
    loading.value = false;
  }
}

async function updateStatus(status: string) {
  await api.put(`/work-orders/${order.value.id}/status`, { status });
  ElMessage.success('状态更新成功');
  fetchOrder();
}

async function handleAddItems() {
  saving.value = true;
  try {
    await api.post(`/work-orders/${order.value.id}/items`, { items: itemForm.items });
    ElMessage.success('项目添加成功');
    showAddItem.value = false;
    itemForm.items = [{ name: '', itemType: 'service', quantity: 1, unitPrice: 0 }];
    fetchOrder();
  } finally {
    saving.value = false;
  }
}

onMounted(fetchOrder);
</script>
