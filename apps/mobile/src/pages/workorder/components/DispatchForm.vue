<template>
  <view class="section premium-card">
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
      <input class="form-input-inline" v-model="remark" type="text" placeholder="选填，如客户配合主修或要点" />
    </view>

    <button class="dispatch-submit-btn font-bold pulse-glow" :loading="loading" @tap="submitDispatch">
      确认指派开始施工
    </button>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAuthStore } from '../../../stores/auth';
import { request } from '../../../utils/request';

const props = defineProps<{ orderId: string }>();
const emit = defineEmits<{ (e: 'submitted'): void }>();

const auth = useAuthStore();
const technicians = ref<any[]>([]);
const techIndex = ref(-1);
const workPlaces = ['1号通用工位', '2号通用工位', '机修双柱举升位', '四轮定位位', '洗车精美容位', '钣金拉伸机位', '无尘喷漆房'];
const workPlaceIndex = ref(0);
const teams = ['机修班组', '常规保养组', '钣金班组', '油漆班组', '汽车美容组', '施救应急组'];
const teamIndex = ref(0);
const remark = ref('');
const loading = ref(false);

function onTechnicianChange(e: any) { techIndex.value = e.detail.value; }
function onWorkPlaceChange(e: any) { workPlaceIndex.value = e.detail.value; }
function onTeamChange(e: any) { teamIndex.value = e.detail.value; }

async function fetchTechnicians() {
  try {
    const res: any = await request({
      url: '/api/users?page=1&pageSize=50',
      method: 'GET',
      header: { Authorization: `Bearer ${auth.token}` },
    });
    if (res.data?.code === 0 && res.data.data) {
      technicians.value = res.data.data.items || [];
    }
  } catch {}
}

async function submitDispatch() {
  if (techIndex.value === -1) {
    uni.showToast({ title: '请选择指派的主修技师', icon: 'none' });
    return;
  }
  const tech = technicians.value[techIndex.value];
  loading.value = true;
  try {
    const res: any = await request({
      url: '/api/dispatch',
      method: 'POST',
      header: { Authorization: `Bearer ${auth.token}` },
      data: {
        workOrderId: props.orderId,
        technicianId: tech.id,
        workPlace: workPlaces[workPlaceIndex.value],
        team: teams[teamIndex.value],
        remark: remark.value.trim() || undefined,
      },
    });
    if (res.data?.code === 0) {
      uni.showToast({ title: '派工指派成功', icon: 'success' });
      emit('submitted');
    } else {
      throw new Error(res.data?.message || '派工提交失败');
    }
  } catch (err: any) {
    uni.showModal({ title: '派工失败', content: err.message || '系统提交派工出错，请稍后重试', showCancel: false });
  } finally {
    loading.value = false;
  }
}

onMounted(() => fetchTechnicians());
</script>

<style scoped>
.premium-card { background: #1c1c1e; border-radius: 20rpx; padding: 30rpx; margin-bottom: 24rpx; border: 1rpx solid #2c2c2e; box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.15); }
.section-title { font-size: 30rpx; font-weight: bold; margin-bottom: 30rpx; color: #ffffff; display: flex; align-items: center; }
.prefix { margin-right: 12rpx; font-size: 32rpx; }
.form-item { display: flex; align-items: center; justify-content: space-between; border-bottom: 1rpx solid #2c2c2e; padding: 24rpx 0; }
.form-item.vertical { flex-direction: column; align-items: flex-start; gap: 16rpx; }
.border-glow { border-bottom: 1rpx solid #3a3a3c; }
.form-label { font-size: 26rpx; color: #a1a1a9; width: 200rpx; }
.form-label-v { font-size: 26rpx; color: #a1a1a9; }
.form-picker { flex: 1; }
.picker-value { font-size: 28rpx; color: #3b82f6; text-align: right; font-weight: bold; }
.arrow { font-size: 18rpx; margin-left: 6rpx; }
.form-input-inline { width: 100%; height: 72rpx; background: #161618; border: 1rpx solid #2c2c2e; border-radius: 12rpx; padding: 0 20rpx; font-size: 26rpx; color: #ffffff; box-sizing: border-box; }
.dispatch-submit-btn { width: 100%; height: 84rpx; line-height: 84rpx; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: #ffffff; font-size: 28rpx; border-radius: 42rpx; border: none; margin-top: 30rpx; }
.pulse-glow { animation: pulse 2.5s infinite; }
@keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); } 70% { box-shadow: 0 0 0 10rpx rgba(59, 130, 246, 0); } 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); } }
.font-bold { font-weight: bold; }
</style>
