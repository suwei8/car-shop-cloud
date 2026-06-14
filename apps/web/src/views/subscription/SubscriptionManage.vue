<template>
  <div class="subscription-manage">
    <!-- Current subscription status -->
    <el-card v-if="currentSub" class="status-card" shadow="never">
      <template #header>
        <div style="display: flex; align-items: center; gap: 8px">
          <el-icon><Box /></el-icon>
          <span>当前订阅</span>
        </div>
      </template>
      <el-descriptions :column="2" border size="small">
        <el-descriptions-item label="当前套餐">{{ currentSub.planName }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="currentSub.status === 'active' ? 'success' : 'warning'" size="small">
            {{ currentSub.status === 'active' ? '正常' : currentSub.status }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="有效期至">{{ new Date(currentSub.endAt).toLocaleDateString() }}</el-descriptions-item>
        <el-descriptions-item label="剩余天数">
          <span :style="{ color: currentSub.daysRemaining < 30 ? '#f56c6c' : '#67c23a', fontWeight: 'bold' }">
            {{ currentSub.daysRemaining }} 天
          </span>
        </el-descriptions-item>
        <el-descriptions-item label="门店上限">{{ currentSub.maxShops }}家</el-descriptions-item>
        <el-descriptions-item label="员工上限">{{ currentSub.maxEmployees }}人</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card v-else class="status-card" shadow="never">
      <el-empty description="暂无有效订阅" :image-size="60" />
    </el-card>

    <!-- Plan selection -->
    <el-card class="plan-card-section" shadow="never">
      <template #header>
        <div style="display: flex; align-items: center; gap: 8px">
          <el-icon><ShoppingCart /></el-icon>
          <span>选择套餐</span>
        </div>
      </template>

      <div class="plan-grid">
        <PlanCard
          v-for="plan in plans"
          :key="plan.id"
          :plan="plan"
          :selected="selectedPlanId === plan.id"
          :is-current="currentSub?.planName === plan.name"
          @select="selectedPlanId = plan.id"
        />
      </div>

      <!-- Duration selection -->
      <div v-if="selectedPlanId" class="duration-section">
        <div class="section-label">选择时长</div>
        <el-radio-group v-model="selectedMonths" size="large">
          <el-radio-button :value="1">1个月</el-radio-button>
          <el-radio-button :value="3">3个月 {{ discountLabel(3) }}</el-radio-button>
          <el-radio-button :value="6">6个月 {{ discountLabel(6) }}</el-radio-button>
          <el-radio-button :value="12">12个月 {{ discountLabel(12) }}</el-radio-button>
        </el-radio-group>

        <div v-if="selectedPlan" class="price-summary">
          <div class="summary-row">
            <span>原价：</span>
            <span class="original-price">¥{{ originalAmount.toFixed(2) }}</span>
          </div>
          <div v-if="Number(selectedPlan.discountRate) < 1" class="summary-row">
            <span>折扣：</span>
            <span class="discount-text">{{ (Number(selectedPlan.discountRate) * 10).toFixed(1) }}折</span>
          </div>
          <div class="summary-row total">
            <span>应付：</span>
            <span class="total-price">¥{{ finalAmount.toFixed(2) }}</span>
          </div>
          <div v-if="savings > 0" class="savings">已为您节省 ¥{{ savings.toFixed(2) }}</div>
        </div>

        <!-- Payment method -->
        <div class="payment-section">
          <div class="section-label">支付方式</div>
          <el-radio-group v-model="paymentMethod">
            <el-radio value="wechat">
              <span style="display: inline-flex; align-items: center; gap: 4px">
                <span style="color: #07c160">💚</span> 微信支付
              </span>
            </el-radio>
            <el-radio value="alipay">
              <span style="display: inline-flex; align-items: center; gap: 4px">
                <span style="color: #1677ff">💙</span> 支付宝
              </span>
            </el-radio>
          </el-radio-group>
        </div>

        <el-button
          type="primary"
          size="large"
          :loading="purchasing"
          :disabled="!paymentMethod"
          @click="handlePurchase"
          style="margin-top: 16px"
        >
          立即购买
        </el-button>
      </div>
    </el-card>

    <!-- Order history -->
    <el-card class="history-card" shadow="never">
      <template #header>
        <div style="display: flex; align-items: center; gap: 8px">
          <el-icon><Document /></el-icon>
          <span>购买历史</span>
        </div>
      </template>
      <OrderHistory ref="orderHistoryRef" />
    </el-card>

    <!-- QR Pay Dialog -->
    <QrPayDialog
      v-model="showQrPay"
      :code-url="qrPayData.codeUrl"
      :order-id="qrPayData.orderId"
      :amount="qrPayData.amount"
      :method="qrPayData.method"
      @paid="handlePaySuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Box, ShoppingCart, Document } from '@element-plus/icons-vue';
import api from '../../utils/api';
import PlanCard from './components/PlanCard.vue';
import OrderHistory from './components/OrderHistory.vue';
import QrPayDialog from './components/QrPayDialog.vue';

const plans = ref<any[]>([]);
const currentSub = ref<any>(null);
const selectedPlanId = ref('');
const selectedMonths = ref(6);
const paymentMethod = ref('');
const purchasing = ref(false);
const showQrPay = ref(false);
const qrPayData = ref({ codeUrl: '', orderId: '', amount: 0, method: '' });
const orderHistoryRef = ref();

const selectedPlan = computed(() => {
  const plan = plans.value.find((p) => p.id === selectedPlanId.value);
  if (!plan) return null;

  const discounts = plan.discounts || {};
  const monthsStr = String(selectedMonths.value);
  const discountInfo = discounts[monthsStr] || { rate: 1, price: '0' };

  return {
    ...plan,
    discountRate: discountInfo.rate,
    discountedPrice: Number(discountInfo.price),
  };
});

const originalAmount = computed(() => {
  if (!selectedPlan.value) return 0;
  const monthlyPrice = Number(selectedPlan.value.priceMonthly);
  return monthlyPrice * selectedMonths.value;
});

const finalAmount = computed(() => {
  if (!selectedPlan.value) return 0;
  return selectedPlan.value.discountedPrice;
});

const savings = computed(() => {
  return Math.max(0, originalAmount.value - finalAmount.value);
});

function discountLabel(months: number) {
  const plan = plans.value.find((p) => p.id === selectedPlanId.value);
  if (!plan) return '';
  const discounts = plan.discounts || {};
  const info = discounts[String(months)];
  if (!info || info.rate >= 1) return '';
  return `${(info.rate * 10).toFixed(1)}折`;
}

async function fetchPlans() {
  try {
    const res: any = await api.get('/subscription/plans');
    plans.value = Array.isArray(res) ? res : [];
  } catch {
    // ignore
  }
}

async function fetchCurrentSub() {
  try {
    const res: any = await api.get('/subscription/current');
    currentSub.value = res;
  } catch {
    currentSub.value = null;
  }
}

async function handlePurchase() {
  if (!selectedPlanId.value) {
    ElMessage.warning('请选择套餐');
    return;
  }
  if (!paymentMethod.value) {
    ElMessage.warning('请选择支付方式');
    return;
  }

  purchasing.value = true;
  try {
    // Create order
    const order: any = await api.post('/subscription/orders', {
      planId: selectedPlanId.value,
      months: selectedMonths.value,
      paymentMethod: paymentMethod.value,
    });

    // Pay order
    const payResult: any = await api.post(`/subscription/orders/${order.id}/pay`, {
      paymentMethod: paymentMethod.value,
    });

    // Show QR code
    qrPayData.value = {
      codeUrl: payResult.codeUrl,
      orderId: order.id,
      amount: Number(order.amount),
      method: paymentMethod.value,
    };
    showQrPay.value = true;
  } catch (err: any) {
    ElMessage.error(err.message || '购买失败');
  } finally {
    purchasing.value = false;
  }
}

function handlePaySuccess() {
  ElMessage.success('订阅购买成功！');
  fetchCurrentSub();
  if (orderHistoryRef.value) {
    orderHistoryRef.value.fetchOrders?.();
  }
}

onMounted(() => {
  fetchPlans();
  fetchCurrentSub();
});
</script>

<style scoped>
.subscription-manage {
  max-width: 900px;
}
.status-card {
  margin-bottom: 20px;
}
.plan-card-section {
  margin-bottom: 20px;
}
.plan-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}
.duration-section {
  border-top: 1px solid #ebeef5;
  padding-top: 20px;
}
.section-label {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 12px;
  color: #303133;
}
.price-summary {
  margin-top: 20px;
  padding: 16px;
  background: #f5f7fa;
  border-radius: 8px;
}
.summary-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 14px;
  color: #606266;
}
.summary-row.total {
  font-size: 18px;
  font-weight: 700;
  color: #303133;
  border-top: 1px solid #dcdfe6;
  padding-top: 8px;
  margin-top: 8px;
}
.original-price {
  text-decoration: line-through;
  color: #909399;
}
.discount-text {
  color: #e6a23c;
  font-weight: 600;
}
.total-price {
  color: #f56c6c;
}
.savings {
  text-align: right;
  color: #67c23a;
  font-size: 13px;
  margin-top: 4px;
}
.payment-section {
  margin-top: 20px;
}
.history-card {
  margin-bottom: 20px;
}
</style>
