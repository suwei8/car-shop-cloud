<template>
  <view class="container">
    <view class="card" v-for="order in orders" :key="order.id" @click="goDetail(order.id)">
      <view class="order-header">
        <text class="order-no">{{ order.orderNo }}</text>
        <text class="status" :class="order.status">{{ statusLabel(order.status) }}</text>
      </view>
      <view class="order-body">
        <text class="plate">{{ order.vehiclePlateNo }}</text>
        <text class="type">{{ typeLabel(order.orderType) }}</text>
      </view>
      <view class="order-footer">
        <text class="time">{{ formatDate(order.createdAt) }}</text>
        <text class="amount">¥{{ Number(order.payableAmount).toFixed(2) }}</text>
      </view>
    </view>
    <view v-if="!orders.length && !loading" class="empty">暂无工单记录</view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { request } from '../../utils/api';

const orders = ref<any[]>([]);
const loading = ref(false);

const statusMap: Record<string, string> = {
  draft: '草稿', quoted: '已报价', confirmed: '已确认', dispatching: '派工中',
  in_progress: '施工中', completed: '已完成', settled: '已结算', cancelled: '已取消',
};
const typeMap: Record<string, string> = { repair: '维修', wash: '洗美', quick: '快单' };

function statusLabel(s: string) { return statusMap[s] || s; }
function typeLabel(t: string) { return typeMap[t] || t; }
function formatDate(d: string) { return new Date(d).toLocaleDateString(); }

function goDetail(id: string) {
  uni.navigateTo({ url: `/pages/work-orders/detail?id=${id}` });
}

onMounted(async () => {
  loading.value = true;
  try {
    const res: any = await request('/customer-portal/work-orders');
    orders.value = res.items || [];
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.container { padding: 4px; }
.order-header { display: flex; justify-content: space-between; margin-bottom: 8px; }
.order-no { font-size: 13px; color: #666; }
.status { font-size: 12px; padding: 2px 8px; border-radius: 10px; }
.status.completed, .status.settled { background: #e1f3d8; color: #67c23a; }
.status.in_progress, .status.dispatching, .status.confirmed { background: #fdf6ec; color: #e6a23c; }
.status.cancelled { background: #f0f0f0; color: #999; }
.order-body { display: flex; gap: 12px; margin-bottom: 8px; }
.plate { font-weight: 600; }
.type { color: #666; font-size: 13px; }
.order-footer { display: flex; justify-content: space-between; font-size: 13px; color: #999; }
.amount { color: #f56c6c; font-weight: 600; }
.empty { text-align: center; color: #999; padding: 40px; }
</style>
