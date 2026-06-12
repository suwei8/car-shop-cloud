import axios, { AxiosRequestConfig } from 'axios';
import { ElMessage } from 'element-plus';
import router from '../router';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
});

let isRefreshing = false;
let pendingRequests: Array<(token: string) => void> = [];

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    const { code, message, data } = response.data;
    if (code !== 0) {
      ElMessage.error(message || '请求失败');
      return Promise.reject(new Error(message));
    }
    return data;
  },
  async (error) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      if (isRefreshing) {
        return new Promise((resolve) => {
          pendingRequests.push((token: string) => {
            originalRequest.headers!.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          });
        });
      }

      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('无 refresh token');

        const res = await axios.post('/api/auth/refresh', { refreshToken });
        const { accessToken, refreshToken: newRefreshToken } = res.data.data;

        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', newRefreshToken);

        originalRequest.headers!.Authorization = `Bearer ${accessToken}`;

        pendingRequests.forEach((cb) => cb(accessToken));
        pendingRequests = [];

        return api(originalRequest);
      } catch {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('userInfo');
        pendingRequests = [];
        router.push('/login');
        ElMessage.error('登录已过期，请重新登录');
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    const msg = error.response?.data?.message || error.message || '网络错误';
    ElMessage.error(msg);
    return Promise.reject(error);
  },
);

export async function apiGet<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  return api.get(url, { params }) as unknown as T;
}

export async function apiPost<T>(url: string, data?: unknown): Promise<T> {
  return api.post(url, data) as unknown as T;
}

export async function apiPut<T>(url: string, data?: unknown): Promise<T> {
  return api.put(url, data) as unknown as T;
}

export async function apiDelete<T>(url: string): Promise<T> {
  return api.delete(url) as unknown as T;
}

export default api;
