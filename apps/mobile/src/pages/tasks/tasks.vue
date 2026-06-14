<template>
  <view class="page">
    <view class="header">
      <text class="title">我的派工</text>
    </view>

    <view class="tabs">
      <view :class="['tab', status === '' ? 'active' : '']" @tap="status = ''">全部</view>
      <view :class="['tab', status === 'pending' ? 'active' : '']" @tap="status = 'pending'">待处理</view>
      <view :class="['tab', status === 'in_progress' ? 'active' : '']" @tap="status = 'in_progress'">进行中</view>
      <view :class="['tab', status === 'completed' ? 'active' : '']" @tap="status = 'completed'">已完成</view>
    </view>

    <scroll-view
      class="list"
      scroll-y
      refresher-enabled
      :refresher-triggered="refreshing"
      @refresherrefresh="onRefresh"
      @scrolltolower="onLoadMore"
    >
      <view class="card" v-for="task in tasks" :key="task.id" @tap="goDetail(task)">
        <view class="card-header">
          <text class="order-no">{{ task.workOrder?.orderNo }}</text>
          <text :class="['status', task.status]">{{ statusLabel(task.status) }}</text>
        </view>
        <view class="card-body">
          <text class="plate">{{ task.workOrder?.vehiclePlateNo }}</text>
          <text class="type">{{ { repair: '维修', wash: '洗美', quick: '快单' }[task.workOrder?.orderType] }}</text>
        </view>
        <view class="task-allocation-info" v-if="task.workPlace || task.team">
          <text class="allocation-tag" v-if="task.workPlace">📍 {{ task.workPlace }}</text>
          <text class="allocation-tag" v-if="task.team">👥 {{ task.team }}</text>
        </view>
        <view class="card-footer">
          <text class="desc">{{ task.workOrder?.description || '无描述' }}</text>
        </view>
      </view>

      <view class="loading-more" v-if="loading">
        <text class="loading-text">加载中...</text>
      </view>
      <view class="empty" v-if="tasks.length === 0 && !loading">
        <text>暂无任务</text>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { request } from '../../utils/request';

const tasks = ref<any[]>([]);
const status = ref('');
const refreshing = ref(false);
const loading = ref(false);

const statusMap: Record<string, string> = {
  pending: '待处理', in_progress: '进行中', paused: '已暂停', completed: '已完成',
};
function statusLabel(s: string) { return statusMap[s] || s; }

async function fetchTasks(isRefresh = false) {
  if (loading.value && !isRefresh) return;
  loading.value = true;
  const token = uni.getStorageSync('accessToken');
  const params = status.value ? `?status=${status.value}` : '';
  const res: any = await request({
    url: `/api/dispatch/my-tasks${params}`,
    method: 'GET',
    header: { Authorization: `Bearer ${token}` },
  });
  if (res.data?.code === 0) {
    tasks.value = res.data.data;
  }
  loading.value = false;
  refreshing.value = false;
}

function onRefresh() {
  refreshing.value = true;
  fetchTasks(true);
}

function onLoadMore() {
  // Tasks API returns all at once currently, placeholder for future pagination
}

function goDetail(task: any) {
  uni.navigateTo({ url: `/pages/workorder/detail?id=${task.workOrderId}` });
}

watch(status, () => fetchTasks());
onMounted(() => {
  const pages = getCurrentPages();
  if (pages.length > 0) {
    const page = pages[pages.length - 1] as any;
    const opts = page.$page?.options || page.options || {};
    if (opts.status) {
      status.value = opts.status;
      return;
    }
  }
  fetchTasks();
});
</script>

<style scoped>
.page { padding: 20rpx; background: #f5f5f5; min-height: 100vh; }
.header { margin-bottom: 20rpx; }
.title { font-size: 36rpx; font-weight: bold; }
.tabs { display: flex; gap: 16rpx; margin-bottom: 20rpx; }
.tab { padding: 12rpx 24rpx; background: #fff; border-radius: 8rpx; font-size: 26rpx; }
.tab.active { background: #409eff; color: #fff; }
.card { background: #fff; border-radius: 12rpx; padding: 24rpx; margin-bottom: 16rpx; }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12rpx; }
.order-no { font-size: 28rpx; font-weight: bold; }
.status { font-size: 24rpx; padding: 4rpx 12rpx; border-radius: 4rpx; }
.status.pending { background: #e6a23c20; color: #e6a23c; }
.status.in_progress { background: #409eff20; color: #409eff; }
.status.completed { background: #67c23a20; color: #67c23a; }
.card-body { display: flex; gap: 20rpx; margin-bottom: 8rpx; }
.plate { font-size: 30rpx; font-weight: bold; }
.type { font-size: 24rpx; color: #999; }
.card-footer { font-size: 24rpx; color: #666; }
.empty { text-align: center; padding: 100rpx 0; color: #999; }
.loading-more { text-align: center; padding: 20rpx; }
.loading-text { color: #999; font-size: 24rpx; }

/* 派工工位与班组样式 */
.task-allocation-info { display: flex; gap: 16rpx; margin-bottom: 12rpx; flex-wrap: wrap; }
.allocation-tag { font-size: 22rpx; background: #f2f6fc; color: #409eff; padding: 4rpx 12rpx; border-radius: 6rpx; border: 1rpx solid #dcdfe6; }
</style>
