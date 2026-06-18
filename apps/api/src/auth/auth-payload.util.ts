import { JwtPayload } from '@car/shared';

const ALL_SCOPE_ROLES = ['tenant_admin', 'shop_manager'];

interface RolePermissionLike {
  permission: { code: string };
}

interface UserRoleLike {
  role: {
    code: string;
    rolePermissions: RolePermissionLike[];
  };
}

interface AuthPayloadUserLike {
  id: string;
  tenantId: string | null;
  isPlatform: boolean;
  employee?: { shopId?: string | null } | null;
  userRoles: UserRoleLike[];
}

export function inferDataScope(roles: string[]): 'self' | 'shop' | 'all' {
  if (roles.some((role) => ALL_SCOPE_ROLES.includes(role))) {
    return 'all';
  }
  return 'shop';
}

export function extractAuthClaims(userRoles: UserRoleLike[]): Pick<JwtPayload, 'roles' | 'permissions'> {
  const roles = userRoles.map((userRole) => userRole.role.code);
  const permissions = userRoles.flatMap((userRole) =>
    userRole.role.rolePermissions.map((rolePermission) => rolePermission.permission.code),
  );

  return {
    roles: [...new Set<string>(roles)],
    permissions: [...new Set<string>(permissions)],
  };
}

export function buildEmployeeJwtPayload(
  user: AuthPayloadUserLike,
  dataScopeOverride?: 'self' | 'shop' | 'all',
): JwtPayload {
  const claims = extractAuthClaims(user.userRoles);

  return {
    sub: user.id,
    tenantId: user.tenantId,
    shopId: user.employee?.shopId || null,
    isPlatform: user.isPlatform,
    roles: claims.roles,
    permissions: claims.permissions,
    dataScope: user.isPlatform ? undefined : dataScopeOverride || inferDataScope(claims.roles),
    audience: 'employee',
  };
}
