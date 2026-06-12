import { BASE_URL } from '../config';

interface RequestOptions {
  url: string;
  method?: string;
  data?: any;
  header?: Record<string, string>;
  _retry?: boolean;
}

interface ApiResponse {
  data: any;
  statusCode: number;
}

let refreshing = false;
const pendingQueue: Array<{ resolve: (v: string) => void; reject: () => void }> = [];

async function getToken(): Promise<string> {
  return uni.getStorageSync('accessToken') || '';
}

async function doRefresh(): Promise<boolean> {
  const refreshToken = uni.getStorageSync('refreshToken');
  if (!refreshToken) return false;
  try {
    const res = await rawRequest({
      url: '/api/auth/refresh',
      method: 'POST',
      data: { refreshToken },
    });
    if (res.data?.code === 0) {
      const data = res.data.data;
      uni.setStorageSync('accessToken', data.accessToken);
      uni.setStorageSync('refreshToken', data.refreshToken);
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

function redirectToLogin() {
  uni.removeStorageSync('accessToken');
  uni.removeStorageSync('refreshToken');
  uni.removeStorageSync('userInfo');
  uni.reLaunch({ url: '/pages/login/login' });
}

function rawRequest(options: RequestOptions): Promise<ApiResponse> {
  const url = options.url.startsWith('http') ? options.url : `${BASE_URL}${options.url}`;

  if (typeof window !== 'undefined' && typeof XMLHttpRequest !== 'undefined') {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(options.method || 'GET', url, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      if (options.header) {
        for (const [key, value] of Object.entries(options.header)) {
          xhr.setRequestHeader(key, value);
        }
      }
      xhr.onload = () => {
        try { resolve({ data: JSON.parse(xhr.responseText), statusCode: xhr.status }); }
        catch { reject(new Error('解析响应失败')); }
      };
      xhr.onerror = () => reject(new Error('网络请求失败'));
      xhr.ontimeout = () => reject(new Error('请求超时'));
      if (options.data && options.method !== 'GET') {
        xhr.send(JSON.stringify(options.data));
      } else {
        xhr.send();
      }
    });
  }

  return new Promise((resolve, reject) => {
    uni.request({
      url,
      method: (options.method as any) || 'GET',
      header: { 'Content-Type': 'application/json', ...(options.header || {}) },
      data: options.data,
      success: (res: any) => resolve({ data: res.data, statusCode: res.statusCode }),
      fail: (err: any) => reject(new Error(err.errMsg || '请求失败')),
    });
  });
}

export async function request(options: RequestOptions): Promise<ApiResponse> {
  const token = await getToken();
  const headers: Record<string, string> = { ...(options.header || {}) };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res = await rawRequest({ ...options, header: headers });

  if (res.statusCode === 401 && !options._retry) {
    if (refreshing) {
      const newToken = await new Promise<string>((resolve, reject) => {
        pendingQueue.push({ resolve, reject });
      });
      headers['Authorization'] = `Bearer ${newToken}`;
      return rawRequest({ ...options, header: headers, _retry: true });
    }

    refreshing = true;
    const ok = await doRefresh();
    refreshing = false;

    if (ok) {
      const newToken = await getToken();
      pendingQueue.forEach(p => p.resolve(newToken));
      pendingQueue.length = 0;

      headers['Authorization'] = `Bearer ${newToken}`;
      res = await rawRequest({ ...options, header: headers, _retry: true });
      return res;
    } else {
      pendingQueue.forEach(p => p.reject());
      pendingQueue.length = 0;
      redirectToLogin();
      throw new Error('登录已过期');
    }
  }

  return res;
}

export { BASE_URL };
