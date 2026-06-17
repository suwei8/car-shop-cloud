<template>
  <view class="page">
    <view class="header">
      <text class="title">接待快速开单</text>
      <text class="subtitle">极速智能匹配与环车预检系统</text>
    </view>

    <!-- 客户车辆表单 -->
    <view class="section premium-card">
      <!-- Old vs. New Tab Control -->
      <view class="tab-control">
        <view :class="['tab-item', customerType === 'existing' ? 'active' : '']" @tap="setCustomerType('existing')">
          🔍 检索已有车辆 (老客户)
        </view>
        <view :class="['tab-item', customerType === 'new' ? 'active' : '']" @tap="setCustomerType('new')">
          ➕ 新建车辆档案 (新客户)
        </view>
      </view>

      <!-- 1. 检索已有车辆 (老客户流程) -->
      <view class="tab-content" v-if="customerType === 'existing'">
        <view class="form-item border-glow" v-if="!matchedVehicle">
          <text class="label">搜索车辆 *</text>
          <view class="search-row">
            <input class="input search-input" v-model="searchKeyword" type="text" placeholder="输入车牌号 / 联系电话" @input="onSearchInput" />
            <view class="ocr-btn" @tap="searchPlateOcr">
              <text class="ocr-icon">📷</text>
            </view>
          </view>
        </view>

        <!-- Selected Vehicle Card -->
        <view class="match-card exact-match-bg" v-if="matchedVehicle">
          <view class="match-header">
            <text class="match-badge">✅ 已选定车辆档案</text>
            <text class="reset-btn" @tap="clearMatchedVehicle">重新选择</text>
          </view>
          <view class="match-body">
            <view class="match-row">
              <text class="match-label">车牌号码：</text>
              <text class="match-val text-primary">{{ matchedVehicle.plateNo }}</text>
            </view>
            <view class="match-row">
              <text class="match-label">车主姓名：</text>
              <text class="match-val">{{ matchedVehicle.customer?.name }}</text>
            </view>
            <view class="match-row">
              <text class="match-label">联系电话：</text>
              <text class="match-val">{{ matchedVehicle.customer?.phone }}</text>
            </view>
            <view class="match-row">
              <text class="match-label">品牌车型：</text>
              <text class="match-val">{{ matchedVehicle.brand }} {{ matchedVehicle.model }}</text>
            </view>
            <view class="match-row" v-if="matchedVehicle.mileage">
              <text class="match-label">历史里程：</text>
              <text class="match-val">{{ matchedVehicle.mileage }} km</text>
            </view>
          </view>
        </view>

        <!-- Search Results Dropdown -->
        <view class="suggestions-container" v-if="searchKeyword.trim() && similarVehicles.length > 0 && !matchedVehicle">
          <view class="suggestions-header">
            <text class="suggestions-title">💡 检索到以下车辆，请点击选择：</text>
          </view>
          <view class="suggestion-list">
            <view class="suggestion-card" v-for="veh in similarVehicles" :key="veh.id" @tap="selectMatchedVehicle(veh)">
              <view class="s-plate">{{ veh.plateNo }}</view>
              <view class="s-info">
                <text class="s-owner">{{ veh.customer?.name }}</text>
                <text class="s-phone">{{ veh.customer?.phone ? veh.customer.phone.slice(-4) + ' 尾号' : '无号码' }}</text>
              </view>
              <view class="s-model">{{ veh.brand }} {{ veh.model }}</view>
            </view>
          </view>
        </view>

        <!-- No search results -->
        <view class="new-plate-banner" v-if="searchKeyword.trim() && similarVehicles.length === 0 && !matchedVehicle">
          <view class="banner-content">
            <text class="banner-icon">⚠️</text>
            <text class="banner-text">未检索到任何匹配的车辆档案。</text>
          </view>
          <button class="new-veh-btn pulse-glow" @tap="setCustomerType('new')">
            点此一键去新建档案
          </button>
        </view>

        <view class="search-placeholder-tip" v-if="!searchKeyword.trim() && !matchedVehicle">
          <text class="placeholder-tip-text">请在上方输入车牌号或手机号，系统将实时检索已有档案。</text>
        </view>
      </view>

      <!-- 2. 新建车辆档案 (新客户流程) -->
      <view class="tab-content" v-if="customerType === 'new'">
        <view class="new-vehicle-form-inline">
          <view class="form-sub-title">🆕 登记首进店车辆与车主档案</view>

          <view class="form-item border-glow">
            <text class="label">车牌号 *</text>
            <view class="plate-input-row">
              <input class="input plate-input" v-model="form.plateNo" type="text" placeholder="云G88888" />
              <view class="ocr-btn" @tap="recognizePlate">
                <text class="ocr-icon">📷</text>
                <text class="ocr-text">拍照识别</text>
              </view>
            </view>
          </view>

          <view class="form-item border-glow">
            <text class="label">VIN码</text>
            <view class="vin-row">
              <input class="input vin-input" v-model="form.vin" type="text" placeholder="可扫码/拍照自动填入" />
              <view class="scan-btn" @tap="scanVin">
                <text class="scan-icon">📱</text>
              </view>
              <view class="ocr-btn" @tap="recognizeVin">
                <text class="ocr-icon">📷</text>
                <text class="ocr-text">拍照识别</text>
              </view>
            </view>
          </view>

          <view class="form-item">
            <text class="label">车主姓名 *</text>
            <input class="input" v-model="form.customerName" type="text" placeholder="请输入车主姓名" />
          </view>

          <view class="form-item">
            <text class="label">联系电话 *</text>
            <input class="input" v-model="form.phone" type="number" placeholder="请输入11位手机号" maxlength="11" />
          </view>

          <view class="form-item">
            <text class="label">品牌车型 *</text>
            <view class="brand-picker-trigger" @tap="openBrandPicker">
              <text v-if="form.brandModel" class="brand-picker-value">{{ form.brandModel }}</text>
              <text v-else class="brand-picker-placeholder">点击选择品牌车系</text>
              <text class="arrow">▼</text>
            </view>
          </view>

          <view class="form-item" v-if="brandPickerManualMode">
            <text class="label">手动输入</text>
            <input class="input" v-model="form.brandModel" type="text" placeholder="例如：保时捷 911" />
          </view>

          <!-- Electrics & Insurance Care Dates -->
          <view class="care-section">
            <view class="care-title">📅 电销关怀提醒设置（选填）</view>

            <view class="care-grid">
              <!-- 年检到期日 -->
              <view class="care-card" :class="{ warning: isNearExpiry(annualInspectionDate) }">
                <view class="care-label">年检到期日</view>
                <picker mode="date" :value="annualInspectionDate" @change="onAnnualDateChange">
                  <view class="picker-date">{{ annualInspectionDate || '点击选择' }}</view>
                </picker>
                <view class="care-badge" v-if="isNearExpiry(annualInspectionDate)">🚨 临近到期</view>
              </view>

              <!-- 交强险到期日 -->
              <view class="care-card" :class="{ warning: isNearExpiry(compulsoryInsuranceDate) }">
                <view class="care-label">交强险到期</view>
                <picker mode="date" :value="compulsoryInsuranceDate" @change="onCompulsoryDateChange">
                  <view class="picker-date">{{ compulsoryInsuranceDate || '点击选择' }}</view>
                </picker>
                <view class="care-badge" v-if="isNearExpiry(compulsoryInsuranceDate)">🚨 临近到期</view>
              </view>

              <!-- 商业险到期日 -->
              <view class="care-card" :class="{ warning: isNearExpiry(commercialInsuranceDate) }">
                <view class="care-label">商业险到期</view>
                <picker mode="date" :value="commercialInsuranceDate" @change="onCommercialDateChange">
                  <view class="picker-date">{{ commercialInsuranceDate || '点击选择' }}</view>
                </picker>
                <view class="care-badge" v-if="isNearExpiry(commercialInsuranceDate)">🚨 临近到期</view>
              </view>
            </view>
          </view>
        </view>
      </view>

      <view class="form-item input-mileage">
        <text class="label">当前里程 (km) *</text>
        <input class="input" v-model="form.mileage" type="number" placeholder="请输入公里数" />
      </view>
    </view>

    <!-- 🚗 环车外观检查与照片上传 -->
    <view class="section premium-card">
      <view class="section-title">
        <text class="prefix">🚗</text>
        <text>环车预检外观登记</text>
      </view>

      <!-- 车辆部位选择网格 -->
      <view class="car-areas-grid">
        <view class="car-area-item" :class="{ active: activeArea === 'front' }" @tap="selectArea('front', '车头')">
          <text class="area-icon">🔽</text>
          <text class="area-text">车头</text>
        </view>
        <view class="car-area-item" :class="{ active: activeArea === 'rear' }" @tap="selectArea('rear', '车尾')">
          <text class="area-icon">🔼</text>
          <text class="area-text">车尾</text>
        </view>
        <view class="car-area-item" :class="{ active: activeArea === 'left' }" @tap="selectArea('left', '左侧车身')">
          <text class="area-icon">◀️</text>
          <text class="area-text">左侧身</text>
        </view>
        <view class="car-area-item" :class="{ active: activeArea === 'right' }" @tap="selectArea('right', '右侧车身')">
          <text class="area-icon">▶️</text>
          <text class="area-text">右侧身</text>
        </view>
        <view class="car-area-item" :class="{ active: activeArea === 'roof' }" @tap="selectArea('roof', '车顶/天窗')">
          <text class="area-icon">⬜</text>
          <text class="area-text">车顶</text>
        </view>
      </view>

      <!-- Active Inspection Panel -->
      <view class="inspection-panel" v-if="activeArea">
        <view class="panel-header">
          <text class="panel-title">📍 登记【{{ activeAreaName }}】外观状况</text>
          <text class="panel-close" @tap="activeArea = ''">✕</text>
        </view>

        <!-- Damage selection -->
        <view class="damage-options">
          <view :class="['damage-opt', precheckForm.damageType === type ? 'active' : '']"
                v-for="type in damageTypes" :key="type" @tap="precheckForm.damageType = type">
            {{ type }}
          </view>
        </view>

        <!-- Camera Upload -->
        <view class="precheck-photo-box">
          <view class="upload-trigger" v-if="!precheckForm.photoUrl" @tap="takePrecheckPhoto">
            <text class="upload-icon">📸</text>
            <text class="upload-text">拍摄异常部位照片</text>
          </view>
          <view class="photo-preview" v-else>
            <image class="preview-img" :src="precheckForm.photoUrl" mode="aspectFill" @tap="previewImage(precheckForm.photoUrl)" />
            <text class="del-photo-btn" @tap="precheckForm.photoUrl = ''">删除照片</text>
          </view>
        </view>

        <button class="add-precheck-btn" @tap="addPrecheckRecord">添加此项登记</button>
      </view>

      <!-- Record list -->
      <view class="record-list" v-if="precheckRecords.length > 0">
        <view class="record-title">📝 环车状况已记录列表：</view>
        <view class="record-item" v-for="(rec, idx) in precheckRecords" :key="idx">
          <view class="rec-info">
            <text class="rec-bullet">●</text>
            <text class="rec-area font-bold">[{{ rec.areaName }}]</text>
            <text class="rec-type font-bold text-danger">{{ rec.damageType }}</text>
          </view>
          <view class="rec-actions">
            <image class="rec-img" v-if="rec.photoUrl" :src="rec.photoUrl" mode="aspectFill" @tap="previewImage(rec.photoUrl)" />
            <text class="rec-del" @tap="deletePrecheckRecord(idx)">✕</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 工单类型与服务要求 -->
    <view class="section premium-card">
      <view class="section-title">
        <text class="prefix">📋</text>
        <text>工单服务要求</text>
      </view>

      <view class="form-item">
        <text class="label">工单类型 *</text>
        <picker @change="onOrderTypeChange" :value="orderTypeIndex" :range="orderTypeLabels">
          <view class="picker-val">{{ orderTypeLabels[orderTypeIndex] }}</view>
        </picker>
      </view>

      <view class="form-item vertical">
        <text class="label-v">要求/诉求描述</text>
        <textarea class="textarea" v-model="form.description" placeholder="请输入客户的服务诉求或故障描述..." />
      </view>

      <view class="form-item">
        <text class="label">预计交付日期</text>
        <picker mode="date" :value="expectDate" :start="todayStr" @change="onExpectDateChange">
          <view class="picker-val">{{ expectDate || '请选择完工日期' }}</view>
        </picker>
      </view>

      <view class="form-item">
        <text class="label">预计交付时间</text>
        <picker mode="time" :value="expectTime" @change="onExpectTimeChange">
          <view class="picker-val">{{ expectTime || '请选择完工时间' }}</view>
        </picker>
      </view>
    </view>

    <!-- 工单项目明细 -->
    <view class="section premium-card">
      <view class="section-title-between">
        <view class="sec-title-left">
          <text class="prefix">🔧</text>
          <text>选择施工项目与配件材料</text>
        </view>
      </view>

      <view class="selected-items-list">
        <view class="selected-item-row" v-for="(item, idx) in selectedItems" :key="idx">
          <view class="sel-item-info">
            <text class="sel-item-name font-bold">{{ item.name }}</text>
            <text class="sel-item-badge" :class="item.itemType">{{ item.itemType === 'service' ? '服务项目' : '配件材料' }}</text>
          </view>
          <view class="sel-item-price-qty">
            <view class="qty-adjust-box">
              <text class="qty-btn" @tap="adjustItemQty(idx, -1)">-</text>
              <input class="qty-input" type="number" v-model.number="item.quantity" @input="calculateTotal" />
              <text class="qty-btn" @tap="adjustItemQty(idx, 1)">+</text>
              <text class="qty-unit">{{ item.unit || '次' }}</text>
            </view>
            <text class="sel-item-price font-bold">¥{{ Number(item.unitPrice * item.quantity).toFixed(2) }}</text>
          </view>
          <text class="sel-item-del font-bold" @tap="removeSelectedItem(idx)">✕</text>
        </view>
        <view class="empty-items-tip" v-if="selectedItems.length === 0">尚未选择任何服务或配件</view>
      </view>

      <view class="add-buttons-row">
        <button class="btn btn-outline font-bold" @tap="openServicePicker">+ 选择服务项目</button>
        <button class="btn btn-outline font-bold" @tap="openPartPicker">+ 选择配件材料</button>
      </view>
    </view>

    <!-- 底部合计与按钮 -->
    <view class="bottom-bar">
      <view class="total-price-preview">
        <text class="total-label">工单总计金额：</text>
        <text class="total-val font-bold">¥{{ Number(totalAmount).toFixed(2) }}</text>
      </view>
      <button class="submit-btn font-bold pulse-glow" :loading="submitting" @tap="submitOrder">确认接车开单</button>
    </view>

    <!-- 品牌车型选择器弹窗 -->
    <view class="modal-mask" v-if="showBrandPicker" @tap.self="showBrandPicker = false">
      <view class="brand-modal premium-card">
        <view class="brand-modal-header">
          <text class="brand-modal-title">选择品牌车型</text>
          <text class="brand-modal-close" @tap="showBrandPicker = false">×</text>
        </view>

        <view class="brand-search-box">
          <input class="brand-search-input" v-model="brandSearchKeyword" type="text" placeholder="搜索品牌或车系..." />
        </view>

        <view class="brand-switch" @tap="toggleManualMode">
          <text class="brand-switch-text">没有想要的？切换手动输入</text>
        </view>

        <view class="brand-columns">
          <scroll-view class="brand-col" scroll-y="true">
            <view :class="['brand-opt', selectedBrand === b.brand ? 'active' : '']" v-for="b in filteredBrands" :key="b.brand" @tap="selectBrand(b.brand)">
              {{ b.brand }}
            </view>
            <view class="brand-empty" v-if="filteredBrands.length === 0">无匹配品牌</view>
          </scroll-view>

          <scroll-view class="series-col" scroll-y="true">
            <view :class="['series-opt', selectedSeries === s ? 'active' : '']" v-for="s in filteredSeries" :key="s" @tap="selectSeries(s)">
              {{ s }}
            </view>
            <view class="brand-empty" v-if="filteredSeries.length === 0 && selectedBrand">该品牌暂无车系</view>
            <view class="brand-empty" v-if="!selectedBrand">请先选择品牌</view>
          </scroll-view>
        </view>

        <view class="brand-modal-footer">
          <text class="brand-selection-preview" v-if="selectedBrand && selectedSeries">已选：{{ selectedBrand }} {{ selectedSeries }}</text>
          <text class="brand-selection-preview" v-else-if="selectedBrand">已选品牌：{{ selectedBrand }}</text>
          <text class="brand-selection-preview text-gray" v-else>请选择品牌和车系</text>
          <button class="brand-confirm-btn" :disabled="!selectedSeries" @tap="confirmBrandSelection">确认选择</button>
        </view>
      </view>
    </view>

    <!-- 🔧 服务项目选择器弹窗 -->
    <view class="modal-mask" v-if="showServicePicker" @tap.self="showServicePicker = false">
      <view class="modal-content premium-card">
        <view class="modal-header">
          <text class="modal-title font-bold">选择服务项目</text>
          <text class="modal-close" @tap="showServicePicker = false">×</text>
        </view>

        <view class="search-header compact">
          <input class="search-input" v-model="serviceSearch" type="text" placeholder="搜索服务项目名称" />
        </view>

        <scroll-view class="scroll-list-picker" scroll-y="true">
          <view class="select-row-card" v-for="item in filteredServices" :key="item.id" @tap="addServiceItem(item)">
            <view class="row-info">
              <text class="row-name font-bold">{{ item.name }}</text>
              <text class="row-category">{{ item.category || '未分类' }}</text>
            </view>
            <text class="row-price font-bold">¥{{ Number(item.unitPrice).toFixed(2) }}</text>
          </view>
          <view class="brand-empty" v-if="filteredServices.length === 0">暂无匹配的服务项目</view>
        </scroll-view>
      </view>
    </view>

    <!-- 📦 配件材料选择器弹窗 -->
    <view class="modal-mask" v-if="showPartPicker" @tap.self="showPartPicker = false">
      <view class="modal-content premium-card">
        <view class="modal-header">
          <text class="modal-title font-bold">选择配件材料</text>
          <text class="modal-close" @tap="showPartPicker = false">×</text>
        </view>

        <view class="search-header compact">
          <input class="search-input" v-model="partSearch" type="text" placeholder="搜索配件名称 / 编码" />
        </view>

        <scroll-view class="scroll-list-picker" scroll-y="true">
          <view class="select-row-card" v-for="part in filteredParts" :key="part.id" @tap="addPartItem(part)">
            <view class="row-info">
              <text class="row-name font-bold">{{ part.name }}</text>
              <text class="row-sub">编码: {{ part.code }} | 品牌: {{ part.brand || '无' }}</text>
              <text class="row-stock" :class="getPartStock(part) <= part.minStock ? 'text-warning' : 'text-success'">
                库存: {{ getPartStock(part) }} {{ part.unit || '个' }} (阀值: {{ part.minStock || 0 }})
              </text>
            </view>
            <text class="row-price font-bold">¥{{ Number(part.salePrice).toFixed(2) }}</text>
          </view>
          <view class="brand-empty" v-if="filteredParts.length === 0">暂无匹配的配件材料</view>
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { request } from '../../utils/request';

interface BrandSeries {
  brand: string;
  series: string[];
}

const form = ref({
  plateNo: '',
  customerName: '',
  phone: '',
  brandModel: '',
  mileage: '',
  description: '',
  vin: '',
});

const submitting = ref(false);

// 新老客户流程划分
const customerType = ref<'existing' | 'new'>('existing');
const searchKeyword = ref('');
const matchedVehicle = ref<any>(null);
const similarVehicles = ref<any[]>([]);
const showNewPlateBanner = ref(false);

const annualInspectionDate = ref('');
const compulsoryInsuranceDate = ref('');
const commercialInspectionDate = ref(''); // Keep same naming
const commercialInsuranceDate = commercialInspectionDate; // Alias to prevent typing errors

const expectDate = ref('');
const expectTime = ref('');

// SVG 环车外观检查相关变量
const activeArea = ref('');
const activeAreaName = ref('');
const precheckForm = ref({
  damageType: '划痕',
  photoUrl: ''
});
const damageTypes = ['划痕', '凹陷', '碎裂', '缺失'];
const precheckRecords = ref<any[]>([]);
const selectedItems = ref<any[]>([]);
const totalAmount = ref(0);

const showServicePicker = ref(false);
const serviceSearch = ref('');
const serviceList = ref<any[]>([]);

const showPartPicker = ref(false);
const partSearch = ref('');
const partList = ref<any[]>([]);

const filteredServices = computed(() => {
  if (!serviceSearch.value.trim()) return serviceList.value;
  const kw = serviceSearch.value.toLowerCase().trim();
  return serviceList.value.filter(s => s.name.toLowerCase().includes(kw));
});

const filteredParts = computed(() => {
  if (!partSearch.value.trim()) return partList.value;
  const kw = partSearch.value.toLowerCase().trim();
  return partList.value.filter(p => p.name.toLowerCase().includes(kw) || p.code.toLowerCase().includes(kw));
});

function getPartStock(part: any): number {
  if (!part.stockBalances || part.stockBalances.length === 0) return 0;
  return part.stockBalances.reduce((sum: number, bal: any) => sum + Number(bal.quantity), 0);
}

async function openServicePicker() {
  showServicePicker.value = true;
  serviceSearch.value = '';
  if (serviceList.value.length === 0) {
    const token = uni.getStorageSync('accessToken');
    const res: any = await request({
      url: '/api/service-items?page=1&pageSize=100',
      method: 'GET',
      header: { Authorization: `Bearer ${token}` }
    });
    if (res.data?.code === 0) {
      serviceList.value = res.data.data.items || res.data.data || [];
    }
  }
}

async function openPartPicker() {
  showPartPicker.value = true;
  partSearch.value = '';
  if (partList.value.length === 0) {
    const token = uni.getStorageSync('accessToken');
    const res: any = await request({
      url: '/api/parts?page=1&pageSize=100',
      method: 'GET',
      header: { Authorization: `Bearer ${token}` }
    });
    if (res.data?.code === 0) {
      partList.value = res.data.data.items || res.data.data || [];
    }
    // 如果数据库为空，填充常用配件测试数据
    if (partList.value.length === 0) {
      partList.value = [
        { id: 'p1', name: '机油(全合成 5W-30)', code: 'OIL-5W30', salePrice: 180, unit: '升', stockBalances: [{ quantity: 50 }] },
        { id: 'p2', name: '机油滤芯', code: 'OF-001', salePrice: 35, unit: '个', stockBalances: [{ quantity: 100 }] },
        { id: 'p3', name: '空气滤芯', code: 'AF-001', salePrice: 45, unit: '个', stockBalances: [{ quantity: 80 }] },
        { id: 'p4', name: '空调滤芯', code: 'CF-001', salePrice: 55, unit: '个', stockBalances: [{ quantity: 80 }] },
        { id: 'p5', name: '刹车片(前)', code: 'BP-F01', salePrice: 280, unit: '套', stockBalances: [{ quantity: 30 }] },
        { id: 'p6', name: '刹车片(后)', code: 'BP-R01', salePrice: 220, unit: '套', stockBalances: [{ quantity: 30 }] },
        { id: 'p7', name: '雨刮片(一对)', code: 'WG-001', salePrice: 68, unit: '对', stockBalances: [{ quantity: 50 }] },
        { id: 'p8', name: '火花塞', code: 'SP-001', salePrice: 45, unit: '个', stockBalances: [{ quantity: 200 }] },
        { id: 'p9', name: '变速箱油', code: 'ATF-001', salePrice: 120, unit: '升', stockBalances: [{ quantity: 30 }] },
        { id: 'p10', name: '防冻液', code: 'CL-001', salePrice: 65, unit: '升', stockBalances: [{ quantity: 40 }] },
        { id: 'p11', name: '刹车油', code: 'BF-001', salePrice: 58, unit: '升', stockBalances: [{ quantity: 35 }] },
        { id: 'p12', name: '轮胎(205/55R16)', code: 'TIRE-205', salePrice: 450, unit: '条', stockBalances: [{ quantity: 20 }] },
        { id: 'p13', name: '蓄电池(60Ah)', code: 'BAT-60', salePrice: 580, unit: '个', stockBalances: [{ quantity: 10 }] },
        { id: 'p14', name: '灯泡(H7)', code: 'LAMP-H7', salePrice: 35, unit: '个', stockBalances: [{ quantity: 100 }] },
        { id: 'p15', name: '玻璃水', code: 'GW-001', salePrice: 25, unit: '瓶', stockBalances: [{ quantity: 200 }] },
      ];
    }
  }
}

function addServiceItem(item: any) {
  selectedItems.value.push({
    id: item.id,
    itemType: 'service',
    name: item.name,
    quantity: 1,
    unit: '工时',
    unitPrice: Number(item.unitPrice)
  });
  calculateTotal();
  showServicePicker.value = false;
}

function addPartItem(part: any) {
  selectedItems.value.push({
    id: part.id,
    itemType: 'part',
    name: part.name,
    quantity: 1,
    unit: part.unit || '个',
    unitPrice: Number(part.salePrice)
  });
  calculateTotal();
  showPartPicker.value = false;
}

function adjustItemQty(idx: number, delta: number) {
  const item = selectedItems.value[idx];
  if (item) {
    const newVal = item.quantity + delta;
    item.quantity = newVal < 1 ? 1 : newVal;
  }
  calculateTotal();
}

function removeSelectedItem(idx: number) {
  selectedItems.value.splice(idx, 1);
  calculateTotal();
}

function calculateTotal() {
  totalAmount.value = selectedItems.value.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
}

// 品牌车型选择器
const brandLibrary = ref<BrandSeries[]>([]);
const showBrandPicker = ref(false);
const brandSearchKeyword = ref('');
const selectedBrand = ref('');
const selectedSeries = ref('');
const brandPickerManualMode = ref(false);

const filteredBrands = computed(() => {
  const kw = brandSearchKeyword.value.trim().toLowerCase();
  if (!kw) return brandLibrary.value;
  return brandLibrary.value.filter(b =>
    b.brand.toLowerCase().includes(kw) ||
    b.series.some(s => s.toLowerCase().includes(kw))
  );
});

const filteredSeries = computed(() => {
  if (!selectedBrand.value) return [];
  const brand = brandLibrary.value.find(b => b.brand === selectedBrand.value);
  if (!brand) return [];
  const kw = brandSearchKeyword.value.trim().toLowerCase();
  if (!kw) return brand.series;
  return brand.series.filter(s => s.toLowerCase().includes(kw));
});

function openBrandPicker() {
  brandSearchKeyword.value = '';
  selectedBrand.value = '';
  selectedSeries.value = '';
  showBrandPicker.value = true;
}

function selectBrand(brand: string) {
  selectedBrand.value = brand;
  selectedSeries.value = '';
}

function selectSeries(series: string) {
  selectedSeries.value = series;
}

function confirmBrandSelection() {
  if (selectedBrand.value && selectedSeries.value) {
    form.value.brandModel = `${selectedBrand.value} ${selectedSeries.value}`;
    showBrandPicker.value = false;
  }
}

function toggleManualMode() {
  brandPickerManualMode.value = !brandPickerManualMode.value;
  showBrandPicker.value = false;
}

async function fetchBrandLibrary() {
  try {
    const token = uni.getStorageSync('accessToken');
    const res: any = await request({
      url: '/api/vehicles/brand-library',
      method: 'GET',
      header: { Authorization: `Bearer ${token}` },
    });
    if (res.data?.code === 0 && Array.isArray(res.data.data)) {
      brandLibrary.value = res.data.data;
    }
  } catch {}
}

onMounted(() => {
  fetchBrandLibrary();
});

const todayStr = computed(() => {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
});

function onExpectDateChange(e: any) {
  expectDate.value = e.detail.value;
}

function onExpectTimeChange(e: any) {
  expectTime.value = e.detail.value;
}

// “工单类型”选项修改为：机修、保养、钣金、喷漆、洗美、施救
const orderTypes = ['repair', 'maintenance', 'sheet_metal', 'painting', 'wash', 'rescue'];
const orderTypeLabels = ['机修', '保养', '钣金', '喷漆', '洗美', '施救'];
const orderTypeIndex = ref(0);

function onOrderTypeChange(e: any) {
  orderTypeIndex.value = e.detail.value;
}

function setCustomerType(type: 'existing' | 'new') {
  customerType.value = type;
  // 切换分类时清除状态
  matchedVehicle.value = null;
  similarVehicles.value = [];
  searchKeyword.value = '';
  showNewPlateBanner.value = false;

  form.value.customerName = '';
  form.value.phone = '';
  form.value.brandModel = '';
  form.value.plateNo = '';
}

// 搜索栏车牌拍照识别
function searchPlateOcr() {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: async (chooseRes) => {
      const tempFilePath = chooseRes.tempFilePaths[0];
      uni.showLoading({ title: '正在识别车牌...', mask: true });

      try {
        const base64 = await imageToBase64(tempFilePath);
        if (!base64) {
          uni.showToast({ title: '图片转换失败', icon: 'none' });
          return;
        }

        const token = uni.getStorageSync('accessToken');
        const res: any = await request({
          url: '/api/ocr/license-plate',
          method: 'POST',
          header: { Authorization: `Bearer ${token}` },
          data: { imageBase64: base64 }
        });

        if (res.data?.code === 0 && res.data.data?.plateNo) {
          const plateNo = res.data.data.plateNo;
          searchKeyword.value = plateNo;
          // 自动触发搜索
          onSearchInput();
          uni.showToast({ title: `已识别：${plateNo}`, icon: 'success' });
        } else {
          uni.showToast({ title: '未能识别车牌', icon: 'none' });
        }
      } catch (err: any) {
        uni.showToast({ title: '识别失败', icon: 'none' });
      } finally {
        uni.hideLoading();
      }
    },
    fail: () => {
      uni.showToast({ title: '拍照取消', icon: 'none' });
    }
  });
}

// 实时模糊车牌与电话检索
async function onSearchInput() {
  const keyword = searchKeyword.value.trim();
  if (!keyword) {
    similarVehicles.value = [];
    showNewPlateBanner.value = false;
    return;
  }

  const token = uni.getStorageSync('accessToken');
  try {
    const res: any = await request({
      url: `/api/vehicles/search?keyword=${encodeURIComponent(keyword)}`,
      method: 'GET',
      header: { Authorization: `Bearer ${token}` }
    });

    if (res.data?.code === 0 && res.data.data.length > 0) {
      similarVehicles.value = res.data.data;
      showNewPlateBanner.value = false;
    } else {
      similarVehicles.value = [];
      showNewPlateBanner.value = true;
    }
  } catch (e) {
    // 忽略异常
  }
}

function selectMatchedVehicle(veh: any) {
  matchedVehicle.value = veh;
  form.value.customerName = veh.customer?.name || '';
  form.value.phone = veh.customer?.phone || '';
  form.value.brandModel = `${veh.brand || ''} ${veh.model || ''}`.trim();
  form.value.plateNo = veh.plateNo;

  similarVehicles.value = [];
  showNewPlateBanner.value = false;
}

function clearMatchedVehicle() {
  matchedVehicle.value = null;
  searchKeyword.value = '';
  similarVehicles.value = [];
  showNewPlateBanner.value = false;

  form.value.customerName = '';
  form.value.phone = '';
  form.value.brandModel = '';
  form.value.plateNo = '';
}

// 检查是否临期关怀 (30天内到期)
function isNearExpiry(dateStr: string) {
  if (!dateStr) return false;
  const targetTime = new Date(dateStr + 'T00:00:00').getTime();
  const todayTime = new Date().getTime();
  const diffDays = (targetTime - todayTime) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= 30;
}

function onAnnualDateChange(e: any) {
  annualInspectionDate.value = e.detail.value;
}

function onCompulsoryDateChange(e: any) {
  compulsoryInsuranceDate.value = e.detail.value;
}

function onCommercialDateChange(e: any) {
  commercialInspectionDate.value = e.detail.value;
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
            header: { 'Content-Type': mimeType },
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

// SVG 车检选择区域
function selectArea(areaCode: string, areaName: string) {
  activeArea.value = areaCode;
  activeAreaName.value = areaName;
  precheckForm.value.damageType = '划痕';
  precheckForm.value.photoUrl = '';
}

// 现场拍照上传
function takePrecheckPhoto() {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: (chooseRes) => {
      const tempFilePath = chooseRes.tempFilePaths[0];
      precheckForm.value.photoUrl = tempFilePath;
      uni.showToast({ title: '照片已选择', icon: 'success' });
    }
  });
}

function addPrecheckRecord() {
  if (!activeArea.value) return;
  precheckRecords.value.push({
    areaCode: activeArea.value,
    areaName: activeAreaName.value,
    damageType: precheckForm.value.damageType,
    photoUrl: precheckForm.value.photoUrl
  });

  activeArea.value = '';
  activeAreaName.value = '';
}

function deletePrecheckRecord(index: number) {
  precheckRecords.value.splice(index, 1);
}

function previewImage(url: string) {
  uni.previewImage({ urls: [url] });
}

function scanVin() {
  uni.scanCode({
    onlyFromCamera: false,
    scanType: ['qrCode', 'barCode'],
    success: (res) => {
      if (res.result) {
        form.value.vin = res.result.toUpperCase();
        uni.showToast({ title: 'VIN扫码成功', icon: 'success' });
      }
    },
    fail: () => {
      uni.showToast({ title: '扫码取消', icon: 'none' });
    }
  });
}

// VIN 码拍照识别
function recognizeVin() {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: async (chooseRes) => {
      const tempFilePath = chooseRes.tempFilePaths[0];
      uni.showLoading({ title: '正在识别 VIN 码...', mask: true });

      try {
        const base64 = await imageToBase64(tempFilePath);

        if (!base64) {
          uni.showToast({ title: '图片转换失败', icon: 'none' });
          return;
        }

        const token = uni.getStorageSync('accessToken');
        const res: any = await request({
          url: '/api/ocr/vin',
          method: 'POST',
          header: { Authorization: `Bearer ${token}` },
          data: { imageBase64: base64 }
        });

        if (res.data?.code === 0 && res.data.data?.plateNo) {
          const vin = res.data.data.plateNo;
          const confidence = res.data.data.confidence;

          uni.showModal({
            title: 'VIN 码识别结果',
            content: `识别到 VIN：${vin}\n置信度：${(confidence * 100).toFixed(0)}%\n\n是否使用此 VIN 码？`,
            confirmText: '使用',
            cancelText: '重新拍照',
            success: (modalRes) => {
              if (modalRes.confirm) {
                form.value.vin = vin;
                // 自动查询车辆信息
                decodeVinAndFillInfo(vin);
              }
            }
          });
        } else {
          uni.showToast({ title: '未能识别 VIN 码，请手动输入', icon: 'none' });
        }
      } catch (err: any) {
        console.error('[VIN] 错误:', err);
        uni.showModal({
          title: '识别失败',
          content: err.message || 'VIN 识别出错，请重试或手动输入',
          showCancel: false
        });
      } finally {
        uni.hideLoading();
      }
    },
    fail: (err: any) => {
      uni.showToast({ title: '拍照取消', icon: 'none' });
    }
  });
}

// 通过 VIN 码查询车辆信息并自动填入
async function decodeVinAndFillInfo(vin: string) {
  try {
    uni.showLoading({ title: '正在查询车辆信息...', mask: true });

    const token = uni.getStorageSync('accessToken');
    const res: any = await request({
      url: `/api/vin/decode?vin=${vin}`,
      method: 'GET',
      header: { Authorization: `Bearer ${token}` }
    });

    // 处理嵌套响应格式：res.data.data.data
    let info = null;
    if (res.data?.code === 0 && res.data.data) {
      if (res.data.data.code === 0 && res.data.data.data) {
        info = res.data.data.data;
      } else if (res.data.data.brand) {
        info = res.data.data;
      }
    }

    if (info && info.brand) {
      // 自动填入品牌车型（格式：品牌 车型 年款）
      const parts = [info.brand, info.model, info.year ? info.year + '款' : ''].filter(Boolean);
      const brandModel = parts.join(' ');
      form.value.brandModel = brandModel;

      // 显示详细提示
      const details = [
        info.brand ? `品牌：${info.brand}` : '',
        info.model ? `车型：${info.model}` : '',
        info.year ? `年款：${info.year}` : '',
        info.engineType ? `发动机：${info.engineType}` : '',
        info.country ? `产地：${info.country}` : '',
      ].filter(Boolean).join('\n');

      uni.showModal({
        title: '车辆信息已识别',
        content: details || '已填入品牌信息',
        showCancel: false,
        confirmText: '知道了'
      });
    } else {
      uni.showToast({ title: 'VIN 已填入，请手动选择车型', icon: 'none' });
    }
  } catch (err: any) {
    console.error('[VIN] 查询失败:', err);
    uni.showToast({ title: 'VIN 已填入，请手动选择车型', icon: 'none' });
  } finally {
    uni.hideLoading();
  }
}

// 车牌拍照识别
function recognizePlate() {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: async (chooseRes) => {
      const tempFilePath = chooseRes.tempFilePaths[0];
      uni.showLoading({ title: '正在识别车牌...', mask: true });

      try {
        // 将图片转换为 base64
        const base64 = await imageToBase64(tempFilePath);

        if (!base64) {
          uni.showToast({ title: '图片转换失败', icon: 'none' });
          return;
        }

        // 调用后端 OCR 接口
        const token = uni.getStorageSync('accessToken');
        const res: any = await request({
          url: '/api/ocr/license-plate',
          method: 'POST',
          header: { Authorization: `Bearer ${token}` },
          data: { imageBase64: base64 }
        });

        if (res.data?.code === 0 && res.data.data?.plateNo) {
          const { plateNo, confidence } = res.data.data;

          // 弹窗让用户确认或修改
          uni.showModal({
            title: '车牌识别结果',
            content: `识别到车牌：${plateNo}\n置信度：${(confidence * 100).toFixed(0)}%\n\n是否使用此车牌号？`,
            confirmText: '使用',
            cancelText: '重新拍照',
            success: (modalRes) => {
              if (modalRes.confirm) {
                form.value.plateNo = plateNo;
                uni.showToast({ title: '车牌已填入', icon: 'success' });
              }
            }
          });
        } else {
          uni.showToast({ title: '未能识别车牌，请手动输入', icon: 'none' });
        }
      } catch (err: any) {
        console.error('[OCR] 错误:', err);
        uni.showModal({
          title: '识别失败',
          content: err.message || '车牌识别出错，请重试或手动输入',
          showCancel: false
        });
      } finally {
        uni.hideLoading();
      }
    },
    fail: (err: any) => {
      uni.showToast({ title: '拍照取消', icon: 'none' });
    }
  });
}

// 图片转 base64
function imageToBase64(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // #ifdef H5
    fetch(filePath)
      .then(res => res.blob())
      .then(blob => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      })
      .catch(reject);
    // #endif

    // #ifdef MP-WEIXIN
    const fs = uni.getFileSystemManager();
    if (fs && typeof fs.readFile === 'function') {
      fs.readFile({
        filePath: filePath,
        encoding: 'base64',
        success: (res: any) => {
          resolve(res.data as string);
        },
        fail: (err: any) => {
          reject(new Error('读取图片失败: ' + (err.errMsg || '未知错误')));
        }
      });
    } else {
      reject(new Error('文件系统管理器不可用'));
    }
    // #endif

    // #ifdef APP-PLUS
    plus.io.resolveLocalFileSystemURL(filePath, (entry: any) => {
      entry.file((file: any) => {
        const reader = new plus.io.FileReader();
        reader.onloadend = (e: any) => {
          const base64 = e.target.result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = () => reject(new Error('读取图片失败'));
        reader.readAsDataURL(file);
      });
    }, () => reject(new Error('文件路径无效')));
    // #endif
  });
}

// 报价接车提交
async function submitOrder() {
  if (!form.value.mileage) {
    uni.showToast({ title: '请输入当前里程', icon: 'none' });
    return;
  }

  // 1. 如果是老客户流程，必须选定匹配的车辆档案
  if (customerType.value === 'existing' && !matchedVehicle.value) {
    uni.showToast({ title: '请先在上方检索并选定一个已有车辆档案', icon: 'none' });
    return;
  }

  // 2. 如果是新客户流程，必须完整填写新建档案所需的核心字段
  if (customerType.value === 'new') {
    if (!form.value.plateNo.trim()) {
      uni.showToast({ title: '请输入车牌号', icon: 'none' });
      return;
    }
    if (!form.value.customerName.trim()) {
      uni.showToast({ title: '请输入车主姓名', icon: 'none' });
      return;
    }
    if (!form.value.phone.trim() || form.value.phone.length !== 11) {
      uni.showToast({ title: '请输入正确的11位手机号', icon: 'none' });
      return;
    }
    if (!form.value.brandModel.trim()) {
      uni.showToast({ title: '请选择或输入品牌车型', icon: 'none' });
      return;
    }
  }

  submitting.value = true;
  const token = uni.getStorageSync('accessToken');
  const storedInfo = uni.getStorageSync('userInfo');
  const userInfo = typeof storedInfo === 'object' ? storedInfo : JSON.parse(storedInfo || '{}');

  try {
    let customerId = '';
    let vehicleId = '';

    if (customerType.value === 'existing' && matchedVehicle.value) {
      customerId = matchedVehicle.value.customerId;
      vehicleId = matchedVehicle.value.id;
    } else {
      // 1. 新客户首进店，一键安全建立 Customer & Vehicle
      uni.showLoading({ title: '正在建立车辆档案...', mask: true });

      const custRes: any = await request({
        url: '/api/customers',
        method: 'POST',
        header: { Authorization: `Bearer ${token}` },
        data: {
          name: form.value.customerName.trim(),
          phone: form.value.phone.trim(),
        }
      });
      if (custRes.data?.code !== 0) {
        throw new Error(custRes.data?.message || '创建新客户档案失败');
      }
      customerId = custRes.data.data.id;

      // 解析品牌车型
      const brandParts = form.value.brandModel.trim().split(' ');
      const brand = brandParts[0] || '未知';
      const model = brandParts.slice(1).join(' ') || '未知';

      // 优雅地把关怀提醒日期和其它字段序列化存入 `remark` string 中
      const remarkJson = JSON.stringify({
        annualInspectionDate: annualInspectionDate.value || undefined,
        compulsoryInsuranceDate: compulsoryInsuranceDate.value || undefined,
        commercialInsuranceDate: commercialInspectionDate.value || undefined
      });

      const vehRes: any = await request({
        url: '/api/vehicles',
        method: 'POST',
        header: { Authorization: `Bearer ${token}` },
        data: {
          customerId,
          plateNo: form.value.plateNo.trim().toUpperCase(),
          brand,
          model,
          mileage: parseInt(form.value.mileage),
          remark: remarkJson,
        }
      });
      if (vehRes.data?.code !== 0) {
        throw new Error(vehRes.data?.message || '创建新车辆档案失败');
      }
      vehicleId = vehRes.data.data.id;
    }

    // 2. 将环车预检记录序列化组合进工单要求中，作为免责证明！
    let finalDescription = form.value.description.trim();
    if (precheckRecords.value.length > 0) {
      const precheckText = '【环车预检免责说明】：\n' + precheckRecords.value.map((r, i) =>
        `${i + 1}. [${r.areaName}] 存在: ${r.damageType}${r.photoUrl ? ' (照片已传: ' + r.photoUrl + ')' : ''}`
      ).join('\n');

      finalDescription = finalDescription
        ? `${finalDescription}\n\n${precheckText}`
        : precheckText;
    }

    // 3. 发送创建工单请求
    uni.showLoading({ title: '正在提交接车...', mask: true });

    let expectDateTimeStr: string | undefined = undefined;
    if (expectDate.value && expectTime.value) {
      expectDateTimeStr = `${expectDate.value}T${expectTime.value}:00`;
    }

    const woRes: any = await request({
      url: '/api/work-orders',
      method: 'POST',
      header: { Authorization: `Bearer ${token}` },
      data: {
        shopId: userInfo.shopId || '',
        orderType: orderTypes[orderTypeIndex.value],
        customerId,
        vehicleId,
        vehiclePlateNo: form.value.plateNo.trim().toUpperCase(),
        advisorId: userInfo.id,
        description: finalDescription || undefined,
        expectDate: expectDateTimeStr,
        items: selectedItems.value.map(i => ({
          itemType: i.itemType,
          serviceItemId: i.id,
          name: i.name,
          quantity: i.quantity,
          unit: i.unit,
          unitPrice: i.unitPrice
        }))
      }
    });

    if (woRes.data?.code === 0) {
      uni.showToast({ title: '开单成功', icon: 'success' });
      setTimeout(() => {
        uni.navigateTo({ url: `/pages/workorder/detail?id=${woRes.data.data.id}` });
      }, 1000);
    } else {
      throw new Error(woRes.data?.message || '创建工单失败');
    }
  } catch (err: any) {
    uni.showModal({
      title: '开单失败',
      content: err.message || '未知错误，请联系系统管理员',
      showCancel: false
    });
  } finally {
    uni.hideLoading();
    submitting.value = false;
  }
}

// 自动载入路由参数，支持老客户指定车辆及新客户直接建档
onLoad(async (options: any) => {
  if (options && options.vehicleId) {
    const token = uni.getStorageSync('accessToken');
    try {
      uni.showLoading({ title: '正在载入车辆档案...' });
      const res: any = await request({
        url: `/api/vehicles/${options.vehicleId}`,
        method: 'GET',
        header: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.code === 0 && res.data.data) {
        setCustomerType('existing');
        selectMatchedVehicle(res.data.data);
      }
    } catch (e) {
      // 忽略
    } finally {
      uni.hideLoading();
    }
  } else if (options && options.type === 'new') {
    setCustomerType('new');
  }
});
</script>

<style scoped>
/* 全局页面高端配色系统 */
.page {
  padding: 20rpx 20rpx 140rpx 20rpx;
  background: #121214;
  min-height: 100vh;
  color: #e0e0e6;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

.header {
  margin-bottom: 30rpx;
  padding-left: 10rpx;
}
.title {
  font-size: 40rpx;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: 2rpx;
}
.subtitle {
  font-size: 22rpx;
  color: #767680;
  margin-top: 6rpx;
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

/* 分段选项卡 Tab 控制器 */
.tab-control {
  display: flex;
  background: #161618;
  border-radius: 12rpx;
  padding: 6rpx;
  margin-bottom: 30rpx;
  border: 1rpx solid #2c2c2e;
}
.tab-item {
  flex: 1;
  text-align: center;
  font-size: 24rpx;
  color: #a1a1a9;
  padding: 16rpx 0;
  border-radius: 8rpx;
  font-weight: bold;
  transition: all 0.2s ease;
}
.tab-item.active {
  background: #3b82f6;
  color: #ffffff;
  box-shadow: 0 2rpx 8rpx rgba(59, 130, 246, 0.4);
}

.tab-content {
  margin-bottom: 20rpx;
}

/* 搜索提示字眼 */
.search-placeholder-tip {
  padding: 40rpx 0;
  text-align: center;
}
.placeholder-tip-text {
  font-size: 24rpx;
  color: #767680;
  line-height: 1.5;
}

/* 表单输入与光晕效果 */
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
.label {
  font-size: 26rpx;
  color: #a1a1a9;
  width: 200rpx;
}
.label-v {
  font-size: 26rpx;
  color: #a1a1a9;
  margin-bottom: 4rpx;
}
.input {
  flex: 1;
  font-size: 28rpx;
  text-align: right;
  color: #ffffff;
}
.search-input {
  text-align: left;
  color: #3b82f6;
  font-weight: bold;
}
.search-row {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.car-areas-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12rpx;
  margin-bottom: 20rpx;
}
.car-area-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20rpx 8rpx;
  background: #161618;
  border: 2rpx solid #2c2c2e;
  border-radius: 12rpx;
  transition: all 0.2s;
}
.car-area-item.active {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.15);
}
.area-icon {
  font-size: 36rpx;
  margin-bottom: 8rpx;
}
.area-text {
  font-size: 20rpx;
  color: #a1a1a9;
  font-weight: bold;
}
.car-area-item.active .area-text {
  color: #3b82f6;
}
.plate-input {
  font-weight: bold;
  color: #3b82f6;
  font-size: 30rpx;
  letter-spacing: 1rpx;
}
.plate-input-row {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.ocr-btn {
  display: flex;
  align-items: center;
  gap: 6rpx;
  padding: 10rpx 16rpx;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border-radius: 8rpx;
  white-space: nowrap;
}
.ocr-icon {
  font-size: 24rpx;
}
.ocr-text {
  font-size: 20rpx;
  color: #ffffff;
  font-weight: bold;
}
.vin-row {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.vin-input {
  flex: 1;
  font-size: 26rpx;
  text-align: right;
  color: #ffffff;
}
.scan-btn {
  width: 64rpx;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(59, 130, 246, 0.15);
  border: 1rpx solid #3b82f6;
  border-radius: 12rpx;
}
.scan-icon {
  font-size: 28rpx;
}
.picker-val {
  flex: 1;
  font-size: 28rpx;
  text-align: right;
  color: #3b82f6;
  font-weight: bold;
}

.textarea {
  width: 100%;
  height: 140rpx;
  font-size: 26rpx;
  padding: 20rpx;
  border: 1rpx solid #2c2c2e;
  border-radius: 12rpx;
  box-sizing: border-box;
  background: #161618;
  color: #ffffff;
}

/* 匹配历史卡片样式 */
.match-card {
  padding: 24rpx;
  border-radius: 16rpx;
  margin: 16rpx 0 24rpx 0;
  border: 1rpx solid #1e3a8a;
  background: linear-gradient(135deg, #1e3a8a 0%, #1e1b4b 100%);
}
.match-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}
.match-badge {
  font-size: 22rpx;
  color: #60a5fa;
  font-weight: bold;
}
.reset-btn {
  font-size: 22rpx;
  color: #f43f5e;
  padding: 4rpx 16rpx;
  background: rgba(244, 63, 94, 0.1);
  border-radius: 20rpx;
  font-weight: bold;
}
.match-body {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.match-row {
  display: flex;
  font-size: 24rpx;
}
.match-label {
  color: #93c5fd;
  width: 140rpx;
}
.match-val {
  color: #ffffff;
  font-weight: bold;
}

/* 相似车辆推荐 */
.suggestions-container {
  background: rgba(59, 130, 246, 0.05);
  border: 1rpx dashed #3b82f6;
  border-radius: 16rpx;
  padding: 20rpx;
  margin: 16rpx 0 24rpx 0;
}
.suggestions-header {
  margin-bottom: 16rpx;
}
.suggestions-title {
  font-size: 24rpx;
  color: #93c5fd;
  font-weight: bold;
}
.suggestion-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}
.suggestion-card {
  background: #242426;
  padding: 16rpx;
  border-radius: 10rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 1rpx solid #2c2c2e;
}
.s-plate {
  font-size: 26rpx;
  font-weight: bold;
  color: #3b82f6;
}
.s-info {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.s-owner {
  font-size: 24rpx;
  color: #ffffff;
  font-weight: bold;
}
.s-phone {
  font-size: 20rpx;
  color: #8e8e93;
}
.s-model {
  font-size: 22rpx;
  color: #a1a1a9;
}

/* 新车档案提示横幅 */
.new-plate-banner {
  background: rgba(245, 158, 11, 0.1);
  border: 1rpx solid #d97706;
  border-radius: 16rpx;
  padding: 24rpx;
  margin: 16rpx 0 24rpx 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
}
.banner-content {
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.banner-icon {
  font-size: 28rpx;
}
.banner-text {
  font-size: 24rpx;
  color: #fbbf24;
  font-weight: bold;
}
.new-veh-btn {
  width: 100%;
  height: 68rpx;
  line-height: 68rpx;
  background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
  color: #ffffff;
  font-size: 24rpx;
  font-weight: bold;
  border-radius: 34rpx;
  border: none;
}
.pulse-glow {
  animation: pulse 2s infinite;
}
@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(217, 119, 6, 0.4); }
  70% { box-shadow: 0 0 0 10rpx rgba(217, 119, 6, 0); }
  100% { box-shadow: 0 0 0 0 rgba(217, 119, 6, 0); }
}

/* 首进店表单折叠容器 */
.new-vehicle-form-inline {
  background: #242426;
  border-radius: 16rpx;
  padding: 20rpx;
  border: 1rpx solid #2c2c2e;
  margin-top: 16rpx;
}
.form-sub-title {
  font-size: 26rpx;
  font-weight: bold;
  color: #ffffff;
  border-bottom: 2rpx solid #2c2c2e;
  padding-bottom: 12rpx;
  margin-bottom: 12rpx;
}

/* 电销关怀提醒日期设计 */
.care-section {
  margin-top: 24rpx;
}
.care-title {
  font-size: 24rpx;
  font-weight: bold;
  color: #a1a1a9;
  margin-bottom: 16rpx;
}
.care-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12rpx;
}
.care-card {
  background: #161618;
  border: 1rpx solid #2c2c2e;
  border-radius: 12rpx;
  padding: 16rpx 8rpx;
  text-align: center;
  position: relative;
  overflow: hidden;
}
.care-card.warning {
  border-color: #d97706;
  background: rgba(217, 119, 6, 0.05);
}
.care-label {
  font-size: 20rpx;
  color: #8e8e93;
  margin-bottom: 8rpx;
}
.picker-date {
  font-size: 20rpx;
  font-weight: bold;
  color: #ffffff;
}
.care-badge {
  font-size: 16rpx;
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.1);
  padding: 2rpx 4rpx;
  border-radius: 4rpx;
  display: inline-block;
  margin-top: 8rpx;
}

/* SVG 环车预检画布 */
.svg-container {
  display: flex;
  justify-content: center;
  background: #161618;
  border-radius: 16rpx;
  padding: 20rpx 0;
  border: 1rpx solid #2c2c2e;
  margin-bottom: 20rpx;
}
.car-svg {
  background: transparent;
}
.hotspot {
  fill: rgba(59, 130, 246, 0.02);
  stroke: rgba(59, 130, 246, 0.15);
  stroke-width: 1.5;
  stroke-dasharray: 4;
  cursor: pointer;
  transition: all 0.3s ease;
  pointer-events: all;
}
.hotspot:hover, .hotspot.active {
  fill: rgba(59, 130, 246, 0.25);
  stroke: #3b82f6;
  stroke-width: 2.5;
  stroke-dasharray: none;
  filter: drop-shadow(0 0 6rpx rgba(59, 130, 246, 0.5));
}

/* 预检详情面板 */
.inspection-panel {
  background: #242426;
  border: 1rpx solid #3b82f6;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
}
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1rpx solid #2c2c2e;
  padding-bottom: 16rpx;
  margin-bottom: 16rpx;
}
.panel-title {
  font-size: 26rpx;
  font-weight: bold;
  color: #3b82f6;
}
.panel-close {
  font-size: 28rpx;
  color: #8e8e93;
  padding: 0 10rpx;
}

.damage-options {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12rpx;
  margin-bottom: 20rpx;
}
.damage-opt {
  height: 64rpx;
  line-height: 64rpx;
  text-align: center;
  font-size: 24rpx;
  color: #a1a1a9;
  background: #161618;
  border: 1rpx solid #2c2c2e;
  border-radius: 8rpx;
}
.damage-opt.active {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
  font-weight: bold;
}

.precheck-photo-box {
  margin-bottom: 20rpx;
}
.upload-trigger {
  height: 120rpx;
  border: 2rpx dashed #2c2c2e;
  border-radius: 12rpx;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: #161618;
}
.upload-icon {
  font-size: 36rpx;
  margin-bottom: 6rpx;
}
.upload-text {
  font-size: 20rpx;
  color: #8e8e93;
}
.photo-preview {
  position: relative;
  height: 160rpx;
  width: 100%;
}
.preview-img {
  width: 100%;
  height: 160rpx;
  border-radius: 12rpx;
}
.del-photo-btn {
  position: absolute;
  right: 12rpx;
  top: 12rpx;
  font-size: 18rpx;
  color: #ffffff;
  background: rgba(244, 63, 94, 0.8);
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
}

.add-precheck-btn {
  width: 100%;
  height: 70rpx;
  line-height: 70rpx;
  background: #3b82f6;
  color: #ffffff;
  font-size: 26rpx;
  font-weight: bold;
  border-radius: 35rpx;
  border: none;
}

/* 已记录损伤列表 */
.record-list {
  background: #242426;
  border-radius: 12rpx;
  padding: 16rpx;
  border: 1rpx solid #2c2c2e;
}
.record-title {
  font-size: 24rpx;
  font-weight: bold;
  color: #a1a1a9;
  margin-bottom: 12rpx;
}
.record-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12rpx 0;
  border-bottom: 1rpx solid #2c2c2e;
}
.record-item:last-child {
  border-bottom: none;
}
.rec-info {
  display: flex;
  align-items: center;
  gap: 8rpx;
  font-size: 24rpx;
}
.rec-bullet {
  color: #3b82f6;
  font-size: 18rpx;
}
.rec-area {
  color: #ffffff;
}
.rec-type {
  color: #ef4444;
}
.rec-actions {
  display: flex;
  align-items: center;
  gap: 16rpx;
}
.rec-img {
  width: 50rpx;
  height: 50rpx;
  border-radius: 6rpx;
}
.rec-del {
  font-size: 26rpx;
  color: #8e8e93;
  padding: 0 10rpx;
}

/* 底部合计与按钮 */
.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 120rpx;
  background: #1c1c1e;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 30rpx;
  box-shadow: 0 -4rpx 16rpx rgba(0,0,0,0.3);
  border-top: 1rpx solid #2c2c2e;
  z-index: 100;
}
.submit-btn {
  width: 100%;
  height: 84rpx;
  line-height: 84rpx;
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  color: #ffffff;
  font-size: 30rpx;
  border-radius: 42rpx;
  border: none;
  margin: 0;
}

.font-bold {
  font-weight: bold;
}
.text-danger {
  color: #f43f5e;
}
.text-primary {
  color: #3b82f6;
}

/* 品牌车型选择器 */
.brand-picker-trigger {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8rpx;
  min-height: 48rpx;
}
.brand-picker-value {
  font-size: 28rpx;
  color: #3b82f6;
  font-weight: bold;
}
.brand-picker-placeholder {
  font-size: 26rpx;
  color: #8e8e93;
}
.brand-picker-trigger .arrow {
  font-size: 18rpx;
  color: #8e8e93;
}

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
.brand-modal {
  width: 680rpx;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
}
.brand-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 20rpx;
  border-bottom: 1rpx solid #2c2c2e;
}
.brand-modal-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #ffffff;
}
.brand-modal-close {
  font-size: 40rpx;
  color: #a1a1a9;
  line-height: 1;
  padding: 0 10rpx;
}
.brand-search-box {
  margin: 20rpx 0;
}
.brand-search-input {
  width: 100%;
  height: 72rpx;
  background: #161618;
  border: 1rpx solid #2c2c2e;
  border-radius: 12rpx;
  padding: 0 24rpx;
  font-size: 26rpx;
  color: #ffffff;
  box-sizing: border-box;
}
.brand-switch {
  margin-bottom: 16rpx;
}
.brand-switch-text {
  font-size: 22rpx;
  color: #3b82f6;
  text-decoration: underline;
}
.brand-columns {
  display: flex;
  gap: 16rpx;
  height: 500rpx;
  background: #161618;
  border-radius: 12rpx;
  border: 1rpx solid #2c2c2e;
  padding: 8rpx;
}
.brand-col {
  flex: 1;
  height: 100%;
  border-right: 1rpx solid #2c2c2e;
  overflow-y: auto;
}
.series-col {
  flex: 1;
  height: 100%;
  overflow-y: auto;
}
.brand-opt, .series-opt {
  padding: 18rpx 16rpx;
  font-size: 26rpx;
  color: #e0e0e6;
  border-radius: 8rpx;
  margin-bottom: 4rpx;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.brand-opt.active {
  background: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
  font-weight: bold;
}
.series-opt.active {
  background: #3b82f6;
  color: #ffffff;
  font-weight: bold;
}
.brand-empty {
  text-align: center;
  padding: 40rpx 0;
  font-size: 24rpx;
  color: #8e8e93;
}
.brand-modal-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 20rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid #2c2c2e;
}
.brand-selection-preview {
  font-size: 26rpx;
  color: #3b82f6;
  font-weight: bold;
  flex: 1;
}
.brand-selection-preview.text-gray {
  color: #8e8e93;
  font-weight: normal;
}
.brand-confirm-btn {
  height: 68rpx;
  line-height: 68rpx;
  padding: 0 40rpx;
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  color: #ffffff;
  font-size: 26rpx;
  font-weight: bold;
  border-radius: 34rpx;
  border: none;
}
.brand-confirm-btn[disabled] {
  opacity: 0.4;
  background: #2c2c2e;
  color: #8e8e93;
}

/* Selected items list */
.selected-items-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-bottom: 24rpx;
}
.selected-item-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #161618;
  padding: 16rpx 20rpx;
  border-radius: 12rpx;
  border: 1rpx solid #2c2c2e;
}
.sel-item-info {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  flex: 1;
}
.sel-item-name {
  font-size: 26rpx;
  color: #ffffff;
}
.sel-item-badge {
  font-size: 18rpx;
  padding: 2rpx 10rpx;
  border-radius: 4rpx;
  align-self: flex-start;
  font-weight: bold;
}
.sel-item-badge.service {
  background: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
}
.sel-item-badge.part {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
}

.sel-item-price-qty {
  display: flex;
  align-items: center;
  gap: 30rpx;
}
.qty-adjust-box {
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
  background: transparent;
  border: none;
}
.qty-unit {
  font-size: 20rpx;
  color: #a1a1a9;
}
.sel-item-price {
  font-size: 26rpx;
  color: #f43f5e;
  font-weight: bold;
  width: 120rpx;
  text-align: right;
}
.sel-item-del {
  font-size: 28rpx;
  color: #a1a1a9;
  margin-left: 20rpx;
  padding: 0 10rpx;
}

.add-buttons-row {
  display: flex;
  gap: 20rpx;
}
.btn-outline {
  flex: 1;
  height: 70rpx;
  line-height: 70rpx;
  background: transparent;
  border: 1rpx dashed #3b82f6;
  color: #3b82f6;
  font-size: 24rpx;
  border-radius: 35rpx;
}

.empty-items-tip {
  text-align: center;
  padding: 30rpx 0;
  font-size: 24rpx;
  color: #8e8e93;
}

.total-price-preview {
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.total-label {
  font-size: 20rpx;
  color: #8e8e93;
}
.total-val {
  font-size: 32rpx;
  color: #f43f5e;
}

/* Modals */
.scroll-list-picker {
  max-height: 400rpx;
  overflow-y: auto;
  margin-top: 16rpx;
}
.select-row-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 20rpx;
  background: #161618;
  border: 1rpx solid #2c2c2e;
  border-radius: 12rpx;
  margin-bottom: 12rpx;
}
.row-info {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  flex: 1;
  margin-right: 16rpx;
}
.row-name {
  font-size: 24rpx;
  color: #ffffff;
}
.row-category {
  font-size: 20rpx;
  color: #8e8e93;
}
.row-sub {
  font-size: 18rpx;
  color: #8e8e93;
}
.row-stock {
  font-size: 20rpx;
  font-weight: bold;
}
.row-price {
  font-size: 24rpx;
  color: #f43f5e;
}
</style>
