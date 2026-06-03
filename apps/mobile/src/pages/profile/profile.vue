<template>
  <view class="page">
    <view class="header-section premium-card">
      <view class="avatar-box">
        <text class="avatar">{{ userAvatar }}</text>
      </view>
      <view class="user-info">
        <text class="name">{{ userInfo.name || '未登录' }}</text>
        <text class="phone">{{ userInfo.phone || '' }}</text>
      </view>
    </view>

    <view class="section premium-card">
      <view class="section-title">
        <text class="prefix">🏪</text>
        <text>店铺信息</text>
      </view>
      <view class="info-row">
        <text class="label">所属店铺</text>
        <text class="value">{{ shop?.name || '未分配' }}</text>
      </view>
      <view class="info-row" v-if="shop?.phone">
        <text class="label">联系电话</text>
        <text class="value text-primary" @tap="callShop">{{ shop.phone }}</text>
      </view>
      <view class="info-row" v-if="shop?.address">
        <text class="label">店铺地址</text>
        <text class="value">{{ shop.address }}</text>
      </view>
    </view>

    <view class="section premium-card">
      <view class="section-title">
        <text class="prefix">⚙️</text>
        <text>系统设置</text>
      </view>

      <view class="menu-item" @tap="goToPage('notifications')">
        <text class="menu-label">🔔 消息通知</text>
        <text class="menu-arrow">▶</text>
      </view>

      <view class="menu-item" @tap="goToPage('settings')">
        <text class="menu-label">🔧 系统参数</text>
        <text class="menu-arrow">▶</text>
      </view>

      <view class="menu-item" @tap="clearCache">
        <text class="menu-label">🗑️ 清除缓存</text>
        <text class="menu-arrow">▶</text>
      </view>

      <view class="menu-item" @tap="checkUpdate">
        <text class="menu-label">🔄 检查更新</text>
        <text class="menu-arrow">▶</text>
      </view>

      <view class="menu-item" @tap="showAbout">
        <text class="menu-label">ℹ️ 关于我们</text>
        <text class="menu-arrow">▶</text>
      </view>
    </view>

    <view class="btn-section">
      <button class="logout-btn font-bold pulse-glow" @tap="handleLogout">退出登录</button>
    </view>

    <view class="about-modal" v-if="showAboutModal" @tap.self="showAboutModal = false">
      <view class="modal-content premium-card">
        <view class="modal-header">
          <text class="modal-title">关于车店云管家</text>
          <text class="modal-close" @tap="showAboutModal = false">×</text>
        </view>
        <view class="modal-body">
          <text class="version">版本 0.1.0</text>
          <text class="copyright">© 2024 车店云管家</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const userInfo = ref<any>({});
const shop = ref<any>(null);
const showAboutModal = ref(false);

const userAvatar = computed(() => {
  const name = userInfo.value?.name || '';
  return name.length > 0 ? name.substring(0, 1) : '👤';
});

function callShop() {
  if (shop.value?.phone) {
    uni.makePhoneCall({ phoneNumber: shop.value.phone });
  }
}

function goToPage(page: string) {
  if (page === 'notifications') {
    uni.navigateTo({ url: '/pages/notifications/notifications' });
  } else if (page === 'settings') {
    uni.showToast({ title: '敬请期待', icon: 'none' });
  }
}

function clearCache() {
  uni.showModal({
    title: '提示',
    content: '确定清除本地缓存数据？',
    success: (res) => {
      if (res.confirm) {
        uni.clearStorageSync();
        uni.showToast({ title: '缓存已清除', icon: 'success' });
      }
    }
  });
}

function checkUpdate() {
  // #ifdef APP-PLUS
  const server = uni.getUpdateManager();
  if (server) {
    server.onCheckForUpdate((res) => {
      if (res.update) {
        uni.showModal({
          title: '更新提示',
          content: '发现新版本，是否下载更新？',
          success: (s) => {
            if (s.confirm) {
              server.onUpdateReady(() => {
                uni.showModal({
                  title: '安装提示',
                  content: '更新包下载完成，重启应用安装？',
                  success: (rs) => {
                    if (rs.confirm) {
                      server.applyUpdate();
                    }
                  }
                });
              });
            }
          }
        });
      } else {
        uni.showToast({ title: '当前为最新版本', icon: 'none' });
      }
    });
  }
  // #endif
  // #ifdef H5
  uni.showToast({ title: 'H5版本无自动更新', icon: 'none' });
  // #endif
}

function showAbout() {
  showAboutModal.value = true;
}

function handleLogout() {
  uni.showModal({
    title: '退出登录',
    content: '确定要退出当前账号吗？',
    success: (res) => {
      if (res.confirm) {
        uni.removeStorageSync('accessToken');
        uni.removeStorageSync('refreshToken');
        uni.removeStorageSync('userInfo');
        uni.reLaunch({ url: '/pages/login/login' });
      }
    }
  });
}

onMounted(() => {
  const info = uni.getStorageSync('userInfo');
  if (info) {
    userInfo.value = typeof info === 'string' ? JSON.parse(info) : info;
  }
});
</script>

<style scoped>
.page {
  padding: 20rpx;
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
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.15);
}

.header-section {
  display: flex;
  align-items: center;
  gap: 24rpx;
}

.avatar-box {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar {
  font-size: 48rpx;
  color: #fff;
  font-weight: bold;
}

.user-info {
  flex: 1;
}

.name {
  font-size: 36rpx;
  font-weight: bold;
  color: #ffffff;
  display: block;
  margin-bottom: 10rpx;
}

.phone {
  font-size: 26rpx;
  color: #a1a1a9;
}

.section-title {
  font-size: 30rpx;
  font-weight: bold;
  margin-bottom: 30rpx;
  color: #ffffff;
  display: flex;
  align-items: center;
}

.prefix {
  margin-right: 12rpx;
  font-size: 32rpx;
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #2c2c2e;
}

.info-row:last-child {
  border-bottom: none;
}

.label {
  font-size: 26rpx;
  color: #a1a1a9;
}

.value {
  font-size: 26rpx;
  color: #ffffff;
  font-weight: bold;
}

.text-primary {
  color: #3b82f6;
}

.menu-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 0;
  border-bottom: 1rpx solid #2c2c2e;
}

.menu-item:last-child {
  border-bottom: none;
}

.menu-label {
  font-size: 26rpx;
  color: #ffffff;
}

.menu-arrow {
  font-size: 24rpx;
  color: #8e8e93;
}

.btn-section {
  margin-top: 40rpx;
  padding: 0 30rpx;
}

.logout-btn {
  width: 100%;
  height: 84rpx;
  line-height: 84rpx;
  background: linear-gradient(135deg, #f43f5e 0%, #be185d 100%);
  color: #ffffff;
  font-size: 28rpx;
  border-radius: 42rpx;
  border: none;
}

.pulse-glow {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(244, 63, 94, 0.4); }
  70% { box-shadow: 0 0 0 10rpx rgba(244, 63, 94, 0); }
  100% { box-shadow: 0 0 0 0 rgba(244, 63, 94, 0); }
}

.about-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.modal-content {
  width: 600rpx;
  border-radius: 24rpx;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 24rpx;
  border-bottom: 1rpx solid #2c2c2e;
}

.modal-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #ffffff;
}

.modal-close {
  font-size: 40rpx;
  color: #a1a1a9;
  line-height: 1;
  padding: 0 10rpx;
}

.modal-body {
  padding: 40rpx 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20rpx;
}

.version {
  font-size: 28rpx;
  color: #8e8e93;
}

.copyright {
  font-size: 24rpx;
  color: #767680;
}
</style>