<template>
  <el-card shadow="never">
    <template #header>客户分析</template>
    <div v-loading="loading" style="height: 300px">
      <div v-if="!hasData && !loading" style="display: flex; align-items: center; justify-content: center; height: 100%; color: #999">
        暂无数据
      </div>
      <el-row v-else :gutter="16" style="height: 100%">
        <el-col :span="10">
          <div style="text-align: center; font-size: 14px; color: #666; margin-bottom: 8px">新客/回头客</div>
          <v-chart :option="pieOption" autoresize style="height: 260px" />
        </el-col>
        <el-col :span="14">
          <div style="text-align: center; font-size: 14px; color: #666; margin-bottom: 8px">每日新客增长</div>
          <v-chart :option="lineOption" autoresize style="height: 260px" />
        </el-col>
      </el-row>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import VChart from 'vue-echarts';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { PieChart, LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { getCustomerAnalysis } from '../../../api/analytics';
import type { CustomerAnalysisData } from '../../../api/analytics';

use([CanvasRenderer, PieChart, LineChart, GridComponent, TooltipComponent, LegendComponent]);

const props = defineProps<{
  startDate: string;
  endDate: string;
  shopId: string;
}>();

const loading = ref(false);
const newCustomers = ref(0);
const returningCustomers = ref(0);
const growthTrend = ref<CustomerAnalysisData['growthTrend']>([]);

const hasData = computed(() => newCustomers.value + returningCustomers.value > 0);

const pieOption = computed(() => ({
  tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
  series: [{
    type: 'pie',
    radius: ['40%', '70%'],
    data: [
      { name: '新客', value: newCustomers.value },
      { name: '回头客', value: returningCustomers.value },
    ],
    emphasis: { itemStyle: { shadowBlur: 10 } },
  }],
}));

const lineOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
  xAxis: {
    type: 'category',
    data: growthTrend.value.map(d => d.period),
    axisLabel: { rotate: 30, fontSize: 10 },
  },
  yAxis: { type: 'value' },
  series: [{
    type: 'line',
    data: growthTrend.value.map(d => d.newCount),
    smooth: true,
    areaStyle: { opacity: 0.3 },
    itemStyle: { color: '#F56C6C' },
  }],
}));

async function fetchData() {
  loading.value = true;
  try {
    const result = await getCustomerAnalysis({
      startDate: props.startDate,
      endDate: props.endDate,
      shopId: props.shopId || undefined,
    });
    newCustomers.value = result.newCustomers || 0;
    returningCustomers.value = result.returningCustomers || 0;
    growthTrend.value = result.growthTrend || [];
  } catch (e) {
    console.error('Failed to fetch customer analysis:', e);
  } finally {
    loading.value = false;
  }
}

watch(() => [props.startDate, props.endDate, props.shopId], fetchData);
onMounted(fetchData);
</script>
