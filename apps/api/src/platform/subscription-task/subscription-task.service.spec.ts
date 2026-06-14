import { SubscriptionTaskService } from './subscription-task.service';

const mockPrisma = {
  tenant: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
  tenantSubscription: {
    update: jest.fn(),
  },
};

const mockAuditService = {
  log: jest.fn(),
};

const mockSubscriptionGuard = {
  invalidateCache: jest.fn(),
};

const mockConfig = {
  get: jest.fn((key: string, defaultValue: string) => defaultValue),
};

describe('SubscriptionTaskService', () => {
  let service: SubscriptionTaskService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SubscriptionTaskService(
      mockPrisma as any,
      mockAuditService as any,
      mockSubscriptionGuard as any,
      mockConfig as any,
    );
  });

  function makeTenant(id: string, subStatus: string, subEndAt: Date, tenantStatus = 'active') {
    return {
      id,
      name: `Tenant ${id}`,
      subscriptionStatus: tenantStatus === 'trial' ? 'trial' : subStatus,
      subscriptions: [{ id: `sub-${id}`, status: subStatus, endAt: subEndAt }],
    };
  }

  it('should keep active status when subscription not expired', async () => {
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    mockPrisma.tenant.findMany.mockResolvedValue([
      makeTenant('t1', 'active', futureDate),
    ]);

    const result = await service.manualRun();
    expect(result.updated).toBe(0);
    expect(mockPrisma.tenant.update).not.toHaveBeenCalled();
  });

  it('should transition to grace when within grace period', async () => {
    const recentlyExpired = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    mockPrisma.tenant.findMany.mockResolvedValue([
      makeTenant('t2', 'active', recentlyExpired),
    ]);

    const result = await service.manualRun();
    expect(result.updated).toBe(1);
    expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
      where: { id: 't2' },
      data: expect.objectContaining({ subscriptionStatus: 'grace' }),
    });
  });

  it('should transition to suspended when grace period exceeded', async () => {
    const longExpired = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    mockPrisma.tenant.findMany.mockResolvedValue([
      makeTenant('t3', 'active', longExpired),
    ]);

    const result = await service.manualRun();
    expect(result.updated).toBe(1);
    expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
      where: { id: 't3' },
      data: expect.objectContaining({ subscriptionStatus: 'suspended' }),
    });
    expect(mockPrisma.tenantSubscription.update).toHaveBeenCalledWith({
      where: { id: expect.any(String) },
      data: { status: 'expired' },
    });
  });

  it('should handle cancelled subscription as suspended', async () => {
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    mockPrisma.tenant.findMany.mockResolvedValue([
      makeTenant('t4', 'cancelled', futureDate),
    ]);

    const result = await service.manualRun();
    expect(result.updated).toBe(1);
    expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
      where: { id: 't4' },
      data: expect.objectContaining({ subscriptionStatus: 'suspended' }),
    });
  });

  it('should not update tenants with no subscriptions', async () => {
    mockPrisma.tenant.findMany.mockResolvedValue([
      { id: 't5', name: 'NoSub', subscriptionStatus: 'trial', subscriptions: [] },
    ]);

    const result = await service.manualRun();
    expect(result.updated).toBe(0);
    expect(mockPrisma.tenant.update).not.toHaveBeenCalled();
  });

  it('should write audit log on status change', async () => {
    const longExpired = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    mockPrisma.tenant.findMany.mockResolvedValue([
      makeTenant('t6', 'active', longExpired),
    ]);

    await service.manualRun();
    expect(mockAuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'subscription_status_change',
        targetType: 'tenant',
        targetId: 't6',
        changes: expect.objectContaining({ from: 'active', to: 'suspended' }),
      }),
    );
  });

  it('should invalidate SubscriptionGuard cache after status change', async () => {
    const longExpired = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    mockPrisma.tenant.findMany.mockResolvedValue([
      makeTenant('t7', 'active', longExpired),
    ]);

    await service.manualRun();
    expect(mockSubscriptionGuard.invalidateCache).toHaveBeenCalledWith('t7');
  });
});
