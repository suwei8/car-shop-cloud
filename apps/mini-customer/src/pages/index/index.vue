<template>
  <view class="container">
    <view class="header">
      <text class="shop-name">{{ auth.customerInfo?.tenant?.name || '加载中...' }}</text>
      <text class="greeting">{{ greeting }}</text>
    </view>

    <view class="card" v-if="activeOrder">
      <view class="card-title">进行中的工单</view>
      <view class="order-info">
        <text class="plate">{{ activeOrder.vehiclePlateNo }}</text>
        <text class="status">{{ statusLabel(activeOrder.status) }}</text>
      </view>
      <view class="progress-bar">
        <view class="progress-fill" :style="{ width: progressPercent + '%' }"></view>
      </view>
      <view class="progress-labels">
        <text v-for="(step, i) in steps" :key="step" :class="{ active: i <= currentStep }">{{ step }}</text>
      </view>
      <navigator :url="`/pages/work-orders/detail?id=${activeOrder.id}`" class="view-detail">查看详情 ></navigator>
    </view>

    <view class="card" v-else>
      <view class="card-title">工单状态</view>
      <text class="empty-text">当前没有进行中的工单</text>
    </view>

    <view class="card">
      <view class="card-title">储值卡</view>
      <view v-if="storedCards.length" v-for="card in storedCards" :key="card.id" class="balance-row">
        <text>{{ card.cardNo }}</text>
        <text class="balance">¥{{ Number(card.balance).toFixed(2) }}</text>
      </view>
      <text v-else class="empty-text">暂无储值卡</text>
    </view>

    <view class="card">
      <view class="card-title">套餐卡</view>
      <view v-if="packageCards.length" v-for="card in packageCards" :key="card.id" class="package-row">
        <text>{{ card.name }}</text>
        <text class="remain">{{ card.items?.reduce((s: number, i: any) => s + Number(i.remainQty), 0) || 0 }} 次剩余</text>
      </view>
      <text v-else class="empty-text">暂无套餐卡</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '../../stores/auth';
import { request } from '../../utils/api';

const auth = useAuthStore();

const activeOrder = ref<any>(null);
const storedCards = ref<any[]>([]);
const packageCards = ref<any[]>([]);

const steps = ['已确认', '派工中', '施工中', '已完成'];
const statusStepMap: Record<string, number> = {
  confirmed: 0, dispatching: 1, in_progress: 2, completed: 3,
};

const currentStep = computed(() => statusStepMap[activeOrder.value?.status] ?? -1);
const progressPercent = computed(() => Math.max(0, ((currentStep.value + 1) / steps.length) * 100));

const greeting = computed(() => {
  const h = new Date().getHours();
  if (h < 12) return '上午好';
  if (h < 18) return '下午好';
  return '晚上好';
});

const statusMap: Record<string, string> = {
  draft: '草稿', quoted: '已报价', confirmed: '已确认', dispatching: '派工中',
  in_progress: '施工中', completed: '已完成', settled: '已结算', cancelled: '已取消',
};
function statusLabel(s: string) { return statusMap[s] || s; }

onMounted(async () => {
  if (!auth.token) return;
  try {
    const orders: any = await request('/customer-portal/work-orders', { data: { pageSize: '1' } });
    const items = orders.items || [];
    const active = items.find((o: any) => !['settled', 'cancelled', 'completed'].includes(o.status));
    activeOrder.value = active || null;
  } catch {}
  try {
    const cards: any = await request('/customer-portal/cards');
    storedCards.value = cards.storedValueCards || [];
    packageCards.value = cards.packageCards || [];
  } catch {}
});
</script>

<style scoped>
.container { padding-bottom: 20px; }
.header { padding: 20px 16px; background: linear-gradient(135deg, #409eff, #66b1ff); color: #fff; }
.shop-name { font-size: 20px; font-weight: 700; display: block; }
.greeting { font-size: 14px; opacity: 0.85; margin-top: 4px; display: block; }
.order-info { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.plate { font-size: 16px; font-weight: 600; }
.status { font-size: 12px; color: #409eff; }
.progress-bar { height: 6px; background: #eee; border-radius: 3px; overflow: hidden; margin-bottom: 8px; }
.progress-fill { height: 100%; background: #409eff; border-radius: 3px; transition: width 0.3s; }
.progress-labels { display: flex; justify-content: space-between; font-size: 11px; color: #999; }
.progress-labels .active { color: #409eff; font-weight: 600; }
.view-detail { text-align: right; margin-top: 12px; font-size: 13px; color: #409eff; }
.balance-row, .package-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
.balance { font-weight: 600; color: #f56c6c; }
.remain { color: #67c23a; font-weight: 600; }
.empty-text { color: #999; font-size: 13px; }
</style>
