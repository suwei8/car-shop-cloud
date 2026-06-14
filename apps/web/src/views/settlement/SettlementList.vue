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
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="statusTagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="referenceNo" label="流水号" />
      <el-table-column prop="remark" label="备注" />
      <el-table-column prop="createdAt" label="时间" width="180">
        <template #default="{ row }">{{ new Date(row.createdAt).toLocaleString() }}</template>
      </el-table-column>
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="canRefund(row)"
            type="danger"
            link
            size="small"
            @click="openRefund(row)"
          >退款</el-button>
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

    <RefundDialog
      v-model="showRefund"
      :settlement-id="refundTarget.settlementId"
      :payment-id="refundTarget.paymentId"
      :max-refundable="refundTarget.maxRefundable"
      @success="fetchList"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { apiGet } from '../../utils/api';
import type { Payment } from '../../types/models';
import type { PaginatedData } from '../../types/api';
import RefundDialog from './components/RefundDialog.vue';

const list = ref<(Payment & { settlement?: { settleNo: string; workOrderId: string }; status?: string; refundAmount?: number })[]>([]);
const loading = ref(false);
const page = ref(1);
const pageSize = 20;
const total = ref(0);
const payMethod = ref('');
const dateRange = ref<string[]>([]);

const showRefund = ref(false);
const refundTarget = reactive({ settlementId: '', paymentId: '', maxRefundable: 0 });

const payMethodMap: Record<string, string> = {
  cash: '现金', wechat: '微信', alipay: '支付宝', card: '银行卡',
  stored_value: '储值卡', package_card: '套餐卡',
};
function payMethodLabel(m: string) { return payMethodMap[m] || m; }

const statusMap: Record<string, string> = {
  pending: '待支付', paid: '已支付', refunding: '退款中',
  refunded: '已退款', partially_refunded: '部分退款', failed: '失败',
};
function statusLabel(s: string) { return statusMap[s] || s || '-'; }

function statusTagType(s: string): string {
  const map: Record<string, string> = {
    pending: 'warning', paid: 'success', refunded: 'info',
    partially_refunded: 'warning', failed: 'danger',
  };
  return map[s] || '';
}

function canRefund(row: any): boolean {
  const onlineMethods = ['wechat', 'alipay'];
  return onlineMethods.includes(row.payMethod) &&
    ['paid', 'partially_refunded'].includes(row.status || 'paid');
}

function openRefund(row: any) {
  refundTarget.settlementId = row.settlementId;
  refundTarget.paymentId = row.id;
  refundTarget.maxRefundable = Number(row.amount) - Number(row.refundAmount || 0);
  showRefund.value = true;
}

async function fetchList() {
  loading.value = true;
  try {
    const params: Record<string, unknown> = { page: page.value, pageSize };
    if (payMethod.value) params.payMethod = payMethod.value;
    if (dateRange.value?.length === 2) {
      params.startDate = dateRange.value[0];
      params.endDate = dateRange.value[1];
    }
    const res = await apiGet<PaginatedData<any>>('/settlements/payments', { params });
    list.value = res.items;
    total.value = res.total;
  } finally {
    loading.value = false;
  }
}

onMounted(fetchList);
</script>
