// pm2 开发模式部署配置（热重载，不打镜像）
// 用法：pm2 start ecosystem.config.js
// 注意：env 中的变量会传递给子进程，确保 API 绑定到 127.0.0.1 而非 0.0.0.0
module.exports = {
  apps: [
    {
      name: 'car-api',
      cwd: '/home/sw/dev_root/car',
      script: '/bin/bash',
      args: ['-lc', 'cd /home/sw/dev_root/car/apps/api && exec pnpm run start:dev'],
      interpreter: 'none',
      autorestart: true,
      max_restarts: 20,
      env: {
        NODE_ENV: 'development',
        // 强制绑定回环地址，防止 API 暴露到公网
        API_HOST: '127.0.0.1',
        API_PORT: '3000',
      },
      out_file: '/home/sw/.pm2/logs/car-api-out.log',
      error_file: '/home/sw/.pm2/logs/car-api-err.log',
    },
    {
      name: 'car-web',
      cwd: '/home/sw/dev_root/car',
      script: '/bin/bash',
      // vite dev：仅监听本机回环，由 nginx 反代对外；--host 127.0.0.1 提升安全
      args: ['-lc', 'cd /home/sw/dev_root/car/apps/web && exec pnpm run dev -- --host 127.0.0.1 --port 5173'],
      interpreter: 'none',
      autorestart: true,
      max_restarts: 20,
      env: {
        NODE_ENV: 'development',
      },
      out_file: '/home/sw/.pm2/logs/car-web-out.log',
      error_file: '/home/sw/.pm2/logs/car-web-err.log',
    },
  ],
};
