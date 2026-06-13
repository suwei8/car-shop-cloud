export interface PaginationQuery {
    page?: number;
    pageSize?: number;
}
export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
}
export interface ApiResponse<T = unknown> {
    code: number;
    message: string;
    data: T;
}
export interface JwtPayload {
    sub: string;
    tenantId: string | null;
    shopId: string | null;
    isPlatform: boolean;
    roles: string[];
    permissions: string[];
    dataScope?: 'self' | 'shop' | 'all';
    audience?: 'employee' | 'customer';
    customerId?: string;
    impersonatedBy?: string;
}
export type Cents = number;
