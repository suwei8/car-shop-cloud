const LOGIN_PAGE = '/pages/login/login';

const PUBLIC_PAGES = [LOGIN_PAGE];

function isPublicPage(url: string): boolean {
  const path = url.split('?')[0];
  return PUBLIC_PAGES.includes(path);
}

function hasToken(): boolean {
  return !!uni.getStorageSync('accessToken');
}

function redirectToLogin() {
  uni.reLaunch({ url: LOGIN_PAGE });
}

export function setupAuthGuard() {
  const interceptors = ['navigateTo', 'redirectTo', 'reLaunch', 'switchTab'] as const;

  for (const method of interceptors) {
    uni.addInterceptor(method, {
      invoke(args: any) {
        const url = args.url || '';
        if (!isPublicPage(url) && !hasToken()) {
          redirectToLogin();
          return false;
        }
        return true;
      },
    });
  }
}

export function checkLaunchAuth() {
  if (!hasToken()) {
    redirectToLogin();
  }
}
