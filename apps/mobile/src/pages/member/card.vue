<template>
  <view class="page">
    <view class="header">
      <text class="title">我的储值卡</text>
    </view>

    <view class="list">
      <view class="card" v-for="card in cards" :key="card.id">
        <view class="card-header">
          <text class="card-no">{{ card.cardNo }}</text>
          <text :class="['status', card.status]">{{ { active: '正常', frozen: '冻结', cancelled: '注销' }[card.status] }}</text>
        </view>
        <view class="card-balance">
          <text class="balance-label">余额</text>
          <text class="balance-amount">¥{{ Number(card.balance).toFixed(2) }}</text>
        </view>
        <view class="card-detail">
          <text>本金：¥{{ Number(card.principalBalance).toFixed(2) }}</text>
          <text>赠送：¥{{ Number(card.giftBalance).toFixed(2) }}</text>
        </view>
      </view>

      <view class="empty" v-if="cards.length === 0">
        <text>暂无储值卡</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { API_BASE_URL } from '../../config';

const cards = ref<any[]>([]);

onMounted(async () => {
  const token = uni.getStorageSync('accessToken');
  const userInfo = JSON.parse(uni.getStorageSync('userInfo') || '{}');

  const res: any = await uni.request({
    url: `${API_BASE_URL}/api/stored-value-cards?customerId=${userInfo.id || ''}`,
    method: 'GET',
    header: { Authorization: `Bearer ${token}` },
  });
  if (res.data?.code === 0) {
    cards.value = res.data.data.items;
  }
});
</script>

<style scoped>
.page { padding: 20rpx; background: #f5f5f5; min-height: 100vh; }
.header { margin-bottom: 20rpx; }
.title { font-size: 36rpx; font-weight: bold; }
.card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16rpx; padding: 32rpx; margin-bottom: 20rpx; color: #fff; }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20rpx; }
.card-no { font-size: 28rpx; }
.status { font-size: 22rpx; padding: 4rpx 12rpx; border-radius: 4rpx; background: rgba(255,255,255,0.2); }
.card-balance { text-align: center; margin-bottom: 20rpx; }
.balance-label { font-size: 24rpx; opacity: 0.8; }
.balance-amount { font-size: 48rpx; font-weight: bold; display: block; margin-top: 8rpx; }
.card-detail { display: flex; justify-content: space-around; font-size: 24rpx; opacity: 0.8; }
.empty { text-align: center; padding: 100rpx 0; color: #999; }
</style>
