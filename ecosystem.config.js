// pm2 开发模式部署配置（热重载，不打镜像）
// 用法：pm2 start ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'car-api',
      script: '/bin/bash',
      args: ['-lc', 'cd /home/sw/dev_root/car/apps/api && exec pnpm run start:dev'],
      interpreter: 'none',
      autorestart: true,
      max_restarts: 20,
      env: { NODE_ENV: 'development' },
      out_file: '/home/sw/.pm2/logs/car-api-out.log',
      error_file: '/home/sw/.pm2/logs/car-api-err.log',
    },
    {
      name: 'car-web',
      script: '/bin/bash',
      // vite dev：仅监听本机回环，由 nginx 反代对外；--host 127.0.0.1 提升安全
      args: ['-lc', 'cd /home/sw/dev_root/car/apps/web && exec pnpm run dev -- --host 127.0.0.1 --port 5173'],
      interpreter: 'none',
      autorestart: true,
      max_restarts: 20,
      env: { NODE_ENV: 'development' },
      out_file: '/home/sw/.pm2/logs/car-web-out.log',
      error_file: '/home/sw/.pm2/logs/car-web-err.log',
    },
  ],
};
