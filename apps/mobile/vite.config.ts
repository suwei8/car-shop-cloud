import { defineConfig } from 'vite';
import uni from '@dcloudio/vite-plugin-uni';

export default defineConfig({
  plugins: [uni()],
  server: {
    host: '0.0.0.0',
    port: 5174,
    allowedHosts: ['car-admin.555606.xyz', 'car-api.555606.xyz'],
    proxy: {
      '/api': {
        target: 'https://car-api.555606.xyz',
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
