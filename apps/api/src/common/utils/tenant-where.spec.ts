import { ForbiddenException } from '@nestjs/common';
import { JwtPayload } from '@car/shared';
import { tenantWhere, tenantCreate, assertTenantUser, assertSameTenantId } from './tenant-where';

describe('tenant-where helpers', () => {
  const tenantUser: JwtPayload = {
    sub: 'user-1',
    tenantId: 'tenant-1',
    shopId: 'shop-1',
    isPlatform: false,
    roles: ['tenant_admin'],
    permissions: [],
  };

  const platformUser: JwtPayload = {
    sub: 'admin-1',
    tenantId: null,
    shopId: null,
    isPlatform: true,
    roles: ['platform_admin'],
    permissions: [],
  };

  describe('assertTenantUser', () => {
    it('does not throw for tenant user', () => {
      expect(() => assertTenantUser(tenantUser)).not.toThrow();
    });

    it('throws ForbiddenException for platform user (tenantId is null)', () => {
      expect(() => assertTenantUser(platformUser)).toThrow(ForbiddenException);
    });
  });

  describe('tenantWhere', () => {
    it('merges where with tenantId from JWT', () => {
      const result = tenantWhere(tenantUser, { status: 'active' });
      expect(result).toEqual({ status: 'active', tenantId: 'tenant-1' });
    });

    it('returns only tenantId when where is undefined', () => {
      const result = tenantWhere(tenantUser);
      expect(result).toEqual({ tenantId: 'tenant-1' });
    });

    it('allows client where that already contains matching tenantId', () => {
      const result = tenantWhere(tenantUser, { tenantId: 'tenant-1', status: 'active' });
      expect(result).toEqual({ status: 'active', tenantId: 'tenant-1' });
    });

    it('throws ForbiddenException when client where contains different tenantId', () => {
      expect(() =>
        tenantWhere(tenantUser, { tenantId: 'tenant-evil', status: 'active' }),
      ).toThrow(ForbiddenException);
    });

    it('throws ForbiddenException for platform user without tenantId', () => {
      expect(() => tenantWhere(platformUser, { status: 'active' })).toThrow(
        ForbiddenException,
      );
    });
  });

  describe('tenantCreate', () => {
    it('merges create data with tenantId from JWT', () => {
      const result = tenantCreate(tenantUser, { name: 'test', status: 'active' });
      expect(result).toEqual({ name: 'test', status: 'active', tenantId: 'tenant-1' });
    });

    it('returns only tenantId when data is undefined', () => {
      const result = tenantCreate(tenantUser);
      expect(result).toEqual({ tenantId: 'tenant-1' });
    });

    it('overwrites client tenantId that matches JWT value', () => {
      const result = tenantCreate(tenantUser, { tenantId: 'tenant-1', name: 'test' });
      expect(result).toEqual({ name: 'test', tenantId: 'tenant-1' });
    });

    it('throws ForbiddenException when client data contains different tenantId', () => {
      expect(() =>
        tenantCreate(tenantUser, { tenantId: 'tenant-evil', name: 'test' }),
      ).toThrow(ForbiddenException);
    });

    it('throws ForbiddenException for platform user without tenantId', () => {
      expect(() => tenantCreate(platformUser, { name: 'test' })).toThrow(
        ForbiddenException,
      );
    });
  });

  describe('assertSameTenantId', () => {
    it('does not throw when tenantIds match', () => {
      expect(() => assertSameTenantId(tenantUser, 'tenant-1')).not.toThrow();
    });

    it('throws ForbiddenException when tenantIds differ', () => {
      expect(() => assertSameTenantId(tenantUser, 'tenant-evil')).toThrow(
        ForbiddenException,
      );
    });

    it('includes context in error message', () => {
      expect(() => assertSameTenantId(tenantUser, 'tenant-evil', '工单')).toThrow(
        expect.objectContaining({ message: '工单: 租户 ID 不匹配' }),
      );
    });

    it('throws for platform user without tenantId', () => {
      expect(() => assertSameTenantId(platformUser, 'tenant-1')).toThrow(
        ForbiddenException,
      );
    });
  });
});
