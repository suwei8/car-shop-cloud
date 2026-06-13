import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: () => import('../views/Login.vue'),
      meta: { public: true },
    },
    {
      path: '/register',
      name: 'Register',
      component: () => import('../views/Register.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      component: () => import('../layouts/MainLayout.vue'),
      redirect: '/dashboard',
      children: [
        // 商户后台
        {
          path: 'dashboard',
          name: 'Dashboard',
          component: () => import('../views/Dashboard.vue'),
          meta: { title: '工作台' },
        },
        {
          path: 'shops',
          name: 'Shops',
          component: () => import('../views/shops/ShopList.vue'),
          meta: { title: '门店管理', permission: 'tenant:shop:view' },
        },
        {
          path: 'users',
          name: 'Users',
          component: () => import('../views/users/UserList.vue'),
          meta: { title: '员工管理', permission: 'tenant:user:view' },
        },
        {
          path: 'roles',
          name: 'Roles',
          component: () => import('../views/roles/RoleList.vue'),
          meta: { title: '角色权限', permission: 'tenant:role:view' },
        },
        {
          path: 'customers',
          name: 'Customers',
          component: () => import('../views/customers/CustomerList.vue'),
          meta: { title: '客户档案', permission: 'tenant:customer:view' },
        },
        {
          path: 'vehicles',
          name: 'Vehicles',
          component: () => import('../views/vehicles/VehicleList.vue'),
          meta: { title: '车辆档案', permission: 'tenant:vehicle:view' },
        },
        {
          path: 'work-orders',
          name: 'WorkOrders',
          component: () => import('../views/work-orders/WorkOrderList.vue'),
          meta: { title: '工单管理', permission: 'tenant:workorder:view' },
        },
        {
          path: 'work-orders/create',
          name: 'WorkOrderCreate',
          component: () => import('../views/work-orders/WorkOrderCreate.vue'),
          meta: { title: '接车开单', permission: 'tenant:workorder:create' },
        },
        {
          path: 'work-orders/:id',
          name: 'WorkOrderDetail',
          component: () => import('../views/work-orders/WorkOrderDetail.vue'),
          meta: { title: '工单详情', permission: 'tenant:workorder:view' },
        },
        {
          path: 'dispatch',
          name: 'Dispatch',
          component: () => import('../views/dispatch/DispatchList.vue'),
          meta: { title: '派工管理', permission: 'tenant:workorder:view' },
        },
        {
          path: 'inventory',
          name: 'Inventory',
          component: () => import('../views/inventory/PartList.vue'),
          meta: { title: '配件管理', permission: 'tenant:inventory:view' },
        },
        {
          path: 'suppliers',
          name: 'Suppliers',
          component: () => import('../views/inventory/SupplierList.vue'),
          meta: { title: '供货商管理', permission: 'tenant:inventory:view' },
        },
        {
          path: 'settlements',
          name: 'Settlements',
          component: () => import('../views/settlement/SettlementList.vue'),
          meta: { title: '收款记录', permission: 'tenant:settlement:view' },
        },
        {
          path: 'stored-value-cards',
          name: 'StoredValueCards',
          component: () => import('../views/member/StoredValueCardList.vue'),
          meta: { title: '储值卡管理', permission: 'tenant:member:view' },
        },
        {
          path: 'reports/daily',
          name: 'DailyReport',
          component: () => import('../views/reports/DailyReport.vue'),
          meta: { title: '营业日报', permission: 'tenant:report:view' },
        },
        {
          path: 'reports/technician',
          name: 'TechnicianReport',
          component: () => import('../views/reports/TechnicianReport.vue'),
          meta: { title: '技师产值', permission: 'tenant:report:view' },
        },
        {
          path: 'reminders',
          name: 'Reminders',
          component: () => import('../views/reminders/ReminderList.vue'),
          meta: { title: '经营提醒', permission: 'tenant:workorder:view' },
        },
        {
          path: 'system/data-import',
          name: 'DataImport',
          component: () => import('../views/system/DataImport.vue'),
          meta: { title: '数据导入', permission: 'tenant:customer:create' },
        },
        // 平台后台
        {
          path: 'platform/tenants',
          name: 'PlatformTenants',
          component: () => import('../views/platform/TenantList.vue'),
          meta: { title: '商户管理', permission: 'platform:tenant:view' },
        },
        {
          path: 'platform/plans',
          name: 'PlatformPlans',
          component: () => import('../views/platform/PlanList.vue'),
          meta: { title: '套餐管理', permission: 'platform:plan:view' },
        },
      ],
    },
  ],
});

router.beforeEach(async (to, _from, next) => {
  const auth = useAuthStore();

  if (to.meta.public) {
    next();
    return;
  }

  if (!auth.isLoggedIn) {
    next('/login');
    return;
  }

  // 有 token 但没有用户信息时，从后端恢复
  if (!auth.user) {
    await auth.fetchUser();
    if (!auth.user) {
      next('/login');
      return;
    }
  }

  if (to.meta.permission && !auth.hasPermission(to.meta.permission as string)) {
    next('/dashboard');
    return;
  }

  next();
});

export default router;
