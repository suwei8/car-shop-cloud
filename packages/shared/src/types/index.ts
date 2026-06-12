/** 通用分页请求 */
export interface PaginationQuery {
  page?: number;
  pageSize?: number;
}

/** 通用分页响应 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** 通用 API 响应 */
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}

/** JWT Payload */
export interface JwtPayload {
  sub: string;
  tenantId: string | null;
  shopId: string | null;
  isPlatform: boolean;
  roles: string[];
  permissions: string[];
  dataScope?: 'self' | 'shop' | 'all';
}

/** 金额：整数分 */
export type Cents = number;
