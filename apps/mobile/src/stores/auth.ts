import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { request } from '../utils/request';

interface UserInfo {
  id: string;
  name: string;
  phone: string;
  isPlatform: boolean;
  tenantId: string;
  shopId?: string;
  roles: string[];
  permissions: string[];
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string>(uni.getStorageSync('accessToken') || '');
  const refreshTokenValue = ref<string>(uni.getStorageSync('refreshToken') || '');
  const user = ref<UserInfo | null>(
    uni.getStorageSync('userInfo') ? JSON.parse(uni.getStorageSync('userInfo')) : null,
  );

  const isLoggedIn = computed(() => !!token.value);

  // Feature flags
  const simpleMode = ref(false);
  const flagsLoaded = ref(false);

  async function login(phone: string, password: string) {
    const res: any = await request({
      url: '/api/auth/login',
      method: 'POST',
      data: { phone, password },
    });

    if (res.data?.code === 0) {
      const data = res.data.data;
      token.value = data.accessToken;
      refreshTokenValue.value = data.refreshToken;
      user.value = data.user;
      uni.setStorageSync('accessToken', data.accessToken);
      uni.setStorageSync('refreshToken', data.refreshToken);
      uni.setStorageSync('userInfo', JSON.stringify(data.user));
      await fetchFeatureFlags();
      return true;
    }
    return false;
  }

  function logout() {
    token.value = '';
    refreshTokenValue.value = '';
    user.value = null;
    simpleMode.value = false;
    flagsLoaded.value = false;
    uni.removeStorageSync('accessToken');
    uni.removeStorageSync('refreshToken');
    uni.removeStorageSync('userInfo');
    uni.reLaunch({ url: '/pages/login/login' });
  }

  async function refresh(): Promise<boolean> {
    if (!refreshTokenValue.value) return false;
    try {
      const res: any = await request({
        url: '/api/auth/refresh',
        method: 'POST',
        data: { refreshToken: refreshTokenValue.value },
      });
      if (res.data?.code === 0) {
        const data = res.data.data;
        token.value = data.accessToken;
        refreshTokenValue.value = data.refreshToken;
        uni.setStorageSync('accessToken', data.accessToken);
        uni.setStorageSync('refreshToken', data.refreshToken);
        return true;
      }
    } catch {
      // refresh failed
    }
    return false;
  }

  async function fetchFeatureFlags() {
    if (!token.value || !user.value?.tenantId) return;
    try {
      const res: any = await request({
        url: '/api/feature-flags/my',
        method: 'GET',
        header: { Authorization: `Bearer ${token.value}` },
      });
      if (res.data?.code === 0 && res.data.data) {
        simpleMode.value = !!res.data.data.simple_mode;
        flagsLoaded.value = true;
      }
    } catch {
      flagsLoaded.value = true;
    }
  }

  return { token, refreshTokenValue, user, isLoggedIn, simpleMode, flagsLoaded, login, logout, refresh, fetchFeatureFlags };
});
