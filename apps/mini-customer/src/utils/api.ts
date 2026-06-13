const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

interface RequestOptions {
  method?: string;
  data?: any;
  header?: Record<string, string>;
}

export function request<T = any>(url: string, options: RequestOptions = {}): Promise<T> {
  const token = uni.getStorageSync('customerToken');
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${BASE_URL}/api${url}`,
      method: options.method || 'GET',
      data: options.data,
      header: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.header,
      },
      success: (res: any) => {
        if (res.statusCode === 401) {
          uni.removeStorageSync('customerToken');
          uni.redirectTo({ url: '/pages/my/index' });
          reject(new Error('未授权，请重新登录'));
          return;
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data?.data ?? res.data);
        } else {
          const msg = res.data?.message || '请求失败';
          uni.showToast({ title: msg, icon: 'none' });
          reject(new Error(msg));
        }
      },
      fail: (err) => {
        uni.showToast({ title: '网络错误', icon: 'none' });
        reject(err);
      },
    });
  });
}
