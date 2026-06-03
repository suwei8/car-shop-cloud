<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app';
import { setupAuthGuard, checkLaunchAuth } from './utils/auth-guard';

setupAuthGuard();

onLaunch(() => {
  checkLaunchAuth();
});
</script>

<style>
page {
  background-color: #f5f5f5;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}
</style>
