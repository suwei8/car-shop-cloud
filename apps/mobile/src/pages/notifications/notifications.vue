<template>
  <view class="page">
    <view class="header-section">
      <text class="title">消息通知</text>
      <text class="mark-all-read" @tap="markAllRead">全部已读</text>
    </view>

    <scroll-view class="list-section" scroll-y>
      <view v-if="notifications.length === 0" class="empty-state">
        <text class="empty-icon">📭</text>
        <text class="empty-text">暂无新消息通知</text>
      </view>

      <view 
        v-for="item in notifications" 
        :key="item.id" 
        class="notification-card premium-card"
        :class="{ 'unread': !item.read }"
        @tap="toggleRead(item)"
      >
        <view class="card-header">
          <view class="tag-and-title">
            <text class="type-tag" :class="item.type">{{ getTypeLabel(item.type) }}</text>
            <text class="card-title">{{ item.title }}</text>
          </view>
          <text class="card-time">{{ item.time }}</text>
        </view>
        <view class="card-body">
          <text class="card-content">{{ item.content }}</text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface NotificationItem {
  id: string;
  type: 'system' | 'task' | 'appointment';
  title: string;
  content: string;
  time: string;
  read: boolean;
}

const notifications = ref<NotificationItem[]>([
  {
    id: '1',
    type: 'task',
    title: '新派工通知',
    content: '您的派工任务：车牌号粤B88888 车辆（奔驰 C200）已派工，服务顾问：张三，请尽快开始施工。',
    time: '今天 10:30',
    read: false,
  },
  {
    id: '2',
    type: 'appointment',
    title: '客户预约提示',
    content: '客户李先生预约了今日 15:30 的汽车大保养服务，车型：奥迪 A6L。请提前准备好配件。',
    time: '今天 09:15',
    read: false,
  },
  {
    id: '3',
    type: 'system',
    title: '系统升级提示',
    content: '车店云管家已成功升级至 v0.1.0。已为您开启多商户 SaaS 数据隔离与租户状态校验服务，系统更加安全稳定。',
    time: '昨天 18:00',
    read: true,
  },
]);

function getTypeLabel(type: string) {
  switch (type) {
    case 'system': return '系统';
    case 'task': return '派工';
    case 'appointment': return '预约';
    default: return '消息';
  }
}

function markAllRead() {
  notifications.value.forEach(item => item.read = true);
  uni.showToast({ title: '已全部标记为已读', icon: 'success' });
}

function toggleRead(item: NotificationItem) {
  item.read = true;
  uni.showToast({ title: '消息已读', icon: 'none' });
}
</script>

<style scoped>
.page {
  padding: 30rpx;
  background: #121214;
  min-height: 100vh;
  color: #e0e0e6;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

.header-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30rpx;
}

.title {
  font-size: 40rpx;
  font-weight: bold;
  color: #ffffff;
}

.mark-all-read {
  font-size: 26rpx;
  color: #3b82f6;
  font-weight: 500;
}

.list-section {
  height: calc(100vh - 120rpx);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-top: 200rpx;
}

.empty-icon {
  font-size: 100rpx;
  margin-bottom: 20rpx;
}

.empty-text {
  font-size: 28rpx;
  color: #8e8e93;
}

.premium-card {
  background: #1c1c1e;
  border-radius: 20rpx;
  padding: 30rpx;
  margin-bottom: 24rpx;
  border: 1rpx solid #2c2c2e;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.15);
}

.notification-card {
  position: relative;
  transition: all 0.3s;
}

.notification-card.unread {
  border-left: 6rpx solid #3b82f6;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}

.tag-and-title {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.type-tag {
  font-size: 20rpx;
  padding: 4rpx 12rpx;
  border-radius: 6rpx;
  font-weight: bold;
}

.type-tag.system {
  background: rgba(168, 85, 247, 0.15);
  color: #a855f7;
}

.type-tag.task {
  background: rgba(234, 179, 8, 0.15);
  color: #eab308;
}

.type-tag.appointment {
  background: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
}

.card-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #ffffff;
}

.card-time {
  font-size: 24rpx;
  color: #8e8e93;
}

.card-body {
  line-height: 1.6;
}

.card-content {
  font-size: 26rpx;
  color: #a1a1a9;
}
</style>
