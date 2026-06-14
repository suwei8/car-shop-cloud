<template>
  <view class="page">
    <!-- 顶部店面信息与问候 -->
    <view class="header-section">
      <view class="shop-brand">
        <text class="brand-logo">🏪</text>
        <view class="shop-name-box">
          <text class="shop-name font-bold">{{ shopName }}</text>
          <text class="role-badge">{{ simpleMode ? '极简模式' : '专业模式' }}</text>
        </view>
      </view>
      <view class="user-greeting">
        <text class="greeting-txt">您好，<text class="user-highlight font-bold">{{ userName }}</text></text>
      </view>
    </view>

    <!-- 💡 核心三步极速新手引导 (无单时显示) -->
    <view class="section premium-card onboarding-banner pulse-glow" v-if="stats.todayOrders === 0 && stats.totalDebt === 0">
      <view class="onboarding-header">
        <text class="onboarding-title font-bold">🚀 新手极速开单指南</text>
        <text class="onboarding-subtitle">只需 3 步即可轻松开始记账</text>
      </view>
      <view class="onboarding-steps">
        <view class="step-item" @tap="quickNavigate('/pages/workorder/create')">
          <view class="step-num">1</view>
          <view class="step-body">
            <text class="step-txt font-bold">点击「接待开单」</text>
            <text class="step-desc">输入车牌登记老客户或新建车辆</text>
          </view>
        </view>
        <view class="step-item">
          <view class="step-num">2</view>
          <view class="step-body">
            <text class="step-txt font-bold">选择项目/配件施工</text>
            <text class="step-desc">绑定服务并从配件库挑选扣减库存</text>
          </view>
        </view>
        <view class="step-item">
          <view class="step-num">3</view>
          <view class="step-body">
            <text class="step-txt font-bold">一键完工与收款</text>
            <text class="step-desc">标记完工并记录实收本金、欠款等</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 📊 老板看账：核心经营看板 -->
    <view class="section metrics-section">
      <view class="main-revenue-card premium-card">
        <view class="metric-label-row">
          <text class="metric-desc">今日营业额 (元)</text>
          <text class="metric-icon">💰</text>
        </view>
        <view class="metric-value-row">
          <text class="revenue-val font-bold">¥{{ Number(stats.todayRevenue || 0).toFixed(2) }}</text>
        </view>
        <view class="sub-stats-row">
          <view class="sub-stat">
            <text class="sub-label">今日工单数</text>
            <text class="sub-val font-bold">{{ stats.todayOrders }} 笔</text>
          </view>
          <view class="sub-stat vertical-divider"></view>
          <view class="sub-stat">
            <text class="sub-label">施工中工单</text>
            <text class="sub-val font-bold">{{ stats.inProgressOrders }} 笔</text>
          </view>
        </view>
      </view>

      <view class="secondary-metrics-grid">
        <!-- 欠款看板 -->
        <view class="metric-card premium-card" @tap="switchTab('/pages/search/search')">
          <view class="card-title-row">
            <text class="card-icon text-danger">⚠️</text>
            <text class="card-label">客户欠款总额</text>
          </view>
          <view class="card-val text-danger font-bold">
            ¥{{ Number(stats.totalDebt || 0).toFixed(2) }}
          </view>
          <view class="card-desc" v-if="stats.debtCount > 0">
            共 {{ stats.debtCount }} 笔挂账未结清
          </view>
          <view class="card-desc text-gray" v-else>
            暂无挂账欠款
          </view>
        </view>

        <!-- 库存看板 -->
        <view class="metric-card premium-card" @tap="quickNavigate('/pages/stock/list')">
          <view class="card-title-row">
            <text class="card-icon text-warning">📦</text>
            <text class="card-label">低库存预警</text>
          </view>
          <view :class="['card-val', stats.lowStockCount > 0 ? 'text-warning' : '']">
            {{ stats.lowStockCount }} <text class="unit-text">件</text>
          </view>
          <view class="card-desc text-warning" v-if="stats.lowStockCount > 0">
            需要及时补充配件库存
          </view>
          <view class="card-desc text-gray" v-else>
            库存充足
          </view>
        </view>
      </view>

      <!-- 待办提醒看板 -->
      <view class="premium-card reminder-bar" v-if="stats.pendingReminders > 0">
        <text class="reminder-text">📢 您今日有 <text class="text-danger font-bold">{{ stats.pendingReminders }}</text> 项到期保养/流失客户关怀待办提醒</text>
        <text class="action-btn-text font-bold" @tap="switchTab('/pages/search/search')">去查看</text>
      </view>
    </view>

    <!-- ⚡ 快捷接车开单入口 -->
    <view class="section premium-card actions-section">
      <view class="section-title">
        <text class="prefix">⚡</text>
        <text>工作台极速开单</text>
      </view>
      <view class="action-grid">
        <view class="action-item" @tap="quickNavigate('/pages/workorder/create?type=repair')">
          <text class="act-icon bg-blue">🔧</text>
          <text class="act-label">开维修单</text>
        </view>
        <view class="action-item" @tap="quickNavigate('/pages/workorder/create?type=wash')">
          <text class="act-icon bg-green">🚿</text>
          <text class="act-label">开洗车单</text>
        </view>
        <view class="action-item" @tap="switchTab('/pages/search/search')">
          <text class="act-icon bg-yellow">🔍</text>
          <text class="act-label">检索客户</text>
        </view>
        <view class="action-item" @tap="quickNavigate('/pages/stock/list')">
          <text class="act-icon bg-purple">📦</text>
          <text class="act-label">配件库存</text>
        </view>
      </view>
    </view>

    <!-- 📝 最近接车工单流水 -->
    <view class="section premium-card recent-orders-section">
      <view class="section-title-between">
        <view class="sec-title-left">
          <text class="prefix">📝</text>
          <text>最近接车工单 ({{ recentOrders.length }})</text>
        </view>
        <text class="more-link" @tap="switchTab('/pages/workorder/list')">全部工单 ></text>
      </view>

      <view class="orders-list">
        <view class="order-row-item" v-for="order in recentOrders" :key="order.id" @tap="goOrderDetail(order.id)">
          <view class="order-top">
            <text class="order-plate font-bold">{{ order.vehiclePlateNo }}</text>
            <text :class="['order-status-badge', order.status]">{{ orderStatusLabel(order.status) }}</text>
          </view>
          <view class="order-mid">
            <text class="order-customer">{{ order.customer?.name || '新车主' }} ({{ order.customer?.phone || '无手机号' }})</text>
            <text class="order-cost font-bold">¥{{ Number(order.totalAmount).toFixed(2) }}</text>
          </view>
          <view class="order-bottom">
            <text class="order-date">{{ new Date(order.createdAt).toLocaleString() }}</text>
            <text class="order-detail-btn font-bold">详情 ></text>
          </view>
        </view>
        <view class="empty-orders-state" v-if="recentOrders.length === 0">
          <text class="empty-orders-icon">🚗</text>
          <text class="empty-orders-text">今日暂无进店工单</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { request } from '../../utils/request';
import { useAuthStore } from '../../stores/auth';

const auth = useAuthStore();
const userName = ref('老板');
const shopName = ref('加载中...');
const simpleMode = ref(false);

const stats = ref({
  todayOrders: 0,
  todayRevenue: 0,
  inProgressOrders: 0,
  totalDebt: 0,
  debtCount: 0,
  lowStockCount: 0,
  pendingReminders: 0
});

const recentOrders = ref<any[]>([]);

const statusMap: Record<string, string> = {
  draft: '草稿', confirmed: '已确认', dispatching: '待派工', in_progress: '施工中', completed: '待结算', settled: '已结算', cancelled: '已作废',
};
function orderStatusLabel(s: string) { return statusMap[s] || s; }

async function fetchDashboardData() {
  const token = uni.getStorageSync('accessToken');
  if (!token) return;

  try {
    // 1. 获取概览数据 (含 304 中新加入的客户欠款总额和笔数)
    const statsRes: any = await request({
      url: '/api/dashboard/overview',
      method: 'GET',
      header: { Authorization: `Bearer ${token}` }
    });
    if (statsRes.data?.code === 0 && statsRes.data.data) {
      stats.value = statsRes.data.data;
    }

    // 2. 获取最近工单
    const ordersRes: any = await request({
      url: '/api/dashboard/recent-orders?limit=5',
      method: 'GET',
      header: { Authorization: `Bearer ${token}` }
    });
    if (ordersRes.data?.code === 0 && Array.isArray(ordersRes.data.data)) {
      recentOrders.value = ordersRes.data.data;
    }
  } catch (err) {
    console.error('获取工作台数据失败', err);
  }
}

function quickNavigate(path: string) {
  uni.navigateTo({ url: path });
}

function switchTab(path: string) {
  uni.switchTab({ url: path });
}

function goOrderDetail(id: string) {
  uni.navigateTo({ url: `/pages/workorder/detail?id=${id}` });
}

onShow(async () => {
  await fetchDashboardData();
});

onMounted(async () => {
  // 从本地缓存提取用户信息和店铺信息
  const info = uni.getStorageSync('userInfo');
  if (info) {
    const user = typeof info === 'string' ? JSON.parse(info) : info;
    userName.value = user.name || '老板';
    
    if (user.shopId) {
      const token = uni.getStorageSync('accessToken');
      request({
        url: `/api/shops/${user.shopId}`,
        method: 'GET',
        header: { Authorization: `Bearer ${token}` }
      }).then((res: any) => {
        if (res.data?.code === 0 && res.data.data) {
          shopName.value = res.data.data.name;
        }
      }).catch(() => {
        shopName.value = '汽修门店';
      });
    } else {
      shopName.value = '汽修门店';
    }
  } else {
    shopName.value = '未分配门店';
  }

  // 获取 Feature Flags
  await auth.fetchFeatureFlags();
  simpleMode.value = auth.simpleMode;
});
</script>

<style scoped>
.page { 
  padding: 20rpx 20rpx 120rpx 20rpx; 
  background: #121214; 
  min-height: 100vh; 
  color: #e0e0e6;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

.premium-card {
  background: #1c1c1e;
  border-radius: 20rpx;
  padding: 30rpx;
  margin-bottom: 24rpx;
  border: 1rpx solid #2c2c2e;
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.15);
}

.header-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 10rpx 10rpx 30rpx 10rpx;
}
.shop-brand {
  display: flex;
  align-items: center;
  gap: 16rpx;
}
.brand-logo {
  font-size: 44rpx;
}
.shop-name-box {
  display: flex;
  flex-direction: column;
}
.shop-name {
  font-size: 32rpx;
  color: #ffffff;
}
.role-badge {
  font-size: 20rpx;
  color: #3b82f6;
  background: rgba(59, 130, 246, 0.15);
  padding: 2rpx 12rpx;
  border-radius: 6rpx;
  margin-top: 4rpx;
  align-self: flex-start;
  font-weight: bold;
}
.greeting-txt {
  font-size: 26rpx;
  color: #a1a1a9;
}
.user-highlight {
  color: #ffffff;
  font-size: 28rpx;
}

/* Onboarding 新手引导卡片 */
.onboarding-banner {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(29, 78, 216, 0.05) 100%);
  border-color: rgba(59, 130, 246, 0.4);
}
.onboarding-header {
  margin-bottom: 24rpx;
}
.onboarding-title {
  font-size: 30rpx;
  color: #fbbf24;
  display: block;
}
.onboarding-subtitle {
  font-size: 22rpx;
  color: #a1a1a9;
  margin-top: 4rpx;
  display: block;
}
.onboarding-steps {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}
.step-item {
  display: flex;
  gap: 20rpx;
  align-items: flex-start;
  padding: 16rpx;
  background: rgba(255,255,255,0.03);
  border-radius: 12rpx;
}
.step-num {
  width: 36rpx;
  height: 36rpx;
  line-height: 36rpx;
  text-align: center;
  border-radius: 50%;
  background: #3b82f6;
  color: #ffffff;
  font-size: 22rpx;
  font-weight: bold;
}
.step-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}
.step-txt {
  font-size: 24rpx;
  color: #ffffff;
}
.step-desc {
  font-size: 20rpx;
  color: #8e8e93;
}

/* 核心经营面板 */
.main-revenue-card {
  background: linear-gradient(135deg, #1e1b4b 0%, #1e293b 100%);
  border-color: #312e81;
}
.metric-label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.metric-desc {
  font-size: 26rpx;
  color: #a1a1a9;
}
.metric-icon {
  font-size: 40rpx;
}
.metric-value-row {
  margin: 20rpx 0;
}
.revenue-val {
  font-size: 54rpx;
  color: #10b981;
  letter-spacing: 1rpx;
}
.sub-stats-row {
  display: flex;
  align-items: center;
  margin-top: 10rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid rgba(255, 255, 255, 0.08);
}
.sub-stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}
.sub-label {
  font-size: 22rpx;
  color: #8e8e93;
}
.sub-val {
  font-size: 28rpx;
  color: #ffffff;
}
.vertical-divider {
  width: 1rpx;
  height: 40rpx;
  background: rgba(255, 255, 255, 0.08);
  flex: none;
}

.secondary-metrics-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20rpx;
  margin-bottom: 24rpx;
}
.secondary-metrics-grid .metric-card {
  margin-bottom: 0;
}
.card-title-row {
  display: flex;
  align-items: center;
  gap: 10rpx;
  margin-bottom: 12rpx;
}
.card-icon {
  font-size: 28rpx;
}
.card-label {
  font-size: 24rpx;
  color: #a1a1a9;
}
.card-val {
  font-size: 32rpx;
  color: #ffffff;
  font-weight: 800;
  margin-bottom: 10rpx;
}
.unit-text {
  font-size: 20rpx;
  font-weight: normal;
  margin-left: 4rpx;
  color: #8e8e93;
}
.card-desc {
  font-size: 20rpx;
}

.reminder-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #1c1917;
  border-color: #451a03;
  padding: 20rpx 30rpx;
}
.reminder-text {
  font-size: 24rpx;
  color: #fbbf24;
  flex: 1;
  margin-right: 16rpx;
}

/* 快捷接车开单 */
.actions-section {
  padding-bottom: 16rpx;
}
.section-title {
  font-size: 28rpx;
  font-weight: bold;
  color: #ffffff;
  margin-bottom: 24rpx;
  display: flex;
  align-items: center;
  gap: 10rpx;
}
.prefix {
  font-size: 32rpx;
}
.action-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10rpx;
}
.action-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
}
.act-icon {
  width: 80rpx;
  height: 80rpx;
  line-height: 80rpx;
  text-align: center;
  border-radius: 50%;
  font-size: 36rpx;
}
.bg-blue { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
.bg-green { background: rgba(16, 185, 129, 0.15); color: #10b981; }
.bg-yellow { background: rgba(251, 191, 36, 0.15); color: #fbbf24; }
.bg-purple { background: rgba(139, 92, 246, 0.15); color: #8b5cf6; }
.act-label {
  font-size: 22rpx;
  color: #e0e0e6;
}

/* 最近接车工单 */
.section-title-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
}
.sec-title-left {
  font-size: 28rpx;
  font-weight: bold;
  color: #ffffff;
  display: flex;
  align-items: center;
  gap: 10rpx;
}
.more-link {
  font-size: 22rpx;
  color: #8e8e93;
}
.orders-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}
.order-row-item {
  background: rgba(255,255,255,0.02);
  border-radius: 12rpx;
  padding: 20rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.04);
}
.order-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8rpx;
}
.order-plate {
  font-size: 28rpx;
  color: #3b82f6;
}
.order-status-badge {
  font-size: 18rpx;
  padding: 2rpx 10rpx;
  border-radius: 4rpx;
  font-weight: bold;
}
.order-status-badge.draft { background: rgba(142, 142, 147, 0.15); color: #8e8e93; }
.order-status-badge.confirmed { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
.order-status-badge.dispatching { background: rgba(139, 92, 246, 0.15); color: #8b5cf6; }
.order-status-badge.in_progress { background: rgba(251, 191, 36, 0.15); color: #fbbf24; }
.order-status-badge.completed { background: rgba(16, 185, 129, 0.15); color: #10b981; }
.order-status-badge.settled { background: rgba(139, 92, 246, 0.15); color: #8b5cf6; }
.order-status-badge.cancelled { background: rgba(239, 68, 68, 0.15); color: #ef4444; }

.order-mid {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8rpx;
}
.order-customer {
  font-size: 24rpx;
  color: #e0e0e6;
}
.order-cost {
  font-size: 26rpx;
  color: #f43f5e;
}
.order-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.order-date {
  font-size: 18rpx;
  color: #8e8e93;
}
.order-detail-btn {
  font-size: 20rpx;
  color: #3b82f6;
}

.empty-orders-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60rpx 0;
}
.empty-orders-icon {
  font-size: 60rpx;
  margin-bottom: 12rpx;
}
.empty-orders-text {
  font-size: 24rpx;
  color: #8e8e93;
}

.action-btn-text {
  color: #3b82f6;
  font-size: 24rpx;
}
.text-danger { color: #f43f5e; }
.text-warning { color: #fbbf24; }
.text-gray { color: #8e8e93; }

.pulse-glow {
  animation: pulse 2.5s infinite;
}
@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.3); }
  70% { box-shadow: 0 0 0 10rpx rgba(59, 130, 246, 0); }
  100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
}
</style>
