import { BadRequestException } from '@nestjs/common';
import { RegistrationService } from './registration.service';

describe('RegistrationService', () => {
  let service: RegistrationService;
  let mockPrisma: any;
  let mockJwtService: any;
  let mockConfig: any;
  let mockSmsCodeService: any;
  let mockInitializer: any;
  let mockNotificationService: any;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      tenant: {
        create: jest.fn(),
      },
      tenantSubscription: {
        create: jest.fn(),
      },
      subscriptionPlan: {
        findUnique: jest.fn(),
      },
      refreshToken: {
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    mockJwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
    };

    mockConfig = {
      get: (key: string, defaultVal?: string) => {
        if (key === 'TRIAL_DAYS') return '14';
        if (key === 'JWT_ACCESS_TOKEN_TTL') return '15m';
        if (key === 'JWT_REFRESH_TOKEN_TTL') return '7d';
        return defaultVal;
      },
    };

    mockSmsCodeService = {
      verifyCode: jest.fn(),
      checkRegisterLimit: jest.fn(),
    };

    mockInitializer = {
      initialize: jest.fn().mockResolvedValue({
        tenantId: 'tenant-1',
        shopId: 'shop-1',
        warehouseId: 'wh-1',
        userId: 'user-1',
        adminPassword: '',
        roleCount: 5,
        serviceItemCount: 29,
        dictionaryCount: 21,
      }),
    };

    mockNotificationService = {
      send: jest.fn().mockResolvedValue({ id: 'notif-1', status: 'sent' }),
    };

    service = new RegistrationService(
      mockPrisma,
      mockJwtService,
      mockConfig,
      mockSmsCodeService,
      mockInitializer,
      mockNotificationService,
    );
  });

  describe('register', () => {
    it('should throw if phone already registered', async () => {
      mockSmsCodeService.verifyCode.mockResolvedValue(true);
      mockSmsCodeService.checkRegisterLimit.mockResolvedValue(undefined);
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'existing-user' });

      await expect(
        service.register({
          shopName: '测试店',
          phone: '13800000000',
          code: '123456',
          password: 'Abc12345',
          ip: '127.0.0.1',
        }),
      ).rejects.toThrow('该手机号已注册');
    });

    it('should successfully register a new tenant', async () => {
      mockSmsCodeService.verifyCode.mockResolvedValue(true);
      mockSmsCodeService.checkRegisterLimit.mockResolvedValue(undefined);
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue({ id: 'plan-trial' });

      // Mock $transaction to execute the callback
      const trialEndAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          tenant: { create: jest.fn().mockResolvedValue({ id: 'new-tenant', name: '测试店', subscriptionEndAt: trialEndAt }) },
          tenantSubscription: { create: jest.fn() },
          subscriptionPlan: { findUnique: jest.fn().mockResolvedValue({ id: 'plan-trial' }) },
        };
        return fn(tx);
      });

      // After initialization, find the user
      mockPrisma.user.findFirst.mockResolvedValueOnce(null); // initial check
      mockPrisma.user.findFirst.mockResolvedValueOnce({
        id: 'admin-user',
        phone: '13800000000',
        name: '管理员',
        tenantId: 'new-tenant',
        isPlatform: false,
        status: 'active',
        employee: null,
        userRoles: [{
          role: {
            code: 'tenant_admin',
            rolePermissions: [{ permission: { code: 'tenant:shop:view' } }],
          },
        }],
      });

      const result = await service.register({
        shopName: '测试店',
        phone: '13800000000',
        code: '123456',
        password: 'Abc12345',
        ip: '127.0.0.1',
      });

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.subscription.status).toBe('trial');
      expect(result.subscription.daysRemaining).toBe(14);
    });

    it('should check register limit', async () => {
      mockSmsCodeService.checkRegisterLimit.mockRejectedValue(
        new BadRequestException('该IP今日注册次数已达上限'),
      );

      await expect(
        service.register({
          shopName: '测试店',
          phone: '13800000000',
          code: '123456',
          password: 'Abc12345',
          ip: '127.0.0.1',
        }),
      ).rejects.toThrow('该IP今日注册次数已达上限');
    });
  });
});
