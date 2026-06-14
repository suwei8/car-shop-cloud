<template>
  <el-card shadow="never">
    <template #header>配件消耗 TOP 10</template>
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
import { getPartsConsumption } from '../../../api/analytics';
import type { PartsConsumptionData } from '../../../api/analytics';

use([CanvasRenderer, BarChart, GridComponent, TooltipComponent]);

const props = defineProps<{
  startDate: string;
  endDate: string;
  shopId: string;
}>();

const loading = ref(false);
const chartData = ref<PartsConsumptionData['data']>([]);

const chartOption = computed(() => {
  const sorted = [...chartData.value].sort((a, b) => Number(a.totalAmount) - Number(b.totalAmount));
  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const p = params[0];
        const item = sorted[p.dataIndex];
        return `${item.partName} (${item.partCode})<br/>消耗金额: ¥${Number(item.totalAmount).toLocaleString()}<br/>数量: ${item.totalQuantity}`;
      },
    },
    grid: { left: '3%', right: '15%', bottom: '3%', containLabel: true },
    xAxis: { type: 'value', axisLabel: { formatter: '¥{value}' } },
    yAxis: {
      type: 'category',
      data: sorted.map(d => d.partName),
    },
    series: [{
      type: 'bar',
      data: sorted.map(d => Number(d.totalAmount)),
      itemStyle: { color: '#909399' },
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
    const result = await getPartsConsumption({
      startDate: props.startDate,
      endDate: props.endDate,
      shopId: props.shopId || undefined,
    });
    chartData.value = result.data || [];
  } catch (e) {
    console.error('Failed to fetch parts consumption:', e);
  } finally {
    loading.value = false;
  }
}

watch(() => [props.startDate, props.endDate, props.shopId], fetchData);
onMounted(fetchData);
</script>
