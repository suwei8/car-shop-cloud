<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app';
import { ref } from 'vue';
import { setupAuthGuard, checkLaunchAuth } from './utils/auth-guard';
import { useAuthStore } from './stores/auth';

setupAuthGuard();

const isOffline = ref(false);
let pollTimer: ReturnType<typeof setInterval> | null = null;
let lastUnreadCount = 0;

function startPolling() {
  stopPolling();
  pollTimer = setInterval(checkUnreadNotifications, 60000);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function checkUnreadNotifications() {
  const token = uni.getStorageSync('accessToken');
  if (!token) return;
  try {
    const res: any = await new Promise((resolve, reject) => {
      const baseUrl = (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production')
        ? 'https://car-api.555606.xyz'
        : 'http://localhost:3000';
      const url = `${baseUrl}/api/notifications/unread`;
      if (typeof window !== 'undefined' && typeof XMLHttpRequest !== 'undefined') {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.onload = () => {
          try { resolve({ data: JSON.parse(xhr.responseText) }); }
          catch { reject(new Error('parse')); }
        };
        xhr.onerror = () => reject(new Error('network'));
        xhr.send();
      } else {
        uni.request({
          url,
          method: 'GET',
          header: { Authorization: `Bearer ${token}` },
          success: (r: any) => resolve({ data: r.data }),
          fail: (e: any) => reject(new Error(e.errMsg)),
        });
      }
    });

    if (res.data?.code === 0 && Array.isArray(res.data.data)) {
      const unreadItems = res.data.data;
      const currentCount = unreadItems.length;

      const hasNewAssign = unreadItems.some((n: any) =>
        n.type === 'task' && !n.read &&
        (n.title?.includes('派工') || n.title?.includes('分配') || n.content?.includes('派工'))
      );

      if (hasNewAssign && currentCount > lastUnreadCount) {
        uni.showToast({
          title: `您有 ${currentCount - lastUnreadCount} 条新派工通知`,
          icon: 'none',
          duration: 3000,
        });
      }

      lastUnreadCount = currentCount;
    }
  } catch {
    // silent fail
  }
}

onLaunch(() => {
  checkLaunchAuth();
  const auth = useAuthStore();
  if (auth.isLoggedIn) {
    auth.fetchFeatureFlags();
    startPolling();
    checkUnreadNotifications();
  }

  uni.onNetworkStatusChange((res) => {
    isOffline.value = !res.isConnected;
  });
});

onShow(() => {
  const auth = useAuthStore();
  if (auth.isLoggedIn && !pollTimer) {
    startPolling();
  }
});

onHide(() => {
  stopPolling();
});
</script>

<template>
  <view v-if="isOffline" class="offline-bar">
    <text class="offline-text">⚠️ 网络已断开，请检查网络连接</text>
  </view>
</template>

<style>
page {
  background-color: #f5f5f5;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}
.offline-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 9999;
  background: #ef4444;
  padding: 16rpx 0;
  text-align: center;
}
.offline-text {
  color: #ffffff;
  font-size: 24rpx;
  font-weight: bold;
}
</style>
