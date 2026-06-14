/**
 * 微信小程序登录工具
 */
export function wxLogin(): Promise<string> {
  return new Promise((resolve, reject) => {
    uni.login({
      provider: 'weixin',
      success: (res) => {
        if (res.code) {
          resolve(res.code);
        } else {
          reject(new Error('微信登录失败，未获取到 code'));
        }
      },
      fail: (err) => {
        reject(new Error(err.errMsg || '微信登录失败'));
      },
    });
  });
}
