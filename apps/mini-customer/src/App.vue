<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app';
import { useAuthStore } from './stores/auth';

onLaunch(() => {
  const auth = useAuthStore();
  auth.autoLogin();
});
</script>

<style>
page {
  background-color: #f5f5f5;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  color: #333;
}
.card {
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  margin: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}
.card-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
}
</style>
