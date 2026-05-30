// 网络请求工具 - 兼容 uni-app H5 和 App 模式

const BASE_URL = 'https://car-api.555606.xyz';

interface RequestOptions {
  url: string;
  method?: string;
  data?: any;
  header?: Record<string, string>;
}

interface ApiResponse {
  data: any;
  statusCode: number;
}

// H5 模式使用 XMLHttpRequest（兼容性最好）
function xhrRequest(options: RequestOptions): Promise<ApiResponse> {
  return new Promise((resolve, reject) => {
    const url = options.url.startsWith('http') ? options.url : `${BASE_URL}${options.url}`;
    const xhr = new XMLHttpRequest();
    xhr.open(options.method || 'GET', url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');

    if (options.header) {
      for (const [key, value] of Object.entries(options.header)) {
        xhr.setRequestHeader(key, value);
      }
    }

    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        resolve({ data, statusCode: xhr.status });
      } catch (e) {
        reject(new Error('解析响应失败'));
      }
    };

    xhr.onerror = () => {
      reject(new Error('网络请求失败'));
    };

    xhr.ontimeout = () => {
      reject(new Error('请求超时'));
    };

    if (options.data && options.method !== 'GET') {
      xhr.send(JSON.stringify(options.data));
    } else {
      xhr.send();
    }
  });
}

// App 模式使用 uni.request
function uniRequest(options: RequestOptions): Promise<ApiResponse> {
  const url = options.url.startsWith('http') ? options.url : `${BASE_URL}${options.url}`;

  return new Promise((resolve, reject) => {
    uni.request({
      url,
      method: (options.method as any) || 'GET',
      header: {
        'Content-Type': 'application/json',
        ...(options.header || {}),
      },
      data: options.data,
      success: (res: any) => {
        resolve({ data: res.data, statusCode: res.statusCode });
      },
      fail: (err: any) => {
        reject(new Error(err.errMsg || '请求失败'));
      },
    });
  });
}

// 统一请求函数
export async function request(options: RequestOptions): Promise<ApiResponse> {
  // 判断是否在 H5 浏览器环境
  if (typeof window !== 'undefined' && typeof XMLHttpRequest !== 'undefined') {
    return xhrRequest(options);
  }
  return uniRequest(options);
}

export { BASE_URL };
