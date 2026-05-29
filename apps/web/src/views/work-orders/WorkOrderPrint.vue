<template>
  <div class="print-page" v-if="data">
    <div class="print-header">
      <h1>{{ data.tenant.name }}</h1>
      <h2>维修工单</h2>
    </div>

    <div class="print-info">
      <div class="info-row">
        <span>工单号：{{ data.order.orderNo }}</span>
        <span>日期：{{ new Date(data.order.createdAt).toLocaleDateString() }}</span>
      </div>
      <div class="info-row">
        <span>客户：{{ data.customer.name }}</span>
        <span>电话：{{ data.customer.phone }}</span>
      </div>
      <div class="info-row">
        <span>车牌：{{ data.vehicle.plateNo }}</span>
        <span>车型：{{ data.vehicle.model || '-' }}</span>
      </div>
      <div class="info-row" v-if="data.order.vehicleMileage">
        <span>进店里程：{{ data.order.vehicleMileage }} km</span>
      </div>
      <div class="info-row" v-if="data.order.description">
        <span>故障描述：{{ data.order.description }}</span>
      </div>
    </div>

    <table class="print-table">
      <thead>
        <tr>
          <th>序号</th>
          <th>项目名称</th>
          <th>类型</th>
          <th>数量</th>
          <th>单价</th>
          <th>金额</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(item, index) in data.items" :key="index">
          <td>{{ index + 1 }}</td>
          <td>{{ item.name }}</td>
          <td>{{ { service: '工时', part: '配件', addon: '其他' }[item.itemType] }}</td>
          <td>{{ item.quantity }} {{ item.unit }}</td>
          <td>¥{{ item.unitPrice.toFixed(2) }}</td>
          <td>¥{{ item.amount.toFixed(2) }}</td>
        </tr>
      </tbody>
      <tfoot>
        <tr>
          <td colspan="5" style="text-align: right"><strong>合计：</strong></td>
          <td><strong>¥{{ data.summary.totalAmount.toFixed(2) }}</strong></td>
        </tr>
      </tfoot>
    </table>

    <div class="print-inspections" v-if="data.inspections.length > 0">
      <h3>车辆检查</h3>
      <table class="print-table">
        <thead>
          <tr>
            <th>类别</th>
            <th>项目</th>
            <th>状况</th>
            <th>备注</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(insp, index) in data.inspections" :key="index">
            <td>{{ insp.category }}</td>
            <td>{{ insp.item }}</td>
            <td>{{ { good: '良好', fair: '一般', poor: '差', replace: '需更换' }[insp.condition] }}</td>
            <td>{{ insp.note || '-' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="print-footer">
      <div class="signature">
        <span>客户签字：________________</span>
        <span>服务顾问：________________</span>
      </div>
      <div class="shop-info">
        <p>{{ data.shop.name }} | {{ data.shop.phone }} | {{ data.shop.address }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import api from '../../utils/api';

const route = useRoute();
const data = ref<any>(null);

onMounted(async () => {
  data.value = await api.get(`/print/work-order/${route.params.id}`);
  setTimeout(() => window.print(), 500);
});
</script>

<style scoped>
.print-page {
  width: 210mm;
  margin: 0 auto;
  padding: 15mm;
  font-family: SimSun, serif;
  font-size: 12px;
  color: #000;
}
.print-header {
  text-align: center;
  margin-bottom: 10mm;
}
.print-header h1 {
  font-size: 18px;
  margin: 0;
}
.print-header h2 {
  font-size: 16px;
  margin: 5px 0 0;
}
.print-info {
  margin-bottom: 5mm;
}
.info-row {
  display: flex;
  justify-content: space-between;
  margin: 3px 0;
}
.print-table {
  width: 100%;
  border-collapse: collapse;
  margin: 5mm 0;
}
.print-table th,
.print-table td {
  border: 1px solid #000;
  padding: 4px 8px;
  text-align: left;
}
.print-table th {
  background: #f0f0f0;
}
.print-table tfoot td {
  font-weight: bold;
}
.print-inspections {
  margin-top: 5mm;
}
.print-inspections h3 {
  font-size: 14px;
  margin-bottom: 3mm;
}
.print-footer {
  margin-top: 15mm;
}
.signature {
  display: flex;
  justify-content: space-between;
}
.shop-info {
  text-align: center;
  margin-top: 10mm;
  font-size: 10px;
  color: #666;
}
@media print {
  .print-page {
    padding: 0;
  }
}
</style>
