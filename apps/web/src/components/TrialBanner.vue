<template>
  <div v-if="showBanner" class="trial-banner" :class="bannerClass">
    <el-icon v-if="status === 'suspended'" class="banner-icon"><WarningFilled /></el-icon>
    <el-icon v-else class="banner-icon"><InfoFilled /></el-icon>
    <span class="banner-text">{{ bannerText }}</span>
    <el-button v-if="status === 'trial' || status === 'grace'" type="primary" size="small" @click="goUpgrade">
      立即升级
    </el-button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { InfoFilled, WarningFilled } from '@element-plus/icons-vue';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const auth = useAuthStore();

const subscription = computed(() => {
  const user = auth.user as any;
  return user?.subscription || null;
});

const status = computed(() => subscription.value?.status || '');
const daysRemaining = computed(() => subscription.value?.daysRemaining ?? 0);

const showBanner = computed(() => {
  return ['trial', 'grace', 'suspended'].includes(status.value);
});

const bannerClass = computed(() => ({
  'trial': status.value === 'trial',
  'grace': status.value === 'grace',
  'suspended': status.value === 'suspended',
}));

const bannerText = computed(() => {
  if (status.value === 'trial') {
    return `免费试用中，剩余 ${daysRemaining.value} 天`;
  }
  if (status.value === 'grace') {
    return `试用已到期，宽限期内剩余 ${daysRemaining.value} 天`;
  }
  if (status.value === 'suspended') {
    return '试用已到期，系统已停用，请联系服务商续费';
  }
  return '';
});

function goUpgrade() {
  // Placeholder for upgrade page
  router.push('/dashboard');
}
</script>

<style scoped>
.trial-banner {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  border-radius: 4px;
  margin-bottom: 16px;
  font-size: 14px;
}
.trial-banner.trial {
  background: #fdf6ec;
  color: #e6a23c;
  border: 1px solid #faecd8;
}
.trial-banner.grace {
  background: #fef0f0;
  color: #f56c6c;
  border: 1px solid #fde2e2;
}
.trial-banner.suspended {
  background: #f56c6c;
  color: #fff;
  border: 1px solid #f56c6c;
}
.banner-icon {
  margin-right: 8px;
  font-size: 16px;
}
.banner-text {
  flex: 1;
}
</style>
