<template>
  <view class="index-page">
    <view class="header">
      <text class="greeting">你好，{{ userName }}</text>
    </view>
    <view class="grid">
      <view class="grid-item" v-for="item in menuItems" :key="item.title" @tap="handleTap(item)">
        <text class="icon">{{ item.icon }}</text>
        <text class="label">{{ item.title }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const userName = ref('员工');

const menuItems = [
  { icon: '📋', title: '我的派工', path: '/pages/tasks/tasks' },
  { icon: '🔍', title: '查车', path: '/pages/search/search' },
  { icon: '📝', title: '接待开单', path: '/pages/workorder/create' },
  { icon: '📸', title: '施工拍照', path: '/pages/tasks/tasks?status=in_progress' },
  { icon: '✅', title: '完工确认', path: '/pages/tasks/tasks?status=in_progress' },
  { icon: '💳', title: '储值卡管理', path: '/pages/member/card' },
  { icon: '🔔', title: '消息通知', path: '/pages/notifications/notifications' },
  { icon: '👤', title: '个人中心', path: '/pages/profile/profile' },
];

function handleTap(item: any) {
  if (item.path) {
    uni.navigateTo({ url: item.path });
  } else {
    uni.showToast({ title: '即将开放', icon: 'none' });
  }
}

onMounted(() => {
  try {
    const info = uni.getStorageSync('userInfo');
    if (info) {
      const user = JSON.parse(info);
      userName.value = user.name || '员工';
    }
  } catch {}
});
</script>

<style scoped>
.index-page {
  padding: 30rpx;
}
.header {
  margin-bottom: 40rpx;
}
.greeting {
  font-size: 36rpx;
  font-weight: bold;
}
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20rpx;
}
.grid-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #fff;
  border-radius: 12rpx;
  padding: 30rpx 0;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.06);
}
.icon {
  font-size: 48rpx;
  margin-bottom: 10rpx;
}
.label {
  font-size: 26rpx;
  color: #333;
}
</style>
