<template>
  <el-card shadow="never">
    <template #header>
      <div style="display: flex; justify-content: space-between; align-items: center">
        <span>营收趋势</span>
        <el-radio-group v-model="dimension" size="small" @change="fetchData">
          <el-radio-button value="day">按日</el-radio-button>
          <el-radio-button value="week">按周</el-radio-button>
          <el-radio-button value="month">按月</el-radio-button>
        </el-radio-group>
      </div>
    </template>
    <div v-loading="loading" style="height: 300px">
      <div v-if="chartData.length === 0 && !loading" style="display: flex; align-items: center; justify-content: center; height: 100%; color: #999">
        暂无数据
      </div>
      <v-chart v-else :option="chartOption" autoresize style="height: 100%" />
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import VChart from 'vue-echarts';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { getRevenueTrend } from '../../../api/analytics';
import type { RevenueTrendData } from '../../../api/analytics';

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent, LegendComponent]);

const props = defineProps<{
  startDate: string;
  endDate: string;
  shopId: string;
}>();

const loading = ref(false);
const dimension = ref<'day' | 'week' | 'month'>('day');
const chartData = ref<RevenueTrendData['data']>([]);

const chartOption = computed(() => ({
  tooltip: {
    trigger: 'axis',
    formatter: (params: any) => {
      const p = params[0];
      return `${p.axisValue}<br/>营收: ¥${Number(p.value).toLocaleString()}<br/>工单数: ${chartData.value[p.dataIndex]?.orderCount || 0}`;
    },
  },
  grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
  xAxis: {
    type: 'category',
    data: chartData.value.map(d => d.period),
    axisLabel: { rotate: 30 },
  },
  yAxis: {
    type: 'value',
    axisLabel: { formatter: '¥{value}' },
  },
  series: [
    {
      name: '营收',
      type: 'line',
      data: chartData.value.map(d => Number(d.totalRevenue)),
      smooth: true,
      areaStyle: { opacity: 0.3 },
      itemStyle: { color: '#409EFF' },
    },
  ],
}));

async function fetchData() {
  loading.value = true;
  try {
    const result = await getRevenueTrend({
      startDate: props.startDate,
      endDate: props.endDate,
      dimension: dimension.value,
      shopId: props.shopId || undefined,
    });
    chartData.value = result.data || [];
  } catch (e) {
    console.error('Failed to fetch revenue trend:', e);
  } finally {
    loading.value = false;
  }
}

watch(() => [props.startDate, props.endDate, props.shopId], fetchData);
onMounted(fetchData);
</script>
