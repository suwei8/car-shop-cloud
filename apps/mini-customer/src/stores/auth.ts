import { defineStore } from 'pinia';
import { ref } from 'vue';
import { request } from '../utils/api';

export const useAuthStore = defineStore('auth', () => {
  const token = ref(uni.getStorageSync('customerToken') || '');
  const openid = ref(uni.getStorageSync('customerOpenid') || '');
  const bound = ref(false);
  const customerInfo = ref<any>(null);
  const bindings = ref<any[]>([]);

  function setToken(t: string) {
    token.value = t;
    uni.setStorageSync('customerToken', t);
  }

  function setOpenid(o: string) {
    openid.value = o;
    uni.setStorageSync('customerOpenid', o);
  }

  async function autoLogin() {
    // #ifdef MP-WEIXIN
    if (token.value) {
      try {
        await fetchMe();
        return;
      } catch {
        token.value = '';
      }
    }
    try {
      const loginRes = await new Promise<any>((resolve, reject) => {
        uni.login({
          provider: 'weixin',
          success: resolve,
          fail: reject,
        });
      });
      const res: any = await request('/customer-portal/auth/login', {
        method: 'POST',
        data: { code: loginRes.code },
      });
      setOpenid(res.openid);
      if (res.bound && res.token) {
        setToken(res.token);
        bound.value = true;
        await fetchMe();
      } else {
        bound.value = false;
      }
    } catch (e) {
      console.error('wx login failed', e);
    }
    // #endif

    // #ifdef H5
    if (token.value) {
      try { await fetchMe(); } catch { token.value = ''; }
    }
    // #endif
  }

  async function bindPhone(phone: string, code: string) {
    const res: any = await request('/customer-portal/auth/bind', {
      method: 'POST',
      data: { openid: openid.value, phone, code },
    });
    setToken(res.token);
    bound.value = true;
    await fetchMe();
  }

  async function fetchMe() {
    customerInfo.value = await request('/customer-portal/me');
  }

  async function fetchBindings() {
    bindings.value = await request('/customer-portal/bindings');
  }

  async function switchShop(tenantId: string, customerId: string) {
    const res: any = await request('/customer-portal/auth/switch-shop', {
      method: 'POST',
      data: { tenantId, customerId },
    });
    setToken(res.token);
    await fetchMe();
  }

  async function sendCode(phone: string) {
    await request('/customer-portal/auth/send-code', {
      method: 'POST',
      data: { phone },
    });
  }

  function logout() {
    token.value = '';
    openid.value = '';
    customerInfo.value = null;
    uni.removeStorageSync('customerToken');
    uni.removeStorageSync('customerOpenid');
  }

  return {
    token, openid, bound, customerInfo, bindings,
    autoLogin, bindPhone, fetchMe, fetchBindings, switchShop, sendCode, logout,
  };
});
