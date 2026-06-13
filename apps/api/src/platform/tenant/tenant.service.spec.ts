import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PlatformTenantService } from './tenant.service';

const now = new Date();
const futureDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
const pastDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

const mockPrisma = {
  tenant: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
  subscriptionPlan: { findUnique: jest.fn() },
  tenantSubscription: { create: jest.fn() },
  user: { findFirst: jest.fn() },
  auditLog: { create: jest.fn() },
  $transaction: jest.fn(),
};

const mockAudit = { log: jest.fn() };
const mockJwt = { sign: jest.fn() };
const mockModuleRef = { get: jest.fn().mockReturnValue({ invalidateCache: jest.fn() }) };
const mockConfig = { get: jest.fn().mockReturnValue('test-secret') };
const mockInitializer = { initialize: jest.fn() };

function createService() {
  return new PlatformTenantService(
    mockPrisma as any,
    mockConfig as any,
    mockInitializer as any,
    mockAudit as any,
    mockJwt as any,
    mockModuleRef as any,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PlatformTenantService', () => {
  describe('renew', () => {
    it('should extend from current endAt when not expired', async () => {
      const service = createService();
      const currentEndAt = new Date('2027-06-13');

      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        subscriptionEndAt: currentEndAt,
      });
      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue({ id: 'plan-basic' });
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        return fn({
          tenantSubscription: { create: jest.fn().mockResolvedValue({ id: 'sub-1' }) },
          tenant: { update: jest.fn() },
        });
      });

      const result = await service.renew('tenant-1', 'plan-basic', 12, 'operator-1');

      const txCall = mockPrisma.$transaction.mock.calls[0][0];
      const mockTx = {
        tenantSubscription: { create: jest.fn().mockResolvedValue({ id: 'sub-1' }) },
        tenant: { update: jest.fn() },
      };
      await txCall(mockTx);

      const createCall = mockTx.tenantSubscription.create.mock.calls[0][0].data;
      expect(createCall.startAt.toISOString()).toContain('2027-06-13');
      expect(createCall.endAt > currentEndAt).toBe(true);
      expect(createCall.status).toBe('active');

      expect(mockAudit.log).toHaveBeenCalledWith(expect.objectContaining({
        action: 'renew',
        targetType: 'tenant',
        targetId: 'tenant-1',
      }));
    });

    it('should start from today when expired', async () => {
      const service = createService();
      const expiredEndAt = new Date('2025-01-01');

      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        subscriptionEndAt: expiredEndAt,
      });
      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue({ id: 'plan-basic' });
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        return fn({
          tenantSubscription: { create: jest.fn().mockResolvedValue({ id: 'sub-2' }) },
          tenant: { update: jest.fn() },
        });
      });

      await service.renew('tenant-1', 'plan-basic', 12, 'operator-1');

      const txCall = mockPrisma.$transaction.mock.calls[0][0];
      const mockTx = {
        tenantSubscription: { create: jest.fn().mockResolvedValue({ id: 'sub-2' }) },
        tenant: { update: jest.fn() },
      };
      await txCall(mockTx);

      const createCall = mockTx.tenantSubscription.create.mock.calls[0][0].data;
      const startYear = createCall.startAt.getFullYear();
      expect(startYear).toBe(new Date().getFullYear());
    });

    it('should throw NotFoundException for missing tenant', async () => {
      const service = createService();
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      await expect(service.renew('nonexistent', 'plan-basic', 12, 'op-1'))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('extend', () => {
    it('should add days to current endAt', async () => {
      const service = createService();
      const currentEndAt = new Date('2027-06-13');

      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        subscriptionEndAt: currentEndAt,
      });
      mockPrisma.tenant.update.mockResolvedValue({});

      const result = await service.extend('tenant-1', 30, '客户投诉补偿', 'operator-1');

      expect(mockPrisma.tenant.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'tenant-1' },
      }));

      const updateData = mockPrisma.tenant.update.mock.calls[0][0].data;
      expect(updateData.subscriptionEndAt > currentEndAt).toBe(true);

      expect(mockAudit.log).toHaveBeenCalledWith(expect.objectContaining({
        action: 'extend',
        changes: expect.objectContaining({ days: 30, reason: '客户投诉补偿' }),
      }));
    });
  });

  describe('suspend', () => {
    it('should set subscriptionStatus to suspended', async () => {
      const service = createService();
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-1' });
      mockPrisma.tenant.update.mockResolvedValue({});

      const result = await service.suspend('tenant-1', '违规操作', 'operator-1');

      expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant-1' },
        data: { subscriptionStatus: 'suspended' },
      });

      expect(mockAudit.log).toHaveBeenCalledWith(expect.objectContaining({
        action: 'suspend',
      }));
      expect(result).toEqual({ message: '已停用' });
    });
  });

  describe('resume', () => {
    it('should set active when subscription not expired', async () => {
      const service = createService();
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        subscriptionEndAt: futureDate,
      });
      mockPrisma.tenant.update.mockResolvedValue({});

      const result = await service.resume('tenant-1', 'operator-1');

      expect(result.subscriptionStatus).toBe('active');
      expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant-1' },
        data: { status: 'active', subscriptionStatus: 'active' },
      });
    });

    it('should keep suspended when subscription expired', async () => {
      const service = createService();
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        subscriptionEndAt: pastDate,
      });
      mockPrisma.tenant.update.mockResolvedValue({});

      const result = await service.resume('tenant-1', 'operator-1');

      expect(result.subscriptionStatus).toBe('suspended');
    });
  });

  describe('impersonate', () => {
    it('should generate JWT with impersonatedBy and 30m expiry', async () => {
      const service = createService();
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-1' });
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'admin-1',
        tenantId: 'tenant-1',
        isPlatform: false,
        name: '商户管理员',
        employee: null,
        userRoles: [
          {
            role: {
              code: 'tenant_admin',
              rolePermissions: [{ permission: { code: 'tenant:shop:view' } }],
            },
          },
        ],
      });
      mockJwt.sign.mockReturnValue('mock-jwt-token');

      const result = await service.impersonate('tenant-1', 'platform-admin-1');

      expect(mockJwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 'admin-1',
          tenantId: 'tenant-1',
          isPlatform: false,
          impersonatedBy: 'platform-admin-1',
        }),
        { expiresIn: '30m' },
      );

      expect(result).toEqual({ accessToken: 'mock-jwt-token', expiresIn: 1800 });

      expect(mockAudit.log).toHaveBeenCalledWith(expect.objectContaining({
        action: 'impersonate',
        targetType: 'tenant',
        targetId: 'tenant-1',
        userId: 'platform-admin-1',
      }));
    });

    it('should throw when no admin user exists', async () => {
      const service = createService();
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-1' });
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(service.impersonate('tenant-1', 'op-1'))
        .rejects.toThrow(BadRequestException);
    });
  });
});
