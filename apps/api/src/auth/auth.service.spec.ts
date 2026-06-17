import { UnauthorizedException, ConflictException, ForbiddenException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let mockPrisma: any;
  let mockJwtService: any;
  let mockConfig: any;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      tenant: {
        findUnique: jest.fn(),
      },
      refreshToken: {
        create: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    mockJwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
    };

    mockConfig = {
      get: (key: string, defaultVal?: string) => {
        if (key === 'JWT_ACCESS_TOKEN_TTL') return '15m';
        if (key === 'JWT_REFRESH_TOKEN_TTL') return '7d';
        return defaultVal;
      },
    };

    service = new AuthService(mockPrisma, mockJwtService, mockConfig);
  });

  const activeUser = {
    id: 'user-1',
    phone: '13800000000',
    name: '管理员',
    status: 'active',
    tenantId: 'tenant-1',
    isPlatform: false,
    passwordHash: '$2b$10$abcdefghijklmnopqrstuuABCD12345678901234567890ab',
    employee: { shopId: 'shop-1' },
    userRoles: [{
      role: {
        code: 'tenant_admin',
        rolePermissions: [{ permission: { code: 'tenant:shop:view' } }],
      },
    }],
  };

  describe('login', () => {
    it('should return 401 when no user matches phone', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      await expect(
        service.login('13800000000', 'Test123456'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return 409 Conflict when multiple active users match phone', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        { ...activeUser, id: 'user-1', tenantId: 'tenant-1' },
        { ...activeUser, id: 'user-2', tenantId: 'tenant-2' },
      ]);

      await expect(
        service.login('13800000000', 'Test123456'),
      ).rejects.toThrow(ConflictException);
    });

    it('should return 409 when platform account and tenant account share phone', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        { ...activeUser, id: 'user-1', tenantId: 'tenant-1', isPlatform: false },
        { ...activeUser, id: 'user-admin', tenantId: null, isPlatform: true },
      ]);

      await expect(
        service.login('13800000000', 'Test123456'),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw UnauthorizedException on invalid password', async () => {
      mockPrisma.user.findMany.mockResolvedValue([activeUser]);

      await expect(
        service.login('13800000000', 'wrongpassword'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw ForbiddenException when tenant is not active', async () => {
      const bcrypt = require('bcrypt');
      const hash = await bcrypt.hash('Test123456', 10);
      const userWithHash = { ...activeUser, passwordHash: hash };
      mockPrisma.user.findMany.mockResolvedValue([userWithHash]);
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-1', status: 'suspended' });

      await expect(
        service.login('13800000000', 'Test123456'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should successfully login with valid credentials and single user', async () => {
      const bcrypt = require('bcrypt');
      const hash = await bcrypt.hash('Test123456', 10);
      const userWithHash = { ...activeUser, passwordHash: hash };
      mockPrisma.user.findMany.mockResolvedValue([userWithHash]);
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        status: 'active',
        subscriptionStatus: 'trial',
        subscriptionEndAt: new Date(Date.now() + 30 * 86400000),
      });
      mockPrisma.user.update.mockResolvedValue({});

      const result = await service.login('13800000000', 'Test123456');

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user.phone).toBe('13800000000');
    });

    it('should not call token generation when multiple users match', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        { ...activeUser, id: 'user-1', tenantId: 'tenant-1' },
        { ...activeUser, id: 'user-2', tenantId: 'tenant-2' },
      ]);

      await service.login('13800000000', 'Test123456').catch(() => {});

      expect(mockJwtService.sign).not.toHaveBeenCalled();
      expect(mockPrisma.refreshToken.create).not.toHaveBeenCalled();
    });
  });
});
