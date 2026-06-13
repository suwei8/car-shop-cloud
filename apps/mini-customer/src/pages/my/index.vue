<template>
  <view class="container">
    <view class="card" v-if="!auth.bound">
      <view class="card-title">手机号绑定</view>
      <input v-model="phone" type="number" placeholder="请输入手机号" maxlength="11" class="input" />
      <view class="code-row">
        <input v-model="smsCode" type="number" placeholder="验证码" maxlength="6" class="input code-input" />
        <button class="code-btn" :disabled="countdown > 0" @click="handleSendCode">
          {{ countdown > 0 ? `${countdown}s` : '获取验证码' }}
        </button>
      </view>
      <button class="bind-btn" @click="handleBind">绑定并登录</button>
    </view>

    <template v-if="auth.bound">
      <view class="card">
        <view class="card-title">个人信息</view>
        <view class="info-row">
          <text class="label">姓名</text>
          <text>{{ auth.customerInfo?.name || '-' }}</text>
        </view>
        <view class="info-row">
          <text class="label">手机号</text>
          <text>{{ auth.customerInfo?.phone || '-' }}</text>
        </view>
        <view class="info-row">
          <text class="label">当前门店</text>
          <text>{{ auth.customerInfo?.tenant?.name || '-' }}</text>
        </view>
      </view>

      <view class="card">
        <view class="card-title">切换门店</view>
        <view v-if="auth.bindings.length > 1" v-for="b in auth.bindings" :key="b.tenantId + b.customerId"
              class="shop-item" :class="{ active: b.tenantId === auth.customerInfo?.tenant?.id }"
              @click="handleSwitch(b.tenantId, b.customerId)">
          <text>{{ b.tenantName }}</text>
          <text v-if="b.tenantId === auth.customerInfo?.tenant?.id" class="current">当前</text>
        </view>
        <text v-else class="empty-text">暂无其他门店</text>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAuthStore } from '../../stores/auth';

const auth = useAuthStore();
const phone = ref('');
const smsCode = ref('');
const countdown = ref(0);
let timer: any = null;

async function handleSendCode() {
  if (!phone.value || phone.value.length !== 11) {
    uni.showToast({ title: '请输入正确的手机号', icon: 'none' });
    return;
  }
  try {
    await auth.sendCode(phone.value);
    uni.showToast({ title: '验证码已发送', icon: 'success' });
    countdown.value = 60;
    timer = setInterval(() => {
      countdown.value--;
      if (countdown.value <= 0) clearInterval(timer);
    }, 1000);
  } catch (e: any) {
    uni.showToast({ title: e.message || '发送失败', icon: 'none' });
  }
}

async function handleBind() {
  if (!phone.value || !smsCode.value) {
    uni.showToast({ title: '请填写手机号和验证码', icon: 'none' });
    return;
  }
  try {
    await auth.bindPhone(phone.value, smsCode.value);
    uni.showToast({ title: '绑定成功', icon: 'success' });
  } catch (e: any) {
    uni.showToast({ title: e.message || '绑定失败', icon: 'none' });
  }
}

async function handleSwitch(tenantId: string, customerId: string) {
  try {
    await auth.switchShop(tenantId, customerId);
    uni.showToast({ title: '切换成功', icon: 'success' });
  } catch (e: any) {
    uni.showToast({ title: e.message || '切换失败', icon: 'none' });
  }
}

onMounted(() => {
  if (auth.token) {
    auth.fetchBindings();
  }
});
</script>

<style scoped>
.input { border: 1px solid #ddd; border-radius: 6px; padding: 10px 12px; font-size: 14px; margin-bottom: 12px; }
.code-row { display: flex; gap: 8px; margin-bottom: 12px; }
.code-input { flex: 1; margin-bottom: 0; }
.code-btn { width: 120px; font-size: 13px; background: #f0f0f0; border: none; border-radius: 6px; }
.bind-btn { background: #409eff; color: #fff; border: none; border-radius: 6px; font-size: 15px; }
.info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f5f5f5; }
.label { color: #999; }
.shop-item { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #f5f5f5; }
.shop-item.active { color: #409eff; }
.current { font-size: 12px; color: #409eff; }
.empty-text { color: #999; font-size: 13px; }
</style>
