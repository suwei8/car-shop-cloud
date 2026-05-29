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

      // 如果正在刷新中，将请求加入队列等待
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

        // 重试原请求
        originalRequest.headers!.Authorization = `Bearer ${accessToken}`;

        // 执行队列中的等待请求
        pendingRequests.forEach((cb) => cb(accessToken));
        pendingRequests = [];

        return api(originalRequest);
      } catch {
        // refresh 也失败了，清除登录状态
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

export default api;
