<template>
  <div class="page-container">
    <h2>数据导入</h2>

    <el-steps :active="currentStep" finish-status="success" style="margin: 24px 0">
      <el-step title="下载模板" description="下载Excel导入模板" />
      <el-step title="上传文件" description="上传填好的Excel文件" />
      <el-step title="预览校验" description="查看校验结果" />
      <el-step title="确认导入" description="执行数据导入" />
      <el-step title="完成" description="导入成功" />
    </el-steps>

    <!-- Step 1: 下载模板 -->
    <el-card v-if="currentStep === 0" shadow="never">
      <div style="text-align: center; padding: 40px 0">
        <el-icon :size="48" color="#409EFF"><Download /></el-icon>
        <h3 style="margin: 16px 0 8px">下载导入模板</h3>
        <p style="color: #909399; margin-bottom: 24px">模板包含三个Sheet：客户、车辆、储值卡，包含必填列标注和示例数据</p>
        <el-button type="primary" size="large" @click="downloadTemplate">
          <el-icon><Download /></el-icon> 下载模板
        </el-button>
        <div style="margin-top: 24px; color: #909399; font-size: 13px">
          <p>⚠️ 注意事项：</p>
          <ul style="list-style: none; padding: 0; text-align: left; display: inline-block">
            <li>• 手机号必须为11位数字</li>
            <li>• 车牌号会自动转大写</li>
            <li>• 储值卡余额不能为负数</li>
            <li>• 单次导入上限5000行</li>
          </ul>
        </div>
        <el-button type="primary" link @click="currentStep = 1" style="margin-top: 16px">下一步 →</el-button>
      </div>
    </el-card>

    <!-- Step 2: 上传文件 -->
    <el-card v-if="currentStep === 1" shadow="never">
      <div style="text-align: center; padding: 40px 0">
        <el-upload
          ref="uploadRef"
          drag
          :auto-upload="false"
          :limit="1"
          accept=".xlsx,.xls"
          :on-change="handleFileChange"
          :on-exceed="handleExceed"
        >
          <el-icon :size="48" color="#409EFF"><UploadFilled /></el-icon>
          <div style="margin: 8px 0">将文件拖到此处，或<em>点击上传</em></div>
          <template #tip>
            <div style="color: #909399; font-size: 12px">仅支持 .xlsx / .xls 格式，文件大小 ≤ 5MB</div>
          </template>
        </el-upload>
        <div style="margin-top: 24px">
          <el-button @click="currentStep = 0">上一步</el-button>
          <el-button type="primary" :disabled="!selectedFile" @click="handlePreview">上传并预览</el-button>
        </div>
      </div>
    </el-card>

    <!-- Step 3: 预览校验结果 -->
    <el-card v-if="currentStep === 2" shadow="never">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span>校验结果</span>
          <el-button @click="currentStep = 1">重新上传</el-button>
        </div>
      </template>

      <div v-if="previewResult" style="margin-bottom: 16px">
        <el-row :gutter="16">
          <el-col :span="8">
            <el-statistic title="有效行" :value="previewResult.summary.validRows" />
          </el-col>
          <el-col :span="8">
            <el-statistic title="错误行" :value="previewResult.summary.errorRows" />
          </el-col>
          <el-col :span="8">
            <el-statistic title="跳过行" :value="previewResult.summary.skipRows" />
          </el-col>
        </el-row>
      </div>

      <!-- 客户Sheet结果 -->
      <div v-if="previewResult?.customers.errors.length" style="margin-bottom: 16px">
        <h4 style="color: #F56C6C">客户Sheet - 错误行</h4>
        <el-table :data="previewResult.customers.errors" size="small" border>
          <el-table-column prop="rowNum" label="行号" width="80" />
          <el-table-column label="姓名" width="120">
            <template #default="{ row }">{{ row.data.name }}</template>
          </el-table-column>
          <el-table-column label="手机号" width="140">
            <template #default="{ row }">{{ row.data.phone }}</template>
          </el-table-column>
          <el-table-column label="错误原因">
            <template #default="{ row }">
              <span style="color: #F56C6C">{{ row.errors?.join('；') }}</span>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 车辆Sheet结果 -->
      <div v-if="previewResult?.vehicles.errors.length" style="margin-bottom: 16px">
        <h4 style="color: #F56C6C">车辆Sheet - 错误行</h4>
        <el-table :data="previewResult.vehicles.errors" size="small" border>
          <el-table-column prop="rowNum" label="行号" width="80" />
          <el-table-column label="车牌号" width="120">
            <template #default="{ row }">{{ row.data.plateNo }}</template>
          </el-table-column>
          <el-table-column label="客户手机号" width="140">
            <template #default="{ row }">{{ row.data.customerPhone }}</template>
          </el-table-column>
          <el-table-column label="错误原因">
            <template #default="{ row }">
              <span style="color: #F56C6C">{{ row.errors?.join('；') }}</span>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 储值卡Sheet结果 -->
      <div v-if="previewResult?.storedValueCards.errors.length" style="margin-bottom: 16px">
        <h4 style="color: #F56C6C">储值卡Sheet - 错误行</h4>
        <el-table :data="previewResult.storedValueCards.errors" size="small" border>
          <el-table-column prop="rowNum" label="行号" width="80" />
          <el-table-column label="客户手机号" width="140">
            <template #default="{ row }">{{ row.data.customerPhone }}</template>
          </el-table-column>
          <el-table-column label="余额" width="100">
            <template #default="{ row }">{{ row.data.balance }}</template>
          </el-table-column>
          <el-table-column label="错误原因">
            <template #default="{ row }">
              <span style="color: #F56C6C">{{ row.errors?.join('；') }}</span>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 跳过行提示 -->
      <div v-if="(previewResult?.summary.skipRows ?? 0) > 0" style="margin-bottom: 16px">
        <el-alert type="info" show-icon>
          共有 {{ previewResult?.summary.skipRows ?? 0 }} 行数据将被跳过（与数据库中已存在的手机号/车牌号重复）
        </el-alert>
      </div>

      <!-- 无错误提示 -->
      <div v-if="previewResult && previewResult.summary.errorRows === 0">
        <el-alert type="success" show-icon>所有数据校验通过，可以导入</el-alert>
      </div>

      <div style="margin-top: 16px">
        <el-button @click="currentStep = 1">上一步</el-button>
        <el-button
          type="primary"
          :disabled="(previewResult?.summary.errorRows ?? 0) > 0"
          :loading="importing"
          @click="handleExecute"
        >
          {{ (previewResult?.summary.errorRows ?? 0) > 0 ? '请先修正错误行' : '确认导入' }}
        </el-button>
      </div>
    </el-card>

    <!-- Step 4/5: 导入完成 -->
    <el-card v-if="currentStep >= 4" shadow="never">
      <div style="text-align: center; padding: 40px 0">
        <el-icon :size="48" color="#67C23A"><CircleCheckFilled /></el-icon>
        <h3 style="margin: 16px 0 8px; color: #67C23A">导入成功！</h3>
        <p v-if="importResult" style="color: #606266">
          成功导入：客户 {{ importResult.customers }} 条、车辆 {{ importResult.vehicles }} 条、储值卡 {{ importResult.storedValueCards }} 条
        </p>
        <el-button type="primary" @click="reset" style="margin-top: 24px">继续导入</el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef } from 'vue';
import { ElMessage } from 'element-plus';
import { Download, UploadFilled, CircleCheckFilled } from '@element-plus/icons-vue';
import { apiPost } from '../../utils/api';
import type { PreviewResult } from './types';

const currentStep = ref(0);
const selectedFile = shallowRef<File | null>(null);
const previewResult = ref<PreviewResult | null>(null);
const importing = ref(false);
const importResult = ref<{ customers: number; vehicles: number; storedValueCards: number } | null>(null);

function downloadTemplate() {
  const token = localStorage.getItem('accessToken');
  const link = document.createElement('a');
  link.href = '/api/data-import/template';
  link.setAttribute('download', 'data_import_template.xlsx');
  if (token) {
    // For direct download with auth, we fetch as blob
    fetch('/api/data-import/template', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('下载失败');
        return res.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
        ElMessage.success('模板下载成功');
      })
      .catch(() => ElMessage.error('模板下载失败'));
  }
}

function handleFileChange(file: any) {
  selectedFile.value = file.raw;
}

function handleExceed() {
  ElMessage.warning('只能上传一个文件');
}

async function handlePreview() {
  if (!selectedFile.value) return;

  const formData = new FormData();
  formData.append('file', selectedFile.value);

  try {
    previewResult.value = await apiPost<PreviewResult>('/data-import/preview', formData);
    currentStep.value = 2;
  } catch {
    // error handled by api interceptor
  }
}

async function handleExecute() {
  if (!selectedFile.value || !previewResult.value) return;

  importing.value = true;
  try {
    const formData = new FormData();
    formData.append('file', selectedFile.value);
    formData.append('previewData', JSON.stringify(previewResult.value));

    importResult.value = await apiPost<{ customers: number; vehicles: number; storedValueCards: number }>(
      '/data-import/execute',
      formData,
    );
    currentStep.value = 4;
    ElMessage.success('数据导入成功！');
  } catch {
    // error handled by api interceptor
  } finally {
    importing.value = false;
  }
}

function reset() {
  currentStep.value = 0;
  selectedFile.value = null;
  previewResult.value = null;
  importResult.value = null;
}
</script>
