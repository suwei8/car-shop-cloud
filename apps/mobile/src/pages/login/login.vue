<template>
  <view class="login-page">
    <view class="login-header">
      <text class="title">车店云管家</text>
      <text class="subtitle">员工登录</text>
    </view>
    <view class="login-form">
      <input v-model="phone" type="number" placeholder="手机号" maxlength="11" />
      <input v-model="password" type="password" placeholder="密码" />
      <button type="primary" :loading="loading" @tap="handleLogin">登录</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAuthStore } from '../../stores/auth';

const auth = useAuthStore();
const phone = ref('');
const password = ref('');
const loading = ref(false);

onMounted(() => {
  if (auth.isLoggedIn) {
    uni.reLaunch({ url: '/pages/index/index' });
  }
});

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
</style>
