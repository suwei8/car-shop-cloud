<template>
  <div
    class="plan-card"
    :class="{ selected: selected, current: isCurrent }"
    @click="$emit('select')"
  >
    <div v-if="isCurrent" class="current-badge">当前套餐</div>
    <h3 class="plan-name">{{ plan.name }}</h3>
    <div class="plan-price">
      <span class="price">¥{{ monthlyPrice }}</span>
      <span class="unit">/月</span>
    </div>
    <div class="plan-limits">
      <div>🏪 门店上限：{{ plan.maxShops }}家</div>
      <div>👥 员工上限：{{ plan.maxEmployees }}人</div>
    </div>
    <div v-if="plan.features" class="plan-features">
      <div v-for="(feat, idx) in featureList" :key="idx" class="feature-item">
        ✅ {{ feat }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  plan: any;
  selected: boolean;
  isCurrent: boolean;
}>();

defineEmits<{
  select: [];
}>();

const monthlyPrice = computed(() => {
  if (props.plan.priceMonthly) return Number(props.plan.priceMonthly).toFixed(0);
  return (Number(props.plan.priceYearly) / 12).toFixed(0);
});

const featureList = computed(() => {
  if (!props.plan.features) return [];
  if (Array.isArray(props.plan.features)) return props.plan.features;
  try {
    const parsed = JSON.parse(props.plan.features);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
});
</script>

<style scoped>
.plan-card {
  border: 2px solid #e4e7ed;
  border-radius: 12px;
  padding: 24px;
  cursor: pointer;
  transition: all 0.3s;
  position: relative;
  background: #fff;
}
.plan-card:hover {
  border-color: #409eff;
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.15);
}
.plan-card.selected {
  border-color: #409eff;
  background: #f0f7ff;
}
.plan-card.current {
  border-color: #67c23a;
}
.current-badge {
  position: absolute;
  top: -1px;
  right: 16px;
  background: #67c23a;
  color: #fff;
  padding: 2px 12px;
  border-radius: 0 0 8px 8px;
  font-size: 12px;
}
.plan-name {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 12px;
}
.plan-price {
  margin-bottom: 16px;
}
.price {
  font-size: 32px;
  font-weight: 700;
  color: #f56c6c;
}
.unit {
  font-size: 14px;
  color: #909399;
}
.plan-limits {
  font-size: 14px;
  color: #606266;
  margin-bottom: 12px;
}
.plan-limits div {
  margin-bottom: 4px;
}
.plan-features {
  font-size: 13px;
  color: #67c23a;
  border-top: 1px solid #ebeef5;
  padding-top: 12px;
}
.feature-item {
  margin-bottom: 4px;
}
</style>
