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
      featureFlag: {
        findUnique: jest.fn(),
      },
      tenantFeatureFlag: {
        upsert: jest.fn(),
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
        if (key === 'TRIAL_DAYS') return '30';
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
          businessType: 'repair',
          employeeCount: 3,
          ip: '127.0.0.1',
        }),
      ).rejects.toThrow('该手机号已注册');
    });

    it('should successfully register a new tenant with 30-day trial', async () => {
      mockSmsCodeService.verifyCode.mockResolvedValue(true);
      mockSmsCodeService.checkRegisterLimit.mockResolvedValue(undefined);
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue({ id: 'plan-trial' });
      mockPrisma.featureFlag.findUnique.mockResolvedValue({ id: 'flag-simple', code: 'simple_mode' });

      const trialEndAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          tenant: { create: jest.fn().mockResolvedValue({ id: 'new-tenant', name: '测试店', subscriptionEndAt: trialEndAt }) },
          tenantSubscription: { create: jest.fn() },
          subscriptionPlan: { findUnique: jest.fn().mockResolvedValue({ id: 'plan-trial' }) },
          featureFlag: { findUnique: jest.fn().mockResolvedValue({ id: 'flag-simple', code: 'simple_mode' }) },
          tenantFeatureFlag: { upsert: jest.fn() },
        };
        return fn(tx);
      });

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
        businessType: 'repair',
        employeeCount: 3,
        ip: '127.0.0.1',
      });

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.subscription.status).toBe('trial');
      expect(result.subscription.daysRemaining).toBe(30);
    });

    it('should register with optional password', async () => {
      mockSmsCodeService.verifyCode.mockResolvedValue(true);
      mockSmsCodeService.checkRegisterLimit.mockResolvedValue(undefined);
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue({ id: 'plan-trial' });
      mockPrisma.featureFlag.findUnique.mockResolvedValue(null);

      const trialEndAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          tenant: { create: jest.fn().mockResolvedValue({ id: 'new-tenant', name: '测试店', subscriptionEndAt: trialEndAt }) },
          tenantSubscription: { create: jest.fn() },
          subscriptionPlan: { findUnique: jest.fn().mockResolvedValue({ id: 'plan-trial' }) },
          featureFlag: { findUnique: jest.fn().mockResolvedValue(null) },
          tenantFeatureFlag: { upsert: jest.fn() },
        };
        return fn(tx);
      });

      mockPrisma.user.findFirst.mockResolvedValueOnce(null);
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
        businessType: 'wash_beauty',
        employeeCount: 2,
        ip: '127.0.0.1',
      });

      expect(result.accessToken).toBeDefined();
      expect(result.subscription.status).toBe('trial');
    });

    it('should enable simple_mode when employeeCount <= 5', async () => {
      mockSmsCodeService.verifyCode.mockResolvedValue(true);
      mockSmsCodeService.checkRegisterLimit.mockResolvedValue(undefined);
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue({ id: 'plan-trial' });
      mockPrisma.featureFlag.findUnique.mockResolvedValue({ id: 'flag-simple', code: 'simple_mode' });

      const txMocks = {
        tenant: { create: jest.fn().mockResolvedValue({ id: 'new-tenant', name: '测试店', subscriptionEndAt: new Date() }) },
        tenantSubscription: { create: jest.fn() },
        subscriptionPlan: { findUnique: jest.fn().mockResolvedValue({ id: 'plan-trial' }) },
        featureFlag: { findUnique: jest.fn().mockResolvedValue({ id: 'flag-simple', code: 'simple_mode' }) },
        tenantFeatureFlag: { upsert: jest.fn() },
      };
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(txMocks));

      mockPrisma.user.findFirst.mockResolvedValueOnce(null);
      mockPrisma.user.findFirst.mockResolvedValueOnce({
        id: 'admin-user', phone: '13800000000', name: '管理员',
        tenantId: 'new-tenant', isPlatform: false, status: 'active',
        employee: null,
        userRoles: [{ role: { code: 'tenant_admin', rolePermissions: [{ permission: { code: 'tenant:shop:view' } }] } }],
      });

      await service.register({
        shopName: '测试店', phone: '13800000000', code: '123456',
        password: 'Abc12345', businessType: 'repair', employeeCount: 5, ip: '127.0.0.1',
      });

      expect(txMocks.tenantFeatureFlag.upsert).toHaveBeenCalledWith({
        where: { tenantId_featureFlagId: { tenantId: 'new-tenant', featureFlagId: 'flag-simple' } },
        update: { enabled: true },
        create: { tenantId: 'new-tenant', featureFlagId: 'flag-simple', enabled: true },
      });
    });

    it('should not enable simple_mode when employeeCount > 5', async () => {
      mockSmsCodeService.verifyCode.mockResolvedValue(true);
      mockSmsCodeService.checkRegisterLimit.mockResolvedValue(undefined);
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue({ id: 'plan-trial' });
      mockPrisma.featureFlag.findUnique.mockResolvedValue({ id: 'flag-simple', code: 'simple_mode' });

      const txMocks = {
        tenant: { create: jest.fn().mockResolvedValue({ id: 'new-tenant', name: '测试店', subscriptionEndAt: new Date() }) },
        tenantSubscription: { create: jest.fn() },
        subscriptionPlan: { findUnique: jest.fn().mockResolvedValue({ id: 'plan-trial' }) },
        featureFlag: { findUnique: jest.fn().mockResolvedValue({ id: 'flag-simple', code: 'simple_mode' }) },
        tenantFeatureFlag: { upsert: jest.fn() },
      };
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(txMocks));

      mockPrisma.user.findFirst.mockResolvedValueOnce(null);
      mockPrisma.user.findFirst.mockResolvedValueOnce({
        id: 'admin-user', phone: '13800000000', name: '管理员',
        tenantId: 'new-tenant', isPlatform: false, status: 'active',
        employee: null,
        userRoles: [{ role: { code: 'tenant_admin', rolePermissions: [{ permission: { code: 'tenant:shop:view' } }] } }],
      });

      await service.register({
        shopName: '测试店', phone: '13800000000', code: '123456',
        password: 'Abc12345', businessType: 'composite', employeeCount: 10, ip: '127.0.0.1',
      });

      expect(txMocks.tenantFeatureFlag.upsert).not.toHaveBeenCalled();
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
          businessType: 'repair',
          employeeCount: 3,
          ip: '127.0.0.1',
        }),
      ).rejects.toThrow('该IP今日注册次数已达上限');
    });
  });
});
