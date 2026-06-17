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

interface SubscriptionInfo {
  status: string;
  endAt: string | null;
  daysRemaining: number;
}

function safeParseJson<T>(value: any, fallback: T): T {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string>(uni.getStorageSync('accessToken') || '');
  const refreshTokenValue = ref<string>(uni.getStorageSync('refreshToken') || '');
  const user = ref<UserInfo | null>(
    safeParseJson<UserInfo | null>(uni.getStorageSync('userInfo'), null),
  );
  const subscription = ref<SubscriptionInfo | null>(null);

  const isLoggedIn = computed(() => !!token.value);

  // Feature flags
  const simpleMode = ref(false);
  const flagsLoaded = ref(false);

  function setLoginData(data: {
    accessToken: string;
    refreshToken: string;
    user: UserInfo;
    subscription?: SubscriptionInfo;
  }) {
    token.value = data.accessToken;
    refreshTokenValue.value = data.refreshToken;
    user.value = data.user;
    subscription.value = data.subscription || null;
    uni.setStorageSync('accessToken', data.accessToken);
    uni.setStorageSync('refreshToken', data.refreshToken);
    uni.setStorageSync('userInfo', JSON.stringify(data.user));
    if (data.subscription) {
      uni.setStorageSync('subscription', JSON.stringify(data.subscription));
    }
  }

  async function login(phone: string, password: string) {
    const res: any = await request({
      url: '/api/auth/login',
      method: 'POST',
      data: { phone, password },
    });

    if (res.data?.code === 0) {
      const data = res.data.data;
      setLoginData(data);
      await fetchFeatureFlags();
      return true;
    }
    return false;
  }

  /**
   * 微信小程序登录：用 code 换 openid，检查是否已绑定
   * 返回 { needBind, openid, data? }
   */
  async function wechatLogin(code: string) {
    const res: any = await request({
      url: '/api/auth/wechat/login',
      method: 'POST',
      data: { code },
    });

    if (res.data?.code === 0) {
      const data = res.data.data;
      if (data.needBind) {
        return { needBind: true, openid: data.openid };
      } else {
        // 已绑定，直接登录
        setLoginData(data);
        await fetchFeatureFlags();
        return { needBind: false, openid: null };
      }
    }
    throw new Error(res.data?.message || '微信登录失败');
  }

  function logout() {
    token.value = '';
    refreshTokenValue.value = '';
    user.value = null;
    subscription.value = null;
    simpleMode.value = false;
    flagsLoaded.value = false;
    uni.removeStorageSync('accessToken');
    uni.removeStorageSync('refreshToken');
    uni.removeStorageSync('userInfo');
    uni.removeStorageSync('subscription');
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

  return {
    token,
    refreshTokenValue,
    user,
    subscription,
    isLoggedIn,
    simpleMode,
    flagsLoaded,
    setLoginData,
    login,
    wechatLogin,
    logout,
    refresh,
    fetchFeatureFlags,
  };
});
