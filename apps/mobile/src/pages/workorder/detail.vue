<template>
  <view class="page" v-if="order">
    <view class="section">
      <view class="section-title">工单信息</view>
      <view class="info-row">
        <text class="label">工单号</text>
        <text class="value">{{ order.orderNo }}</text>
      </view>
      <view class="info-row">
        <text class="label">类型</text>
        <text class="value">{{ { repair: '维修', wash: '洗美', quick: '快单' }[order.orderType] }}</text>
      </view>
      <view class="info-row">
        <text class="label">状态</text>
        <text class="value">{{ statusLabel(order.status) }}</text>
      </view>
      <view class="info-row">
        <text class="label">创建时间</text>
        <text class="value">{{ new Date(order.createdAt).toLocaleString() }}</text>
      </view>
    </view>

    <view class="section">
      <view class="section-title">客户车辆</view>
      <view class="info-row">
        <text class="label">客户</text>
        <text class="value">{{ order.customer?.name }}</text>
      </view>
      <view class="info-row">
        <text class="label">电话</text>
        <text class="value" @tap="callPhone(order.customer?.phone)">{{ order.customer?.phone }}</text>
      </view>
      <view class="info-row">
        <text class="label">车牌</text>
        <text class="value">{{ order.vehiclePlateNo }}</text>
      </view>
      <view class="info-row">
        <text class="label">车型</text>
        <text class="value">{{ order.vehicle?.brand }} {{ order.vehicle?.model }}</text>
      </view>
    </view>

    <view class="section">
      <view class="section-title">服务项目</view>
      <view class="item" v-for="item in order.items" :key="item.id">
        <view class="item-header">
          <text class="item-name">{{ item.name }}</text>
          <text class="item-amount">¥{{ Number(item.amount).toFixed(2) }}</text>
        </view>
        <view class="item-footer">
          <text class="item-type">{{ { service: '工时', part: '配件', addon: '其他' }[item.itemType] }}</text>
          <text class="item-qty">{{ item.quantity }} {{ item.unit }} × ¥{{ Number(item.unitPrice).toFixed(2) }}</text>
        </view>
      </view>
    </view>

    <view class="section total">
      <text>合计：</text>
      <text class="total-amount">¥{{ Number(order.totalAmount).toFixed(2) }}</text>
    </view>

    <view class="section" v-if="order.description">
      <view class="section-title">故障描述</view>
      <text class="desc">{{ order.description }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { request } from '../../utils/request';

const order = ref<any>(null);

const statusMap: Record<string, string> = {
  draft: '草稿', confirmed: '已确认', in_progress: '施工中', completed: '已完成', settled: '已结算',
};
function statusLabel(s: string) { return statusMap[s] || s; }

function callPhone(phone: string) {
  if (phone) uni.makePhoneCall({ phoneNumber: phone });
}

onMounted(async () => {
  const pages = getCurrentPages();
  const page = pages[pages.length - 1] as any;
  const id = page.$page?.options?.id || page.options?.id;

  const token = uni.getStorageSync('accessToken');
  const res: any = await request({
    url: `/api/work-orders/${id}`,
    method: 'GET',
    header: { Authorization: `Bearer ${token}` },
  });
  if (res.data?.code === 0) {
    order.value = res.data.data;
  }
});
</script>

<style scoped>
.page { padding: 20rpx; background: #f5f5f5; min-height: 100vh; }
.section { background: #fff; border-radius: 12rpx; padding: 24rpx; margin-bottom: 16rpx; }
.section-title { font-size: 28rpx; font-weight: bold; margin-bottom: 16rpx; color: #333; }
.info-row { display: flex; justify-content: space-between; padding: 8rpx 0; }
.label { font-size: 26rpx; color: #999; }
.value { font-size: 26rpx; color: #333; }
.item { border-bottom: 1rpx solid #f0f0f0; padding: 12rpx 0; }
.item:last-child { border-bottom: none; }
.item-header { display: flex; justify-content: space-between; margin-bottom: 4rpx; }
.item-name { font-size: 28rpx; }
.item-amount { font-size: 28rpx; font-weight: bold; color: #f56c6c; }
.item-footer { display: flex; justify-content: space-between; }
.item-type { font-size: 24rpx; color: #999; }
.item-qty { font-size: 24rpx; color: #666; }
.total { display: flex; justify-content: flex-end; align-items: center; gap: 10rpx; }
.total-amount { font-size: 36rpx; font-weight: bold; color: #f56c6c; }
.desc { font-size: 26rpx; color: #666; line-height: 1.6; }
</style>
