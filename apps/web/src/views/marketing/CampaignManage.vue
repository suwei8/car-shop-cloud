<template>
  <div>
    <el-card shadow="never" style="margin-bottom: 16px">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span>短信营销活动</span>
          <el-button type="primary" @click="currentStep = 0; segmentPreview = null; campaignForm.name = ''; campaignForm.content = ''">创建活动</el-button>
        </div>
      </template>

      <el-steps :active="currentStep" finish-status="success" style="margin-bottom: 20px">
        <el-step title="选择客户" description="筛选目标客户群" />
        <el-step title="编辑内容" description="编写短信内容" />
        <el-step title="确认发送" description="确认并发送" />
      </el-steps>

      <!-- Step 1: Customer Segmentation -->
      <div v-if="currentStep === 0">
        <el-form :inline="true">
          <el-form-item label="最近N天未到店">
            <el-input-number v-model="segmentQuery.inactiveDays" :min="0" placeholder="天数" />
          </el-form-item>
          <el-form-item label="最低消费金额">
            <el-input-number v-model="segmentQuery.minSpendAmount" :min="0" placeholder="元" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="previewSegment">预览客户数</el-button>
          </el-form-item>
        </el-form>
        <el-alert v-if="segmentPreview" :title="`符合条件的客户共 ${segmentPreview.count} 人`" type="success" show-icon />
        <el-button type="primary" :disabled="!segmentPreview || segmentPreview.count === 0" @click="currentStep = 1">下一步</el-button>
      </div>

      <!-- Step 2: Content -->
      <div v-if="currentStep === 1">
        <el-form label-width="80px">
          <el-form-item label="活动名称">
            <el-input v-model="campaignForm.name" placeholder="例：6月保养促销" />
          </el-form-item>
          <el-form-item label="短信内容">
            <el-input v-model="campaignForm.content" type="textarea" :rows="4" placeholder="支持变量: {name}" />
          </el-form-item>
        </el-form>
        <el-button @click="currentStep = 0">上一步</el-button>
        <el-button type="primary" :disabled="!campaignForm.name || !campaignForm.content" @click="currentStep = 2">下一步</el-button>
      </div>

      <!-- Step 3: Confirm -->
      <div v-if="currentStep === 2">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="活动名称">{{ campaignForm.name }}</el-descriptions-item>
          <el-descriptions-item label="目标客户数">{{ segmentPreview?.count || 0 }} 人</el-descriptions-item>
          <el-descriptions-item label="短信内容" :span="2">{{ campaignForm.content }}</el-descriptions-item>
        </el-descriptions>
        <div style="margin-top: 20px">
          <el-button @click="currentStep = 1">上一步</el-button>
          <el-button type="primary" :loading="submitting" @click="submitCampaign">确认发送</el-button>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { ElMessage } from 'element-plus';
import { apiPost } from '../../utils/api';

const currentStep = ref(0);
const submitting = ref(false);
const segmentPreview = ref<{ count: number } | null>(null);

const segmentQuery = reactive({
  inactiveDays: undefined as number | undefined,
  minSpendAmount: undefined as number | undefined,
});

const campaignForm = reactive({
  name: '',
  content: '',
});

async function previewSegment() {
  try {
    const result = await apiPost<{ count: number }>('/marketing/segments/preview', segmentQuery);
    segmentPreview.value = result;
  } catch (e) {
    console.error('Failed to preview segment:', e);
  }
}

async function submitCampaign() {
  submitting.value = true;
  try {
    await apiPost('/marketing/campaigns', {
      name: campaignForm.name,
      content: campaignForm.content,
    });
    ElMessage.success('营销活动已创建并开始发送');
    currentStep.value = 0;
    segmentPreview.value = null;
    campaignForm.name = '';
    campaignForm.content = '';
  } catch (e) {
    console.error('Failed to create campaign:', e);
  } finally {
    submitting.value = false;
  }
}
</script>
