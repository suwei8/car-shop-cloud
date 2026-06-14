<template>
  <view class="onboarding-page">
    <view class="header">
      <text class="title">欢迎注册车店管家</text>
      <text class="subtitle">30天免费试用，轻松管店</text>
    </view>

    <!-- Step 1: 手机号 + 验证码 -->
    <view class="form-section">
      <view class="section-title">1. 手机号验证</view>
      <view class="form-item">
        <input
          v-model="form.phone"
          type="number"
          placeholder="请输入手机号"
          maxlength="11"
          class="form-input"
        />
      </view>
      <view class="form-item code-row">
        <input
          v-model="form.smsCode"
          type="number"
          placeholder="短信验证码"
          maxlength="6"
          class="form-input code-input"
        />
        <button
          class="send-btn"
          :disabled="countdown > 0 || sendingCode"
          @tap="handleSendCode"
        >
          {{ countdown > 0 ? `${countdown}s` : '发送验证码' }}
        </button>
      </view>
    </view>

    <!-- Step 2: 经营类型 -->
    <view class="form-section">
      <view class="section-title">2. 选择经营类型</view>
      <view class="type-list">
        <view
          v-for="item in businessTypes"
          :key="item.value"
          class="type-item"
          :class="{ active: form.businessType === item.value }"
          @tap="form.businessType = item.value"
        >
          <text class="type-icon">{{ item.icon }}</text>
          <text class="type-label">{{ item.label }}</text>
          <text class="type-desc">{{ item.desc }}</text>
        </view>
      </view>
    </view>

    <!-- Step 3: 店铺信息 -->
    <view class="form-section">
      <view class="section-title">3. 店铺信息</view>
      <view class="form-item">
        <input
          v-model="form.shopName"
          placeholder="店铺名称（必填）"
          maxlength="30"
          class="form-input"
        />
      </view>
      <view class="form-item">
        <input
          v-model="form.employeeCount"
          type="number"
          placeholder="员工数（必填）"
          maxlength="3"
          class="form-input"
        />
      </view>
      <view class="form-item">
        <input
          v-model="form.address"
          placeholder="地址（选填）"
          maxlength="100"
          class="form-input"
        />
      </view>
      <view class="form-item">
        <input
          v-model="form.contactPhone"
          type="number"
          placeholder="联系电话（选填）"
          maxlength="11"
          class="form-input"
        />
      </view>
    </view>

    <button
      type="primary"
      class="submit-btn"
      :loading="submitting"
      :disabled="submitting"
      @tap="handleSubmit"
    >
      注册并开始使用
    </button>

    <view class="login-link">
      <text @tap="goToLogin">已有账号？去登录</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue';
import { useAuthStore } from '../../stores/auth';
import { request } from '../../utils/request';

const auth = useAuthStore();

const businessTypes = [
  { value: 'repair', label: '汽修保养', icon: '🔧', desc: '机修、保养、电路' },
  { value: 'wash_beauty', label: '洗美快修', icon: '✨', desc: '洗车、美容、精品' },
  { value: 'composite', label: '综合汽服', icon: '🏭', desc: '以上全部' },
];

const form = reactive({
  phone: '',
  smsCode: '',
  businessType: '',
  shopName: '',
  employeeCount: '',
  address: '',
  contactPhone: '',
});

const countdown = ref(0);
const sendingCode = ref(false);
const submitting = ref(false);
let countdownTimer: ReturnType<typeof setInterval> | null = null;

// 从页面参数获取 openid（从登录流程传入）
const openid = ref('');

onMounted(() => {
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1] as any;
  const options = currentPage?.$page?.options || currentPage?.options || {};
  if (options.openid) {
    openid.value = decodeURIComponent(options.openid);
  }
});

onUnmounted(() => {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
});

function validatePhone(phone: string): boolean {
  return /^1[3-9]\d{9}$/.test(phone);
}

async function handleSendCode() {
  if (!form.phone) {
    uni.showToast({ title: '请输入手机号', icon: 'none' });
    return;
  }
  if (!validatePhone(form.phone)) {
    uni.showToast({ title: '手机号格式不正确', icon: 'none' });
    return;
  }

  sendingCode.value = true;
  try {
    const res: any = await request({
      url: '/api/auth/register/send-code',
      method: 'POST',
      data: { phone: form.phone },
    });
    if (res.data?.code === 0) {
      uni.showToast({ title: '验证码已发送', icon: 'none' });
      startCountdown();
    } else {
      uni.showToast({ title: res.data?.message || '发送失败', icon: 'none' });
    }
  } catch (e: any) {
    uni.showToast({ title: '网络错误: ' + (e.message || '未知'), icon: 'none', duration: 3000 });
  } finally {
    sendingCode.value = false;
  }
}

function startCountdown() {
  countdown.value = 60;
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = setInterval(() => {
    countdown.value--;
    if (countdown.value <= 0) {
      if (countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
      }
    }
  }, 1000);
}

function validateForm(): string | null {
  if (!form.phone) return '请输入手机号';
  if (!validatePhone(form.phone)) return '手机号格式不正确';
  if (!form.smsCode || form.smsCode.length < 6) return '请输入6位验证码';
  if (!form.businessType) return '请选择经营类型';
  if (!form.shopName || form.shopName.length < 2) return '店铺名称至少2个字符';
  if (!form.employeeCount || parseInt(form.employeeCount) < 1) return '员工数至少为1';
  return null;
}

async function handleSubmit() {
  const error = validateForm();
  if (error) {
    uni.showToast({ title: error, icon: 'none' });
    return;
  }

  submitting.value = true;
  try {
    // 获取新的 wx.login code 用于绑定
    const loginCode = await new Promise<string>((resolve, reject) => {
      uni.login({
        provider: 'weixin',
        success: (res) => resolve(res.code),
        fail: (err) => reject(new Error(err.errMsg || '微信登录失败')),
      });
    });

    const res: any = await request({
      url: '/api/auth/wechat/bind',
      method: 'POST',
      data: {
        code: loginCode,
        phone: form.phone,
        smsCode: form.smsCode,
        shopName: form.shopName,
        businessType: form.businessType,
        employeeCount: parseInt(form.employeeCount),
      },
    });

    if (res.data?.code === 0) {
      const data = res.data.data;
      // 保存 token
      auth.setLoginData(data);
      uni.showToast({ title: '注册成功', icon: 'success' });
      setTimeout(() => {
        uni.reLaunch({ url: '/pages/index/index' });
      }, 1000);
    } else {
      uni.showToast({ title: res.data?.message || '注册失败', icon: 'none', duration: 3000 });
    }
  } catch (e: any) {
    uni.showToast({ title: '注册失败: ' + (e.message || '未知'), icon: 'none', duration: 3000 });
  } finally {
    submitting.value = false;
  }
}

function goToLogin() {
  uni.navigateTo({ url: '/pages/login/login' });
}
</script>

<style scoped>
.onboarding-page {
  min-height: 100vh;
  padding: 40rpx 32rpx;
  background: #f5f5f5;
}
.header {
  text-align: center;
  padding: 40rpx 0 30rpx;
}
.title {
  font-size: 44rpx;
  font-weight: bold;
  color: #333;
  display: block;
}
.subtitle {
  font-size: 26rpx;
  color: #999;
  display: block;
  margin-top: 10rpx;
}
.form-section {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
}
.section-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 20rpx;
}
.form-item {
  margin-bottom: 20rpx;
}
.form-input {
  border: 1px solid #e5e5e5;
  border-radius: 12rpx;
  padding: 24rpx;
  font-size: 30rpx;
  width: 100%;
  box-sizing: border-box;
}
.code-row {
  display: flex;
  gap: 16rpx;
}
.code-input {
  flex: 1;
}
.send-btn {
  min-width: 200rpx;
  height: 80rpx;
  line-height: 80rpx;
  font-size: 26rpx;
  background: #f0f0f0;
  color: #666;
  border: none;
  border-radius: 12rpx;
  white-space: nowrap;
}
.send-btn[disabled] {
  opacity: 0.6;
}
.type-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.type-item {
  display: flex;
  align-items: center;
  padding: 24rpx;
  border: 2rpx solid #e5e5e5;
  border-radius: 12rpx;
  transition: all 0.2s;
}
.type-item.active {
  border-color: #3b82f6;
  background: #eff6ff;
}
.type-icon {
  font-size: 40rpx;
  margin-right: 16rpx;
}
.type-label {
  font-size: 30rpx;
  font-weight: bold;
  color: #333;
  margin-right: 12rpx;
}
.type-desc {
  font-size: 24rpx;
  color: #999;
}
.submit-btn {
  margin-top: 20rpx;
  margin-bottom: 20rpx;
  height: 88rpx;
  line-height: 88rpx;
  font-size: 32rpx;
  border-radius: 12rpx;
}
.login-link {
  text-align: center;
  padding: 20rpx 0;
}
.login-link text {
  font-size: 26rpx;
  color: #3b82f6;
}
</style>
