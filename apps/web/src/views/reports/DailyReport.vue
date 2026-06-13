<template>
  <div class="page-container">
    <div class="page-header">
      <h2>营业日报</h2>
    </div>

    <el-form :inline="true" style="margin-bottom: 16px">
      <el-form-item>
        <el-date-picker v-model="dateRange" type="daterange" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" value-format="YYYY-MM-DD" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="fetchReport">查询</el-button>
        <el-button @click="exportReport">导出 Excel</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="20" style="margin-bottom: 20px">
      <el-col :span="4">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-label">工单总数</div>
          <div class="stat-value">{{ report.summary?.totalOrders || 0 }}</div>
        </el-card>
      </el-col>
      <el-col :span="4">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-label">营收总额</div>
          <div class="stat-value money">¥{{ (report.summary?.totalRevenue || 0).toFixed(2) }}</div>
        </el-card>
      </el-col>
      <el-col :span="4">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-label">优惠金额</div>
          <div class="stat-value">¥{{ (report.summary?.totalDiscount || 0).toFixed(2) }}</div>
        </el-card>
      </el-col>
      <el-col :span="4">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-label">实收金额</div>
          <div class="stat-value money">¥{{ (report.summary?.totalPaid || 0).toFixed(2) }}</div>
        </el-card>
      </el-col>
      <el-col :span="4">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-label">欠款金额</div>
          <div class="stat-value danger">¥{{ (report.summary?.totalDebt || 0).toFixed(2) }}</div>
        </el-card>
      </el-col>
      <el-col :span="4">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-label">结算单数</div>
          <div class="stat-value">{{ report.summary?.settlementCount || 0 }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20">
      <el-col :span="12">
        <el-card>
          <template #header>按状态统计</template>
          <el-table :data="report.orders || []" size="small">
            <el-table-column prop="status" label="状态">
              <template #default="{ row }">{{ statusLabel(row.status) }}</template>
            </el-table-column>
            <el-table-column prop="count" label="数量" width="100" />
            <el-table-column label="金额" width="120">
              <template #default="{ row }">¥{{ row.amount.toFixed(2) }}</template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>按支付方式统计</template>
          <el-table :data="report.payments || []" size="small">
            <el-table-column prop="method" label="支付方式">
              <template #default="{ row }">{{ payMethodLabel(row.method) }}</template>
            </el-table-column>
            <el-table-column prop="count" label="笔数" width="100" />
            <el-table-column label="金额" width="120">
              <template #default="{ row }">¥{{ row.amount.toFixed(2) }}</template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import api from '../../utils/api';

const dateRange = ref<string[]>([]);
const report = ref<any>({});

const statusMap: Record<string, string> = {
  draft: '草稿', confirmed: '已确认', in_progress: '施工中', completed: '已完成', settled: '已结算', cancelled: '已取消',
};
function statusLabel(s: string) { return statusMap[s] || s; }

const payMethodMap: Record<string, string> = {
  cash: '现金', wechat: '微信', alipay: '支付宝', card: '银行卡',
  stored_value: '储值卡', package_card: '套餐卡',
};
function payMethodLabel(m: string) { return payMethodMap[m] || m; }

async function fetchReport() {
  if (!dateRange.value || dateRange.value.length !== 2) return;
  report.value = await api.get('/reports/daily', {
    params: { startDate: dateRange.value[0], endDate: dateRange.value[1] },
  });
}

async function exportReport() {
  if (!dateRange.value || dateRange.value.length !== 2) return;
  try {
    const res = await api.get('/reports/daily/export', {
      params: { startDate: dateRange.value[0], endDate: dateRange.value[1] },
      responseType: 'blob',
    });
    const blob = new Blob([res as unknown as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `营业日报_${dateRange.value[0]}_${dateRange.value[1]}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    ElMessage.success('导出成功');
  } catch {
    ElMessage.error('导出失败');
  }
}

onMounted(() => {
  const today = new Date().toISOString().slice(0, 10);
  dateRange.value = [today, today];
  fetchReport();
});
</script>

<style scoped>
.stat-card { text-align: center; }
.stat-label { font-size: 14px; color: #909399; margin-bottom: 8px; }
.stat-value { font-size: 24px; font-weight: bold; color: #409eff; }
.stat-value.money { color: #67c23a; }
.stat-value.danger { color: #f56c6c; }
</style>
