<template>
  <el-card shadow="never">
    <template #header>技师产值排行</template>
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
import { BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { getTechnicianRanking } from '../../../api/analytics';
import type { TechnicianRankingData } from '../../../api/analytics';

use([CanvasRenderer, BarChart, GridComponent, TooltipComponent]);

const props = defineProps<{
  startDate: string;
  endDate: string;
  shopId: string;
}>();

const loading = ref(false);
const chartData = ref<TechnicianRankingData['data']>([]);

const chartOption = computed(() => {
  const sorted = [...chartData.value].sort((a, b) => a.totalRevenue.localeCompare(b.totalRevenue));
  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const p = params[0];
        return `${p.name}<br/>营收: ¥${Number(p.value).toLocaleString()}<br/>工单数: ${chartData.value.find(d => d.technicianName === p.name)?.orderCount || 0}`;
      },
    },
    grid: { left: '3%', right: '15%', bottom: '3%', containLabel: true },
    xAxis: { type: 'value', axisLabel: { formatter: '¥{value}' } },
    yAxis: {
      type: 'category',
      data: sorted.map(d => d.technicianName),
    },
    series: [{
      type: 'bar',
      data: sorted.map(d => Number(d.totalRevenue)),
      itemStyle: { color: '#E6A23C' },
      label: {
        show: true,
        position: 'right',
        formatter: (p: any) => `¥${Number(p.value).toLocaleString()}`,
      },
    }],
  };
});

async function fetchData() {
  loading.value = true;
  try {
    const result = await getTechnicianRanking({
      startDate: props.startDate,
      endDate: props.endDate,
      shopId: props.shopId || undefined,
    });
    chartData.value = (result.data || []).slice(0, 10);
  } catch (e) {
    console.error('Failed to fetch technician ranking:', e);
  } finally {
    loading.value = false;
  }
}

watch(() => [props.startDate, props.endDate, props.shopId], fetchData);
onMounted(fetchData);
</script>
