<template>
  <el-dialog v-model="visible" title="扫码支付" width="400px" :close-on-click-modal="false" @close="handleClose">
    <div style="text-align: center">
      <div v-if="status === 'pending'">
        <canvas ref="qrCanvas" />
        <p style="margin-top: 12px; color: #999">请使用{{ methodLabel }}扫码支付</p>
        <el-tag type="warning" size="large">¥{{ amount.toFixed(2) }}</el-tag>
      </div>
      <div v-else-if="status === 'paid'">
        <el-result icon="success" title="支付成功" />
      </div>
      <div v-else-if="status === 'expired'">
        <el-result icon="warning" title="支付超时" sub-title="请重新发起支付" />
      </div>
      <div v-else>
        <el-icon class="is-loading" :size="32"><Loading /></el-icon>
        <p>正在确认支付状态...</p>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue';
import QRCode from 'qrcode';
import { ElMessage } from 'element-plus';
import { Loading } from '@element-plus/icons-vue';
import api from '../../../utils/api';

const props = defineProps<{
  modelValue: boolean;
  codeUrl: string;
  orderId: string;
  amount: number;
  method: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [val: boolean];
  paid: [];
}>();

const visible = ref(props.modelValue);
const status = ref('pending');
const qrCanvas = ref<HTMLCanvasElement | null>(null);
let pollTimer: ReturnType<typeof setInterval> | null = null;

const methodLabel = props.method === 'wechat' ? '微信' : '支付宝';

watch(
  () => props.modelValue,
  (val) => {
    visible.value = val;
    if (val && props.codeUrl) {
      status.value = 'pending';
      renderQr();
      startPolling();
    }
  },
);

watch(visible, (val) => {
  emit('update:modelValue', val);
});

function renderQr() {
  if (!qrCanvas.value || !props.codeUrl) return;
  QRCode.toCanvas(qrCanvas.value, props.codeUrl, { width: 250 });
}

function startPolling() {
  stopPolling();
  pollTimer = setInterval(async () => {
    try {
      const res: any = await api.get(`/subscription/orders/${props.orderId}`);
      if (res.status === 'paid') {
        status.value = 'paid';
        stopPolling();
        ElMessage.success('支付成功');
        setTimeout(() => {
          handleClose();
          emit('paid');
        }, 1500);
      }
    } catch {
      // ignore polling errors
    }
  }, 3000);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function handleClose() {
  stopPolling();
  visible.value = false;
  emit('update:modelValue', false);
}

onBeforeUnmount(stopPolling);
</script>
