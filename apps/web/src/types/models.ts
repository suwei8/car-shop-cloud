export interface Tenant {
  id: string;
  name: string;
  contactName?: string;
  contactPhone?: string;
  status: string;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  phone: string;
  isPlatform: boolean;
  tenantId: string | null;
  shopId: string | null;
  roles: string[];
  permissions: string[];
}

export interface Shop {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  status: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  gender?: string;
  email?: string;
  address?: string;
  remark?: string;
  status: string;
  createdAt: string;
}

export interface Vehicle {
  id: string;
  customerId: string;
  plateNo: string;
  brand?: string;
  model?: string;
  vin?: string;
  engineNo?: string;
  color?: string;
  mileage?: number;
  firstRegDate?: string;
  remark?: string;
  status: string;
}

export interface WorkOrder {
  id: string;
  orderNo: string;
  orderType: string;
  status: string;
  totalAmount: number;
  discountAmount: number;
  payableAmount: number;
  vehiclePlateNo: string;
  vehicleMileage?: number;
  description?: string;
  expectDate?: string;
  remark?: string;
  customer?: Pick<Customer, 'id' | 'name' | 'phone'>;
  vehicle?: Pick<Vehicle, 'id' | 'plateNo' | 'brand' | 'model'>;
  items?: WorkOrderItem[];
  createdAt: string;
}

export interface WorkOrderItem {
  id: string;
  itemType: 'service' | 'part' | 'addon';
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  amount: number;
  technicianId?: string;
  remark?: string;
}

export interface ServiceItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  unitPrice: number;
  description?: string;
  status: string;
}

export interface DispatchTask {
  id: string;
  workOrderId: string;
  technicianId: string;
  status: string;
  startAt?: string;
  endAt?: string;
  workPlace?: string;
  team?: string;
  workOrder?: Pick<WorkOrder, 'id' | 'orderNo' | 'orderType' | 'vehiclePlateNo' | 'status'>;
  createdAt: string;
}

export interface Settlement {
  id: string;
  settleNo: string;
  workOrderId: string;
  shopId: string;
  totalAmount: number;
  discountAmount: number;
  payableAmount: number;
  paidAmount: number;
  debtAmount: number;
  status: string;
  payments: Payment[];
  createdAt: string;
}

export interface Payment {
  id: string;
  payMethod: string;
  amount: number;
  referenceNo?: string;
  remark?: string;
}

export interface StoredValueCard {
  id: string;
  cardNo: string;
  customerId: string;
  balance: number;
  principalBalance: number;
  giftBalance: number;
  status: string;
  remark?: string;
  createdAt: string;
}

export interface PackageCard {
  id: string;
  cardNo: string;
  customerId: string;
  vehicleId?: string;
  shopIds?: string;
  name: string;
  startAt: string;
  endAt: string;
  status: string;
  items?: PackageCardItem[];
  createdAt: string;
}

export interface PackageCardItem {
  id: string;
  serviceItemId: string;
  totalQty: number;
  remainQty: number;
}

export interface Part {
  id: string;
  code: string;
  name: string;
  category?: string;
  brand?: string;
  unit: string;
  costPrice: number;
  salePrice: number;
  minStock: number;
  status: string;
}

export interface StockBalance {
  id: string;
  warehouseId: string;
  partId: string;
  quantity: number;
  part?: Pick<Part, 'id' | 'code' | 'name' | 'unit' | 'minStock'>;
  warehouse?: Pick<import('./models').Warehouse, 'id' | 'name'>;
}

export interface Warehouse {
  id: string;
  name: string;
  shopId: string;
  isDefault: boolean;
  status: string;
}

export interface Appointment {
  id: string;
  shopId: string;
  customerId: string;
  vehicleId?: string;
  serviceType: string;
  appointTime: string;
  description?: string;
  status: string;
  remark?: string;
  customer?: Pick<Customer, 'id' | 'name' | 'phone'>;
  vehicle?: Pick<Vehicle, 'id' | 'plateNo'>;
  createdAt: string;
}

export interface DashboardOverview {
  todayOrders: number;
  todayRevenue: number;
  inProgressOrders: number;
  todayAppointments: number;
  pendingDispatch: number;
  lowStockCount: number;
  pendingReminders: number;
}

export interface Reminder {
  id: string;
  tenantId: string;
  shopId: string | null;
  type: string;
  customerId: string;
  vehicleId: string | null;
  relatedId: string | null;
  content: string;
  dueDate: string;
  status: string;
  handledBy: string | null;
  handledAt: string | null;
  remark: string | null;
  createdAt: string;
  customer?: { id: string; name: string; phone: string };
  vehiclePlateNo?: string | null;
}
