import { ForbiddenException } from '@nestjs/common';
import { JwtPayload } from '@car/shared';

/**
 * Assert that the user has a valid tenantId.
 * Use at the top of service methods that require tenant isolation.
 */
export function assertTenantUser(user: JwtPayload): asserts user is JwtPayload & { tenantId: string } {
  if (!user.tenantId) {
    throw new ForbiddenException('需要租户身份');
  }
}

/**
 * Build a where clause that ALWAYS includes the caller's tenantId.
 * If the provided `where` already contains a different tenantId, throws ForbiddenException.
 */
export function tenantWhere<T extends Record<string, any>>(
  user: JwtPayload,
  where?: T,
): T & { tenantId: string } {
  assertTenantUser(user);

  if (where && 'tenantId' in where && where.tenantId !== user.tenantId) {
    throw new ForbiddenException('租户 ID 不匹配');
  }

  return { ...where, tenantId: user.tenantId } as T & { tenantId: string };
}

/**
 * Build create data that ALWAYS includes the caller's tenantId.
 * If the provided `data` already contains a different tenantId, throws ForbiddenException.
 * Client-supplied tenantId that matches is silently overwritten with JWT value.
 */
export function tenantCreate<T extends Record<string, any>>(
  user: JwtPayload,
  data?: T,
): T & { tenantId: string } {
  assertTenantUser(user);

  if (data && 'tenantId' in data && data.tenantId !== user.tenantId) {
    throw new ForbiddenException('租户 ID 不匹配');
  }

  return { ...data, tenantId: user.tenantId } as T & { tenantId: string };
}

/**
 * Assert that a tenantId extracted from data matches the caller's tenantId.
 * Useful when operating on records fetched from the database.
 */
export function assertSameTenantId(
  user: JwtPayload,
  tenantIdFromData: string,
  context?: string,
): void {
  assertTenantUser(user);

  if (tenantIdFromData !== user.tenantId) {
    throw new ForbiddenException(
      context ? `${context}: 租户 ID 不匹配` : '租户 ID 不匹配',
    );
  }
}
