<template>
  <view class="page" v-if="order">
    <!-- 工单信息 -->
    <view class="section premium-card">
      <view class="section-title">
        <text class="prefix">📋</text>
        <text>工单基本信息</text>
      </view>
      <view class="info-row">
        <text class="label">工单单号</text>
        <text class="value text-primary font-bold">{{ order.orderNo }}</text>
      </view>
      <view class="info-row">
        <text class="label">业务类型</text>
        <text class="value">{{ { repair: '机修', maintenance: '保养', sheet_metal: '钣金', painting: '喷漆', wash: '洗美', rescue: '施救', quick: '快速' }[order.orderType] || order.orderType }}</text>
      </view>
      <view class="info-row">
        <text class="label">工单状态</text>
        <text :class="['status-badge', order.status]">
          {{ statusLabel(order.status) }}
        </text>
      </view>
      <view class="info-row">
        <text class="label">进店时间</text>
        <text class="value">{{ new Date(order.createdAt).toLocaleString() }}</text>
      </view>
      <view class="info-row" v-if="order.expectDate">
        <text class="label">预计交付时间</text>
        <text class="value text-danger font-bold">{{ new Date(order.expectDate).toLocaleString() }}</text>
      </view>
    </view>

    <!-- 📢 移动端派工指派管理 (对标“百易云修”车间派工) -->
    <view class="section premium-card" v-if="!simpleMode && !dispatchTask && ['draft', 'confirmed', 'dispatching'].includes(order.status)">
      <view class="section-title">
        <text class="prefix">📢</text>
        <text>车间派工与技师分配</text>
      </view>

      <view class="form-item border-glow">
        <text class="form-label">主修技师 *</text>
        <picker class="form-picker" @change="onTechnicianChange" :value="techIndex" :range="technicians" range-key="name">
          <view class="picker-value">
            {{ technicians[techIndex]?.name || '选择主修技师' }}
            <text class="arrow">▼</text>
          </view>
        </picker>
      </view>

      <view class="form-item border-glow">
        <text class="form-label">施工工位</text>
        <picker class="form-picker" @change="onWorkPlaceChange" :value="workPlaceIndex" :range="workPlaces">
          <view class="picker-value">
            {{ workPlaces[workPlaceIndex] || '选择施工工位' }}
            <text class="arrow">▼</text>
          </view>
        </picker>
      </view>

      <view class="form-item border-glow">
        <text class="form-label">指派班组</text>
        <picker class="form-picker" @change="onTeamChange" :value="teamIndex" :range="teams">
          <view class="picker-value">
            {{ teams[teamIndex] || '选择指派班组' }}
            <text class="arrow">▼</text>
          </view>
        </picker>
      </view>

      <view class="form-item vertical">
        <text class="form-label-v">派工备注 / 注意事项</text>
        <input class="form-input-inline" v-model="dispatchForm.remark" type="text" placeholder="选填，如客户配合主修或要点" />
      </view>

      <button class="dispatch-submit-btn font-bold pulse-glow" :loading="dispatchingLoading" @tap="submitDispatch">
        确认指派开始施工
      </button>
    </view>

    <!-- 技师派工施工管理 (已指派状态) -->
    <view class="section premium-card" v-if="dispatchTask">
      <view class="section-title">
        <text class="prefix">🔧</text>
        <text>施工流转控制</text>
        <text :class="['status-badge', dispatchTask.status]">
          {{ { pending: '待开工', in_progress: '施工中', paused: '已暂停', completed: '已完工' }[dispatchTask.status] || dispatchTask.status }}
        </text>
      </view>
      
      <view class="info-row" v-if="dispatchTask.workPlace">
        <text class="label">施工工位</text>
        <text class="value font-bold text-primary">📍 {{ dispatchTask.workPlace }}</text>
      </view>
      <view class="info-row" v-if="dispatchTask.team">
        <text class="label">派工班组</text>
        <text class="value">👥 {{ dispatchTask.team }}</text>
      </view>
      <view class="info-row" v-if="dispatchTask.technician">
        <text class="label">主修技师</text>
        <text class="value font-bold">{{ dispatchTask.technician.name }}</text>
      </view>
      <view class="info-row" v-if="dispatchTask.remark">
        <text class="label">派工备注</text>
        <text class="value">{{ dispatchTask.remark }}</text>
      </view>

      <!-- 施工照片列表 -->
      <view class="photo-container">
        <text class="label-v font-bold">施工现场照片 ({{ photos.length }} 张)</text>
        <view class="photo-list">
          <view class="photo-item" v-for="photo in photos" :key="photo.id" @tap="previewImage(photo.url)">
            <image class="photo-img" :src="photo.url" mode="aspectFill" />
          </view>
          <view class="photo-item add-photo" v-if="dispatchTask.status !== 'completed'" @tap="chooseAndUploadPhoto">
            <text class="plus">+</text>
            <text class="add-text">拍摄上传</text>
          </view>
        </view>
      </view>

      <!-- 施工操作按钮 -->
      <view class="btn-group" v-if="dispatchTask.status !== 'completed'">
        <button class="btn btn-primary font-bold pulse-glow" v-if="dispatchTask.status === 'pending'" @tap="startWork">开始施工</button>
        <button class="btn btn-success font-bold" v-if="['in_progress', 'paused'].includes(dispatchTask.status)" @tap="completeWork">确认完工</button>
      </view>
    </view>

    <!-- 客户车辆 -->
    <view class="section premium-card">
      <view class="section-title">
        <text class="prefix">🚗</text>
        <text>客户与车辆信息</text>
      </view>
      <view class="info-row">
        <text class="label">车主客户</text>
        <text class="value font-bold">{{ order.customer?.name }}</text>
      </view>
      <view class="info-row">
        <text class="label">联系电话</text>
        <text class="value text-phone font-bold" @tap="callPhone(order.customer?.phone)">{{ order.customer?.phone }}</text>
      </view>
      <view class="info-row">
        <text class="label">车牌号码</text>
        <text class="value text-primary font-bold">{{ order.vehiclePlateNo }}</text>
      </view>
      <view class="info-row">
        <text class="label">品牌车型</text>
        <text class="value">{{ order.vehicle?.brand }} {{ order.vehicle?.model }}</text>
      </view>
      <view class="info-row" v-if="order.vehicleMileage">
        <text class="label">进店里程</text>
        <text class="value">{{ order.vehicleMileage }} km</text>
      </view>
    </view>

    <!-- 故障描述 / 车检预检说明 -->
    <view class="section premium-card" v-if="order.description">
      <view class="section-title">
        <text class="prefix">📝</text>
        <text>车主诉求与车检情况</text>
      </view>
      <text class="desc">{{ order.description }}</text>
    </view>

    <!-- 服务项目明细 -->
    <view class="section premium-card" v-if="order.items && order.items.length > 0">
      <view class="section-title">
        <text class="prefix">🔧</text>
        <text>服务项目明细</text>
      </view>
      <view class="item" v-for="item in order.items" :key="item.id">
        <view class="item-header">
          <text class="item-name font-bold">{{ item.name }}</text>
          <text class="item-amount font-bold">¥{{ Number(item.amount).toFixed(2) }}</text>
        </view>
        <view class="item-footer">
          <text class="item-type">{{ { service: '工时项目', part: '配件材料', addon: '其它要求' }[item.itemType] || item.itemType }}</text>
          <text class="item-qty">{{ item.quantity }} {{ item.unit || '次' }} × ¥{{ Number(item.unitPrice).toFixed(2) }}</text>
        </view>
      </view>
    </view>

    <!-- 合计结算总金额 -->
    <view class="section premium-card total-row" v-if="order.items && order.items.length > 0">
      <text class="total-label">工单总计金额：</text>
      <text class="total-amount">¥{{ Number(order.totalAmount).toFixed(2) }}</text>
    </view>

    <!-- 结算信息（已结算工单） -->
    <view class="section premium-card" v-if="order.status === 'settled'">
      <view class="section-title">
        <text class="prefix">💰</text>
        <text>收银收付账单</text>
      </view>
      <view class="info-row">
        <text class="label">应付金额</text>
        <text class="value text-danger font-bold">¥{{ Number(order.payableAmount).toFixed(2) }}</text>
      </view>
      <view class="info-row" v-if="Number(order.discountAmount) > 0">
        <text class="label">优惠折让</text>
        <text class="value">¥{{ Number(order.discountAmount).toFixed(2) }}</text>
      </view>
      <view class="info-row">
        <text class="label">结算状态</text>
        <text class="value text-success font-bold">已记账结算收银</text>
      </view>
      <view class="btn-group">
        <button class="btn btn-warning font-bold" @tap="reverseSettle">撤销结算收银(反结算)</button>
      </view>
    </view>

    <!-- 简易模式：一键完工 -->
    <view class="simple-bar-section" v-if="simpleMode && ['dispatching', 'in_progress'].includes(order.status)">
      <button class="btn-quick-complete pulse-glow font-bold" @tap="quickCompleteOrder">一键完工</button>
    </view>

    <!-- 移动端收款结算操作条 -->
    <view class="settle-bar-section" v-if="order.status === 'completed'">
      <button class="btn-settle pulse-glow font-bold" @tap="openSettleModal">收款记账结算</button>
    </view>

    <!-- 结算收银弹窗 -->
    <view class="modal-mask" v-if="showSettleModal" @tap.self="showSettleModal = false">
      <view class="modal-content premium-card">
        <view class="modal-header">
          <text class="modal-title">收款记账收银</text>
          <text class="modal-close" @tap="showSettleModal = false">×</text>
        </view>
        <view class="modal-body">
          <view class="modal-row">
            <text class="m-label">工单总额：</text>
            <text class="m-value text-danger font-bold">¥{{ Number(order.totalAmount).toFixed(2) }}</text>
          </view>
          
          <view class="modal-row form-item">
            <text class="m-label">优惠折扣：</text>
            <input class="m-input" type="digit" v-model="discountAmount" placeholder="0.00" />
          </view>
          
          <view class="modal-row">
            <text class="m-label">应收账款：</text>
            <text class="m-value text-danger font-bold">¥{{ Number(payableAmount).toFixed(2) }}</text>
          </view>
          
          <view class="modal-row form-item">
            <text class="m-label">实收金额：</text>
            <input class="m-input" type="digit" v-model="paidAmountInput" placeholder="0.00" />
          </view>

          <view class="modal-row form-item">
            <text class="m-label">支付通道：</text>
            <radio-group class="radio-group" @change="onPayMethodChange">
              <label class="radio-label"><radio value="cash" checked color="#3b82f6" />系统现金记账</label>
              <label class="radio-label"><radio value="wechat" color="#3b82f6" />微信付款</label>
              <label class="radio-label"><radio value="alipay" color="#3b82f6" />支付宝</label>
              <label class="radio-label" v-if="memberCards.length > 0"><radio value="card" color="#3b82f6" />会员储值划扣</label>
            </radio-group>
          </view>

          <!-- 储值卡选择 -->
          <view class="modal-row form-item" v-if="payMethod === 'card' && memberCards.length > 0">
            <text class="m-label">选择储值卡：</text>
            <picker class="picker" @change="onCardChange" :value="cardIndex" :range="memberCards" range-key="cardNo">
              <view class="picker-val" v-if="memberCards[cardIndex]">
                {{ memberCards[cardIndex].cardNo }} (余: ¥{{ Number(memberCards[cardIndex].balance).toFixed(2) }})
              </view>
            </picker>
          </view>
          <view class="modal-row" v-if="payMethod === 'card' && memberCards.length === 0">
            <text class="m-label"></text>
            <text class="text-gray" style="font-size: 22rpx; color: #8e8e93;">该客户名下无有效储值卡</text>
          </view>

          <view class="modal-row form-item">
            <text class="m-label">参考单号：</text>
            <input class="m-input" type="text" v-model="referenceNo" placeholder="选填，如收据号或交易流水" />
          </view>

          <view class="modal-row form-item">
            <text class="m-label">备注：</text>
            <input class="m-input" type="text" v-model="settleRemark" placeholder="选填备注" />
          </view>
        </view>
        
        <view class="modal-actions">
          <button class="btn btn-secondary font-bold" @tap="showSettleModal = false">取消</button>
          <button class="btn btn-primary font-bold" @tap="submitSettle">确认收银结算</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { request } from '../../utils/request';
import { useAuthStore } from '../../stores/auth';

const auth = useAuthStore();
const simpleMode = computed(() => auth.simpleMode);

const order = ref<any>(null);
const dispatchTask = ref<any>(null);
const photos = ref<any[]>([]);
let orderId = '';

const showSettleModal = ref(false);
const discountAmount = ref<number | string>(0);
const payMethod = ref('cash');
const paidAmountInput = ref<number | string>(0);
const memberCards = ref<any[]>([]);
const cardIndex = ref(0);
const referenceNo = ref('');
const settleRemark = ref('');

// 派工管理涉及的数据
const technicians = ref<any[]>([]);
const techIndex = ref(-1);
const workPlaces = ['1号通用工位', '2号通用工位', '机修双柱举升位', '四轮定位位', '洗车精美容位', '钣金拉伸机位', '无尘喷漆房'];
const workPlaceIndex = ref(0);
const teams = ['机修班组', '常规保养组', '钣金班组', '油漆班组', '汽车美容组', '施救应急组'];
const teamIndex = ref(0);

const dispatchForm = ref({
  remark: ''
});
const dispatchingLoading = ref(false);

const payableAmount = computed(() => {
  const total = Number(order.value?.totalAmount) || 0;
  const discount = Number(discountAmount.value) || 0;
  return Math.max(0, total - discount);
});

const selectedCardId = computed(() => {
  if (memberCards.value.length > 0 && cardIndex.value < memberCards.value.length) {
    return memberCards.value[cardIndex.value].id;
  }
  return '';
});

watch(payableAmount, (newVal) => {
  paidAmountInput.value = newVal;
});

function onPayMethodChange(e: any) {
  payMethod.value = e.detail.value;
}

function onCardChange(e: any) {
  cardIndex.value = e.detail.value;
}

function onTechnicianChange(e: any) {
  techIndex.value = e.detail.value;
}

function onWorkPlaceChange(e: any) {
  workPlaceIndex.value = e.detail.value;
}

function onTeamChange(e: any) {
  teamIndex.value = e.detail.value;
}

async function fetchMemberCards() {
  if (!order.value?.customer?.id) return;
  const token = uni.getStorageSync('accessToken');
  const res: any = await request({
    url: `/api/stored-value-cards?customerId=${order.value.customer.id}`,
    method: 'GET',
    header: { Authorization: `Bearer ${token}` }
  });
  if (res.data?.code === 0) {
    memberCards.value = res.data.data.items || [];
    cardIndex.value = 0;
  }
}

// 获取全店员工列表（派工备选）
async function fetchTechnicians() {
  const token = uni.getStorageSync('accessToken');
  try {
    const res: any = await request({
      url: '/api/users?page=1&pageSize=50',
      method: 'GET',
      header: { Authorization: `Bearer ${token}` }
    });
    if (res.data?.code === 0 && res.data.data) {
      technicians.value = res.data.data.items || [];
    }
  } catch (e) {
    // 忽略
  }
}

// 派工指派提交
async function submitDispatch() {
  if (techIndex.value === -1) {
    uni.showToast({ title: '请选择指派的主修技师', icon: 'none' });
    return;
  }
  const tech = technicians.value[techIndex.value];
  dispatchingLoading.value = true;
  const token = uni.getStorageSync('accessToken');
  
  try {
    const res: any = await request({
      url: '/api/dispatch',
      method: 'POST',
      header: { Authorization: `Bearer ${token}` },
      data: {
        workOrderId: orderId,
        technicianId: tech.id,
        workPlace: workPlaces[workPlaceIndex.value],
        team: teams[teamIndex.value],
        remark: dispatchForm.value.remark.trim() || undefined
      }
    });
    if (res.data?.code === 0) {
      uni.showToast({ title: '派工指派成功', icon: 'success' });
      await fetchOrderDetails();
      await fetchDispatchTask();
    } else {
      throw new Error(res.data?.message || '派工提交失败');
    }
  } catch (err: any) {
    uni.showModal({
      title: '派工失败',
      content: err.message || '系统提交派工出错，请稍后重试',
      showCancel: false
    });
  } finally {
    dispatchingLoading.value = false;
  }
}

function openSettleModal() {
  discountAmount.value = 0;
  payMethod.value = 'cash';
  paidAmountInput.value = Number(order.value.totalAmount);
  referenceNo.value = '';
  settleRemark.value = '';
  showSettleModal.value = true;
  fetchMemberCards();
}

async function submitSettle() {
  const total = Number(order.value.totalAmount);
  const discount = Number(discountAmount.value) || 0;
  if (discount < 0 || discount > total) {
    uni.showToast({ title: '优惠金额不合法', icon: 'none' });
    return;
  }
  const payable = payableAmount.value;
  const paid = Number(paidAmountInput.value) || 0;
  if (paid < 0) {
    uni.showToast({ title: '实收金额不能为负数', icon: 'none' });
    return;
  }

  if (payMethod.value === 'card') {
    if (memberCards.value.length === 0) {
      uni.showToast({ title: '无可用储值卡', icon: 'none' });
      return;
    }
    const card = memberCards.value[cardIndex.value];
    if (Number(card.balance) < paid) {
      uni.showToast({ title: '储值卡余额不足', icon: 'none' });
      return;
    }
  }

  uni.showLoading({ title: '正在提交结算...', mask: true });
  try {
    const token = uni.getStorageSync('accessToken');
    const paymentItem: any = {
      payMethod: payMethod.value,
      amount: paid,
      remark: settleRemark.value,
    };
    if (payMethod.value === 'card' && selectedCardId.value) {
      paymentItem.cardId = selectedCardId.value;
    }
    if (referenceNo.value) {
      paymentItem.referenceNo = referenceNo.value;
    }

    const res: any = await request({
      url: '/api/settlements',
      method: 'POST',
      header: { Authorization: `Bearer ${token}` },
      data: {
        workOrderId: order.value.id,
        discountAmount: discount,
        payments: [paymentItem],
      }
    });

    if (res.data?.code === 0) {
      uni.showToast({ title: '结算成功', icon: 'success' });
      showSettleModal.value = false;
      await fetchOrderDetails();
    } else {
      uni.showModal({
        title: '结算失败',
        content: res.data?.message || '操作失败',
        showCancel: false,
      });
    }
  } catch (err: any) {
    uni.showToast({ title: err.message || '网络错误', icon: 'none' });
  } finally {
    uni.hideLoading();
  }
}

async function reverseSettle() {
  uni.showModal({
    title: '提示',
    content: '确定要撤销此次结算(反结算)吗？这将会将工单退回已完工状态，并原路退回付款金额！',
    success: async (modalRes) => {
      if (modalRes.confirm) {
        uni.showLoading({ title: '正在撤销结算...', mask: true });
        try {
          const token = uni.getStorageSync('accessToken');
          const settleListRes: any = await request({
            url: `/api/settlements?workOrderId=${order.value.id}`,
            method: 'GET',
            header: { Authorization: `Bearer ${token}` },
          });
          
          let settleId = '';
          if (settleListRes.data?.code === 0) {
            const list = settleListRes.data.data.items || [];
            const settleObj = list.find((s: any) => s.workOrderId === order.value.id && s.status === 'settled');
            if (settleObj) {
              settleId = settleObj.id;
            }
          }
          
          if (!settleId) {
            uni.showToast({ title: '未找到匹配的结算单，请在后台撤销', icon: 'none' });
            return;
          }

          const res: any = await request({
            url: `/api/settlements/${settleId}/reverse`,
            method: 'POST',
            header: { Authorization: `Bearer ${token}` },
          });

          if (res.data?.code === 0) {
            uni.showToast({ title: '撤销成功', icon: 'success' });
            await fetchOrderDetails();
          } else {
            uni.showModal({
              title: '撤销失败',
              content: res.data?.message || '操作失败',
              showCancel: false,
            });
          }
        } catch (err: any) {
          uni.showToast({ title: err.message || '网络错误', icon: 'none' });
        } finally {
          uni.hideLoading();
        }
      }
    }
  });
}

const statusMap: Record<string, string> = {
  draft: '接单草稿', confirmed: '已确认待施工', dispatching: '待派工指派', in_progress: '车间施工中', completed: '完工待结算', settled: '收银已结算',
};
function statusLabel(s: string) { return statusMap[s] || s; }

async function quickCompleteOrder() {
  uni.showModal({
    title: '一键完工',
    content: `确定将工单 ${order.value?.orderNo} 标记为完工？`,
    success: async (res) => {
      if (!res.confirm) return;
      const token = uni.getStorageSync('accessToken');
      try {
        const woRes: any = await request({
          url: `/api/work-orders/${orderId}/status`,
          method: 'PUT',
          data: { status: 'completed' },
          header: { Authorization: `Bearer ${token}` },
        });
        if (woRes.data?.code === 0) {
          uni.showToast({ title: '已完工', icon: 'success' });
          await fetchOrderDetails();
        } else {
          throw new Error(woRes.data?.message || '操作失败');
        }
      } catch (err: any) {
        uni.showToast({ title: err.message || '完工失败', icon: 'none' });
      }
    }
  });
}

function callPhone(phone: string) {
  if (phone) uni.makePhoneCall({ phoneNumber: phone });
}

// 预览图片
function previewImage(url: string) {
  uni.previewImage({
    urls: photos.value.map(p => p.url),
    current: url,
  });
}

// 获取工单详情
async function fetchOrderDetails() {
  const token = uni.getStorageSync('accessToken');
  const res: any = await request({
    url: `/api/work-orders/${orderId}`,
    method: 'GET',
    header: { Authorization: `Bearer ${token}` },
  });
  if (res.data?.code === 0) {
    order.value = res.data.data;
    // 主动探测工单已分配的派工任务进行绑定
    if (order.value.dispatchTasks && order.value.dispatchTasks.length > 0) {
      dispatchTask.value = order.value.dispatchTasks[0];
      fetchPhotos();
    } else {
      dispatchTask.value = null;
    }
  }
}

// 获取本人的派工任务进行备用
async function fetchDispatchTask() {
  const token = uni.getStorageSync('accessToken');
  const res: any = await request({
    url: '/api/dispatch/my-tasks',
    method: 'GET',
    header: { Authorization: `Bearer ${token}` },
  });
  if (res.data?.code === 0) {
    const myTasks = res.data.data;
    const myTask = myTasks.find((t: any) => t.workOrderId === orderId);
    if (myTask) {
      dispatchTask.value = myTask;
      fetchPhotos();
    }
  }
}

// 获取施工照片
async function fetchPhotos() {
  if (!dispatchTask.value) return;
  const token = uni.getStorageSync('accessToken');
  const res: any = await request({
    url: `/api/files?businessType=dispatch-task&businessId=${dispatchTask.value.id}`,
    method: 'GET',
    header: { Authorization: `Bearer ${token}` },
  });
  if (res.data?.code === 0) {
    photos.value = res.data.data;
  }
}

// 手动开工
async function startWork() {
  if (!dispatchTask.value) return;
  const token = uni.getStorageSync('accessToken');
  const res: any = await request({
    url: `/api/dispatch/${dispatchTask.value.id}/start`,
    method: 'PUT',
    header: { Authorization: `Bearer ${token}` },
  });
  if (res.data?.code === 0) {
    uni.showToast({ title: '已开工' });
    dispatchTask.value.status = 'in_progress';
    fetchOrderDetails();
  }
}

// 确认完工
async function completeWork() {
  if (!dispatchTask.value) return;
  const token = uni.getStorageSync('accessToken');
  const res: any = await request({
    url: `/api/dispatch/${dispatchTask.value.id}/complete`,
    method: 'PUT',
    header: { Authorization: `Bearer ${token}` },
  });
  if (res.data?.code === 0) {
    uni.showToast({ title: '已完工' });
    dispatchTask.value.status = 'completed';
    fetchOrderDetails();
  }
}

// 兼容 H5 和 App 的 PUT 直传 OCI/S3 函数
async function uploadFileToOci(tempFilePath: string, uploadUrl: string, mimeType: string): Promise<boolean> {
  return new Promise(async (resolve, reject) => {
    if (typeof window !== 'undefined') {
      try {
        const blob = await fetch(tempFilePath).then(r => r.blob());
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl, true);
        xhr.setRequestHeader('Content-Type', mimeType || blob.type);
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(true);
          } else {
            reject(new Error(`上传 OCI 失败，状态码: ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error('网络上传失败'));
        xhr.send(blob);
      } catch (e) {
        reject(e);
      }
    } else {
      uni.getFileSystemManager().readFile({
        filePath: tempFilePath,
        success: (res) => {
          uni.request({
            url: uploadUrl,
            method: 'PUT',
            header: {
              'Content-Type': mimeType,
            },
            data: res.data as ArrayBuffer,
            success: (uploadRes: any) => {
              if (uploadRes.statusCode >= 200 && uploadRes.statusCode < 300) {
                resolve(true);
              } else {
                reject(new Error(`App上传 OCI 失败: ${uploadRes.statusCode}`));
              }
            },
            fail: (err: any) => {
              reject(new Error(err.errMsg || 'App上传请求失败'));
            }
          });
        },
        fail: (err) => {
          reject(new Error('读取本地文件失败: ' + err.errMsg));
        }
      });
    }
  });
}

// 拍照选择照片并直传
function chooseAndUploadPhoto() {
  if (!dispatchTask.value) return;
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: async (chooseRes) => {
      const tempFilePath = chooseRes.tempFilePaths[0];
      uni.showLoading({ title: '正在上传照片...', mask: true });
      
      try {
        const token = uni.getStorageSync('accessToken');
        
        // 1. 获取 OCI 预签名直传 URL
        const urlRes: any = await request({
          url: '/api/files/upload-url',
          method: 'POST',
          header: { Authorization: `Bearer ${token}` },
          data: {
            originalName: 'construction_photo.jpg',
            mimeType: 'image/jpeg',
            size: 10240,
            source: 'mobile',
            businessType: 'dispatch-task',
            businessId: dispatchTask.value.id,
          }
        });
        
        if (urlRes.data?.code !== 0) {
          throw new Error(urlRes.data?.message || '获取上传预签名链接失败');
        }
        
        const { uploadUrl, fileUrl } = urlRes.data.data || urlRes.data;
        if (!uploadUrl || !fileUrl) {
          throw new Error('返回的上传凭证不完整');
        }
        
        // 2. 直传图片到 OCI
        await uploadFileToOci(tempFilePath, uploadUrl, 'image/jpeg');
        
        // 3. 关联到派工任务并联动改变车间状态
        const bindRes: any = await request({
          url: `/api/dispatch/${dispatchTask.value.id}/photos`,
          method: 'POST',
          header: { Authorization: `Bearer ${token}` },
          data: { fileUrl }
        });
        
        if (bindRes.data?.code === 0) {
          uni.showToast({ title: '上传成功', icon: 'success' });
          if (dispatchTask.value.status === 'pending') {
            dispatchTask.value.status = 'in_progress';
          }
          fetchOrderDetails();
          fetchPhotos();
        } else {
          throw new Error(bindRes.data?.message || '联动车间状态失败');
        }
      } catch (err: any) {
        uni.showModal({
          title: '提示',
          content: err.message || '上传图片出错，请重试',
          showCancel: false,
        });
      } finally {
        uni.hideLoading();
      }
    }
  });
}

onMounted(async () => {
  const pages = getCurrentPages();
  const page = pages[pages.length - 1] as any;
  orderId = page.$page?.options?.id || page.options?.id;

  if (orderId) {
    await fetchOrderDetails();
    await fetchDispatchTask();
    await fetchTechnicians();
  }
});
</script>

<style scoped>
/* 全局页面高端暗黑玻璃拟态配色系统 */
.page { 
  padding: 20rpx 20rpx 140rpx 20rpx; 
  background: #121214; 
  min-height: 100vh; 
  color: #e0e0e6;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

/* 高端拟态卡片 */
.premium-card { 
  background: #1c1c1e; 
  border-radius: 20rpx; 
  padding: 30rpx; 
  margin-bottom: 24rpx; 
  border: 1rpx solid #2c2c2e;
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.15); 
}

.section-title { 
  font-size: 30rpx; 
  font-weight: bold; 
  margin-bottom: 30rpx; 
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
  padding: 12rpx 0; 
  border-bottom: 1rpx solid #2c2c2e;
}
.info-row:last-child {
  border-bottom: none;
}
.label { 
  font-size: 26rpx; 
  color: #a1a1a9; 
}
.value { 
  font-size: 26rpx; 
  color: #ffffff; 
}
.text-phone {
  color: #3b82f6;
  text-decoration: underline;
}

/* 明细项 */
.item { 
  border-bottom: 1rpx solid #2c2c2e; 
  padding: 20rpx 0; 
}
.item:last-child { 
  border-bottom: none; 
}
.item-header { 
  display: flex; 
  justify-content: space-between; 
  margin-bottom: 8rpx; 
}
.item-name { 
  font-size: 28rpx; 
  color: #ffffff;
}
.item-amount { 
  font-size: 28rpx; 
  color: #f43f5e; 
}
.item-footer { 
  display: flex; 
  justify-content: space-between; 
}
.item-type { 
  font-size: 24rpx; 
  color: #a1a1a9; 
}
.item-qty { 
  font-size: 24rpx; 
  color: #8e8e93; 
}

/* 合计 */
.total-row { 
  display: flex; 
  justify-content: flex-end; 
  align-items: center; 
  gap: 10rpx; 
}
.total-label {
  font-size: 28rpx;
  color: #a1a1a9;
}
.total-amount { 
  font-size: 38rpx; 
  color: #f43f5e; 
}
.desc { 
  font-size: 26rpx; 
  color: #e0e0e6; 
  line-height: 1.6; 
  background: #161618;
  padding: 16rpx;
  border-radius: 12rpx;
  border: 1rpx solid #2c2c2e;
}

/* 施工状态徽章 */
.status-badge { 
  display: inline-block; 
  padding: 6rpx 20rpx; 
  border-radius: 20rpx; 
  font-size: 20rpx; 
  font-weight: bold; 
}
.status-badge.pending { background: rgba(251, 191, 36, 0.15); color: #fbbf24; }
.status-badge.in_progress { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
.status-badge.completed { background: rgba(16, 185, 129, 0.15); color: #10b981; }
.status-badge.paused { background: rgba(244, 63, 94, 0.15); color: #f43f5e; }

/* 施工照片区域 */
.photo-container { 
  margin-top: 24rpx; 
  border-top: 1rpx solid #2c2c2e; 
  padding-top: 24rpx; 
}
.photo-list { 
  display: flex; 
  flex-wrap: wrap; 
  gap: 16rpx; 
  margin-top: 20rpx; 
}
.photo-item { 
  position: relative; 
  width: 140rpx; 
  height: 140rpx; 
  border-radius: 12rpx; 
  overflow: hidden; 
  background: #161618; 
  border: 1rpx solid #2c2c2e;
}
.photo-img { 
  width: 100%; 
  height: 100%; 
}
.add-photo { 
  display: flex; 
  flex-direction: column; 
  justify-content: center; 
  align-items: center; 
  border: 2rpx dashed #2c2c2e; 
  background: #161618; 
}
.plus { 
  font-size: 44rpx; 
  color: #8e8e93; 
  line-height: 1; 
}
.add-text { 
  font-size: 18rpx; 
  color: #8e8e93; 
  margin-top: 6rpx; 
}

/* 施工操作按钮 */
.btn-group { 
  display: flex; 
  gap: 20rpx; 
  margin-top: 30rpx; 
}
.btn { 
  flex: 1; 
  height: 78rpx; 
  line-height: 78rpx; 
  text-align: center; 
  border-radius: 39rpx; 
  font-size: 26rpx; 
  font-weight: bold; 
  border: none;
  margin: 0; 
}
.btn-primary { background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: #fff; }
.btn-success { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #fff; }
.btn-warning { background: linear-gradient(135deg, #fbbf24 0%, #d97706 100%); color: #fff; }

/* 派工表单专属样式 */
.form-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1rpx solid #2c2c2e;
  padding: 24rpx 0;
}
.form-item.vertical {
  flex-direction: column;
  align-items: flex-start;
  gap: 16rpx;
}
.border-glow {
  border-bottom: 1rpx solid #3a3a3c;
}
.form-label {
  font-size: 26rpx;
  color: #a1a1a9;
  width: 200rpx;
}
.form-label-v {
  font-size: 26rpx;
  color: #a1a1a9;
}
.form-picker {
  flex: 1;
}
.picker-value {
  font-size: 28rpx;
  color: #3b82f6;
  text-align: right;
  font-weight: bold;
}
.arrow {
  font-size: 18rpx;
  margin-left: 6rpx;
}
.form-input-inline {
  width: 100%;
  height: 72rpx;
  background: #161618;
  border: 1rpx solid #2c2c2e;
  border-radius: 12rpx;
  padding: 0 20rpx;
  font-size: 26rpx;
  color: #ffffff;
  box-sizing: border-box;
}
.dispatch-submit-btn {
  width: 100%;
  height: 84rpx;
  line-height: 84rpx;
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  color: #ffffff;
  font-size: 28rpx;
  border-radius: 42rpx;
  border: none;
  margin-top: 30rpx;
}
.pulse-glow {
  animation: pulse 2.5s infinite;
}
@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); }
  70% { box-shadow: 0 0 0 10rpx rgba(59, 130, 246, 0); }
  100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
}

/* 收款结算操作条 */
.settle-bar-section { 
  margin-top: 30rpx; 
  padding: 0 10rpx; 
}
.btn-settle { 
  background: linear-gradient(135deg, #10b981 0%, #059669 100%); 
  color: #fff; 
  font-size: 30rpx; 
  border-radius: 45rpx; 
  height: 90rpx; 
  line-height: 90rpx; 
  text-align: center; 
  border: none; 
  box-shadow: 0 4rpx 16rpx rgba(16,185,129,0.3); 
  width: 100%;
}

/* 简易模式一键完工 */
.simple-bar-section {
  margin-top: 30rpx;
  padding: 0 10rpx;
}
.btn-quick-complete {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: #fff;
  font-size: 30rpx;
  border-radius: 45rpx;
  height: 90rpx;
  line-height: 90rpx;
  text-align: center;
  border: none;
  box-shadow: 0 4rpx 16rpx rgba(245,158,11,0.3);
  width: 100%;
}
.text-danger { color: #f43f5e; }
.text-success { color: #10b981; }
.text-primary { color: #3b82f6; }

/* 收银结算弹窗 */
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
  z-index: 999; 
}
.modal-content { 
  width: 650rpx; 
  max-height: 90vh; 
  display: flex; 
  flex-direction: column; 
}
.modal-header { 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  padding-bottom: 24rpx; 
  border-bottom: 1rpx solid #2c2c2e; 
}
.modal-title { 
  font-size: 32rpx; 
  font-weight: bold; 
  color: #ffffff;
}
.modal-close { 
  font-size: 40rpx; 
  color: #a1a1a9; 
  line-height: 1; 
  padding: 0 10rpx; 
}
.modal-body { 
  padding: 24rpx 0; 
  overflow-y: auto; 
  display: flex; 
  flex-direction: column; 
  gap: 20rpx; 
}
.modal-row { 
  display: flex; 
  align-items: center; 
  font-size: 28rpx; 
}
.m-label { 
  width: 160rpx; 
  color: #a1a1a9; 
}
.m-value { 
  color: #ffffff; 
}
.m-input { 
  flex: 1; 
  height: 64rpx; 
  font-size: 28rpx; 
  border: 1rpx solid #2c2c2e; 
  border-radius: 8rpx; 
  padding: 0 16rpx; 
  background: #161618;
  color: #ffffff;
}
.radio-group { 
  display: flex; 
  flex-wrap: wrap; 
  gap: 16rpx; 
  flex: 1;
}
.radio-label { 
  display: flex; 
  align-items: center; 
  font-size: 24rpx; 
  color: #e0e0e6;
  gap: 4rpx; 
}
.picker { 
  flex: 1; 
  border: 1rpx solid #2c2c2e; 
  border-radius: 8rpx; 
  padding: 10rpx 16rpx; 
  background: #161618; 
}
.picker-val { 
  font-size: 26rpx; 
  color: #3b82f6; 
  font-weight: bold;
}
.modal-actions { 
  display: flex; 
  gap: 20rpx;
  margin-top: 24rpx;
}
.modal-actions .btn {
  flex: 1;
  height: 78rpx;
  line-height: 78rpx;
  font-size: 28rpx;
  border-radius: 39rpx;
}
.btn-cancel { 
  background: #2c2c2e; 
  color: #a1a1a9; 
}
.btn-confirm { 
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); 
  color: #fff; 
}
</style>
