/**
 * 预置字典数据
 * type + code + name 唯一
 */
export const DICTIONARIES = [
  // 业务类型
  { type: 'business_type', code: 'repair', name: '维修', sort: 1 },
  { type: 'business_type', code: 'maintenance', name: '保养', sort: 2 },
  { type: 'business_type', code: 'wash', name: '洗美', sort: 3 },
  { type: 'business_type', code: 'tire', name: '轮胎', sort: 4 },
  { type: 'business_type', code: 'other', name: '其他', sort: 5 },
  // 支付方式
  { type: 'payment_method', code: 'cash', name: '现金', sort: 1 },
  { type: 'payment_method', code: 'wechat', name: '微信支付', sort: 2 },
  { type: 'payment_method', code: 'alipay', name: '支付宝', sort: 3 },
  { type: 'payment_method', code: 'card', name: '银行卡', sort: 4 },
  { type: 'payment_method', code: 'stored_value', name: '储值卡', sort: 5 },
  { type: 'payment_method', code: 'package_card', name: '套餐卡', sort: 6 },
  // 车辆颜色
  { type: 'car_color', code: 'white', name: '白色', sort: 1 },
  { type: 'car_color', code: 'black', name: '黑色', sort: 2 },
  { type: 'car_color', code: 'silver', name: '银色', sort: 3 },
  { type: 'car_color', code: 'gray', name: '灰色', sort: 4 },
  { type: 'car_color', code: 'red', name: '红色', sort: 5 },
  { type: 'car_color', code: 'blue', name: '蓝色', sort: 6 },
  { type: 'car_color', code: 'other', name: '其他', sort: 7 },
  // 工单类型
  { type: 'order_type', code: 'repair', name: '维修', sort: 1 },
  { type: 'order_type', code: 'wash', name: '洗车', sort: 2 },
  { type: 'order_type', code: 'quick', name: '快修', sort: 3 },
] as const;

export type DictionaryData = (typeof DICTIONARIES)[number];
