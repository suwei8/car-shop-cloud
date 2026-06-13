<template>
  <view class="container" v-if="order">
    <view class="card">
      <view class="card-title">基本信息</view>
      <view class="info-row">
        <text class="label">工单号</text>
        <text>{{ order.orderNo }}</text>
      </view>
      <view class="info-row">
        <text class="label">车牌号</text>
        <text>{{ order.vehiclePlateNo }}</text>
      </view>
      <view class="info-row">
        <text class="label">类型</text>
        <text>{{ typeLabel(order.orderType) }}</text>
      </view>
      <view class="info-row">
        <text class="label">状态</text>
        <text class="status">{{ statusLabel(order.status) }}</text>
      </view>
      <view class="info-row">
        <text class="label">创建时间</text>
        <text>{{ formatDate(order.createdAt) }}</text>
      </view>
      <view class="info-row" v-if="order.description">
        <text class="label">描述</text>
        <text>{{ order.description }}</text>
      </view>
    </view>

    <view class="card">
      <view class="card-title">服务项目</view>
      <view v-for="item in order.items" :key="item.id" class="item-row">
        <view class="item-name">
          <text>{{ item.name }}</text>
          <text class="item-type">{{ itemTypeLabel(item.itemType) }}</text>
        </view>
        <view class="item-amount">
          <text class="qty">x{{ item.quantity }}</text>
          <text class="price">¥{{ Number(item.amount).toFixed(2) }}</text>
        </view>
      </view>
      <view class="total-row">
        <text>合计</text>
        <text class="total">¥{{ Number(order.payableAmount).toFixed(2) }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { request } from '../../utils/api';

const order = ref<any>(null);
const orderId = ref('');

const statusMap: Record<string, string> = {
  draft: '草稿', quoted: '已报价', confirmed: '已确认', dispatching: '派工中',
  in_progress: '施工中', completed: '已完成', settled: '已结算', cancelled: '已取消',
};
const typeMap: Record<string, string> = { repair: '维修', wash: '洗美', quick: '快单' };
const itemTypeMap: Record<string, string> = { service: '工时', part: '配件', addon: '其他' };

function statusLabel(s: string) { return statusMap[s] || s; }
function typeLabel(t: string) { return typeMap[t] || t; }
function itemTypeLabel(t: string) { return itemTypeMap[t] || t; }
function formatDate(d: string) { return new Date(d).toLocaleString(); }

onLoad((query: any) => {
  orderId.value = query?.id || '';
});

onMounted(async () => {
  if (!orderId.value) return;
  order.value = await request(`/customer-portal/work-orders/${orderId.value}`);
});
</script>

<style scoped>
.info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f5f5f5; }
.label { color: #999; }
.status { color: #409eff; font-weight: 600; }
.item-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f5f5f5; }
.item-name { display: flex; flex-direction: column; }
.item-type { font-size: 11px; color: #999; margin-top: 2px; }
.item-amount { text-align: right; }
.qty { font-size: 12px; color: #999; display: block; }
.price { font-weight: 600; }
.total-row { display: flex; justify-content: space-between; padding-top: 12px; font-size: 16px; font-weight: 700; }
.total { color: #f56c6c; }
</style>
