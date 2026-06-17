import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserService } from './user.service';

describe('UserService', () => {
  let service: UserService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      employee: {
        create: jest.fn(),
        update: jest.fn(),
      },
      userRole: {
        create: jest.fn(),
        deleteMany: jest.fn(),
      },
      tenant: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    service = new UserService(mockPrisma);
  });

  const jwtPayload = {
    sub: 'admin-1',
    tenantId: 'tenant-1',
    shopId: 'shop-1',
    isPlatform: false,
    roles: ['tenant_admin'],
    permissions: [],
    dataScope: 'all' as const,
  };

  describe('create', () => {
    it('should throw ConflictException when phone exists globally in another tenant', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'existing-user', phone: '13800000000', tenantId: 'tenant-2' });

      await expect(
        service.create({
          name: '新员工',
          phone: '13800000000',
          password: 'Test123456',
          shopId: 'shop-1',
          roleIds: ['role-1'],
        }, jwtPayload),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when phone exists in same tenant', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'existing-user', phone: '13800000000', tenantId: 'tenant-1' });

      await expect(
        service.create({
          name: '新员工',
          phone: '13800000000',
          password: 'Test123456',
          shopId: 'shop-1',
          roleIds: ['role-1'],
        }, jwtPayload),
      ).rejects.toThrow(ConflictException);
    });

    it('should create user when phone is globally unique', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        subscriptions: [{ plan: { maxEmployees: 10 } }],
      });
      mockPrisma.user.count.mockResolvedValue(3);

      const newUser = { id: 'new-user', phone: '13900000000' };
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          user: { create: jest.fn().mockResolvedValue(newUser) },
          employee: { create: jest.fn().mockResolvedValue({}) },
          userRole: { create: jest.fn().mockResolvedValue({}) },
        };
        return fn(tx);
      });

      const result = await service.create({
        name: '新员工',
        phone: '13900000000',
        password: 'Test123456',
        shopId: 'shop-1',
        roleIds: ['role-1'],
      }, jwtPayload);

      expect(result.id).toBe('new-user');
    });
  });

  describe('update', () => {
    const existingUser = {
      id: 'user-1',
      phone: '13800000000',
      name: '员工',
      status: 'active',
      employee: { shopId: 'shop-1' },
      userRoles: [{ role: { id: 'role-1', name: '店员', code: 'shop_staff' } }],
    };

    it('should throw ConflictException when new phone exists globally', async () => {
      mockPrisma.user.findFirst
        .mockResolvedValueOnce(existingUser)
        .mockResolvedValueOnce({ id: 'other-user', phone: '13900000000', tenantId: 'tenant-2' });

      await expect(
        service.update('user-1', { phone: '13900000000' }, jwtPayload),
      ).rejects.toThrow(ConflictException);
    });

    it('should not check phone when phone is unchanged', async () => {
      const finalUser = { ...existingUser, userRoles: [] };
      mockPrisma.user.findFirst
        .mockResolvedValueOnce(existingUser)
        .mockResolvedValueOnce(finalUser);
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          user: { update: jest.fn().mockResolvedValue({ id: 'user-1' }) },
          employee: { update: jest.fn() },
          userRole: { deleteMany: jest.fn(), create: jest.fn() },
        };
        return fn(tx);
      });

      await service.update('user-1', { name: '新名字' }, jwtPayload);

      expect(mockPrisma.user.findFirst).toHaveBeenCalledTimes(2);
    });

    it('should allow updating phone when new phone is globally unique', async () => {
      const finalUser = { ...existingUser, phone: '13900000000', userRoles: [] };
      mockPrisma.user.findFirst
        .mockResolvedValueOnce(existingUser)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(finalUser);
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          user: { update: jest.fn().mockResolvedValue({ id: 'user-1' }) },
          employee: { update: jest.fn() },
          userRole: { deleteMany: jest.fn(), create: jest.fn() },
        };
        return fn(tx);
      });

      const result = await service.update('user-1', { phone: '13900000000' }, jwtPayload);

      expect(result).toBeDefined();
    });

    it('should allow updating own user without conflict', async () => {
      const finalUser = { ...existingUser, userRoles: [] };
      mockPrisma.user.findFirst
        .mockResolvedValueOnce(existingUser)
        .mockResolvedValueOnce(finalUser);
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          user: { update: jest.fn().mockResolvedValue({ id: 'user-1' }) },
          employee: { update: jest.fn() },
          userRole: { deleteMany: jest.fn(), create: jest.fn() },
        };
        return fn(tx);
      });

      const result = await service.update('user-1', { phone: '13800000000' }, jwtPayload);

      expect(result).toBeDefined();
    });
  });
});
