<template>
  <view class="page">
    <!-- 1. 顶部店主信息 -->
    <view class="header-section premium-card">
      <view class="avatar-box">
        <text class="avatar">{{ userAvatar }}</text>
      </view>
      <view class="user-info">
        <text class="name font-bold">{{ userInfo.name || '未登录' }}</text>
        <text class="phone">{{ userInfo.phone || '' }}</text>
      </view>
    </view>

    <!-- 2. 店铺基本信息 -->
    <view class="section premium-card">
      <view class="section-title">
        <text class="prefix">🏪</text>
        <text>店铺基本信息</text>
      </view>
      <view class="info-row">
        <text class="label">当前所属店铺</text>
        <text class="value">{{ shop?.name || '未分配店铺' }}</text>
      </view>
      <view class="info-row" v-if="shop?.phone">
        <text class="label">门店电话</text>
        <text class="value text-primary font-bold" @tap="callShop">{{ shop.phone }}</text>
      </view>
      <view class="info-row" v-if="shop?.address">
        <text class="label">店铺地址</text>
        <text class="value">{{ shop.address }}</text>
      </view>
    </view>

    <!-- 3. 套餐与试用续费看板 -->
    <view class="section premium-card subscription-section">
      <view class="section-title-between">
        <view class="sec-title-left">
          <text class="prefix">💎</text>
          <text>套餐版本与试用状态</text>
        </view>
        <button class="renew-btn font-bold pulse-glow" @tap="openRenewModal">立即续费</button>
      </view>
      
      <view class="sub-status-box" v-if="subscription">
        <view class="sub-row">
          <text class="sub-label">系统版本：</text>
          <text class="sub-val font-bold text-warning">{{ subscription.planName || '试用版' }}</text>
        </view>
        <view class="sub-row">
          <text class="sub-label">有效期至：</text>
          <text class="sub-val">{{ subscription.endAt ? new Date(subscription.endAt).toLocaleDateString() : '长期有效' }}</text>
        </view>
        <view class="sub-row">
          <text class="sub-label">剩余时长：</text>
          <text class="sub-val font-bold" :class="subscription.daysRemaining <= 15 ? 'text-danger' : 'text-success'">
            {{ subscription.daysRemaining }} 天
          </text>
        </view>
      </view>
      <!-- ⚠️ 试用到期前7天提示续费 -->
      <view class="expiry-warning-bar" v-if="subscription && subscription.status === 'trial' && subscription.daysRemaining <= 7">
        <text class="warning-text">⚠️ 您的免费试用期还有 {{ subscription.daysRemaining }} 天即将到期，为避免业务受影响，请尽快进行续费！</text>
      </view>
      <view class="sub-status-box text-center" v-else-if="!subscription">
        <text class="sub-val text-gray">未获取到当前套餐状态</text>
      </view>
    </view>

    <!-- 4. 员工与团队管理 (按需加人) -->
    <view class="section premium-card">
      <view class="section-title">
        <text class="prefix">👥</text>
        <text>员工与团队管理</text>
      </view>
      <view class="menu-item" @tap="openStaffModal">
        <view class="menu-left">
          <text class="menu-icon">➕</text>
          <text class="menu-label font-bold">新增员工 / 邀请技师前台</text>
        </view>
        <text class="menu-arrow">▶</text>
      </view>
    </view>

    <!-- 5. 电脑版 Web 后台引导 -->
    <view class="section premium-card pc-guide-card">
      <view class="section-title">
        <text class="prefix">💻</text>
        <text>电脑版 Web 后台引导</text>
      </view>
      <view class="pc-guide-body">
        <text class="pc-tip">💡 为获得更完整的管理体验，您可以使用电脑浏览器访问车店云管家后台：</text>
        <text class="pc-url font-bold">https://car.13982.com</text>
        <text class="pc-features">电脑端支持的高级重度操作：</text>
        <view class="features-list">
          <text class="feat-item">● 配件及客户信息批量导入导出</text>
          <text class="feat-item">● 专业级财务核算与多维度经营分析报表</text>
          <text class="feat-item">● 接车单、结算收据的连接小票机/A4打印</text>
          <text class="feat-item">● 仓库盘点、供应商结算与高级权限配置</text>
        </view>
      </view>
    </view>

    <!-- 6. 系统工具设置 -->
    <view class="section premium-card">
      <view class="section-title">
        <text class="prefix">⚙️</text>
        <text>系统设置与工具</text>
      </view>

      <view class="menu-item" @tap="goToPage('notifications')">
        <view class="menu-left">
          <text class="menu-icon">🔔</text>
          <text class="menu-label">消息通知</text>
        </view>
        <text class="menu-arrow">▶</text>
      </view>

      <view class="menu-item" @tap="clearCache">
        <view class="menu-left">
          <text class="menu-icon">🗑️</text>
          <text class="menu-label">清除缓存</text>
        </view>
        <text class="menu-arrow">▶</text>
      </view>

      <view class="menu-item" @tap="showAbout">
        <view class="menu-left">
          <text class="menu-icon">ℹ️</text>
          <text class="menu-label">关于车店云管家</text>
        </view>
        <text class="menu-arrow">▶</text>
      </view>
    </view>

    <!-- 退出登录 -->
    <view class="btn-section">
      <button class="logout-btn font-bold" @tap="handleLogout">退出登录</button>
    </view>

    <!-- 💎 续费弹窗 -->
    <view class="modal-mask" v-if="showRenewModal" @tap.self="showRenewModal = false">
      <view class="modal-content premium-card">
        <view class="modal-header">
          <text class="modal-title font-bold">选择续费套餐 (按年)</text>
          <text class="modal-close" @tap="showRenewModal = false">×</text>
        </view>
        <view class="modal-body">
          <view class="plan-options-list">
            <view :class="['plan-opt-card', selectedPlanId === p.id ? 'active' : '']" v-for="p in plans" :key="p.id" @tap="selectedPlanId = p.id">
              <view class="plan-info">
                <text class="p-name font-bold">{{ p.name }}</text>
                <text class="p-desc">{{ p.description }}</text>
              </view>
              <view class="plan-price font-bold">
                ¥{{ p.priceYearly }}/年
              </view>
            </view>
          </view>
          
          <button class="btn btn-primary font-bold" style="width:100%;margin-top:20rpx;" :loading="renewLoading" @tap="submitRenew">
            微信安全支付续费
          </button>
        </view>
      </view>
    </view>

    <!-- 👥 员工邀请/手动添加弹窗 -->
    <view class="modal-mask" v-if="showStaffModal" @tap.self="showStaffModal = false">
      <view class="modal-content large premium-card">
        <view class="modal-header">
          <text class="modal-title font-bold">新增/邀请员工</text>
          <text class="modal-close" @tap="showStaffModal = false">×</text>
        </view>
        
        <!-- 分段控制 -->
        <view class="segmented-control">
          <view :class="['segment-item', staffTab === 'qr' ? 'active' : '']" @tap="staffTab = 'qr'">邀请二维码</view>
          <view :class="['segment-item', staffTab === 'manual' ? 'active' : '']" @tap="staffTab = 'manual'">手动添加员工</view>
        </view>

        <view class="modal-body compact">
          <!-- 1. 二维码邀请 -->
          <view class="qr-invite-box" v-if="staffTab === 'qr'">
            <view class="mock-qr-code">
              <!-- Inline styled beautiful SVG representing QR Code -->
              <svg viewBox="0 0 100 100" width="120" height="120">
                <rect x="0" y="0" width="100" height="100" fill="#ffffff" />
                <rect x="10" y="10" width="25" height="25" fill="#121214" />
                <rect x="15" y="15" width="15" height="15" fill="#ffffff" />
                <rect x="18" y="18" width="9" height="9" fill="#121214" />
                
                <rect x="65" y="10" width="25" height="25" fill="#121214" />
                <rect x="70" y="15" width="15" height="15" fill="#ffffff" />
                <rect x="73" y="18" width="9" height="9" fill="#121214" />
                
                <rect x="10" y="65" width="25" height="25" fill="#121214" />
                <rect x="15" y="70" width="15" height="15" fill="#ffffff" />
                <rect x="18" y="73" width="9" height="9" fill="#121214" />
                
                <!-- Random dots for mock qr look -->
                <rect x="40" y="15" width="5" height="10" fill="#121214" />
                <rect x="50" y="10" width="10" height="5" fill="#121214" />
                <rect x="45" y="30" width="15" height="5" fill="#121214" />
                <rect x="40" y="45" width="10" height="15" fill="#121214" />
                <rect x="15" y="45" width="5" height="10" fill="#121214" />
                <rect x="30" y="55" width="5" height="5" fill="#121214" />
                <rect x="75" y="45" width="10" height="10" fill="#121214" />
                <rect x="65" y="60" width="5" height="15" fill="#121214" />
                <rect x="75" y="75" width="15" height="10" fill="#121214" />
                <rect x="50" y="75" width="15" height="5" fill="#121214" />
              </svg>
            </view>
            <text class="qr-tip">请让新员工使用手机微信扫描此二维码</text>
            <view class="invite-code-card">
              <text class="invite-code-label">门店专属验证码</text>
              <text class="invite-code font-bold">8 8 9 9</text>
            </view>
          </view>

          <!-- 2. 手动创建 -->
          <view class="manual-add-box" v-if="staffTab === 'manual'">
            <view class="form-item">
              <text class="form-label">员工姓名 *</text>
              <input class="form-input" v-model="staffForm.name" type="text" placeholder="例如：前台李小姐" />
            </view>
            <view class="form-item">
              <text class="form-label">手机号码 *</text>
              <input class="form-input" v-model="staffForm.phone" type="number" placeholder="请输入11位手机号" maxlength="11" />
            </view>
            <view class="form-item">
              <text class="form-label">登录密码 *</text>
              <input class="form-input" v-model="staffForm.password" type="text" placeholder="请输入员工初始登录密码" />
            </view>
            <view class="form-item">
              <text class="form-label">系统角色 *</text>
              <radio-group class="form-radio-group" @change="onRoleTypeChange">
                <label class="radio-label">
                  <radio value="employee" checked color="#3b82f6" /> 员工 (技师前台)
                </label>
                <label class="radio-label">
                  <radio value="boss" color="#3b82f6" /> 老板 (联席管理员)
                </label>
              </radio-group>
            </view>
            
            <button class="btn btn-primary font-bold" style="width:100%;margin-top:30rpx;" :loading="staffLoading" @tap="submitAddStaff">
              确认添加此员工
            </button>
          </view>
        </view>
      </view>
    </view>

    <!-- 关于我们弹窗 -->
    <view class="about-modal" v-if="showAboutModal" @tap.self="showAboutModal = false">
      <view class="modal-content premium-card">
        <view class="modal-header">
          <text class="modal-title font-bold">关于车店云管家</text>
          <text class="modal-close" @tap="showAboutModal = false">×</text>
        </view>
        <view class="modal-body">
          <text class="version">版本 0.1.0 (商户端)</text>
          <text class="copyright">© 2026 车店云管家</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { request } from '../../utils/request';
import { useAuthStore } from '../../stores/auth';

const auth = useAuthStore();
const userInfo = ref<any>({});
const shop = ref<any>(null);
const subscription = ref<any>(null);
const showAboutModal = ref(false);
const simpleMode = ref(false);

function isMockPaymentEnabled(): boolean {
  return process.env.NODE_ENV !== 'production';
}

// 续费与套餐 state
const showRenewModal = ref(false);
const plans = ref<any[]>([]);
const selectedPlanId = ref('');
const renewLoading = ref(false);

// 员工邀请管理 state
const showStaffModal = ref(false);
const staffTab = ref<'qr' | 'manual'>('qr');
const staffForm = ref({
  name: '',
  phone: '',
  password: '',
  roleType: 'employee'
});
const roles = ref<any[]>([]);
const staffLoading = ref(false);

const userAvatar = computed(() => {
  const name = userInfo.value?.name || '';
  return name.length > 0 ? name.substring(0, 1) : '👤';
});

function callShop() {
  if (shop.value?.phone) {
    uni.makePhoneCall({ phoneNumber: shop.value.phone });
  }
}

function goToPage(page: string) {
  if (page === 'notifications') {
    uni.navigateTo({ url: '/pages/notifications/notifications' });
  }
}

async function fetchSubscription() {
  try {
    const token = uni.getStorageSync('accessToken');
    const res: any = await request({
      url: '/api/subscription/current',
      method: 'GET',
      header: { Authorization: `Bearer ${token}` }
    });
    if (res.data?.code === 0) {
      subscription.value = res.data.data;
    }
  } catch {}
}

async function openRenewModal() {
  uni.showLoading({ title: '加载套餐中...' });
  try {
    const token = uni.getStorageSync('accessToken');
    const res: any = await request({
      url: '/api/subscription/plans',
      method: 'GET',
      header: { Authorization: `Bearer ${token}` }
    });
    if (res.data?.code === 0 && Array.isArray(res.data.data)) {
      plans.value = res.data.data;
      if (plans.value.length > 0) {
        selectedPlanId.value = plans.value[0].id;
      }
      showRenewModal.value = true;
    }
  } catch (err) {
    uni.showToast({ title: '获取套餐失败，请重试', icon: 'none' });
  } finally {
    uni.hideLoading();
  }
}

async function submitRenew() {
  if (!selectedPlanId.value) return;
  renewLoading.value = true;
  try {
    const token = uni.getStorageSync('accessToken');
    
    // 1. 创建订单 (默认按年买 12 个月)
    const orderRes: any = await request({
      url: '/api/subscription/orders',
      method: 'POST',
      header: { Authorization: `Bearer ${token}` },
      data: { planId: selectedPlanId.value, months: 12, paymentMethod: 'wechat' }
    });
    
    if (orderRes.data?.code === 0 && orderRes.data.data) {
      const order = orderRes.data.data;
      
      // Get WeChat openid (simulated/mocked if in mock environment)
      let openid = 'mock_openid';
      try {
        const loginRes = await new Promise<any>((resolve, reject) => {
          uni.login({
            success: (res) => resolve(res),
            fail: (err) => reject(err),
          });
        });
        if (loginRes.code) {
          openid = 'mock_openid_' + loginRes.code;
        }
      } catch (err) {
        // Ignore or use mock
      }

      // 2. 发起支付
      const payRes: any = await request({
        url: `/api/subscription/orders/${order.id}/pay`,
        method: 'POST',
        header: { Authorization: `Bearer ${token}` },
        data: { paymentMethod: 'wechat', openid }
      });
      
      if (payRes.data?.code === 0 && payRes.data.data) {
        const payData = payRes.data.data;
        
        // 3. 调起支付
        if (payData.jsapiParams) {
          // WeChat Mini Program payment invocation
          uni.requestPayment({
            provider: 'wxpay',
            timeStamp: payData.jsapiParams.timeStamp,
            nonceStr: payData.jsapiParams.nonceStr,
            package: payData.jsapiParams.package,
            signType: payData.jsapiParams.signType,
            paySign: payData.jsapiParams.paySign,
            success: async () => {
              uni.showToast({ title: '微信支付成功', icon: 'success' });
              showRenewModal.value = false;
              await fetchSubscription();
            },
            fail: async (err) => {
              console.warn('微信支付失败或取消', err);
              if (isMockPaymentEnabled() && payData.jsapiParams.appId === 'mock_appid') {
                uni.showLoading({ title: '模拟支付回调中...' });
                try {
                  const amtCents = Math.round(Number(order.amount) * 100);
                  const cbRes: any = await request({
                    url: '/api/payment-callbacks/wechat',
                    method: 'POST',
                    data: {
                      outTradeNo: order.orderNo,
                      amount: amtCents
                    }
                  });
                  if (cbRes.statusCode === 200 || cbRes.data?.code === 'SUCCESS') {
                    uni.showToast({ title: '模拟支付成功', icon: 'success' });
                    showRenewModal.value = false;
                    await fetchSubscription();
                  } else {
                    uni.showToast({ title: '模拟回调失败', icon: 'none' });
                  }
                } catch (cbErr) {
                  uni.showToast({ title: '模拟支付异常', icon: 'none' });
                } finally {
                  uni.hideLoading();
                }
              } else {
                uni.showToast({ title: '支付未完成', icon: 'none' });
              }
            }
          });
        } else {
          uni.showToast({ title: '套餐已下单，请在电脑端完成支付', icon: 'none' });
        }
      } else {
        uni.showToast({ title: payRes.data?.message || '支付失败', icon: 'none' });
      }
    } else {
      uni.showToast({ title: orderRes.data?.message || '创建订单失败', icon: 'none' });
    }
  } catch (e: any) {
    uni.showToast({ title: e.message || '续费操作失败', icon: 'none' });
  } finally {
    renewLoading.value = false;
  }
}

async function openStaffModal() {
  staffTab.value = 'qr';
  staffForm.value = { name: '', phone: '', password: '', roleType: 'employee' };
  showStaffModal.value = true;
  
  if (roles.value.length === 0) {
    try {
      const token = uni.getStorageSync('accessToken');
      const res: any = await request({
        url: '/api/roles',
        method: 'GET',
        header: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.code === 0 && Array.isArray(res.data.data)) {
        roles.value = res.data.data;
      }
    } catch {}
  }
}

function onRoleTypeChange(e: any) {
  staffForm.value.roleType = e.detail.value;
}

async function submitAddStaff() {
  if (!staffForm.value.name.trim()) {
    uni.showToast({ title: '请输入员工姓名', icon: 'none' });
    return;
  }
  if (!staffForm.value.phone.trim() || staffForm.value.phone.length !== 11) {
    uni.showToast({ title: '请输入有效的11位手机号', icon: 'none' });
    return;
  }
  if (!staffForm.value.password.trim() || staffForm.value.password.length < 6) {
    uni.showToast({ title: '密码不能少于6位', icon: 'none' });
    return;
  }

  // 匹配角色: 老板为 tenant_admin, 员工默认为技师 technician
  const targetCode = staffForm.value.roleType === 'boss' ? 'tenant_admin' : 'technician';
  const role = roles.value.find(r => r.code === targetCode) || roles.value[0];
  if (!role) {
    uni.showToast({ title: '未找到匹配的系统角色，请重试', icon: 'none' });
    return;
  }

  staffLoading.value = true;
  try {
    const token = uni.getStorageSync('accessToken');
    const res: any = await request({
      url: '/api/users',
      method: 'POST',
      header: { Authorization: `Bearer ${token}` },
      data: {
        name: staffForm.value.name.trim(),
        phone: staffForm.value.phone.trim(),
        password: staffForm.value.password.trim(),
        shopId: userInfo.value.shopId,
        roleIds: [role.id]
      }
    });

    if (res.data?.code === 0) {
      uni.showToast({ title: '添加员工成功', icon: 'success' });
      showStaffModal.value = false;
    } else {
      uni.showToast({ title: res.data?.message || '添加员工失败', icon: 'none' });
    }
  } catch (err: any) {
    uni.showToast({ title: err.message || '操作异常', icon: 'none' });
  } finally {
    staffLoading.value = false;
  }
}

function clearCache() {
  uni.showModal({
    title: '提示',
    content: '确定清除本地缓存数据？',
    success: (res) => {
      if (res.confirm) {
        uni.clearStorageSync();
        uni.showToast({ title: '缓存已清除', icon: 'success' });
      }
    }
  });
}

function showAbout() {
  showAboutModal.value = true;
}

function handleLogout() {
  uni.showModal({
    title: '退出登录',
    content: '确定要退出当前账号吗？',
    success: (res) => {
      if (res.confirm) {
        const authStore = useAuthStore();
        authStore.logout();
      }
    }
  });
}

onMounted(async () => {
  const info = uni.getStorageSync('userInfo');
  if (info) {
    userInfo.value = typeof info === 'string' ? JSON.parse(info) : info;
  }
  
  // 自动从后端拉取最新用户信息以同步最新的 shopId 并更新本地存储
  try {
    const token = uni.getStorageSync('accessToken');
    const meRes: any = await request({
      url: '/api/auth/me',
      method: 'POST',
      header: { Authorization: `Bearer ${token}` }
    });
    if (meRes.data?.code === 0 && meRes.data.data) {
      const latestUser = meRes.data.data;
      userInfo.value = { ...userInfo.value, ...latestUser };
      uni.setStorageSync('userInfo', userInfo.value);
    }
  } catch (err) {}

  if (userInfo.value.shopId) {
    try {
      const token = uni.getStorageSync('accessToken');
      const shopRes: any = await request({
        url: `/api/shops/${userInfo.value.shopId}`,
        method: 'GET',
        header: { Authorization: `Bearer ${token}` }
      });
      if (shopRes.data?.code === 0) {
        shop.value = shopRes.data.data;
      }
    } catch (err) {}
  }
  
  await fetchSubscription();
  simpleMode.value = auth.simpleMode;
});
</script>

<style scoped>
.page {
  padding: 20rpx 20rpx 120rpx 20rpx;
  background: #121214;
  min-height: 100vh;
  color: #e0e0e6;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

.premium-card {
  background: #1c1c1e;
  border-radius: 20rpx;
  padding: 30rpx;
  margin-bottom: 24rpx;
  border: 1rpx solid #2c2c2e;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.15);
}

.header-section {
  display: flex;
  align-items: center;
  gap: 24rpx;
}

.avatar-box {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar {
  font-size: 48rpx;
  color: #fff;
  font-weight: bold;
}

.user-info {
  flex: 1;
}

.name {
  font-size: 36rpx;
  color: #ffffff;
  display: block;
  margin-bottom: 10rpx;
}

.phone {
  font-size: 26rpx;
  color: #a1a1a9;
}

.section-title {
  font-size: 30rpx;
  font-weight: bold;
  margin-bottom: 24rpx;
  color: #ffffff;
  display: flex;
  align-items: center;
}
.section-title-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
}
.sec-title-left {
  font-size: 30rpx;
  font-weight: bold;
  color: #ffffff;
  display: flex;
  align-items: center;
}

.prefix {
  margin-right: 12rpx;
  font-size: 32rpx;
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 18rpx 0;
  border-bottom: 1rpx solid #2c2c2e;
  font-size: 26rpx;
}
.info-row:last-child {
  border-bottom: none;
}

.label {
  color: #a1a1a9;
}

.value {
  color: #ffffff;
  font-weight: bold;
}

.text-primary {
  color: #3b82f6;
}

.menu-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 0;
  border-bottom: 1rpx solid #2c2c2e;
}
.menu-item:last-child {
  border-bottom: none;
}
.menu-left {
  display: flex;
  align-items: center;
  gap: 16rpx;
}
.menu-icon {
  font-size: 28rpx;
}
.menu-label {
  font-size: 26rpx;
  color: #ffffff;
}
.menu-arrow {
  font-size: 24rpx;
  color: #8e8e93;
}

/* 订阅套餐区块 */
.subscription-section {
  background: linear-gradient(135deg, rgba(251,191,36,0.08) 0%, rgba(251,191,36,0.02) 100%);
  border-color: rgba(251,191,36,0.3);
}
.renew-btn {
  height: 58rpx;
  line-height: 58rpx;
  background: linear-gradient(135deg, #fbbf24 0%, #d97706 100%);
  color: #121214;
  font-size: 22rpx;
  border-radius: 29rpx;
  border: none;
  padding: 0 24rpx;
  box-shadow: 0 4rpx 10rpx rgba(251, 191, 36, 0.25);
  margin: 0;
}
.sub-status-box {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  background: rgba(0,0,0,0.2);
  padding: 20rpx;
  border-radius: 12rpx;
  border: 1rpx solid rgba(255,255,255,0.02);
}
.expiry-warning-bar {
  margin-top: 16rpx;
  background: rgba(244, 63, 94, 0.12);
  border: 1rpx solid rgba(244, 63, 94, 0.25);
  padding: 16rpx 20rpx;
  border-radius: 12rpx;
}
.warning-text {
  font-size: 22rpx;
  color: #f43f5e;
  line-height: 1.4;
}
.sub-row {
  display: flex;
  font-size: 24rpx;
}
.sub-label {
  color: #8e8e93;
  width: 150rpx;
}
.sub-val {
  color: #ffffff;
}

/* PC后台指南 */
.pc-guide-card {
  background: linear-gradient(135deg, rgba(59,130,246,0.06) 0%, rgba(59,130,246,0.01) 100%);
  border-color: rgba(59,130,246,0.2);
}
.pc-guide-body {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  background: rgba(0,0,0,0.15);
  padding: 20rpx;
  border-radius: 16rpx;
}
.pc-tip {
  font-size: 24rpx;
  color: #e0e0e6;
  line-height: 1.5;
}
.pc-url {
  font-size: 28rpx;
  color: #3b82f6;
  background: #141416;
  padding: 12rpx 20rpx;
  border-radius: 8rpx;
  text-align: center;
  border: 1rpx solid rgba(59,130,246,0.25);
}
.pc-features {
  font-size: 22rpx;
  color: #a1a1a9;
  margin-top: 10rpx;
}
.features-list {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.feat-item {
  font-size: 22rpx;
  color: #8e8e93;
}

.btn-section {
  margin-top: 40rpx;
}
.logout-btn {
  width: 100%;
  height: 84rpx;
  line-height: 84rpx;
  background: linear-gradient(135deg, #f43f5e 0%, #be185d 100%);
  color: #ffffff;
  font-size: 28rpx;
  border-radius: 42rpx;
  border: none;
}

/* 弹窗及公共 */
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.modal-content {
  width: 600rpx;
  border-radius: 24rpx;
}
.modal-content.large {
  width: 660rpx;
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 20rpx;
  border-bottom: 1rpx solid #2c2c2e;
  margin-bottom: 20rpx;
}
.modal-title {
  font-size: 30rpx;
  color: #ffffff;
}
.modal-close {
  font-size: 38rpx;
  color: #a1a1a9;
  padding: 0 10rpx;
  line-height: 1;
}
.modal-body {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}
.modal-body.compact {
  gap: 10rpx;
}

/* 套餐列表 */
.plan-options-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  max-height: 500rpx;
  overflow-y: auto;
}
.plan-opt-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #141416;
  border: 1rpx solid #2c2c2e;
  border-radius: 12rpx;
  padding: 20rpx;
}
.plan-opt-card.active {
  border-color: #fbbf24;
  background: rgba(251,191,36,0.05);
}
.plan-info {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  flex: 1;
  margin-right: 16rpx;
}
.p-name {
  font-size: 26rpx;
  color: #ffffff;
}
.p-desc {
  font-size: 20rpx;
  color: #8e8e93;
}
.plan-price {
  font-size: 26rpx;
  color: #fbbf24;
}

.btn {
  height: 78rpx;
  line-height: 78rpx;
  text-align: center;
  font-size: 26rpx;
  border-radius: 39rpx;
  border: none;
}
.btn-primary {
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  color: #ffffff;
}

/* 员工管理 */
.segmented-control {
  display: flex;
  background: #141416;
  border-radius: 12rpx;
  padding: 4rpx;
  margin-bottom: 20rpx;
  border: 1rpx solid #2c2c2e;
}
.segment-item {
  flex: 1;
  text-align: center;
  font-size: 24rpx;
  color: #a1a1a9;
  padding: 10rpx 0;
  border-radius: 8rpx;
  font-weight: bold;
}
.segment-item.active {
  background: #3b82f6;
  color: #ffffff;
}

.qr-invite-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20rpx 0;
}
.mock-qr-code {
  background: #ffffff;
  padding: 20rpx;
  border-radius: 12rpx;
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.5);
  margin-bottom: 20rpx;
}
.qr-tip {
  font-size: 22rpx;
  color: #8e8e93;
  margin-bottom: 30rpx;
}
.invite-code-card {
  background: #141416;
  border: 1rpx solid #2c2c2e;
  border-radius: 12rpx;
  padding: 16rpx 40rpx;
  text-align: center;
}
.invite-code-label {
  font-size: 20rpx;
  color: #8e8e93;
  display: block;
  margin-bottom: 6rpx;
}
.invite-code {
  font-size: 36rpx;
  color: #fbbf24;
  letter-spacing: 4rpx;
}

.manual-add-box {
  width: 100%;
}
.form-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1rpx solid #2c2c2e;
  padding: 20rpx 0;
}
.form-item:last-child {
  border-bottom: none;
}
.form-label {
  font-size: 24rpx;
  color: #a1a1a9;
  width: 150rpx;
}
.form-input {
  flex: 1;
  font-size: 24rpx;
  color: #ffffff;
  text-align: right;
}
.form-radio-group {
  display: flex;
  gap: 20rpx;
}
.radio-label {
  font-size: 22rpx;
  color: #ffffff;
  display: flex;
  align-items: center;
  gap: 6rpx;
}

/* 关于我们弹窗 */
.about-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}
.version {
  font-size: 26rpx;
  color: #8e8e93;
}
.copyright {
  font-size: 22rpx;
  color: #767680;
}

.text-success { color: #10b981; }
.text-danger { color: #f43f5e; }
.text-warning { color: #fbbf24; }
.text-gray { color: #8e8e93; }
.text-center { text-align: center; }
.font-bold { font-weight: bold; }
</style>