<template>
  <view class="page">
    <!-- 顶部搜索与快捷操作 -->
    <view class="header-actions">
      <view class="search-bar">
        <input class="search-input" v-model="keyword" type="text" placeholder="搜索名称/编码/品牌" confirm-type="search" @confirm="handleSearch" @input="onKeywordInput" />
        <button class="search-btn font-bold" @tap="handleSearch">搜索</button>
      </view>
      <view class="action-buttons">
        <button class="action-btn scan-btn font-bold" @tap="handleScanAdd">
          <text class="btn-icon">📷</text> 扫码识件
        </button>
        <button class="action-btn add-btn font-bold" @tap="openAddModal">
          <text class="btn-icon">➕</text> 新增配件
        </button>
      </view>
    </view>

    <!-- 配件分类筛选栏 (横向滚动) -->
    <scroll-view class="category-scroll" scroll-x="true" show-scrollbar="false">
      <view class="category-list">
        <view 
          v-for="cat in categories" 
          :key="cat" 
          :class="['category-item', activeCategory === cat ? 'active' : '']"
          @tap="selectCategory(cat)"
          @longpress="handleCategoryLongPress(cat)"
        >
          {{ cat }}
        </view>
        <!-- 新增分类快捷按钮 -->
        <view class="category-item add-cat-item" @tap="handleAddCategory">
          <text class="add-cat-icon">➕</text> 新增分类
        </view>
      </view>
    </scroll-view>

    <!-- 分段控制器：过滤“全部”与“库存预警” -->
    <view class="segmented-control">
      <view :class="['segment-item', filterType === 'all' ? 'active' : '']" @tap="setFilterType('all')">全部配件</view>
      <view :class="['segment-item', filterType === 'warning' ? 'active' : '']" @tap="setFilterType('warning')">
        🚨 库存不足 
        <text class="badge-count" v-if="warningCount > 0">{{ warningCount }}</text>
      </view>
    </view>

    <!-- 配件列表 -->
    <scroll-view class="stock-scroll-list" scroll-y="true" @scrolltolower="onScrollToLower">
      <view class="part-card premium-card" v-for="item in filteredParts" :key="item.id" @tap="openEditModal(item)">
        <view class="part-card-inner">
          <!-- 配件图片 -->
          <view class="part-image-box">
            <image class="part-image" v-if="getPartImage(item)" :src="getPartImage(item)" mode="aspectFill" />
            <view class="part-image-placeholder" v-else>
              <text class="placeholder-icon">🔧</text>
            </view>
          </view>
          
          <!-- 配件信息 -->
          <view class="part-info-box">
            <view class="part-header">
              <view class="part-title-box">
                <text class="part-name font-bold">{{ item.name }}</text>
                <text class="part-code">编码: {{ item.code }}</text>
              </view>
              <view :class="['stock-badge', isLowStock(item) ? 'low-stock-bg' : 'normal-stock-bg']">
                {{ isLowStock(item) ? '🚨 库存低' : '正常' }}
              </view>
            </view>

            <view class="part-body">
              <view class="info-grid">
                <view class="info-cell">
                  <text class="cell-label">当前库存</text>
                  <text :class="['cell-value font-bold', isLowStock(item) ? 'text-warning' : 'text-success']">
                    {{ getPartStock(item) }} {{ item.unit || '个' }}
                  </text>
                </view>
                <view class="info-cell">
                  <text class="cell-label">售价/进价</text>
                  <text class="cell-value text-warning font-bold">
                    ¥{{ item.salePrice || 0 }} <text class="text-gray-small">/ ¥{{ item.costPrice || 0 }}</text>
                  </text>
                </view>
                <view class="info-cell">
                  <text class="cell-label">分类/品牌</text>
                  <text class="cell-value">{{ item.category || '无' }} / {{ item.brand || '无' }}</text>
                </view>
                <view class="info-cell" v-if="getPartRemarkText(item)">
                  <text class="cell-label">备注说明</text>
                  <text class="cell-value text-gray">{{ getPartRemarkText(item) }}</text>
                </view>
              </view>

              <!-- 供应商信息 -->
              <view class="supplier-bar" v-if="item.supplier" @tap.stop="callSupplier(item.supplier.phone)">
                <view class="sup-info">
                  <text class="sup-label">供货商：</text>
                  <text class="sup-name font-bold">{{ item.supplier.name }}</text>
                </view>
                <view class="sup-contact" v-if="item.supplier.phone">
                  <text class="phone-icon">📞</text>
                  <text class="phone-number">{{ item.supplier.phone }}</text>
                </view>
              </view>
            </view>
          </view>
        </view>
      </view>

      <!-- 暂无数据 -->
      <view class="empty-state" v-if="filteredParts.length === 0">
        <text class="empty-icon">📦</text>
        <text class="empty-text">未找到相关配件库存档案</text>
      </view>

      <!-- 底线 -->
      <view class="loading-more" v-if="filteredParts.length > 0">
        <text class="loading-more-txt">{{ hasMore ? '加载中...' : '— 已经到底啦 —' }}</text>
      </view>
    </scroll-view>

    <!-- 🔧 新增/编辑配件滑动弹窗 (Modal) -->
    <view class="modal-mask" v-if="showModal" @tap="showModal = false">
      <view class="modal-content premium-card" @tap.stop="">
        <view class="modal-header">
          <text class="modal-title font-bold">{{ isEditMode ? '编辑配件档案' : '新增配件档案' }}</text>
          <text class="modal-close" @tap="showModal = false">×</text>
        </view>
        
        <scroll-view class="modal-body" scroll-y="true">
          <!-- 拍照/上传图片 -->
          <view class="photo-upload-section">
            <view class="photo-preview-box" @tap="handleChooseImage">
              <image class="photo-preview" v-if="imageUrl" :src="imageUrl" mode="aspectFill" />
              <view class="photo-placeholder" v-else>
                <text class="photo-placeholder-icon">📷</text>
                <text class="photo-placeholder-text">{{ uploadingImage ? '正在上传图片...' : '拍照 / 选择配件图片' }}</text>
              </view>
            </view>
          </view>

          <!-- 表单信息 -->
          <view class="form-group">
            <!-- 配件编码 (支持扫码) -->
            <view class="form-item">
              <text class="form-label">配件编码 / 条形码 *</text>
              <view class="input-with-action">
                <input class="form-input" v-model="form.code" type="text" placeholder="输入或扫描条码" />
                <button class="input-action-btn" @tap="handleScanFormCode">📷 扫码</button>
              </view>
            </view>

            <!-- 配件名称 -->
            <view class="form-item">
              <text class="form-label">配件名称 *</text>
              <input class="form-input" v-model="form.name" type="text" placeholder="如：美孚一号 5W-30 4L" />
            </view>

            <!-- 分类选择 -->
            <view class="form-item">
              <text class="form-label">所属分类</text>
              <input class="form-input" v-model="form.category" type="text" placeholder="可在此输入或选择下方快捷分类" />
              <view class="quick-tags">
                <text 
                  v-for="qcat in quickCategories" 
                  :key="qcat" 
                  class="quick-tag"
                  @tap="form.category = qcat"
                >
                  {{ qcat }}
                </text>
                <text class="quick-tag add-quick-tag" @tap="handleAddCategory">➕ 自定义</text>
              </view>
            </view>

            <!-- 品牌 -->
            <view class="form-item">
              <text class="form-label">品牌 / 规格</text>
              <input class="form-input" v-model="form.brand" type="text" placeholder="如：美孚 / 4L装" />
            </view>

            <!-- 价格与库存预警 -->
            <view class="form-row">
              <view class="form-item flex-1">
                <text class="form-label">进货价 (元)</text>
                <input class="form-input" v-model="form.costPrice" type="digit" placeholder="¥ 0.00" />
              </view>
              <view class="form-item flex-1">
                <text class="form-label">零售售价 (元)</text>
                <input class="form-input" v-model="form.salePrice" type="digit" placeholder="¥ 0.00" />
              </view>
            </view>

            <view class="form-row">
              <view class="form-item flex-1">
                <text class="form-label">计量单位</text>
                <input class="form-input" v-model="form.unit" type="text" placeholder="如：瓶/个/套" />
              </view>
              <view class="form-item flex-1">
                <text class="form-label">预警库存下限</text>
                <input class="form-input" v-model="form.minStock" type="number" placeholder="最低库存量" />
              </view>
            </view>

            <!-- 期初库存与入库单价 (仅在新增模式下显示) -->
            <view class="form-row" v-if="!isEditMode">
              <view class="form-item flex-1">
                <text class="form-label">期初库存数量</text>
                <input class="form-input" v-model="form.initialStock" type="number" placeholder="期初入库数，默认 0" />
              </view>
              <view class="form-item flex-1">
                <text class="form-label">入库单价 (元)</text>
                <input class="form-input" v-model="form.initialStockPrice" type="digit" placeholder="默认等于进货价" />
              </view>
            </view>

            <!-- 快捷追加库存 (仅在编辑模式下显示) -->
            <view class="quick-stock-section" v-if="isEditMode">
              <view class="quick-stock-header font-bold">
                <text>⚡ 快捷追加库存 / 补货</text>
              </view>
              <view class="form-row">
                <view class="form-item flex-1">
                  <text class="form-label">追加数量</text>
                  <input class="form-input highlight-input" v-model="form.quickStockIn" type="number" placeholder="输入追加库存量，如 10" />
                </view>
                <view class="form-item flex-1">
                  <text class="form-label">入库单价 (元)</text>
                  <input class="form-input" v-model="form.quickStockInPrice" type="digit" placeholder="默认等于进货价" />
                </view>
              </view>
            </view>

            <!-- 质保月数 -->
            <view class="form-item">
              <text class="form-label">质保期限 (月)</text>
              <input class="form-input" v-model="form.warrantyMonths" type="number" placeholder="无质保请填 0 或留空" />
            </view>

            <!-- 供货商 -->
            <view class="form-item">
              <text class="form-label">供货商 / 供应商</text>
              <picker :range="suppliers" range-key="name" @change="onSupplierChange">
                <view class="form-picker">
                  {{ selectedSupplierName || '点击选择供应商 (可选)' }}
                </view>
              </picker>
            </view>

            <!-- 备注 -->
            <view class="form-item">
              <text class="form-label">备注说明</text>
              <textarea class="form-textarea" v-model="form.remarkText" placeholder="可输入其他配件附加说明信息..." />
            </view>
          </view>
        </scroll-view>

        <!-- 保存按钮 -->
        <view class="modal-footer">
          <button class="footer-btn cancel-btn" @tap="showModal = false">取消</button>
          <button class="footer-btn submit-btn font-bold" :loading="submitLoading" @tap="submitForm">保存档案</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { request } from '../../utils/request';

const keyword = ref('');
const filterType = ref<'all' | 'warning'>('all');
const parts = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const hasMore = ref(true);
const loading = ref(false);

// 分类与供应商
const defaultCategories = ['机油', '机滤', '空气滤', '空调滤', '火花塞', '刹车片', '刹车盘', '雨刮片', '轮胎', '防冻液', '其它'];
const customCategories = ref<any[]>([]);

const categories = computed(() => {
  const customNames = customCategories.value.map(c => c.name);
  return ['全部', ...defaultCategories.filter(c => c !== '其它'), ...customNames, '其它'];
});

const quickCategories = computed(() => {
  const customNames = customCategories.value.map(c => c.name);
  return [...defaultCategories.filter(c => c !== '其它'), ...customNames];
});

const activeCategory = ref('全部');
const suppliers = ref<any[]>([]);

// 弹窗表单状态
const showModal = ref(false);
const isEditMode = ref(false);
const editingPartId = ref('');
const submitLoading = ref(false);
const uploadingImage = ref(false);
const imageUrl = ref('');

const form = ref({
  code: '',
  name: '',
  category: '',
  brand: '',
  costPrice: '',
  salePrice: '',
  unit: '个',
  minStock: '0',
  warrantyMonths: '0',
  supplierId: '',
  remarkText: '',
  // 额外辅助字段
  initialStock: '',
  initialStockPrice: '',
  quickStockIn: '',
  quickStockInPrice: ''
});

const selectedSupplierName = computed(() => {
  const matched = suppliers.value.find(s => s.id === form.value.supplierId);
  return matched ? matched.name : '';
});

// 解析 remark 中可能包含的图片 URL
function getPartImage(part: any): string | null {
  if (!part.remark) return null;
  const match = part.remark.match(/^\[IMG:(https?:\/\/[^\]]+)\]/);
  return match ? match[1] : null;
}

function getPartRemarkText(part: any): string {
  if (!part.remark) return '';
  return part.remark.replace(/^\[IMG:(https?:\/\/[^\]]+)\]/, '');
}

async function fetchSuppliers() {
  try {
    const token = uni.getStorageSync('accessToken');
    const res: any = await request({
      url: '/api/suppliers',
      method: 'GET',
      header: { Authorization: `Bearer ${token}` }
    });
    if (res.data?.code === 0 && Array.isArray(res.data.data)) {
      suppliers.value = res.data.data;
    }
  } catch {}
}

async function fetchParts(reset = false) {
  if (loading.value) return;
  if (reset) {
    page.value = 1;
    parts.value = [];
    hasMore.value = true;
  }
  if (!hasMore.value) return;

  loading.value = true;
  uni.showLoading({ title: '载入库存中...' });
  try {
    const token = uni.getStorageSync('accessToken');
    let url = `/api/parts?page=${page.value}&pageSize=${pageSize.value}&keyword=${encodeURIComponent(keyword.value.trim())}`;
    
    if (activeCategory.value !== '全部') {
      url += `&category=${encodeURIComponent(activeCategory.value)}`;
    }

    const res: any = await request({
      url,
      method: 'GET',
      header: { Authorization: `Bearer ${token}` }
    });

    if (res.data?.code === 0 && res.data.data) {
      const newItems = res.data.data.items || [];
      parts.value = [...parts.value, ...newItems];
      total.value = res.data.data.total || 0;
      hasMore.value = parts.value.length < total.value;
      if (newItems.length > 0) page.value += 1;
    }
  } catch (e) {
    uni.showToast({ title: '获取库存失败', icon: 'none' });
  } finally {
    uni.hideLoading();
    loading.value = false;
  }
}

function getPartStock(part: any): number {
  if (!part.stockBalances || part.stockBalances.length === 0) return 0;
  return part.stockBalances.reduce((sum: number, bal: any) => sum + Number(bal.quantity), 0);
}

function isLowStock(part: any): boolean {
  const stock = getPartStock(part);
  return stock <= (part.minStock || 0);
}

const filteredParts = computed(() => {
  if (filterType.value === 'all') return parts.value;
  return parts.value.filter(p => isLowStock(p));
});

const warningCount = computed(() => {
  return parts.value.filter(p => isLowStock(p)).length;
});

function setFilterType(type: 'all' | 'warning') {
  filterType.value = type;
}

function selectCategory(cat: string) {
  activeCategory.value = cat;
  fetchParts(true);
}

function handleSearch() {
  fetchParts(true);
}

function onKeywordInput() {
  if (!keyword.value.trim()) {
    fetchParts(true);
  }
}

// 供货商变更
function onSupplierChange(e: any) {
  const idx = e.detail.value;
  const supplier = suppliers.value[idx];
  if (supplier) {
    form.value.supplierId = supplier.id;
  }
}

// 拍照 / 上传图片
function handleChooseImage() {
  if (uploadingImage.value) return;
  
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: async (res) => {
      const localFilePath = res.tempFilePaths[0];
      uploadingImage.value = true;
      uni.showLoading({ title: '上传图片中...' });
      
      try {
        const token = uni.getStorageSync('accessToken');
        
        // 1. 获取预签名直传 URL
        const uploadUrlRes: any = await request({
          url: '/api/files/upload-url',
          method: 'POST',
          header: { Authorization: `Bearer ${token}` },
          data: {
            originalName: `part_${Date.now()}.jpg`,
            mimeType: 'image/jpeg',
            size: 500000, // mock size or estimated size
            source: 'app',
            businessType: 'part'
          }
        });
        
        if (uploadUrlRes.data?.code === 0 && uploadUrlRes.data.data) {
          const { uploadUrl, fileUrl } = uploadUrlRes.data.data;
          
          // 2. 在小程序端使用二进制进行 S3 预签名直传 (PUT 请求)
          if (typeof uni.getFileSystemManager === 'function') {
            const fs = uni.getFileSystemManager();
            fs.readFile({
              filePath: localFilePath,
              success: async (readRes) => {
                try {
                  const binaryData = readRes.data;
                  await uni.request({
                    url: uploadUrl,
                    method: 'PUT',
                    data: binaryData,
                    header: { 'content-type': 'image/jpeg' }
                  });
                  imageUrl.value = fileUrl;
                  uni.showToast({ title: '图片上传成功', icon: 'success' });
                } catch (err) {
                  uni.showToast({ title: '直传服务失败', icon: 'none' });
                } finally {
                  uploadingImage.value = false;
                  uni.hideLoading();
                }
              },
              fail: () => {
                uni.showToast({ title: '读取文件失败', icon: 'none' });
                uploadingImage.value = false;
                uni.hideLoading();
              }
            });
          } else {
            // H5/其他平台降级方案
            imageUrl.value = localFilePath;
            uploadingImage.value = false;
            uni.hideLoading();
          }
        } else {
          uni.showToast({ title: uploadUrlRes.data?.message || '获取签名失败', icon: 'none' });
          uploadingImage.value = false;
          uni.hideLoading();
        }
      } catch (err: any) {
        uni.showToast({ title: '直传出错: ' + (err.message || ''), icon: 'none' });
        uploadingImage.value = false;
        uni.hideLoading();
      }
    },
    fail: () => {
      // cancel
    }
  });
}

// 扫码新增 (在头部)
function handleScanAdd() {
  uni.scanCode({
    success: (res) => {
      const scannedCode = res.result;
      if (!scannedCode) return;
      
      // 检查库中是否已存在该条码
      const matched = parts.value.find(p => p.code === scannedCode);
      if (matched) {
        // 已有该配件，直接进入编辑模式
        openEditModal(matched);
        uni.showToast({ title: '已识别库中配件，已为您打开编辑', icon: 'none', duration: 3000 });
      } else {
        // 库中没有该条码，打开新增，并自动预填条码
        openAddModal();
        form.value.code = scannedCode;
        uni.showToast({ title: '识别新配件，已自动填入条码', icon: 'none', duration: 3000 });
      }
    },
    fail: () => {
      uni.showToast({ title: '扫码取消', icon: 'none' });
    }
  });
}

// 表单内部扫码
function handleScanFormCode() {
  uni.scanCode({
    success: (res) => {
      if (res.result) {
        form.value.code = res.result;
      }
    }
  });
}

function openAddModal() {
  isEditMode.value = false;
  editingPartId.value = '';
  imageUrl.value = '';
  form.value = {
    code: '',
    name: '',
    category: '',
    brand: '',
    costPrice: '',
    salePrice: '',
    unit: '个',
    minStock: '0',
    warrantyMonths: '0',
    supplierId: '',
    remarkText: '',
    initialStock: '',
    initialStockPrice: '',
    quickStockIn: '',
    quickStockInPrice: ''
  };
  showModal.value = true;
}

function openEditModal(part: any) {
  isEditMode.value = true;
  editingPartId.value = part.id;
  imageUrl.value = getPartImage(part) || '';
  
  form.value = {
    code: part.code || '',
    name: part.name || '',
    category: part.category || '',
    brand: part.brand || '',
    costPrice: String(part.costPrice || ''),
    salePrice: String(part.salePrice || ''),
    unit: part.unit || '个',
    minStock: String(part.minStock || '0'),
    warrantyMonths: String(part.warrantyMonths || '0'),
    supplierId: part.supplierId || '',
    remarkText: getPartRemarkText(part),
    initialStock: '',
    initialStockPrice: '',
    quickStockIn: '',
    quickStockInPrice: ''
  };
  showModal.value = true;
}

function onScrollToLower() {
  if (hasMore.value) fetchParts();
}

// 新增分类
async function handleAddCategory() {
  uni.showModal({
    title: '新增配件分类',
    editable: true,
    placeholderText: '请输入新分类名称',
    success: async (resModal) => {
      if (resModal.confirm && resModal.content) {
        const name = resModal.content.trim();
        if (!name) return;
        
        if (defaultCategories.includes(name) || customCategories.value.some(c => c.name === name)) {
          uni.showToast({ title: '该分类已存在', icon: 'none' });
          return;
        }
        
        uni.showLoading({ title: '正在创建...' });
        try {
          const token = uni.getStorageSync('accessToken');
          const res: any = await request({
            url: '/api/dictionaries',
            method: 'POST',
            header: { Authorization: `Bearer ${token}` },
            data: {
              type: 'part_category',
              code: 'cat_' + Date.now(),
              name: name,
              sort: 0
            }
          });
          if (res.data?.code === 0) {
            uni.showToast({ title: '新增成功', icon: 'success' });
            await fetchCustomCategories();
            form.value.category = name; // 自动填入当前编辑的分类
          } else {
            uni.showToast({ title: res.data?.message || '新增失败', icon: 'none' });
          }
        } catch (err: any) {
          uni.showToast({ title: err.message || '保存失败', icon: 'none' });
        } finally {
          uni.hideLoading();
        }
      }
    }
  });
}

// 长按删除自定义分类
async function handleCategoryLongPress(catName: string) {
  if (catName === '全部' || catName === '其它' || defaultCategories.includes(catName)) {
    uni.showToast({ title: '系统默认分类，无法删除', icon: 'none' });
    return;
  }
  
  const matched = customCategories.value.find(c => c.name === catName);
  if (!matched) return;
  
  uni.showModal({
    title: '删除分类',
    content: `确认删除分类 "${catName}" 吗？删除后此分类标签将被移除。`,
    success: async (resModal) => {
      if (resModal.confirm) {
        uni.showLoading({ title: '正在删除...' });
        try {
          const token = uni.getStorageSync('accessToken');
          const res: any = await request({
            url: `/api/dictionaries/${matched.id}`,
            method: 'DELETE',
            header: { Authorization: `Bearer ${token}` }
          });
          if (res.data?.code === 0) {
            uni.showToast({ title: '删除成功', icon: 'success' });
            if (activeCategory.value === catName) {
              activeCategory.value = '全部';
            }
            await fetchCustomCategories();
            fetchParts(true);
          } else {
            uni.showToast({ title: res.data?.message || '删除失败', icon: 'none' });
          }
        } catch (err: any) {
          uni.showToast({ title: err.message || '删除出错', icon: 'none' });
        } finally {
          uni.hideLoading();
        }
      }
    }
  });
}

async function fetchCustomCategories() {
  try {
    const token = uni.getStorageSync('accessToken');
    const res: any = await request({
      url: '/api/dictionaries?type=part_category',
      method: 'GET',
      header: { Authorization: `Bearer ${token}` }
    });
    if (res.data?.code === 0 && Array.isArray(res.data.data)) {
      customCategories.value = res.data.data;
    }
  } catch (e) {}
}

// 保存表单
async function submitForm() {
  if (!form.value.code.trim()) {
    uni.showToast({ title: '请输入或扫描配件条码', icon: 'none' });
    return;
  }
  if (!form.value.name.trim()) {
    uni.showToast({ title: '请输入配件名称', icon: 'none' });
    return;
  }

  // 组装最终备注（拼接上传后的图片URL）
  const finalRemark = imageUrl.value ? `[IMG:${imageUrl.value}]${form.value.remarkText}` : form.value.remarkText;

  const payload = {
    code: form.value.code.trim(),
    name: form.value.name.trim(),
    category: form.value.category.trim() || undefined,
    brand: form.value.brand.trim() || undefined,
    costPrice: form.value.costPrice ? Number(form.value.costPrice) : 0,
    salePrice: form.value.salePrice ? Number(form.value.salePrice) : 0,
    unit: form.value.unit.trim() || '个',
    minStock: Number(form.value.minStock) || 0,
    warrantyMonths: Number(form.value.warrantyMonths) || 0,
    supplierId: form.value.supplierId || undefined,
    remark: finalRemark
  };

  submitLoading.value = true;
  uni.showLoading({ title: '保存档案中...' });
  
  try {
    const token = uni.getStorageSync('accessToken');
    let res: any;
    if (isEditMode.value) {
      res = await request({
        url: `/api/parts/${editingPartId.value}`,
        method: 'PUT',
        header: { Authorization: `Bearer ${token}` },
        data: payload
      });
    } else {
      res = await request({
        url: '/api/parts',
        method: 'POST',
        header: { Authorization: `Bearer ${token}` },
        data: payload
      });
    }

    if (res.data?.code === 0) {
      const savedPart = res.data.data;
      const userInfo = uni.getStorageSync('userInfo') || {};
      const shopId = userInfo.shopId;
      
      // 1. 新增模式且录入了期初库存
      if (!isEditMode.value && Number(form.value.initialStock) > 0 && shopId) {
        const initQty = Number(form.value.initialStock);
        const initPrice = form.value.initialStockPrice ? Number(form.value.initialStockPrice) : (Number(form.value.costPrice) || 0);
        try {
          await request({
            url: '/api/stock/in',
            method: 'POST',
            header: { Authorization: `Bearer ${token}` },
            data: {
              shopId,
              supplierId: form.value.supplierId || undefined,
              remark: '手机端配件建档期初入库',
              items: [
                {
                  partId: savedPart.id,
                  quantity: initQty,
                  unitPrice: initPrice
                }
              ]
            }
          });
        } catch (stockErr) {
          console.error('初始化库存失败', stockErr);
        }
      }
      
      // 2. 编辑模式且录入了追加库存
      if (isEditMode.value && Number(form.value.quickStockIn) > 0 && shopId) {
        const quickQty = Number(form.value.quickStockIn);
        const quickPrice = form.value.quickStockInPrice ? Number(form.value.quickStockInPrice) : (Number(form.value.costPrice) || 0);
        try {
          await request({
            url: '/api/stock/in',
            method: 'POST',
            header: { Authorization: `Bearer ${token}` },
            data: {
              shopId,
              supplierId: form.value.supplierId || undefined,
              remark: '手机端快捷追加库存',
              items: [
                {
                  partId: editingPartId.value,
                  quantity: quickQty,
                  unitPrice: quickPrice
                }
              ]
            }
          });
        } catch (stockErr) {
          console.error('快捷入库失败', stockErr);
        }
      }

      uni.showToast({ title: '保存成功', icon: 'success' });
      showModal.value = false;
      fetchParts(true); // 重新加载列表
    } else {
      uni.showToast({ title: res.data?.message || '保存失败', icon: 'none' });
    }
  } catch (err: any) {
    uni.showToast({ title: err.message || '网络保存出错', icon: 'none' });
  } finally {
    submitLoading.value = false;
    uni.hideLoading();
  }
}

onMounted(() => {
  fetchParts(true);
  fetchSuppliers();
  fetchCustomCategories();
});
</script>

<style scoped>
.page { 
  padding: 20rpx; 
  background: #121214; 
  min-height: 100vh; 
  color: #e0e0e6;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  display: flex;
  flex-direction: column;
}

.premium-card {
  background: #1c1c1e;
  border-radius: 20rpx;
  padding: 26rpx;
  margin-bottom: 24rpx;
  border: 1rpx solid #2c2c2e;
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.15);
}

/* 顶部搜索与操作 */
.header-actions {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-bottom: 20rpx;
}
.search-bar {
  display: flex;
  gap: 16rpx;
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
.action-buttons {
  display: flex;
  gap: 16rpx;
}
.action-btn {
  flex: 1;
  height: 80rpx;
  line-height: 80rpx;
  font-size: 26rpx;
  border-radius: 40rpx;
  border: none;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  margin: 0;
}
.scan-btn {
  background: #2c2c2e;
  border: 1rpx solid #3a3a3c;
}
.add-btn {
  background: #3b82f6;
  box-shadow: 0 4rpx 12rpx rgba(59, 130, 246, 0.2);
}
.btn-icon {
  font-size: 28rpx;
}

/* 分类筛选横向滑动 */
.category-scroll {
  white-space: nowrap;
  width: 100%;
  margin-bottom: 20rpx;
}
.category-list {
  display: inline-flex;
  gap: 16rpx;
  padding: 4rpx 0;
}
.category-item {
  display: inline-block;
  padding: 12rpx 28rpx;
  font-size: 24rpx;
  background: #1c1c1e;
  border: 1rpx solid #2c2c2e;
  color: #a1a1a9;
  border-radius: 30rpx;
}
.category-item.active {
  background: rgba(59, 130, 246, 0.15);
  border-color: #3b82f6;
  color: #3b82f6;
  font-weight: bold;
}

/* 分段控制器 */
.segmented-control { 
  display: flex; 
  background: #1c1c1e; 
  border-radius: 40rpx; 
  padding: 6rpx; 
  margin-bottom: 24rpx; 
  border: 1rpx solid #2c2c2e; 
}
.segment-item { 
  flex: 1; 
  text-align: center; 
  font-size: 26rpx; 
  color: #a1a1a9; 
  padding: 14rpx 0; 
  border-radius: 34rpx; 
  font-weight: bold; 
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
}
.segment-item.active { 
  background: #2c2c2e; 
  color: #ffffff; 
  box-shadow: inset 0 2rpx 4rpx rgba(255,255,255,0.05);
}
.badge-count {
  font-size: 20rpx;
  background: #f43f5e;
  color: #ffffff;
  border-radius: 50%;
  padding: 2rpx 10rpx;
  font-weight: 800;
}

/* 滚动区域 */
.stock-scroll-list {
  flex: 1;
  height: 1px;
}

/* 配件卡片内部结构（支持图片缩略） */
.part-card-inner {
  display: flex;
  gap: 20rpx;
}
.part-image-box {
  width: 140rpx;
  height: 140rpx;
  border-radius: 12rpx;
  background: #141416;
  overflow: hidden;
  border: 1rpx solid #2c2c2e;
  display: flex;
  align-items: center;
  justify-content: center;
}
.part-image {
  width: 100%;
  height: 100%;
}
.part-image-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
}
.placeholder-icon {
  font-size: 44rpx;
  color: #48484a;
}
.part-info-box {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.part-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 1rpx solid #2c2c2e;
  padding-bottom: 10rpx;
  margin-bottom: 12rpx;
}
.part-title-box {
  display: flex;
  flex-direction: column;
  gap: 2rpx;
  flex: 1;
  min-width: 0;
}
.part-name {
  font-size: 28rpx;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.part-code {
  font-size: 20rpx;
  color: #8e8e93;
}
.stock-badge {
  font-size: 18rpx;
  padding: 2rpx 10rpx;
  border-radius: 6rpx;
  font-weight: bold;
  white-space: nowrap;
}
.low-stock-bg {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}
.normal-stock-bg {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
}

/* 配件属性格 */
.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12rpx 30rpx;
  margin-bottom: 16rpx;
}
.info-cell {
  display: flex;
  flex-direction: column;
  gap: 2rpx;
  min-width: 0;
}
.cell-label {
  font-size: 20rpx;
  color: #8e8e93;
}
.cell-value {
  font-size: 24rpx;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.text-gray-small {
  font-size: 18rpx;
  color: #8e8e93;
  font-weight: normal;
}

/* 供应商条 */
.supplier-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #141416;
  padding: 12rpx 16rpx;
  border-radius: 10rpx;
  font-size: 22rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.03);
}
.sup-info {
  display: flex;
  align-items: center;
}
.sup-label {
  color: #8e8e93;
}
.sup-name {
  color: #ffffff;
}
.sup-contact {
  display: flex;
  align-items: center;
  gap: 6rpx;
  color: #3b82f6;
}
.phone-icon {
  font-size: 20rpx;
}

/* 弹窗 (Modal) 样式 */
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  z-index: 999;
  display: flex;
  align-items: flex-end; /* 从底部弹出式面板 */
}
.modal-content {
  width: 100%;
  max-height: 85vh;
  border-radius: 30rpx 30rpx 0 0;
  margin-bottom: 0;
  display: flex;
  flex-direction: column;
  padding: 30rpx 30rpx 60rpx 30rpx;
  border-bottom: none;
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 20rpx;
  border-bottom: 1rpx solid #2c2c2e;
}
.modal-title {
  font-size: 32rpx;
  color: #ffffff;
}
.modal-close {
  font-size: 48rpx;
  color: #8e8e93;
  padding: 0 10rpx;
}
.modal-body {
  flex: 1;
  height: 1px;
  padding: 30rpx 0;
}

/* 拍照预览区域 */
.photo-upload-section {
  display: flex;
  justify-content: center;
  margin-bottom: 30rpx;
}
.photo-preview-box {
  width: 240rpx;
  height: 240rpx;
  background: #141416;
  border-radius: 20rpx;
  border: 2rpx dashed #3a3a3c;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}
.photo-preview {
  width: 100%;
  height: 100%;
}
.photo-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10rpx;
  padding: 20rpx;
  text-align: center;
}
.photo-placeholder-icon {
  font-size: 60rpx;
}
.photo-placeholder-text {
  font-size: 20rpx;
  color: #8e8e93;
}

/* 表单输入群 */
.form-group {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}
.form-row {
  display: flex;
  gap: 20rpx;
}
.flex-1 {
  flex: 1;
}
.form-item {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}
.form-label {
  font-size: 24rpx;
  color: #a1a1a9;
}
.form-input {
  background: #141416;
  border: 1rpx solid #2c2c2e;
  border-radius: 12rpx;
  height: 80rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
  color: #ffffff;
}
.form-textarea {
  background: #141416;
  border: 1rpx solid #2c2c2e;
  border-radius: 12rpx;
  height: 140rpx;
  padding: 20rpx 24rpx;
  font-size: 28rpx;
  color: #ffffff;
  width: 100%;
  box-sizing: border-box;
}
.input-with-action {
  display: flex;
  gap: 16rpx;
}
.input-with-action .form-input {
  flex: 1;
}
.input-action-btn {
  height: 80rpx;
  line-height: 80rpx;
  background: #2c2c2e;
  color: #ffffff;
  font-size: 24rpx;
  border-radius: 12rpx;
  border: 1rpx solid #3a3a3c;
  padding: 0 24rpx;
  margin: 0;
}
.form-picker {
  background: #141416;
  border: 1rpx solid #2c2c2e;
  border-radius: 12rpx;
  height: 80rpx;
  line-height: 80rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
  color: #ffffff;
}

/* 快捷标签 */
.quick-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 8rpx;
}
.quick-tag {
  background: #2c2c2e;
  color: #a1a1a9;
  font-size: 20rpx;
  padding: 6rpx 18rpx;
  border-radius: 20rpx;
}

/* 弹窗底部操作 */
.modal-footer {
  display: flex;
  gap: 20rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid #2c2c2e;
}
.footer-btn {
  flex: 1;
  height: 88rpx;
  line-height: 88rpx;
  text-align: center;
  font-size: 28rpx;
  border-radius: 44rpx;
  border: none;
}
.cancel-btn {
  background: #2c2c2e;
  color: #ffffff;
}
.submit-btn {
  background: #3b82f6;
  color: #ffffff;
  box-shadow: 0 4rpx 16rpx rgba(59, 130, 246, 0.3);
}

/* 各种样式 */
.empty-state { 
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 150rpx 0; 
}
.empty-icon {
  font-size: 80rpx;
  margin-bottom: 20rpx;
}
.empty-text {
  font-size: 28rpx;
  color: #8e8e93;
}
.loading-more {
  text-align: center;
  padding: 20rpx 0 60rpx 0;
}
.loading-more-txt {
  font-size: 22rpx;
  color: #8e8e93;
}
.text-success { color: #10b981; }
.text-warning { color: #fbbf24; }
.text-primary { color: #3b82f6; }
.text-gray { color: #8e8e93; }
.font-bold { font-weight: bold; }

/* 增强样式 */
.add-cat-item {
  border: 1rpx dashed #3b82f6 !important;
  color: #3b82f6 !important;
  background: transparent !important;
}
.add-cat-icon {
  font-size: 20rpx;
  margin-right: 4rpx;
}
.add-quick-tag {
  border: 1rpx dashed #3b82f6 !important;
  color: #3b82f6 !important;
  background: transparent !important;
}
.quick-stock-section {
  background: rgba(59, 130, 246, 0.05);
  border: 1rpx solid rgba(59, 130, 246, 0.2);
  border-radius: 16rpx;
  padding: 24rpx;
  margin-top: 16rpx;
  margin-bottom: 8rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.quick-stock-header {
  font-size: 24rpx;
  color: #3b82f6;
}
.highlight-input {
  border-color: rgba(59, 130, 246, 0.4) !important;
}
</style>
