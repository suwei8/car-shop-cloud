<template>
  <div class="page-container">
    <div class="page-header">
      <h2>收款记录</h2>
    </div>

    <el-form :inline="true" style="margin-bottom: 16px">
      <el-form-item>
        <el-select v-model="payMethod" placeholder="支付方式" clearable>
          <el-option label="现金" value="cash" />
          <el-option label="微信" value="wechat" />
          <el-option label="支付宝" value="alipay" />
          <el-option label="储值卡" value="stored_value" />
          <el-option label="套餐卡" value="package_card" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-date-picker v-model="dateRange" type="daterange" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" value-format="YYYY-MM-DD" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="fetchList">查询</el-button>
      </el-form-item>
    </el-form>

    <el-table :data="list" v-loading="loading" border>
      <el-table-column label="结算单号" width="180">
        <template #default="{ row }">{{ row.settlement?.settleNo }}</template>
      </el-table-column>
      <el-table-column label="支付方式" width="100">
        <template #default="{ row }">{{ payMethodLabel(row.payMethod) }}</template>
      </el-table-column>
      <el-table-column label="金额" width="120">
        <template #default="{ row }">¥{{ Number(row.amount).toFixed(2) }}</template>
      </el-table-column>
      <el-table-column prop="referenceNo" label="流水号" />
      <el-table-column prop="remark" label="备注" />
      <el-table-column prop="createdAt" label="时间" width="180">
        <template #default="{ row }">{{ new Date(row.createdAt).toLocaleString() }}</template>
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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import api from '../../utils/api';

const list = ref<any[]>([]);
const loading = ref(false);
const page = ref(1);
const pageSize = 20;
const total = ref(0);
const payMethod = ref('');
const dateRange = ref<string[]>([]);

const payMethodMap: Record<string, string> = {
  cash: '现金', wechat: '微信', alipay: '支付宝', card: '银行卡',
  stored_value: '储值卡', package_card: '套餐卡',
};
function payMethodLabel(m: string) { return payMethodMap[m] || m; }

async function fetchList() {
  loading.value = true;
  try {
    const params: any = { page: page.value, pageSize };
    if (payMethod.value) params.payMethod = payMethod.value;
    if (dateRange.value?.length === 2) {
      params.startDate = dateRange.value[0];
      params.endDate = dateRange.value[1];
    }
    const res: any = await api.get('/settlements/payments', { params });
    list.value = res.items;
    total.value = res.total;
  } finally {
    loading.value = false;
  }
}

onMounted(fetchList);
</script>
