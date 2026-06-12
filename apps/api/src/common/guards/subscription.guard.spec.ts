import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SubscriptionGuard } from './subscription.guard';

const mockPrisma = {
  tenant: {
    findUnique: jest.fn(),
  },
};

const mockReflector = {
  getAllAndOverride: jest.fn(),
};

function createGuard(status?: string) {
  mockReflector.getAllAndOverride.mockImplementation((key: string) => {
    if (key === 'isPublic') return false;
    return undefined;
  });
  mockPrisma.tenant.findUnique.mockResolvedValue(
    status ? { subscriptionStatus: status } : null,
  );
  return new SubscriptionGuard(mockReflector as any, mockPrisma as any);
}

function createContext(method = 'POST') {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        method,
        user: { sub: 'user-1', tenantId: 'tenant-1', isPlatform: false },
      }),
    }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as unknown as ExecutionContext;
}

describe('SubscriptionGuard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should pass for public endpoints', async () => {
    mockReflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === 'isPublic') return true;
      return undefined;
    });
    const guard = new SubscriptionGuard(mockReflector as any, mockPrisma as any);
    const result = await guard.canActivate(createContext());
    expect(result).toBe(true);
  });

  it('should pass for platform users', async () => {
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'POST',
          user: { sub: 'admin', isPlatform: true },
        }),
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as unknown as ExecutionContext;
    mockReflector.getAllAndOverride.mockReturnValue(false);
    const guard = new SubscriptionGuard(mockReflector as any, mockPrisma as any);
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('should pass for trial tenants', async () => {
    const guard = createGuard('trial');
    const result = await guard.canActivate(createContext('POST'));
    expect(result).toBe(true);
  });

  it('should pass for active tenants', async () => {
    const guard = createGuard('active');
    const result = await guard.canActivate(createContext('POST'));
    expect(result).toBe(true);
  });

  it('should pass for grace tenants', async () => {
    const guard = createGuard('grace');
    const result = await guard.canActivate(createContext('POST'));
    expect(result).toBe(true);
  });

  it('should block POST for suspended tenants', async () => {
    const guard = createGuard('suspended');
    await expect(guard.canActivate(createContext('POST'))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('should block PUT for suspended tenants', async () => {
    const guard = createGuard('suspended');
    await expect(guard.canActivate(createContext('PUT'))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('should block DELETE for suspended tenants', async () => {
    const guard = createGuard('suspended');
    await expect(guard.canActivate(createContext('DELETE'))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('should pass GET for suspended tenants (read-only mode)', async () => {
    const guard = createGuard('suspended');
    const result = await guard.canActivate(createContext('GET'));
    expect(result).toBe(true);
  });
});
