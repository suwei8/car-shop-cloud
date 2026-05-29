<template>
  <el-container style="height: 100vh">
    <el-aside :width="isCollapsed ? '64px' : '220px'" style="transition: width 0.3s">
      <div class="logo" :class="{ collapsed: isCollapsed }">
        <span v-if="!isCollapsed">车店云管家</span>
        <span v-else>车</span>
      </div>
      <el-menu
        :default-active="route.path"
        :collapse="isCollapsed"
        router
        background-color="#304156"
        text-color="#bfcbd9"
        active-text-color="#409eff"
      >
        <!-- 平台菜单 -->
        <template v-if="auth.isPlatform">
          <el-menu-item index="/platform/tenants">
            <el-icon><OfficeBuilding /></el-icon>
            <template #title>商户管理</template>
          </el-menu-item>
          <el-menu-item index="/platform/plans">
            <el-icon><PriceTag /></el-icon>
            <template #title>套餐管理</template>
          </el-menu-item>
        </template>

        <!-- 商户菜单 -->
        <template v-else>
          <el-menu-item index="/dashboard">
            <el-icon><Odometer /></el-icon>
            <template #title>工作台</template>
          </el-menu-item>
          <el-menu-item index="/customers" v-if="auth.hasPermission('tenant:customer:view')">
            <el-icon><User /></el-icon>
            <template #title>客户档案</template>
          </el-menu-item>
          <el-menu-item index="/vehicles" v-if="auth.hasPermission('tenant:vehicle:view')">
            <el-icon><Van /></el-icon>
            <template #title>车辆档案</template>
          </el-menu-item>
          <el-menu-item index="/work-orders" v-if="auth.hasPermission('tenant:workorder:view')">
            <el-icon><Document /></el-icon>
            <template #title>工单管理</template>
          </el-menu-item>
          <el-menu-item index="/dispatch" v-if="auth.hasPermission('tenant:workorder:view')">
            <el-icon><List /></el-icon>
            <template #title>派工管理</template>
          </el-menu-item>
          <el-menu-item index="/inventory" v-if="auth.hasPermission('tenant:inventory:view')">
            <el-icon><Box /></el-icon>
            <template #title>配件管理</template>
          </el-menu-item>
          <el-menu-item index="/suppliers" v-if="auth.hasPermission('tenant:inventory:view')">
            <el-icon><Van /></el-icon>
            <template #title>供货商管理</template>
          </el-menu-item>
          <el-menu-item index="/settlements" v-if="auth.hasPermission('tenant:settlement:view')">
            <el-icon><Money /></el-icon>
            <template #title>收款记录</template>
          </el-menu-item>
          <el-menu-item index="/stored-value-cards" v-if="auth.hasPermission('tenant:member:view')">
            <el-icon><CreditCard /></el-icon>
            <template #title>储值卡管理</template>
          </el-menu-item>
          <el-menu-item index="/reports/daily" v-if="auth.hasPermission('tenant:report:view')">
            <el-icon><DataAnalysis /></el-icon>
            <template #title>营业日报</template>
          </el-menu-item>
          <el-menu-item index="/reports/technician" v-if="auth.hasPermission('tenant:report:view')">
            <el-icon><TrendCharts /></el-icon>
            <template #title>技师产值</template>
          </el-menu-item>
          <el-menu-item index="/shops" v-if="auth.hasPermission('tenant:shop:view')">
            <el-icon><OfficeBuilding /></el-icon>
            <template #title>门店管理</template>
          </el-menu-item>
          <el-menu-item index="/users" v-if="auth.hasPermission('tenant:user:view')">
            <el-icon><User /></el-icon>
            <template #title>员工管理</template>
          </el-menu-item>
          <el-menu-item index="/roles" v-if="auth.hasPermission('tenant:role:view')">
            <el-icon><Key /></el-icon>
            <template #title>角色权限</template>
          </el-menu-item>
        </template>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #eee">
        <el-icon style="cursor: pointer; font-size: 20px" @click="isCollapsed = !isCollapsed">
          <Fold v-if="!isCollapsed" />
          <Expand v-else />
        </el-icon>
        <el-dropdown @command="handleCommand">
          <span style="cursor: pointer; display: flex; align-items: center; gap: 8px">
            <el-avatar :size="32">{{ auth.user?.name?.[0] || 'U' }}</el-avatar>
            <span>{{ auth.user?.name || '用户' }}</span>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="logout">退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </el-header>

      <el-main>
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const isCollapsed = ref(false);

async function handleCommand(cmd: string) {
  if (cmd === 'logout') {
    await auth.logout();
    router.push('/login');
  }
}
</script>

<style scoped>
.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 18px;
  font-weight: bold;
  background-color: #263445;
  white-space: nowrap;
  overflow: hidden;
}
.logo.collapsed {
  font-size: 24px;
}
</style>
