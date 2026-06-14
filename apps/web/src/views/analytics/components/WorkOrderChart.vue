<template>
  <el-card shadow="never">
    <template #header>工单统计</template>
    <div v-loading="loading" style="height: 300px">
      <div v-if="!hasData && !loading" style="display: flex; align-items: center; justify-content: center; height: 100%; color: #999">
        暂无数据
      </div>
      <el-row v-else :gutter="16" style="height: 100%">
        <el-col :span="12">
          <div style="height: 100%">
            <div style="text-align: center; font-size: 14px; color: #666; margin-bottom: 8px">按状态分布</div>
            <v-chart :option="statusOption" autoresize style="height: 260px" />
          </div>
        </el-col>
        <el-col :span="12">
          <div style="height: 100%">
            <div style="text-align: center; font-size: 14px; color: #666; margin-bottom: 8px">按类型分布</div>
            <v-chart :option="typeOption" autoresize style="height: 260px" />
          </div>
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
import { PieChart, BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { getWorkOrderStats } from '../../../api/analytics';
import type { WorkOrderStatsData } from '../../../api/analytics';

use([CanvasRenderer, PieChart, BarChart, GridComponent, TooltipComponent, LegendComponent]);

const props = defineProps<{
  startDate: string;
  endDate: string;
  shopId: string;
}>();

const loading = ref(false);
const statusData = ref<WorkOrderStatsData['statusDistribution']>([]);
const typeData = ref<WorkOrderStatsData['typeDistribution']>([]);

const hasData = computed(() => statusData.value.length > 0 || typeData.value.length > 0);

const statusLabelMap: Record<string, string> = {
  draft: '草稿', confirmed: '已确认', dispatching: '派工中', in_progress: '施工中',
  completed: '已完成', settled: '已结算', cancelled: '已取消',
};

const statusOption = computed(() => ({
  tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
  series: [{
    type: 'pie',
    radius: ['40%', '70%'],
    data: statusData.value.map(d => ({
      name: statusLabelMap[d.status] || d.status,
      value: d.count,
    })),
    emphasis: { itemStyle: { shadowBlur: 10 } },
  }],
}));

const typeLabelMap: Record<string, string> = {
  repair: '维修', wash: '洗车', quick: '快修',
};

const typeOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
  xAxis: {
    type: 'category',
    data: typeData.value.map(d => typeLabelMap[d.type] || d.type),
  },
  yAxis: { type: 'value' },
  series: [{
    type: 'bar',
    data: typeData.value.map(d => d.count),
    itemStyle: { color: '#67C23A' },
  }],
}));

async function fetchData() {
  loading.value = true;
  try {
    const result = await getWorkOrderStats({
      startDate: props.startDate,
      endDate: props.endDate,
      shopId: props.shopId || undefined,
    });
    statusData.value = result.statusDistribution || [];
    typeData.value = result.typeDistribution || [];
  } catch (e) {
    console.error('Failed to fetch work order stats:', e);
  } finally {
    loading.value = false;
  }
}

watch(() => [props.startDate, props.endDate, props.shopId], fetchData);
onMounted(fetchData);
</script>
