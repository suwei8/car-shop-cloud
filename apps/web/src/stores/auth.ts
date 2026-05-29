import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api from '../utils/api';

interface UserInfo {
  id: string;
  name: string;
  phone: string;
  isPlatform: boolean;
  tenantId: string | null;
  shopId: string | null;
  roles: string[];
  permissions: string[];
}

const USER_CACHE_KEY = 'userInfo';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserInfo | null>(null);
  const token = ref<string>(localStorage.getItem('accessToken') || '');

  // 初始化时从缓存恢复用户信息
  const cached = localStorage.getItem(USER_CACHE_KEY);
  if (cached) {
    try {
      user.value = JSON.parse(cached);
    } catch {}
  }

  const isLoggedIn = computed(() => !!token.value);
  const isPlatform = computed(() => user.value?.isPlatform || false);
  const hasPermission = (perm: string) => user.value?.permissions?.includes(perm) || false;

  function setUser(u: UserInfo) {
    user.value = u;
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(u));
  }

  async function login(phone: string, password: string) {
    const res: any = await api.post('/auth/login', { phone, password });
    token.value = res.accessToken;
    setUser(res.user);
    localStorage.setItem('accessToken', res.accessToken);
    localStorage.setItem('refreshToken', res.refreshToken);
    return res;
  }

  async function refresh() {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) throw new Error('无 refresh token');
    const res: any = await api.post('/auth/refresh', { refreshToken });
    token.value = res.accessToken;
    localStorage.setItem('accessToken', res.accessToken);
    localStorage.setItem('refreshToken', res.refreshToken);
    return res;
  }

  async function logout() {
    try {
      await api.post('/auth/logout');
    } catch {}
    token.value = '';
    user.value = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem(USER_CACHE_KEY);
  }

  async function fetchUser() {
    if (!token.value) return;
    try {
      const res: any = await api.post('/auth/me');
      setUser(res);
    } catch {
      await logout();
    }
  }

  return { user, token, isLoggedIn, isPlatform, hasPermission, login, refresh, logout, fetchUser };
});
