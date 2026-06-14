import { apiGet } from '../utils/api';

export interface AnalyticsQueryParams {
  startDate?: string;
  endDate?: string;
  dimension?: 'day' | 'week' | 'month';
  shopId?: string;
}

export interface RevenueTrendData {
  dimension: string;
  startDate: string;
  endDate: string;
  data: { period: string; totalRevenue: string; orderCount: number }[];
}

export interface WorkOrderStatsData {
  statusDistribution: { status: string; count: number }[];
  typeDistribution: { type: string; count: number }[];
  completionRateTrend: { period: string; total: number; completed: number; rate: number }[];
}

export interface TechnicianRankingData {
  data: {
    technicianId: string;
    technicianName: string;
    orderCount: number;
    completedCount: number;
    totalRevenue: string;
  }[];
}

export interface CustomerAnalysisData {
  newCustomers: number;
  returningCustomers: number;
  growthTrend: { period: string; newCount: number }[];
  sourceDistribution: { source: string; count: number }[];
}

export interface PartsConsumptionData {
  data: {
    partId: string;
    partName: string;
    partCode: string;
    totalQuantity: string;
    totalAmount: string;
  }[];
}

export function getRevenueTrend(params: AnalyticsQueryParams): Promise<RevenueTrendData> {
  return apiGet('/analytics/revenue', params as Record<string, unknown>);
}

export function getWorkOrderStats(params: AnalyticsQueryParams): Promise<WorkOrderStatsData> {
  return apiGet('/analytics/work-orders', params as Record<string, unknown>);
}

export function getTechnicianRanking(params: AnalyticsQueryParams): Promise<TechnicianRankingData> {
  return apiGet('/analytics/technicians', params as Record<string, unknown>);
}

export function getCustomerAnalysis(params: AnalyticsQueryParams): Promise<CustomerAnalysisData> {
  return apiGet('/analytics/customers', params as Record<string, unknown>);
}

export function getPartsConsumption(params: AnalyticsQueryParams): Promise<PartsConsumptionData> {
  return apiGet('/analytics/parts', params as Record<string, unknown>);
}
