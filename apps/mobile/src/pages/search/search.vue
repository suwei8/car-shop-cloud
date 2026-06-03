<template>
  <view class="page">
    <!-- 顶部极简搜索框 -->
    <view class="search-header" v-if="!selectedVehicle">
      <input class="search-input" v-model="keyword" type="text" placeholder="输入车牌号 / 手机号 / VIN" confirm-type="search" @confirm="handleSearch" @input="onKeywordInput" />
      <button class="search-btn font-bold" @tap="handleSearch">搜索</button>
    </view>

    <!-- 车辆选择列表（搜索结果/默认列表，对标“百易云修”维修管理） -->
    <view class="results-container" v-if="vehicles.length > 0 && !selectedVehicle">
      <view class="section-title">
        <text class="prefix">🚗</text>
        <text>{{ searched ? '搜索结果' : '车辆档案列表' }} ({{ vehicles.length }})</text>
      </view>
      
      <view class="vehicle-card-wrapper" v-for="v in vehicles" :key="v.id" @tap="selectVehicle(v)">
        <view class="vehicle-card-left">
          <view class="vehicle-header">
            <text class="plate-no">{{ v.plateNo }}</text>
            <text class="brand-model">{{ v.brand || '未登记品牌' }} {{ v.model || '' }}</text>
          </view>
          <view class="owner-info">
            <view class="info-row">
              <text class="label-txt">车主姓名：</text>
              <text class="value-txt">{{ v.customer?.name || '未知' }}</text>
            </view>
            <view class="info-row">
              <text class="label-txt">联系电话：</text>
              <text class="value-txt phone-txt" @tap.stop="callPhone(v.customer?.phone)">{{ v.customer?.phone || '无号码' }}</text>
            </view>
          </view>
        </view>
        <view class="vehicle-card-right">
          <button class="quick-bill-btn font-bold pulse-glow" @tap.stop="quickBill(v)">立即开单</button>
        </view>
      </view>
    </view>

    <!-- 暂无结果 -->
    <view class="empty-state" v-if="vehicles.length === 0 && !selectedVehicle">
      <text class="empty-icon">🔍</text>
      <text class="empty-text">未找到相关车辆档案</text>
    </view>

    <!-- 车辆360视图（选定车辆后，平滑展开资产及历史） -->
    <view class="detail-container" v-if="selectedVehicle">
      <!-- 选定车辆基本信息卡 -->
      <view class="info-card premium-card">
        <view class="card-header">
          <view class="plate-badge">{{ selectedVehicle.plateNo }}</view>
          <text class="back-btn font-bold" @tap="selectedVehicle = null">返回列表</text>
        </view>
        <view class="info-body">
          <view class="info-item">
            <text class="label">车辆品牌：</text>
            <text class="value">{{ selectedVehicle.brand || '未录入' }} {{ selectedVehicle.model || '' }}</text>
          </view>
          <view class="info-item" v-if="selectedVehicle.vin">
            <text class="label">VIN 码：</text>
            <text class="value text-primary font-bold">{{ selectedVehicle.vin }}</text>
          </view>
          <view class="info-item">
            <text class="label">车主姓名：</text>
            <text class="value">{{ selectedVehicle.customer?.name || '未知' }}</text>
          </view>
          <view class="info-item">
            <text class="label">联系电话：</text>
            <text class="value text-phone font-bold" @tap="callPhone(selectedVehicle.customer?.phone)">{{ selectedVehicle.customer?.phone || '无' }}</text>
          </view>
        </view>
      </view>

      <!-- 会员资产：储值与套餐 -->
      <view class="section premium-card">
        <view class="section-title">
          <text class="prefix">💳</text>
          <text>会员卡包资产</text>
        </view>
        
        <!-- 储值卡余额 -->
        <view class="asset-group">
          <view class="asset-title">
            <text class="group-label">储值会员卡 ({{ memberCards.length }})</text>
            <text class="action-btn-text font-bold" @tap="openRechargeModal">[新办/充值]</text>
          </view>
          
          <view class="stored-card" v-for="c in memberCards" :key="c.id">
            <view class="card-no-row">
              <text class="card-icon">⚡</text>
              <text class="card-no">卡号: {{ c.cardNo }}</text>
            </view>
            <view class="card-balance-row">
              <text class="card-balance">可用余额: <text class="amt-highlight">¥{{ Number(c.balance).toFixed(2) }}</text></text>
              <text class="card-details">(本金: ¥{{ Number(c.principalBalance).toFixed(2) }}, 赠送: ¥{{ Number(c.giftBalance).toFixed(2) }})</text>
            </view>
          </view>
          <view class="no-asset" v-if="memberCards.length === 0">暂无有效储值卡</view>
        </view>

        <!-- 套餐卡剩余 -->
        <view class="asset-group" style="margin-top: 30rpx;">
          <view class="asset-title">
            <text class="group-label">专享套餐卡包 ({{ packageCards.length }})</text>
            <text class="action-btn-text font-bold" @tap="openSellPackageModal">[套餐发售]</text>
          </view>
          
          <view class="package-card" v-for="p in packageCards" :key="p.id">
            <view class="package-header">
              <text class="package-name">{{ p.name }}</text>
              <text class="package-date">至 {{ new Date(p.endAt).toLocaleDateString() }}</text>
            </view>
            <view class="package-item" v-for="item in p.items" :key="item.id">
              <text class="item-name">{{ item.serviceItem?.name || '未知服务项目' }}</text>
              <text class="item-qty">剩余 <text class="qty-highlight font-bold">{{ item.remainQty }}</text> 次 / 共 {{ item.totalQty }} 次</text>
            </view>
          </view>
          <view class="no-asset" v-if="packageCards.length === 0">暂无套餐项目卡包</view>
        </view>
      </view>

      <!-- 历史维修工单 -->
      <view class="section premium-card">
        <view class="section-title">
          <text class="prefix">📝</text>
          <text>历史维保记录 ({{ historyOrders.length }})</text>
        </view>
        
        <view class="order-item" v-for="order in historyOrders" :key="order.id" @tap="goOrderDetail(order.id)">
          <view class="order-header">
            <text class="order-no">{{ order.orderNo }}</text>
            <text :class="['order-status', order.status]">{{ orderStatusLabel(order.status) }}</text>
          </view>
          <view class="order-body">
            <text class="order-desc">{{ order.description || '日常洗车美容 / 快修快保' }}</text>
            <text class="order-amount">¥{{ Number(order.totalAmount).toFixed(2) }}</text>
          </view>
          <view class="order-footer">
            <text class="order-time">{{ new Date(order.createdAt).toLocaleString() }}</text>
          </view>
        </view>
        <view class="empty-orders" v-if="historyOrders.length === 0">暂无历史接车工单记录</view>
      </view>
    </view>

    <!-- ➕ 新建车辆档案 悬浮按钮 (对标“百易云修”) -->
    <view class="floating-action pulse-glow" v-if="!selectedVehicle" @tap="quickRegisterVehicle">
      <text class="floating-text">➕ 新建车辆档案</text>
    </view>

    <!-- 储值卡 办卡/充值 弹窗 -->
    <view class="modal-mask" v-if="showRechargeModal" @tap.self="showRechargeModal = false">
      <view class="modal-content premium-card">
        <view class="modal-title">储值卡 - 办卡/充值</view>
        
        <!-- 模式切换 -->
        <view class="segmented-control">
          <view :class="['segment-item', rechargeMode === 'new' ? 'active' : '']" @tap="rechargeMode = 'new'">新办卡</view>
          <view :class="['segment-item', rechargeMode === 'recharge' ? 'active' : '', memberCards.length === 0 ? 'disabled' : '']" @tap="memberCards.length > 0 && (rechargeMode = 'recharge')">充值</view>
        </view>

        <!-- 选择已有卡（仅在充值模式下） -->
        <view class="form-item" v-if="rechargeMode === 'recharge'">
          <text class="form-label">选择卡号</text>
          <picker class="form-picker" :value="selectedCardIndex" :range="memberCards" range-key="cardNo" @change="onCardChange">
            <view class="picker-value">
              {{ memberCards[selectedCardIndex]?.cardNo || '请选择储值卡' }}
              <text class="arrow">▼</text>
            </view>
          </picker>
        </view>

        <!-- 输入卡号（仅在新办卡模式下） -->
        <view class="form-item" v-if="rechargeMode === 'new'">
          <text class="form-label">卡号</text>
          <input class="form-input" v-model="rechargeCardNo" type="text" placeholder="请输入或生成卡号" />
          <text class="action-link" @tap="generateRechargeCardNo">自动生成</text>
        </view>

        <!-- 本金金额 -->
        <view class="form-item">
          <text class="form-label">充值本金 (元)</text>
          <input class="form-input" v-model.number="rechargeAmount" type="number" placeholder="请输入充值本金金额" />
        </view>

        <!-- 赠送金额 -->
        <view class="form-item">
          <text class="form-label">赠送金额 (元)</text>
          <input class="form-input" v-model.number="rechargeGift" type="number" placeholder="0" />
        </view>

        <!-- 备注 -->
        <view class="form-item">
          <text class="form-label">备注</text>
          <input class="form-input" v-model="rechargeRemark" type="text" placeholder="选填，如充值赠洗车券" />
        </view>

        <view class="modal-actions">
          <button class="btn btn-secondary font-bold" @tap="showRechargeModal = false">取消</button>
          <button class="btn btn-primary font-bold" :loading="submitLoading" @tap="submitRecharge">确认提交</button>
        </view>
      </view>
    </view>

    <!-- 套餐卡 售卡 弹窗 -->
    <view class="modal-mask" v-if="showPackageModal" @tap.self="showPackageModal = false">
      <view class="modal-content large premium-card">
        <view class="modal-title">销售套餐卡/包</view>

        <!-- 卡号 -->
        <view class="form-item">
          <text class="form-label">套餐卡号</text>
          <input class="form-input" v-model="packageCardNo" type="text" placeholder="请输入或生成卡号" />
          <text class="action-link" @tap="generatePackageCardNo">自动生成</text>
        </view>

        <!-- 套餐名称 -->
        <view class="form-item">
          <text class="form-label">套餐名称</text>
          <input class="form-input" v-model="packageName" type="text" placeholder="例如：洗车美容多次卡 / 保养尊享套餐" />
        </view>

        <!-- 有效期至 -->
        <view class="form-item">
          <text class="form-label">有效期至</text>
          <picker mode="date" class="form-picker" :value="packageEndAt" @change="onPackageEndAtChange">
            <view class="picker-value">
              {{ packageEndAt || '请选择到期时间' }}
              <text class="arrow">▼</text>
            </view>
          </picker>
        </view>

        <!-- 绑定当前车辆 -->
        <view class="form-item checkbox-item">
          <checkbox :checked="packageBindVehicle" @tap="packageBindVehicle = !packageBindVehicle" color="#3b82f6" />
          <text class="checkbox-label">仅限当前车辆使用 ({{ selectedVehicle?.plateNo }})</text>
        </view>

        <!-- 套餐包含服务项目 -->
        <view class="form-section">
          <view class="form-section-title">
            <text>包含项目 ({{ packageItems.length }})</text>
            <text class="action-link" @tap="openServiceSelector">+ 添加项目</text>
          </view>

          <view class="package-item-list">
            <view class="package-item-row" v-for="(item, idx) in packageItems" :key="item.serviceItemId">
              <text class="pkg-item-name">{{ item.serviceItemName }}</text>
              <view class="pkg-item-qty">
                <text class="qty-btn" @tap="changeItemQty(idx, -1)">-</text>
                <input class="qty-input" v-model.number="item.totalQty" type="number" />
                <text class="qty-btn" @tap="changeItemQty(idx, 1)">+</text>
                <text class="qty-unit">次</text>
              </view>
              <text class="pkg-item-del font-bold" @tap="removePackageItem(idx)">删除</text>
            </view>
            <view class="empty-pkg-items" v-if="packageItems.length === 0">尚未添加任何服务项目</view>
          </view>
        </view>

        <!-- 备注 -->
        <view class="form-item">
          <text class="form-label">备注</text>
          <input class="form-input" v-model="packageRemark" type="text" placeholder="选填备注信息" />
        </view>

        <view class="modal-actions">
          <button class="btn btn-secondary font-bold" @tap="showPackageModal = false">取消</button>
          <button class="btn btn-primary font-bold" :loading="submitLoading" @tap="submitSellPackage">确认售卡</button>
        </view>
      </view>
    </view>

    <!-- 服务项目选择器 -->
    <view class="modal-mask sub-modal" v-if="showServiceSelector" @tap.self="showServiceSelector = false">
      <view class="modal-content sub-content premium-card">
        <view class="modal-title">选择服务项目</view>
        
        <!-- 搜索框 -->
        <view class="search-header compact">
          <input class="search-input" v-model="serviceSearchKeyword" type="text" placeholder="搜索服务项目名称" />
        </view>

        <!-- 服务列表 -->
        <scroll-view class="service-scroll-list" scroll-y="true">
          <view :class="['service-select-row', isServiceSelected(item.id) ? 'selected' : '']" v-for="item in filteredServiceItems" :key="item.id" @tap="toggleServiceSelection(item)">
            <view class="svc-select-info">
              <text class="svc-select-name">{{ item.name }}</text>
              <text class="svc-select-price">¥{{ Number(item.unitPrice).toFixed(2) }}</text>
            </view>
            <view class="svc-select-checkbox" v-if="isServiceSelected(item.id)">✓</view>
          </view>
        </scroll-view>

        <view class="modal-actions">
          <button class="btn btn-primary font-bold" style="width: 100%;" @tap="showServiceSelector = false">完成选择</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { request } from '../../utils/request';

const keyword = ref('');
const searched = ref(false);
const vehicles = ref<any[]>([]);
const selectedVehicle = ref<any>(null);

const historyOrders = ref<any[]>([]);
const memberCards = ref<any[]>([]);
const packageCards = ref<any[]>([]);

// 储值卡 充值/办卡 表单 state
const showRechargeModal = ref(false);
const rechargeMode = ref<'new' | 'recharge'>('new');
const selectedCardIndex = ref(0);
const rechargeCardNo = ref('');
const rechargeAmount = ref<number | ''>('');
const rechargeGift = ref<number | ''>('');
const rechargeRemark = ref('');
const submitLoading = ref(false);

// 套餐卡表单 state
const showPackageModal = ref(false);
const packageCardNo = ref('');
const packageName = ref('');
const packageEndAt = ref('');
const packageBindVehicle = ref(true);
const packageItems = ref<{ serviceItemId: string; serviceItemName: string; totalQty: number }[]>([]);
const packageRemark = ref('');

// 服务项目选择器 state
const showServiceSelector = ref(false);
const serviceItems = ref<any[]>([]);
const serviceSearchKeyword = ref('');

function callPhone(phone: string) {
  if (phone) uni.makePhoneCall({ phoneNumber: phone });
}

// 储值卡辅助函数
function generateRechargeCardNo() {
  rechargeCardNo.value = 'SV' + Math.floor(10000000 + Math.random() * 90000000);
}

function onCardChange(e: any) {
  selectedCardIndex.value = e.detail.value;
}

function openRechargeModal() {
  rechargeMode.value = memberCards.value.length > 0 ? 'recharge' : 'new';
  selectedCardIndex.value = 0;
  generateRechargeCardNo();
  rechargeAmount.value = '';
  rechargeGift.value = '';
  rechargeRemark.value = '';
  showRechargeModal.value = true;
}

async function submitRecharge() {
  if (rechargeMode.value === 'new' && !rechargeCardNo.value.trim()) {
    uni.showToast({ title: '请输入或生成卡号', icon: 'none' });
    return;
  }
  const amt = Number(rechargeAmount.value);
  if (isNaN(amt) || amt <= 0) {
    uni.showToast({ title: '请输入有效的本金金额', icon: 'none' });
    return;
  }

  const gift = Number(rechargeGift.value) || 0;
  submitLoading.value = true;
  try {
    const token = uni.getStorageSync('accessToken');
    if (rechargeMode.value === 'new') {
      const res: any = await request({
        url: `/api/stored-value-cards`,
        method: 'POST',
        header: { Authorization: `Bearer ${token}` },
        data: {
          cardNo: rechargeCardNo.value.trim(),
          customerId: selectedVehicle.value.customerId,
          amount: amt,
          gift: gift,
          remark: rechargeRemark.value.trim()
        }
      });
      if (res.data?.code === 0) {
        uni.showToast({ title: '开卡充值成功', icon: 'success' });
        showRechargeModal.value = false;
        await selectVehicle(selectedVehicle.value);
      } else {
        uni.showToast({ title: res.data?.message || '开卡失败', icon: 'none' });
      }
    } else {
      // 充值已有卡
      const card = memberCards.value[selectedCardIndex.value];
      const res: any = await request({
        url: `/api/stored-value-cards/${card.id}/recharge`,
        method: 'POST',
        header: { Authorization: `Bearer ${token}` },
        data: {
          amount: amt,
          gift: gift,
          remark: rechargeRemark.value.trim()
        }
      });
      if (res.data?.code === 0) {
        uni.showToast({ title: '储值卡充值成功', icon: 'success' });
        showRechargeModal.value = false;
        await selectVehicle(selectedVehicle.value);
      } else {
        uni.showToast({ title: res.data?.message || '充值失败', icon: 'none' });
      }
    }
  } catch (e: any) {
    uni.showToast({ title: e.message || '操作异常', icon: 'none' });
  } finally {
    submitLoading.value = false;
  }
}

// 套餐卡辅助函数
function generatePackageCardNo() {
  packageCardNo.value = 'PK' + Math.floor(10000000 + Math.random() * 90000000);
}

function onPackageEndAtChange(e: any) {
  packageEndAt.value = e.detail.value;
}

function openSellPackageModal() {
  generatePackageCardNo();
  packageName.value = '';
  packageEndAt.value = '';
  packageBindVehicle.value = true;
  packageItems.value = [];
  packageRemark.value = '';
  showPackageModal.value = true;
}

function changeItemQty(idx: number, delta: number) {
  const item = packageItems.value[idx];
  if (item) {
    const newVal = (Number(item.totalQty) || 0) + delta;
    item.totalQty = newVal < 1 ? 1 : newVal;
  }
}

function removePackageItem(idx: number) {
  packageItems.value.splice(idx, 1);
}

// 服务项目选择器函数
async function fetchServiceItems() {
  try {
    const token = uni.getStorageSync('accessToken');
    const res: any = await request({
      url: `/api/service-items`,
      method: 'GET',
      header: { Authorization: `Bearer ${token}` }
    });
    if (res.data?.code === 0) {
      serviceItems.value = Array.isArray(res.data.data) ? res.data.data : (res.data.data?.items || []);
    }
  } catch (e) {
    console.error('获取服务项目失败', e);
  }
}

async function openServiceSelector() {
  if (serviceItems.value.length === 0) {
    uni.showLoading({ title: '加载中...' });
    await fetchServiceItems();
    uni.hideLoading();
  }
  serviceSearchKeyword.value = '';
  showServiceSelector.value = true;
}

function isServiceSelected(id: string) {
  return packageItems.value.some(i => i.serviceItemId === id);
}

function toggleServiceSelection(item: any) {
  const idx = packageItems.value.findIndex(i => i.serviceItemId === item.id);
  if (idx > -1) {
    packageItems.value.splice(idx, 1);
  } else {
    packageItems.value.push({
      serviceItemId: item.id,
      serviceItemName: item.name,
      totalQty: 1
    });
  }
}

const filteredServiceItems = computed(() => {
  if (!serviceSearchKeyword.value.trim()) return serviceItems.value;
  const kw = serviceSearchKeyword.value.toLowerCase().trim();
  return serviceItems.value.filter(item => 
    item.name.toLowerCase().includes(kw) || 
    (item.category && item.category.toLowerCase().includes(kw))
  );
});

async function submitSellPackage() {
  if (!packageCardNo.value.trim()) {
    uni.showToast({ title: '请输入或生成套餐卡号', icon: 'none' });
    return;
  }
  if (!packageName.value.trim()) {
    uni.showToast({ title: '请输入套餐卡名称', icon: 'none' });
    return;
  }
  if (!packageEndAt.value) {
    uni.showToast({ title: '请选择到期时间', icon: 'none' });
    return;
  }
  if (packageItems.value.length === 0) {
    uni.showToast({ title: '请至少添加一个服务项目', icon: 'none' });
    return;
  }

  submitLoading.value = true;
  try {
    const token = uni.getStorageSync('accessToken');
    const res: any = await request({
      url: `/api/package-cards`,
      method: 'POST',
      header: { Authorization: `Bearer ${token}` },
      data: {
        cardNo: packageCardNo.value.trim(),
        customerId: selectedVehicle.value.customerId,
        vehicleId: packageBindVehicle.value ? selectedVehicle.value.id : null,
        name: packageName.value.trim(),
        startAt: new Date().toISOString().split('T')[0],
        endAt: packageEndAt.value,
        items: packageItems.value.map(i => ({ serviceItemId: i.serviceItemId, totalQty: i.totalQty })),
        remark: packageRemark.value.trim()
      }
    });
    if (res.data?.code === 0) {
      uni.showToast({ title: '套餐卡销售成功', icon: 'success' });
      showPackageModal.value = false;
      await selectVehicle(selectedVehicle.value);
    } else {
      uni.showToast({ title: res.data?.message || '销售失败', icon: 'none' });
    }
  } catch (e: any) {
    uni.showToast({ title: e.message || '操作异常', icon: 'none' });
  } finally {
    submitLoading.value = false;
  }
}

// 查询车辆历史信息
async function selectVehicle(vehicle: any) {
  selectedVehicle.value = vehicle;
  const token = uni.getStorageSync('accessToken');
  
  // 1. 获取该车辆的历史工单
  const woRes: any = await request({
    url: `/api/work-orders?vehicleId=${vehicle.id}`,
    method: 'GET',
    header: { Authorization: `Bearer ${token}` }
  });
  if (woRes.data?.code === 0) {
    historyOrders.value = woRes.data.data.items;
  }

  // 如果车辆有关联客户，查询该客户的储值卡与套餐卡
  if (vehicle.customerId) {
    // 2. 获取储值卡
    const cardsRes: any = await request({
      url: `/api/stored-value-cards?customerId=${vehicle.customerId}`,
      method: 'GET',
      header: { Authorization: `Bearer ${token}` }
    });
    if (cardsRes.data?.code === 0) {
      memberCards.value = cardsRes.data.data.items;
    }

    // 3. 获取套餐卡
    const pkgRes: any = await request({
      url: `/api/package-cards?customerId=${vehicle.customerId}`,
      method: 'GET',
      header: { Authorization: `Bearer ${token}` }
    });
    if (pkgRes.data?.code === 0) {
      packageCards.value = pkgRes.data.data.items;
    }
  }
}

// 默认首屏自动加载所有车辆（对标“百易云修”）
async function fetchDefaultVehicles() {
  uni.showLoading({ title: '载入车辆档案中...' });
  try {
    const token = uni.getStorageSync('accessToken');
    const res: any = await request({
      url: '/api/vehicles?page=1&pageSize=30',
      method: 'GET',
      header: { Authorization: `Bearer ${token}` }
    });
    if (res.data?.code === 0 && res.data.data) {
      vehicles.value = res.data.data.items || [];
    }
  } catch (e) {
    // 忽略
  } finally {
    uni.hideLoading();
  }
}

// 搜索入口
async function handleSearch() {
  if (!keyword.value.trim()) {
    searched.value = false;
    selectedVehicle.value = null;
    await fetchDefaultVehicles();
    return;
  }
  
  uni.showLoading({ title: '正在搜索...' });
  selectedVehicle.value = null;
  searched.value = true;
  
  try {
    const token = uni.getStorageSync('accessToken');
    const res: any = await request({
      url: `/api/vehicles/search?keyword=${encodeURIComponent(keyword.value.trim())}`,
      method: 'GET',
      header: { Authorization: `Bearer ${token}` }
    });
    
    if (res.data?.code === 0) {
      vehicles.value = res.data.data;
    } else {
      vehicles.value = [];
    }
  } catch (e) {
    uni.showToast({ title: '搜索失败，请重试', icon: 'none' });
  } finally {
    uni.hideLoading();
  }
}

function onKeywordInput() {
  if (!keyword.value.trim()) {
    // 当清空搜索框时，自动归位加载默认全列表
    searched.value = false;
    selectedVehicle.value = null;
    fetchDefaultVehicles();
  }
}

// 立即开单快捷通道 (带入 vehicleId 瞬间完成匹配隔离)
function quickBill(veh: any) {
  uni.navigateTo({ url: `/pages/workorder/create?vehicleId=${veh.id}` });
}

// ➕ 新建车辆档案快捷入口
function quickRegisterVehicle() {
  uni.navigateTo({ url: `/pages/workorder/create?type=new` });
}

function goOrderDetail(id: string) {
  uni.navigateTo({ url: `/pages/workorder/detail?id=${id}` });
}

const statusMap: Record<string, string> = {
  draft: '草稿', confirmed: '已确认', in_progress: '施工中', completed: '已完成', settled: '已结算', cancelled: '已作废',
};
function orderStatusLabel(s: string) { return statusMap[s] || s; }

onMounted(() => {
  fetchDefaultVehicles();
});
</script>

<style scoped>
/* 全局页面高端暗黑玻璃拟态配色系统 */
.page { 
  padding: 20rpx 20rpx 150rpx 20rpx; 
  background: #121214; 
  min-height: 100vh; 
  color: #e0e0e6;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

/* 顶部搜索条 */
.search-header { 
  display: flex; 
  gap: 16rpx; 
  margin-bottom: 30rpx; 
}
.search-header.compact {
  margin-bottom: 20rpx;
}
.search-input { 
  flex: 1; 
  height: 84rpx; 
  background: #1c1c1e; 
  border-radius: 42rpx; 
  padding: 0 40rpx; 
  font-size: 28rpx; 
  color: #ffffff;
  border: 1rpx solid #2c2c2e;
}
.search-btn { 
  width: 150rpx; 
  height: 84rpx; 
  line-height: 84rpx; 
  text-align: center; 
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); 
  color: #ffffff; 
  border-radius: 42rpx; 
  font-size: 28rpx; 
  border: none; 
  margin: 0; 
  box-shadow: 0 4rpx 12rpx rgba(59, 130, 246, 0.3);
}

.section-title { 
  font-size: 30rpx; 
  font-weight: bold; 
  color: #ffffff; 
  margin: 20rpx 0 20rpx 10rpx; 
  display: flex;
  align-items: center;
}
.prefix {
  margin-right: 12rpx;
  font-size: 32rpx;
}

/* 车辆列表卡片（对标“百易云修”维修管理） */
.vehicle-card-wrapper { 
  background: #1c1c1e; 
  border-radius: 16rpx; 
  padding: 26rpx; 
  margin-bottom: 20rpx; 
  display: flex; 
  justify-content: space-between; 
  align-items: center;
  border: 1rpx solid #2c2c2e;
  box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.15); 
}
.vehicle-card-left {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}
.vehicle-header { 
  display: flex; 
  align-items: center; 
  gap: 16rpx;
}
.plate-no { 
  font-size: 32rpx; 
  font-weight: 800; 
  color: #3b82f6; 
  letter-spacing: 1rpx;
}
.brand-model { 
  font-size: 26rpx; 
  color: #ffffff; 
  font-weight: bold;
}
.owner-info { 
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}
.info-row {
  display: flex;
  font-size: 24rpx;
}
.label-txt {
  color: #8e8e93;
}
.value-txt {
  color: #e0e0e6;
  font-weight: bold;
}
.phone-txt {
  color: #3b82f6;
  text-decoration: underline;
}

.vehicle-card-right {
  margin-left: 20rpx;
}
.quick-bill-btn {
  height: 68rpx;
  line-height: 68rpx;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: #ffffff;
  font-size: 24rpx;
  border-radius: 34rpx;
  border: none;
  padding: 0 30rpx;
  box-shadow: 0 4rpx 10rpx rgba(16, 185, 129, 0.3);
}

/* ➕ 新建车辆悬浮按钮 (对标“百易云修”) */
.floating-action {
  position: fixed;
  bottom: 40rpx;
  left: 40rpx;
  right: 40rpx;
  height: 90rpx;
  line-height: 90rpx;
  text-align: center;
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  border-radius: 45rpx;
  box-shadow: 0 8rpx 24rpx rgba(59, 130, 246, 0.4);
  z-index: 99;
}
.floating-text {
  font-size: 28rpx;
  font-weight: bold;
  color: #ffffff;
  letter-spacing: 1rpx;
}
.pulse-glow {
  animation: pulse 2.5s infinite;
}
@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.5); }
  70% { box-shadow: 0 0 0 12rpx rgba(59, 130, 246, 0); }
  100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
}

/* 暂无结果 */
.empty-state { 
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 150rpx 0; 
}
.empty-icon {
  font-size: 72rpx;
  margin-bottom: 20rpx;
}
.empty-text {
  font-size: 28rpx;
  color: #8e8e93;
}

/* 车辆360详情 */
.premium-card { 
  background: #1c1c1e; 
  border-radius: 20rpx; 
  padding: 30rpx; 
  margin-bottom: 24rpx; 
  border: 1rpx solid #2c2c2e;
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.15); 
}
.info-card { 
  margin-top: 10rpx;
}
.card-header { 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  margin-bottom: 24rpx; 
  border-bottom: 1rpx solid #2c2c2e; 
  padding-bottom: 16rpx; 
}
.plate-badge { 
  background: #3b82f6; 
  color: #ffffff; 
  padding: 8rpx 24rpx; 
  border-radius: 30rpx; 
  font-size: 30rpx; 
  font-weight: 800; 
}
.back-btn { 
  font-size: 24rpx; 
  color: #a1a1a9; 
  padding: 6rpx 20rpx;
  background: #2c2c2e;
  border-radius: 20rpx;
}
.info-body { 
  display: flex; 
  flex-direction: column; 
  gap: 16rpx; 
}
.info-item { 
  display: flex; 
  font-size: 26rpx; 
}
.label { 
  color: #a1a1a9; 
  width: 140rpx; 
}
.value { 
  color: #ffffff; 
  font-weight: bold; 
}
.text-phone {
  color: #3b82f6;
  text-decoration: underline;
}

/* 会员资产组 */
.asset-group { 
  border: 1rpx solid #2c2c2e; 
  border-radius: 12rpx; 
  padding: 20rpx; 
  background: #161618; 
}
.asset-title { 
  font-size: 24rpx; 
  font-weight: bold; 
  color: #ffffff; 
  margin-bottom: 20rpx; 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  border-bottom: 1rpx solid #2c2c2e;
  padding-bottom: 12rpx;
}
.group-label {
  color: #a1a1a9;
}
.action-btn-text {
  color: #3b82f6;
}

.stored-card { 
  border-bottom: 1rpx dashed #2c2c2e; 
  padding: 16rpx 0; 
}
.stored-card:last-child { 
  border-bottom: none; 
}
.card-no-row {
  display: flex;
  align-items: center;
  gap: 8rpx;
  font-size: 24rpx;
  color: #ffffff;
  font-weight: bold;
}
.card-icon {
  color: #fbbf24;
}
.card-balance-row {
  margin-top: 8rpx;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}
.card-balance {
  font-size: 26rpx;
  color: #e0e0e6;
}
.amt-highlight {
  color: #f43f5e;
  font-weight: 800;
  font-size: 28rpx;
}
.card-details {
  font-size: 20rpx;
  color: #8e8e93;
}

.package-card { 
  border-bottom: 1rpx dashed #2c2c2e; 
  padding: 20rpx 0; 
}
.package-card:last-child { 
  border-bottom: none; 
}
.package-header { 
  display: flex; 
  justify-content: space-between; 
  font-size: 26rpx; 
  font-weight: bold; 
  color: #ffffff; 
  margin-bottom: 12rpx; 
}
.package-name { 
  color: #fbbf24; 
}
.package-date { 
  font-size: 20rpx; 
  color: #8e8e93; 
}
.package-item { 
  display: flex; 
  justify-content: space-between; 
  font-size: 24rpx; 
  color: #e0e0e6; 
  padding: 6rpx 0; 
}
.item-name {
  color: #a1a1a9;
}
.qty-highlight {
  color: #3b82f6;
}
.no-asset { 
  font-size: 24rpx; 
  color: #767680; 
  text-align: center; 
  padding: 20rpx 0; 
}

/* 历史工单明细 */
.order-item { 
  border-bottom: 1rpx solid #2c2c2e; 
  padding: 20rpx 0; 
}
.order-item:last-child { 
  border-bottom: none; 
}
.order-header { 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  margin-bottom: 12rpx; 
}
.order-no {
  font-size: 26rpx;
  color: #a1a1a9;
}
.order-status {
  font-size: 20rpx;
  padding: 4rpx 12rpx;
  border-radius: 6rpx;
  font-weight: bold;
}
.order-status.draft { background: rgba(142, 142, 147, 0.15); color: #8e8e93; }
.order-status.confirmed { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
.order-status.in_progress { background: rgba(251, 191, 36, 0.15); color: #fbbf24; }
.order-status.completed { background: rgba(16, 185, 129, 0.15); color: #10b981; }
.order-status.settled { background: rgba(139, 92, 246, 0.15); color: #8b5cf6; }
.order-status.cancelled { background: rgba(239, 68, 68, 0.15); color: #ef4444; }

.order-body {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10rpx;
}
.order-desc {
  font-size: 26rpx;
  color: #ffffff;
  font-weight: bold;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-right: 20rpx;
}
.order-amount {
  font-size: 26rpx;
  color: #f43f5e;
  font-weight: 800;
}
.order-footer {
  font-size: 20rpx;
  color: #8e8e93;
}
.empty-orders {
  font-size: 24rpx;
  color: #767680;
  text-align: center;
  padding: 40rpx 0;
}

/* 弹窗设计 */
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
.modal-title { 
  font-size: 32rpx; 
  font-weight: bold; 
  color: #ffffff; 
  margin-bottom: 24rpx; 
  text-align: center; 
}

/* 分段控制器 */
.segmented-control { 
  display: flex; 
  background: #161618; 
  border-radius: 12rpx; 
  padding: 6rpx; 
  margin-bottom: 24rpx; 
  border: 1rpx solid #2c2c2e; 
}
.segment-item { 
  flex: 1; 
  text-align: center; 
  font-size: 24rpx; 
  color: #a1a1a9; 
  padding: 12rpx 0; 
  border-radius: 8rpx; 
  font-weight: bold; 
}
.segment-item.active { 
  background: #3b82f6; 
  color: #ffffff; 
}
.segment-item.disabled {
  opacity: 0.3;
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
.form-item.checkbox-item {
  justify-content: flex-start;
  gap: 16rpx;
}
.checkbox-label {
  font-size: 24rpx;
  color: #ffffff;
}
.form-label { 
  font-size: 26rpx; 
  color: #a1a1a9; 
  width: 180rpx; 
}
.form-input { 
  flex: 1; 
  font-size: 26rpx; 
  color: #ffffff; 
  text-align: right; 
}
.form-picker {
  flex: 1;
}
.picker-value {
  font-size: 26rpx;
  color: #3b82f6;
  text-align: right;
  font-weight: bold;
}
.arrow {
  font-size: 18rpx;
  margin-left: 6rpx;
}

.action-link {
  font-size: 22rpx;
  color: #3b82f6;
  margin-left: 16rpx;
  text-decoration: underline;
}

.form-section {
  margin-top: 24rpx;
}
.form-section-title {
  display: flex;
  justify-content: space-between;
  font-size: 24rpx;
  font-weight: bold;
  color: #a1a1a9;
  margin-bottom: 16rpx;
}

.package-item-list {
  background: #161618;
  border-radius: 12rpx;
  padding: 12rpx;
  border: 1rpx solid #2c2c2e;
}
.package-item-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #2c2c2e;
}
.package-item-row:last-child {
  border-bottom: none;
}
.pkg-item-name {
  font-size: 24rpx;
  color: #ffffff;
  width: 260rpx;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pkg-item-qty {
  display: flex;
  align-items: center;
  gap: 8rpx;
}
.qty-btn {
  width: 44rpx;
  height: 44rpx;
  line-height: 40rpx;
  text-align: center;
  background: #2c2c2e;
  color: #ffffff;
  border-radius: 6rpx;
  font-size: 28rpx;
}
.qty-input {
  width: 50rpx;
  text-align: center;
  font-size: 24rpx;
  color: #ffffff;
  font-weight: bold;
}
.qty-unit {
  font-size: 20rpx;
  color: #a1a1a9;
}
.pkg-item-del {
  font-size: 22rpx;
  color: #f43f5e;
}
.empty-pkg-items {
  font-size: 22rpx;
  color: #767680;
  text-align: center;
  padding: 20rpx 0;
}

/* 选择项目子弹窗 */
.sub-modal {
  z-index: 1100;
}
.sub-content {
  width: 560rpx;
  height: 800rpx;
  display: flex;
  flex-direction: column;
}
.service-scroll-list {
  flex: 1;
  margin: 16rpx 0;
}
.service-select-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx;
  background: #161618;
  border: 1rpx solid #2c2c2e;
  border-radius: 12rpx;
  margin-bottom: 12rpx;
}
.service-select-row.selected {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.1);
}
.svc-select-info {
  display: flex;
  flex-direction: column;
}
.svc-select-name {
  font-size: 24rpx;
  color: #ffffff;
  font-weight: bold;
}
.svc-select-price {
  font-size: 22rpx;
  color: #f43f5e;
  margin-top: 4rpx;
}
.svc-select-checkbox {
  width: 32rpx;
  height: 32rpx;
  line-height: 32rpx;
  text-align: center;
  background: #3b82f6;
  color: #ffffff;
  border-radius: 50%;
  font-size: 20rpx;
  font-weight: bold;
}

.modal-actions { 
  display: flex; 
  gap: 16rpx; 
  margin-top: 30rpx; 
}
.btn { 
  flex: 1; 
  height: 78rpx; 
  line-height: 78rpx; 
  text-align: center; 
  font-size: 26rpx; 
  border-radius: 39rpx; 
  border: none; 
}
.btn-secondary { 
  background: #2c2c2e; 
  color: #a1a1a9; 
}
.btn-primary { 
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); 
  color: #ffffff; 
}

.text-primary {
  color: #3b82f6;
}
.font-bold {
  font-weight: bold;
}
</style>
