<template>
  <view class="section premium-card">
    <view class="section-title">
      <text class="prefix">🔧</text>
      <text>施工流转控制</text>
      <text :class="['status-badge', task.status]">
        {{ { pending: '待开工', in_progress: '施工中', paused: '已暂停', completed: '已完工' }[task.status] || task.status }}
      </text>
    </view>

    <view class="info-row" v-if="task.workPlace">
      <text class="label">施工工位</text>
      <text class="value font-bold text-primary">📍 {{ task.workPlace }}</text>
    </view>
    <view class="info-row" v-if="task.team">
      <text class="label">派工班组</text>
      <text class="value">👥 {{ task.team }}</text>
    </view>
    <view class="info-row" v-if="task.technician">
      <text class="label">主修技师</text>
      <text class="value font-bold">{{ task.technician.name }}</text>
    </view>
    <view class="info-row" v-if="task.remark">
      <text class="label">派工备注</text>
      <text class="value">{{ task.remark }}</text>
    </view>

    <view class="photo-container">
      <text class="label-v font-bold">施工现场照片 ({{ photos.length }} 张)</text>
      <view class="photo-list">
        <view class="photo-item" v-for="photo in photos" :key="photo.id" @tap="previewImage(photo.url)">
          <image class="photo-img" :src="photo.url" mode="aspectFill" />
        </view>
        <view class="photo-item add-photo" v-if="task.status !== 'completed'" @tap="chooseAndUploadPhoto">
          <text class="plus">+</text>
          <text class="add-text">拍摄上传</text>
        </view>
      </view>
    </view>

    <view class="btn-group" v-if="task.status !== 'completed'">
      <button class="btn btn-primary font-bold pulse-glow" v-if="task.status === 'pending'" @tap="startWork">开始施工</button>
      <button class="btn btn-success font-bold" v-if="['in_progress', 'paused'].includes(task.status)" @tap="completeWork">确认完工</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useAuthStore } from '../../../stores/auth';
import { request } from '../../../utils/request';

const props = defineProps<{ task: any }>();
const emit = defineEmits<{ (e: 'updated'): void }>();

const auth = useAuthStore();
const photos = ref<any[]>([]);

function previewImage(url: string) {
  uni.previewImage({ urls: photos.value.map(p => p.url), current: url });
}

async function fetchPhotos() {
  if (!props.task) return;
  const res: any = await request({
    url: `/api/files?businessType=dispatch-task&businessId=${props.task.id}`,
    method: 'GET',
    header: { Authorization: `Bearer ${auth.token}` },
  });
  if (res.data?.code === 0) photos.value = res.data.data;
}

watch(() => props.task?.id, () => { if (props.task) fetchPhotos(); }, { immediate: true });

async function uploadFileToOci(tempFilePath: string, uploadUrl: string, mimeType: string): Promise<boolean> {
  return new Promise(async (resolve, reject) => {
    if (typeof window !== 'undefined') {
      try {
        const blob = await fetch(tempFilePath).then(r => r.blob());
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl, true);
        xhr.setRequestHeader('Content-Type', mimeType || blob.type);
        xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve(true) : reject(new Error(`上传 OCI 失败，状态码: ${xhr.status}`));
        xhr.onerror = () => reject(new Error('网络上传失败'));
        xhr.ontimeout = () => reject(new Error('请求超时'));
        xhr.send(blob);
      } catch (e) { reject(e); }
    } else {
      uni.getFileSystemManager().readFile({
        filePath: tempFilePath,
        success: (res) => {
          uni.request({
            url: uploadUrl, method: 'PUT', header: { 'Content-Type': mimeType }, data: res.data as ArrayBuffer,
            success: (uploadRes: any) => uploadRes.statusCode >= 200 && uploadRes.statusCode < 300 ? resolve(true) : reject(new Error(`App上传 OCI 失败: ${uploadRes.statusCode}`)),
            fail: (err: any) => reject(new Error(err.errMsg || 'App上传请求失败')),
          });
        },
        fail: (err) => reject(new Error('读取本地文件失败: ' + err.errMsg)),
      });
    }
  });
}

function chooseAndUploadPhoto() {
  if (!props.task) return;
  uni.chooseImage({
    count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'],
    success: async (chooseRes) => {
      const tempFilePath = chooseRes.tempFilePaths[0];
      uni.showLoading({ title: '正在上传照片...', mask: true });
      try {
        const urlRes: any = await request({
          url: '/api/files/upload-url', method: 'POST',
          header: { Authorization: `Bearer ${auth.token}` },
          data: { originalName: 'construction_photo.jpg', mimeType: 'image/jpeg', size: 10240, source: 'mobile', businessType: 'dispatch-task', businessId: props.task.id },
        });
        if (urlRes.data?.code !== 0) throw new Error(urlRes.data?.message || '获取上传预签名链接失败');
        const { uploadUrl, fileUrl } = urlRes.data.data || urlRes.data;
        if (!uploadUrl || !fileUrl) throw new Error('返回的上传凭证不完整');
        await uploadFileToOci(tempFilePath, uploadUrl, 'image/jpeg');
        const bindRes: any = await request({
          url: `/api/dispatch/${props.task.id}/photos`, method: 'POST',
          header: { Authorization: `Bearer ${auth.token}` },
          data: { fileUrl },
        });
        if (bindRes.data?.code === 0) {
          uni.showToast({ title: '上传成功', icon: 'success' });
          emit('updated');
        } else {
          throw new Error(bindRes.data?.message || '联动车间状态失败');
        }
      } catch (err: any) {
        uni.showModal({ title: '提示', content: err.message || '上传图片出错，请重试', showCancel: false });
      } finally { uni.hideLoading(); }
    },
  });
}

async function startWork() {
  if (!props.task) return;
  const res: any = await request({
    url: `/api/dispatch/${props.task.id}/start`, method: 'PUT',
    header: { Authorization: `Bearer ${auth.token}` },
  });
  if (res.data?.code === 0) {
    uni.showToast({ title: '已开工' });
    emit('updated');
  }
}

async function completeWork() {
  if (!props.task) return;
  const res: any = await request({
    url: `/api/dispatch/${props.task.id}/complete`, method: 'PUT',
    header: { Authorization: `Bearer ${auth.token}` },
  });
  if (res.data?.code === 0) {
    uni.showToast({ title: '已完工' });
    emit('updated');
  }
}
</script>

<style scoped>
.premium-card { background: #1c1c1e; border-radius: 20rpx; padding: 30rpx; margin-bottom: 24rpx; border: 1rpx solid #2c2c2e; box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.15); }
.section-title { font-size: 30rpx; font-weight: bold; margin-bottom: 30rpx; color: #ffffff; display: flex; align-items: center; }
.prefix { margin-right: 12rpx; font-size: 32rpx; }
.info-row { display: flex; justify-content: space-between; padding: 12rpx 0; border-bottom: 1rpx solid #2c2c2e; }
.info-row:last-child { border-bottom: none; }
.label { font-size: 26rpx; color: #a1a1a9; }
.value { font-size: 26rpx; color: #ffffff; }
.text-primary { color: #3b82f6; }
.status-badge { display: inline-block; padding: 6rpx 20rpx; border-radius: 20rpx; font-size: 20rpx; font-weight: bold; }
.status-badge.pending { background: rgba(251, 191, 36, 0.15); color: #fbbf24; }
.status-badge.in_progress { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
.status-badge.completed { background: rgba(16, 185, 129, 0.15); color: #10b981; }
.status-badge.paused { background: rgba(244, 63, 94, 0.15); color: #f43f5e; }
.photo-container { margin-top: 24rpx; border-top: 1rpx solid #2c2c2e; padding-top: 24rpx; }
.photo-list { display: flex; flex-wrap: wrap; gap: 16rpx; margin-top: 20rpx; }
.photo-item { position: relative; width: 140rpx; height: 140rpx; border-radius: 12rpx; overflow: hidden; background: #161618; border: 1rpx solid #2c2c2e; }
.photo-img { width: 100%; height: 100%; }
.add-photo { display: flex; flex-direction: column; justify-content: center; align-items: center; border: 2rpx dashed #2c2c2e; background: #161618; }
.plus { font-size: 44rpx; color: #8e8e93; line-height: 1; }
.add-text { font-size: 18rpx; color: #8e8e93; margin-top: 6rpx; }
.btn-group { display: flex; gap: 20rpx; margin-top: 30rpx; }
.btn { flex: 1; height: 78rpx; line-height: 78rpx; text-align: center; border-radius: 39rpx; font-size: 26rpx; font-weight: bold; border: none; margin: 0; }
.btn-primary { background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: #fff; }
.btn-success { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #fff; }
.pulse-glow { animation: pulse 2.5s infinite; }
@keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); } 70% { box-shadow: 0 0 0 10rpx rgba(59, 130, 246, 0); } 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); } }
.font-bold { font-weight: bold; }
</style>
