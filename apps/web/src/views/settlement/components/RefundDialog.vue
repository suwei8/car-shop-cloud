<template>
  <el-dialog v-model="visible" title="发起退款" width="450px">
    <el-form :model="form" label-width="80px">
      <el-form-item label="退款金额">
        <el-input-number v-model="form.amount" :min="0.01" :max="maxRefundable" :precision="2" controls-position="right" style="width: 200px" />
        <span style="margin-left: 8px; color: #999">可退 ¥{{ maxRefundable.toFixed(2) }}</span>
      </el-form-item>
      <el-form-item label="退款原因" required>
        <el-input v-model="form.reason" type="textarea" :rows="3" placeholder="请输入退款原因" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="danger" :loading="submitting" @click="handleSubmit">确认退款</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue';
import { ElMessage } from 'element-plus';
import api from '../../../utils/api';

const props = defineProps<{
  modelValue: boolean;
  settlementId: string;
  paymentId: string;
  maxRefundable: number;
}>();

const emit = defineEmits<{
  'update:modelValue': [val: boolean];
  'success': [];
}>();

const visible = ref(props.modelValue);
const submitting = ref(false);
const form = reactive({ amount: 0, reason: '' });

watch(() => props.modelValue, (val) => {
  visible.value = val;
  if (val) {
    form.amount = 0;
    form.reason = '';
  }
});

watch(visible, (val) => {
  emit('update:modelValue', val);
});

async function handleSubmit() {
  if (!form.reason.trim()) {
    ElMessage.warning('请输入退款原因');
    return;
  }
  if (form.amount <= 0) {
    ElMessage.warning('退款金额必须大于0');
    return;
  }
  if (form.amount > props.maxRefundable) {
    ElMessage.warning(`退款金额不能超过可退金额 ¥${props.maxRefundable.toFixed(2)}`);
    return;
  }

  submitting.value = true;
  try {
    await api.post(`/settlements/${props.settlementId}/payments/${props.paymentId}/refund`, {
      amount: form.amount,
      reason: form.reason,
    });
    ElMessage.success('退款成功');
    handleClose();
    emit('success');
  } finally {
    submitting.value = false;
  }
}

function handleClose() {
  visible.value = false;
  emit('update:modelValue', false);
}
</script>
