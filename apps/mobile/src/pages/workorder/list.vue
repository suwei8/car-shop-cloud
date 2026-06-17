<template>
  <view class="page">
    <!-- Offline indicator -->
    <view class="offline-banner" v-if="isOffline">
      <text class="offline-text">⚠️ 网络已断开</text>
    </view>

    <view class="header">
      <text class="title">工单管理</text>
    </view>

    <!-- Status filter tabs -->
    <scroll-view class="tabs-scroll" scroll-x enable-flex>
      <view class="tabs">
        <view :class="['tab', activeTab === '' ? 'active' : '']" @tap="switchTab('')">全部</view>
        <view :class="['tab', activeTab === 'pending' ? 'active' : '']" @tap="switchTab('pending')">待派工</view>
        <view :class="['tab', activeTab === 'dispatching' ? 'active' : '']" @tap="switchTab('dispatching')">待开工</view>
        <view :class="['tab', activeTab === 'in_progress' ? 'active' : '']" @tap="switchTab('in_progress')">施工中</view>
        <view :class="['tab', activeTab === 'completed' ? 'active' : '']" @tap="switchTab('completed')">待结算</view>
        <view :class="['tab', activeTab === 'settled' ? 'active' : '']" @tap="switchTab('settled')">已完工</view>
      </view>
    </scroll-view>

    <!-- Order list -->
    <scroll-view
      class="order-list"
      scroll-y
      refresher-enabled
      :refresher-triggered="refreshing"
      @refresherrefresh="onRefresh"
      @scrolltolower="onLoadMore"
    >
      <view
        class="order-card"
        v-for="order in filteredOrders"
        :key="order.id"
        @tap="goDetail(order)"
      >
        <view class="card-top">
          <text class="order-no">{{ order.orderNo }}</text>
          <text :class="['status-tag', order.status]">{{ statusLabel(order.status) }}</text>
        </view>
        <view class="card-info">
          <view class="info-line">
            <text class="info-label">车牌：</text>
            <text class="info-value text-primary font-bold">{{ order.vehiclePlateNo }}</text>
          </view>
          <view class="info-line">
            <text class="info-label">类型：</text>
            <text class="info-value">{{ typeLabel(order.orderType) }}</text>
          </view>
          <view class="info-line" v-if="order.customer?.name">
            <text class="info-label">客户：</text>
            <text class="info-value">{{ order.customer.name }}</text>
          </view>
        </view>
        <view class="card-bottom">
          <text class="create-time">{{ formatTime(order.createdAt) }}</text>
          <text class="amount" v-if="order.totalAmount">¥{{ Number(order.totalAmount).toFixed(2) }}</text>
        </view>

        <!-- Simple mode: quick complete button -->
        <view class="simple-actions" v-if="simpleMode && ['dispatching', 'in_progress'].includes(order.status)">
          <button class="btn-quick-complete" @tap.stop="quickComplete(order)">一键完工</button>
        </view>
      </view>

      <view class="loading-more" v-if="loading">
        <text class="loading-text">加载中...</text>
      </view>
      <view class="empty" v-if="!loading && filteredOrders.length === 0">
        <text class="empty-icon">📋</text>
        <text class="empty-text">暂无工单</text>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { request } from '../../utils/request';
import { useAuthStore } from '../../stores/auth';

const auth = useAuthStore();
const simpleMode = computed(() => auth.simpleMode);

const allOrders = ref<any[]>([]);
const activeTab = ref('');
const refreshing = ref(false);
const loading = ref(false);
const page = ref(1);
const pageSize = 20;
const hasMore = ref(true);
const isOffline = ref(false);

const filteredOrders = computed(() => {
  if (!activeTab.value) return allOrders.value;
  return allOrders.value.filter(o => o.status === activeTab.value);
});

const statusMap: Record<string, string> = {
  draft: '草稿', confirmed: '已确认', dispatching: '待开工', in_progress: '施工中',
  completed: '待结算', settled: '已结算', cancelled: '已取消',
};
function statusLabel(s: string) { return statusMap[s] || s; }

const typeMap: Record<string, string> = {
  repair: '机修', maintenance: '保养', sheet_metal: '钣金', painting: '喷漆',
  wash: '洗美', rescue: '施救', quick: '快速',
};
function typeLabel(t: string) { return typeMap[t] || t; }

function formatTime(t: string) {
  if (!t) return '';
  const d = new Date(t);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${m}-${day} ${h}:${min}`;
}

function switchTab(tab: string) {
  activeTab.value = tab;
}

async function fetchOrders(isRefresh = false) {
  if (loading.value) return;
  loading.value = true;
  try {
    if (isRefresh) {
      page.value = 1;
      hasMore.value = true;
    }
    if (!hasMore.value) return;

    const token = uni.getStorageSync('accessToken');
    const statusParam = activeTab.value ? `&status=${activeTab.value}` : '';
    const res: any = await request({
      url: `/api/work-orders?page=${page.value}&pageSize=${pageSize}${statusParam}`,
      method: 'GET',
      header: { Authorization: `Bearer ${token}` },
    });
    if (res.data?.code === 0 && res.data.data) {
      const data = res.data.data;
      const items = data.items || data;
      if (isRefresh) {
        allOrders.value = items;
      } else {
        allOrders.value = [...allOrders.value, ...items];
      }
      hasMore.value = items.length >= pageSize;
      page.value++;
    }
  } catch (e) {
    // silent
  } finally {
    loading.value = false;
    refreshing.value = false;
  }
}

async function onRefresh() {
  refreshing.value = true;
  await fetchOrders(true);
}

function onLoadMore() {
  if (!loading.value && hasMore.value) {
    fetchOrders();
  }
}

function goDetail(order: any) {
  uni.navigateTo({ url: `/pages/workorder/detail?id=${order.id}` });
}

async function quickComplete(order: any) {
  uni.showModal({
    title: '一键完工',
    content: `确定将工单 ${order.orderNo} 标记为完工？`,
    success: async (res) => {
      if (!res.confirm) return;
      const token = uni.getStorageSync('accessToken');
      try {
        const woRes: any = await request({
          url: `/api/work-orders/${order.id}/status`,
          method: 'PUT',
          data: { status: 'completed' },
          header: { Authorization: `Bearer ${token}` },
        });
        if (woRes.data?.code === 0) {
          uni.showToast({ title: '已完工', icon: 'success' });
          order.status = 'completed';
        } else {
          throw new Error(woRes.data?.message || '操作失败');
        }
      } catch (err: any) {
        uni.showToast({ title: err.message || '完工失败', icon: 'none' });
      }
    }
  });
}

onMounted(() => {
  fetchOrders(true);
  uni.onNetworkStatusChange((res) => {
    isOffline.value = !res.isConnected;
  });
});
</script>

<style scoped>
.page {
  padding: 20rpx;
  background: #121214;
  min-height: 100vh;
  color: #e0e0e6;
}

.offline-banner {
  background: #ef4444;
  padding: 12rpx 0;
  text-align: center;
  border-radius: 8rpx;
  margin-bottom: 16rpx;
}
.offline-text {
  color: #fff;
  font-size: 24rpx;
  font-weight: bold;
}

.header { margin-bottom: 20rpx; }
.title { font-size: 40rpx; font-weight: 800; color: #fff; }

.tabs-scroll {
  margin-bottom: 20rpx;
  white-space: nowrap;
}
.tabs {
  display: inline-flex;
  gap: 12rpx;
}
.tab {
  display: inline-block;
  padding: 14rpx 28rpx;
  background: #1c1c1e;
  border-radius: 20rpx;
  font-size: 26rpx;
  color: #a1a1a9;
  border: 1rpx solid #2c2c2e;
  white-space: nowrap;
}
.tab.active {
  background: #3b82f6;
  color: #fff;
  border-color: #3b82f6;
}

.order-list {
  height: calc(100vh - 280rpx);
}

.order-card {
  background: #1c1c1e;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  border: 1rpx solid #2c2c2e;
}
.card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}
.order-no {
  font-size: 28rpx;
  font-weight: bold;
  color: #fff;
}
.status-tag {
  font-size: 22rpx;
  padding: 4rpx 14rpx;
  border-radius: 8rpx;
  font-weight: bold;
}
.status-tag.draft { background: rgba(142,142,147,0.15); color: #8e8e93; }
.status-tag.confirmed { background: rgba(168,85,247,0.15); color: #a855f7; }
.status-tag.dispatching { background: rgba(251,191,36,0.15); color: #fbbf24; }
.status-tag.in_progress { background: rgba(59,130,246,0.15); color: #3b82f6; }
.status-tag.completed { background: rgba(16,185,129,0.15); color: #10b981; }
.status-tag.settled { background: rgba(16,185,129,0.25); color: #10b981; }
.status-tag.cancelled { background: rgba(244,63,94,0.15); color: #f43f5e; }

.card-info {
  margin-bottom: 12rpx;
}
.info-line {
  display: flex;
  font-size: 24rpx;
  margin-bottom: 6rpx;
}
.info-label { color: #8e8e93; width: 90rpx; }
.info-value { color: #e0e0e6; }

.card-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1rpx solid #2c2c2e;
  padding-top: 12rpx;
}
.create-time { font-size: 22rpx; color: #8e8e93; }
.amount { font-size: 28rpx; font-weight: bold; color: #f43f5e; }

.simple-actions {
  margin-top: 16rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid #2c2c2e;
}
.btn-quick-complete {
  width: 100%;
  height: 72rpx;
  line-height: 72rpx;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: #fff;
  font-size: 28rpx;
  font-weight: bold;
  border-radius: 36rpx;
  border: none;
  text-align: center;
}

.loading-more {
  text-align: center;
  padding: 20rpx;
}
.loading-text { color: #8e8e93; font-size: 24rpx; }

.empty {
  text-align: center;
  padding: 120rpx 0;
}
.empty-icon { font-size: 80rpx; display: block; margin-bottom: 16rpx; }
.empty-text { font-size: 28rpx; color: #8e8e93; }

.font-bold { font-weight: bold; }
.text-primary { color: #3b82f6; }
</style>
