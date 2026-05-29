"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AUDIT_ACTIONS = exports.BUILT_IN_ROLES = exports.TENANT_ADMIN_ROLE = exports.PLATFORM_ADMIN_ROLE = exports.MAX_PAGE_SIZE = exports.DEFAULT_PAGE_SIZE = exports.TENANT_PERMISSION_PREFIX = exports.PLATFORM_PERMISSION_PREFIX = void 0;
exports.PLATFORM_PERMISSION_PREFIX = 'platform:';
exports.TENANT_PERMISSION_PREFIX = 'tenant:';
exports.DEFAULT_PAGE_SIZE = 20;
exports.MAX_PAGE_SIZE = 100;
exports.PLATFORM_ADMIN_ROLE = 'platform_admin';
exports.TENANT_ADMIN_ROLE = 'tenant_admin';
exports.BUILT_IN_ROLES = {
    PLATFORM_ADMIN: 'platform_admin',
    TENANT_ADMIN: 'tenant_admin',
    SHOP_MANAGER: 'shop_manager',
    SERVICE_ADVISOR: 'service_advisor',
    TECHNICIAN: 'technician',
    CASHIER: 'cashier',
};
exports.AUDIT_ACTIONS = {
    CREATE: 'create',
    UPDATE: 'update',
    DELETE: 'delete',
    LOGIN: 'login',
    LOGOUT: 'logout',
};
//# sourceMappingURL=index.js.map