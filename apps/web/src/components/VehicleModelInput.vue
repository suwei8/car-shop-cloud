<template>
  <div class="vehicle-model-input">
    <el-row :gutter="8">
      <el-col :span="12">
        <el-select
          v-model="brand"
          filterable allow-create default-first-option
          placeholder="品牌"
          style="width: 100%"
          @change="onBrandChange"
        >
          <el-option v-for="b in library.brands" :key="b" :label="b" :value="b" />
        </el-select>
      </el-col>
      <el-col :span="12">
        <el-select
          v-model="series"
          filterable allow-create default-first-option
          placeholder="车系"
          style="width: 100%"
          :disabled="!brand"
          @change="onSeriesChange"
        >
          <el-option v-for="s in seriesOptions" :key="s" :label="s" :value="s" />
        </el-select>
      </el-col>
    </el-row>
    <el-row :gutter="8" style="margin-top: 8px">
      <el-col :span="8">
        <el-select
          v-model="year"
          filterable allow-create default-first-option
          placeholder="年份"
          style="width: 100%"
          :disabled="!series"
          @change="onYearChange"
        >
          <el-option v-for="y in yearOptions" :key="y" :label="y" :value="y" />
        </el-select>
      </el-col>
      <el-col :span="16">
        <el-select
          v-model="detail"
          filterable allow-create default-first-option
          placeholder="车型详情"
          style="width: 100%"
          :disabled="!year"
          @change="onDetailChange"
        >
          <el-option v-for="d in detailOptions" :key="d" :label="d" :value="d" />
        </el-select>
      </el-col>
    </el-row>
    <div style="margin-top: 6px; font-size: 12px; color: #909399">
      完整车型：<strong>{{ modelValue || '请填写上方信息' }}</strong>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import api from '../utils/api';

interface ModelLibrary {
  brands: string[];
  series: Record<string, string[]>;
  years: Record<string, string[]>;
  details: Record<string, string[]>;
}

const props = defineProps<{ modelValue: string }>();
const emit = defineEmits(['update:modelValue']);

const library = ref<ModelLibrary>({ brands: [], series: {}, years: {}, details: {} });
const brand = ref('');
const series = ref('');
const year = ref('');
const detail = ref('');

const seriesOptions = computed(() => library.value.series[brand.value] || []);
const yearOptions = computed(() => library.value.years[`${brand.value}/${series.value}`] || []);
const detailOptions = computed(() => library.value.details[`${brand.value}/${series.value}/${year.value}`] || []);

function syncModel() {
  const parts = [brand.value, series.value, year.value, detail.value].map(s => s.trim()).filter(Boolean);
  emit('update:modelValue', parts.join('/'));
}

function onBrandChange() {
  series.value = '';
  year.value = '';
  detail.value = '';
  syncModel();
}

function onSeriesChange() {
  year.value = '';
  detail.value = '';
  syncModel();
}

function onYearChange() {
  detail.value = '';
  syncModel();
}

function onDetailChange() {
  syncModel();
}

// 从 model 字符串解析回四个字段
function parseModel(model: string) {
  if (!model) {
    brand.value = ''; series.value = ''; year.value = ''; detail.value = '';
    return;
  }
  const parts = model.split('/');
  brand.value = parts[0]?.trim() || '';
  series.value = parts[1]?.trim() || '';
  year.value = parts[2]?.trim() || '';
  detail.value = parts[3]?.trim() || '';
}

// 监听外部值变化
watch(() => props.modelValue, (val) => {
  // 只在值与当前不同时解析，避免循环
  const current = [brand.value, series.value, year.value, detail.value].map(s => s.trim()).filter(Boolean).join('/');
  if (val !== current) {
    parseModel(val);
  }
});

// 加载车型库
async function fetchLibrary() {
  try {
    library.value = await api.get('/vehicles/model-library') as any;
  } catch {}
}

onMounted(async () => {
  await fetchLibrary();
  if (props.modelValue) {
    parseModel(props.modelValue);
  }
});
</script>
