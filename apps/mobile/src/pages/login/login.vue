<template>
  <view class="login-page">
    <view class="login-header">
      <text class="title">车店管家</text>
      <text class="subtitle">商户登录</text>
    </view>

    <!-- 微信登录按钮 -->
    <button class="wechat-btn" :loading="wechatLoading" @tap="handleWechatLogin">
      微信快捷登录
    </button>

    <view class="divider">
      <text class="divider-line"></text>
      <text class="divider-text">或</text>
      <text class="divider-line"></text>
    </view>

    <!-- 密码登录表单 -->
    <view class="login-form">
      <input v-model="phone" type="number" placeholder="手机号" maxlength="11" />
      <input v-model="password" type="password" placeholder="密码" />
      <button type="primary" :loading="loading" @tap="handleLogin">登录</button>
    </view>

    <view class="register-link">
      <text @tap="goToOnboarding">还没有账号？免费注册</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAuthStore } from '../../stores/auth';
import { wxLogin } from '../../utils/wechat';

const auth = useAuthStore();
const phone = ref('');
const password = ref('');
const loading = ref(false);
const wechatLoading = ref(false);

onMounted(() => {
  if (auth.isLoggedIn) {
    uni.reLaunch({ url: '/pages/index/index' });
  }
});

async function handleWechatLogin() {
  wechatLoading.value = true;
  try {
    const code = await wxLogin();
    const result = await auth.wechatLogin(code);

    if (result.needBind) {
      uni.reLaunch({
        url: `/pages/onboarding/index?openid=${encodeURIComponent(result.openid || '')}`,
      });
    } else {
      uni.reLaunch({ url: '/pages/index/index' });
    }
  } catch (e: any) {
    uni.showToast({ title: '微信登录失败: ' + (e.message || '未知'), icon: 'none', duration: 3000 });
  } finally {
    wechatLoading.value = false;
  }
}

async function handleLogin() {
  if (!phone.value || !password.value) {
    uni.showToast({ title: '请输入手机号和密码', icon: 'none' });
    return;
  }
  loading.value = true;
  try {
    const ok = await auth.login(phone.value, password.value);
    if (ok) {
      uni.reLaunch({ url: '/pages/index/index' });
    } else {
      uni.showToast({ title: '登录失败，请检查账号密码', icon: 'none' });
    }
  } catch (e: any) {
    uni.showToast({ title: '网络错误: ' + (e.message || '未知'), icon: 'none', duration: 3000 });
  } finally {
    loading.value = false;
  }
}

function goToOnboarding() {
  uni.navigateTo({ url: '/pages/onboarding/index' });
}
</script>

<style scoped>
.login-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  padding: 40rpx;
}
.login-header {
  text-align: center;
  margin-bottom: 60rpx;
}
.title {
  font-size: 48rpx;
  font-weight: bold;
  display: block;
}
.subtitle {
  font-size: 28rpx;
  color: #999;
  display: block;
  margin-top: 10rpx;
}
.wechat-btn {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  font-size: 32rpx;
  background: #07c160;
  color: #fff;
  border: none;
  border-radius: 12rpx;
  margin-bottom: 30rpx;
}
.divider {
  display: flex;
  align-items: center;
  width: 100%;
  margin-bottom: 30rpx;
}
.divider-line {
  flex: 1;
  height: 1px;
  background: #e5e5e5;
}
.divider-text {
  padding: 0 20rpx;
  font-size: 26rpx;
  color: #999;
}
.login-form {
  width: 100%;
}
.login-form input {
  border: 1px solid #ddd;
  border-radius: 8rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
  font-size: 30rpx;
}
.login-form button {
  margin-top: 20rpx;
}
.register-link {
  text-align: center;
  margin-top: 30rpx;
}
.register-link text {
  font-size: 26rpx;
  color: #3b82f6;
}
</style>
