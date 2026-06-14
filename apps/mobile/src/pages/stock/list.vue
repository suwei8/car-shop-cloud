<template>
  <view class="page">
    <!-- 顶部搜索与筛选 -->
    <view class="search-header">
      <input class="search-input" v-model="keyword" type="text" placeholder="搜索配件名称 / 编码 / 品牌" confirm-type="search" @confirm="handleSearch" @input="onKeywordInput" />
      <button class="search-btn font-bold" @tap="handleSearch">搜索</button>
    </view>

    <!-- 分段控制器：过滤“全部”与“库存预警” -->
    <view class="segmented-control">
      <view :class="['segment-item', filterType === 'all' ? 'active' : '']" @tap="setFilterType('all')">全部配件</view>
      <view :class="['segment-item', filterType === 'warning' ? 'active' : '']" @tap="setFilterType('warning')">
        ⚠️ 库存不足 
        <text class="badge-count" v-if="warningCount > 0">{{ warningCount }}</text>
      </view>
    </view>

    <!-- 配件列表 -->
    <scroll-view class="stock-scroll-list" scroll-y="true" @scrolltolower="onScrollToLower">
      <view class="part-card premium-card" v-for="item in filteredParts" :key="item.id">
        <view class="part-header">
          <view class="part-title-box">
            <text class="part-name font-bold">{{ item.name }}</text>
            <text class="part-code">{{ item.code }}</text>
          </view>
          <view :class="['stock-badge', isLowStock(item) ? 'low-stock-bg' : 'normal-stock-bg']">
            {{ isLowStock(item) ? '🚨 库存偏低' : '正常' }}
          </view>
        </view>

        <view class="part-body">
          <view class="info-grid">
            <view class="info-cell">
              <text class="cell-label">当前库存</text>
              <text :class="['cell-value font-bold', isLowStock(item) ? 'text-warning' : 'text-success']">
                {{ getPartStock(item) }} {{ item.unit || '个' }}
              </text>
            </view>
            <view class="info-cell">
              <text class="cell-label">安全库存下限</text>
              <text class="cell-value">{{ item.minStock || 0 }} {{ item.unit || '个' }}</text>
            </view>
            <view class="info-cell">
              <text class="cell-label">品牌/规格</text>
              <text class="cell-value">{{ item.brand || '无' }}</text>
            </view>
            <view class="info-cell">
              <text class="cell-label">质保期限</text>
              <text class="cell-value text-primary font-bold">{{ item.warrantyMonths ? item.warrantyMonths + ' 个月' : '无质保' }}</text>
            </view>
          </view>

          <!-- 供应商信息 -->
          <view class="supplier-bar" v-if="item.supplier">
            <view class="sup-info">
              <text class="sup-label">供应商：</text>
              <text class="sup-name font-bold">{{ item.supplier.name }}</text>
            </view>
            <view class="sup-contact" v-if="item.supplier.phone" @tap="callSupplier(item.supplier.phone)">
              <text class="phone-icon">📞</text>
              <text class="phone-number">{{ item.supplier.phone }}</text>
            </view>
          </view>
          <view class="supplier-bar" v-else>
            <text class="sup-label">供应商：</text>
            <text class="sup-name text-gray">未指定供应商</text>
          </view>
        </view>
      </view>

      <!-- 暂无数据 -->
      <view class="empty-state" v-if="filteredParts.length === 0">
        <text class="empty-icon">📦</text>
        <text class="empty-text">未找到相关配件库存档案</text>
      </view>

      <!-- 底线 -->
      <view class="loading-more" v-if="filteredParts.length > 0">
        <text class="loading-more-txt">{{ hasMore ? '加载中...' : '— 已经到底啦 —' }}</text>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { request } from '../../utils/request';

const keyword = ref('');
const filterType = ref<'all' | 'warning'>('all');
const parts = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const hasMore = ref(true);
const loading = ref(false);

async function fetchParts(reset = false) {
  if (loading.value) return;
  if (reset) {
    page.value = 1;
    parts.value = [];
    hasMore.value = true;
  }
  if (!hasMore.value) return;

  loading.value = true;
  uni.showLoading({ title: '载入库存中...' });
  try {
    const token = uni.getStorageSync('accessToken');
    const res: any = await request({
      url: `/api/parts?page=${page.value}&pageSize=${pageSize.value}&keyword=${encodeURIComponent(keyword.value.trim())}`,
      method: 'GET',
      header: { Authorization: `Bearer ${token}` }
    });

    if (res.data?.code === 0 && res.data.data) {
      const newItems = res.data.data.items || [];
      parts.value = [...parts.value, ...newItems];
      total.value = res.data.data.total || 0;
      hasMore.value = parts.value.length < total.value;
      if (newItems.length > 0) page.value += 1;
    }
  } catch (e) {
    uni.showToast({ title: '获取库存失败', icon: 'none' });
  } finally {
    uni.hideLoading();
    loading.value = false;
  }
}

function getPartStock(part: any): number {
  if (!part.stockBalances || part.stockBalances.length === 0) return 0;
  return part.stockBalances.reduce((sum: number, bal: any) => sum + Number(bal.quantity), 0);
}

function isLowStock(part: any): boolean {
  const stock = getPartStock(part);
  return stock <= (part.minStock || 0);
}

const filteredParts = computed(() => {
  if (filterType.value === 'all') return parts.value;
  return parts.value.filter(p => isLowStock(p));
});

const warningCount = computed(() => {
  return parts.value.filter(p => isLowStock(p)).length;
});

function setFilterType(type: 'all' | 'warning') {
  filterType.value = type;
}

function handleSearch() {
  fetchParts(true);
}

function onKeywordInput() {
  if (!keyword.value.trim()) {
    fetchParts(true);
  }
}

function onScrollToLower() {
  if (hasMore.value) fetchParts();
}

function callSupplier(phone: string) {
  if (phone) {
    uni.makePhoneCall({ phoneNumber: phone });
  }
}

onMounted(() => {
  fetchParts(true);
});
</script>

<style scoped>
.page { 
  padding: 20rpx; 
  background: #121214; 
  min-height: 100vh; 
  color: #e0e0e6;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  display: flex;
  flex-direction: column;
}

.premium-card {
  background: #1c1c1e;
  border-radius: 20rpx;
  padding: 26rpx;
  margin-bottom: 24rpx;
  border: 1rpx solid #2c2c2e;
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.15);
}

/* 顶部搜索条 */
.search-header { 
  display: flex; 
  gap: 16rpx; 
  margin-bottom: 24rpx; 
}
.search-input { 
  flex: 1; 
  height: 84rpx; 
  background: #1c1c1e; 
  border-radius: 42rpx; 
  padding: 0 40rpx; 
  font-size: 28rpx; 
  color: #ffffff;
  border: 1rpx solid #2c2c2e;
}
.search-btn { 
  width: 150rpx; 
  height: 84rpx; 
  line-height: 84rpx; 
  text-align: center; 
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); 
  color: #ffffff; 
  border-radius: 42rpx; 
  font-size: 28rpx; 
  border: none; 
  margin: 0; 
  box-shadow: 0 4rpx 12rpx rgba(59, 130, 246, 0.3);
}

/* 分段控制器 */
.segmented-control { 
  display: flex; 
  background: #1c1c1e; 
  border-radius: 40rpx; 
  padding: 6rpx; 
  margin-bottom: 24rpx; 
  border: 1rpx solid #2c2c2e; 
}
.segment-item { 
  flex: 1; 
  text-align: center; 
  font-size: 26rpx; 
  color: #a1a1a9; 
  padding: 14rpx 0; 
  border-radius: 34rpx; 
  font-weight: bold; 
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
}
.segment-item.active { 
  background: #2c2c2e; 
  color: #ffffff; 
  box-shadow: inset 0 2rpx 4rpx rgba(255,255,255,0.05);
}
.badge-count {
  font-size: 20rpx;
  background: #f43f5e;
  color: #ffffff;
  border-radius: 50%;
  padding: 2rpx 10rpx;
  font-weight: 800;
}

/* 滚动区域 */
.stock-scroll-list {
  flex: 1;
  height: 1px; /* 解决 uni-app flex 容器下 scroll-view 高度撑开问题 */
}

/* 配件卡片 */
.part-card {
  display: flex;
  flex-direction: column;
}
.part-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 1rpx solid #2c2c2e;
  padding-bottom: 16rpx;
  margin-bottom: 16rpx;
}
.part-title-box {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  flex: 1;
  margin-right: 20rpx;
}
.part-name {
  font-size: 30rpx;
  color: #ffffff;
}
.part-code {
  font-size: 22rpx;
  color: #8e8e93;
}
.stock-badge {
  font-size: 20rpx;
  padding: 4rpx 12rpx;
  border-radius: 6rpx;
  font-weight: bold;
}
.low-stock-bg {
  background: rgba(251, 191, 36, 0.15);
  color: #fbbf24;
}
.normal-stock-bg {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
}

/* 配件属性格 */
.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20rpx 40rpx;
  margin-bottom: 20rpx;
}
.info-cell {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}
.cell-label {
  font-size: 22rpx;
  color: #8e8e93;
}
.cell-value {
  font-size: 26rpx;
  color: #ffffff;
}

/* 供应商条 */
.supplier-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #141416;
  padding: 16rpx 20rpx;
  border-radius: 12rpx;
  font-size: 24rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.03);
}
.sup-info {
  display: flex;
  align-items: center;
}
.sup-label {
  color: #8e8e93;
}
.sup-name {
  color: #ffffff;
}
.sup-contact {
  display: flex;
  align-items: center;
  gap: 8rpx;
  color: #3b82f6;
  text-decoration: underline;
}

/* 暂无结果 */
.empty-state { 
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 150rpx 0; 
}
.empty-icon {
  font-size: 80rpx;
  margin-bottom: 20rpx;
}
.empty-text {
  font-size: 28rpx;
  color: #8e8e93;
}

.loading-more {
  text-align: center;
  padding: 20rpx 0 60rpx 0;
}
.loading-more-txt {
  font-size: 22rpx;
  color: #8e8e93;
}

.text-success { color: #10b981; }
.text-warning { color: #fbbf24; }
.text-primary { color: #3b82f6; }
.text-gray { color: #8e8e93; }
.font-bold { font-weight: bold; }
</style>
