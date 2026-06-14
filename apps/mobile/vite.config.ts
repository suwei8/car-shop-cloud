import { defineConfig } from 'vite';
import uni from '@dcloudio/vite-plugin-uni';

export default defineConfig({
  plugins: [uni()],
  server: {
    host: '0.0.0.0',
    port: 5174,
    allowedHosts: ['car.13982.com', 'car-api.13982.com'],
    proxy: {
      '/api': {
        target: 'https://car-api.13982.com',
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
