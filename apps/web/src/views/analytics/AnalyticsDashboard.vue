<template>
  <div>
    <el-card class="filter-card" shadow="never" style="margin-bottom: 16px">
      <el-row :gutter="16" align="middle">
        <el-col :span="10">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            :shortcuts="dateShortcuts"
            value-format="YYYY-MM-DD"
            @change="onDateChange"
          />
        </el-col>
        <el-col :span="6">
          <el-select v-model="shopId" placeholder="全部门店" clearable @change="fetchAll">
            <el-option v-for="s in shops" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-col>
      </el-row>
    </el-card>

    <el-row :gutter="16" style="margin-bottom: 16px">
      <el-col :xs="24" :lg="12">
        <RevenueChart :start-date="startDate" :end-date="endDate" :shop-id="shopId" />
      </el-col>
      <el-col :xs="24" :lg="12">
        <WorkOrderChart :start-date="startDate" :end-date="endDate" :shop-id="shopId" />
      </el-col>
    </el-row>
    <el-row :gutter="16" style="margin-bottom: 16px">
      <el-col :xs="24" :lg="12">
        <TechnicianChart :start-date="startDate" :end-date="endDate" :shop-id="shopId" />
      </el-col>
      <el-col :xs="24" :lg="12">
        <CustomerChart :start-date="startDate" :end-date="endDate" :shop-id="shopId" />
      </el-col>
    </el-row>
    <el-row :gutter="16">
      <el-col :xs="24" :lg="12">
        <PartsChart :start-date="startDate" :end-date="endDate" :shop-id="shopId" />
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { apiGet } from '../../utils/api';
import type { Shop } from '../../types/models';
import RevenueChart from './components/RevenueChart.vue';
import WorkOrderChart from './components/WorkOrderChart.vue';
import TechnicianChart from './components/TechnicianChart.vue';
import CustomerChart from './components/CustomerChart.vue';
import PartsChart from './components/PartsChart.vue';

const now = new Date();
const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

const dateRange = ref<[string, string]>([
  thirtyDaysAgo.toISOString().slice(0, 10),
  now.toISOString().slice(0, 10),
]);
const shopId = ref('');
const shops = ref<Shop[]>([]);

const startDate = computed(() => dateRange.value?.[0] || '');
const endDate = computed(() => dateRange.value?.[1] || '');

import { computed } from 'vue';

const dateShortcuts = [
  { text: '最近7天', value: () => [new Date(Date.now() - 7 * 86400000), new Date()] },
  { text: '最近30天', value: () => [new Date(Date.now() - 30 * 86400000), new Date()] },
  { text: '最近90天', value: () => [new Date(Date.now() - 90 * 86400000), new Date()] },
  {
    text: '本月', value: () => {
      const d = new Date();
      return [new Date(d.getFullYear(), d.getMonth(), 1), d];
    },
  },
  {
    text: '上月', value: () => {
      const d = new Date();
      return [new Date(d.getFullYear(), d.getMonth() - 1, 1), new Date(d.getFullYear(), d.getMonth(), 0)];
    },
  },
];

function onDateChange() {
  // Date range changed, charts will react via watch
}

function fetchAll() {
  // Shop changed, charts will react via watch
}

onMounted(async () => {
  try {
    shops.value = await apiGet<Shop[]>('/shops');
  } catch (e) {
    console.error('Failed to fetch shops:', e);
  }
});
</script>

<style scoped>
.filter-card :deep(.el-card__body) {
  padding: 12px 20px;
}
</style>
