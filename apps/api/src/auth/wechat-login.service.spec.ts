import { BadRequestException } from '@nestjs/common';
import { WechatLoginService } from './wechat-login.service';

describe('WechatLoginService', () => {
  let service: WechatLoginService;
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
        update: jest.fn(),
      },
      tenant: {
        create: jest.fn(),
        findUnique: jest.fn(),
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
        if (key === 'WX_MINI_APPID') return undefined;
        if (key === 'WX_MINI_SECRET') return undefined;
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
      }),
    };

    mockNotificationService = {
      send: jest.fn(),
    };

    service = new WechatLoginService(
      mockPrisma,
      mockJwtService,
      mockConfig,
      mockSmsCodeService,
      mockInitializer,
      mockNotificationService,
    );
  });

  const mockUser = {
    id: 'user-1',
    phone: '13800000000',
    name: '管理员',
    tenantId: 'tenant-1',
    status: 'active',
    employee: { shopId: 'shop-1' },
    userRoles: [{
      role: {
        code: 'tenant_admin',
        rolePermissions: [{ permission: { code: 'tenant:shop:view' } }],
      },
    }],
  };

  describe('login', () => {
    it('should return login tokens if openid is bound', async () => {
      mockPrisma.user.findFirst
        .mockResolvedValueOnce(mockUser)  // find by wxOpenid
        .mockResolvedValueOnce({ subscriptionEndAt: new Date(Date.now() + 30 * 86400000), subscriptionStatus: 'trial' }); // tenant

      const result = await service.login('test_code');

      expect(result).toHaveProperty('needBind', false);
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
    });

    it('should return needBind if openid is not bound', async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce(null);

      const result = await service.login('test_code');

      expect(result).toHaveProperty('needBind', true);
      expect(result).toHaveProperty('openid');
    });
  });

  describe('bind', () => {
    it('should bind to existing user by phone', async () => {
      mockSmsCodeService.verifyCode.mockResolvedValue(true);
      // findFirst: first call finds existing user by phone
      mockPrisma.user.findFirst.mockResolvedValueOnce(mockUser);
      mockPrisma.user.findFirst.mockResolvedValueOnce({ subscriptionEndAt: new Date(Date.now() + 30 * 86400000), subscriptionStatus: 'trial' });

      const result = await service.bind({
        code: 'test_code',
        phone: '13800000000',
        smsCode: '123456',
        ip: '127.0.0.1',
      });

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { wxOpenid: expect.stringContaining('mock_openid_') },
      });
      expect(result).toHaveProperty('accessToken');
    });

    it('should create new user when binding with registration data', async () => {
      mockSmsCodeService.verifyCode.mockResolvedValue(true);
      mockSmsCodeService.checkRegisterLimit.mockResolvedValue(undefined);

      const txMocks = {
        tenant: { create: jest.fn().mockResolvedValue({ id: 'new-tenant', subscriptionEndAt: new Date() }) },
        tenantSubscription: { create: jest.fn() },
        subscriptionPlan: { findUnique: jest.fn().mockResolvedValue({ id: 'plan-trial' }) },
        featureFlag: { findUnique: jest.fn().mockResolvedValue(null) },
        tenantFeatureFlag: { upsert: jest.fn() },
      };
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(txMocks));

      // findFirst call chain:
      // 1. check existing user by phone → null (no existing user)
      // 2. find user after transaction (without include)
      // 3. find user after transaction (with include for token generation)
      mockPrisma.user.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'new-user',
          phone: '13800000000',
          name: '管理员',
          tenantId: 'new-tenant',
          status: 'active',
          employee: null,
          userRoles: [],
        })
        .mockResolvedValueOnce({
          id: 'new-user',
          phone: '13800000000',
          name: '管理员',
          tenantId: 'new-tenant',
          status: 'active',
          employee: null,
          userRoles: [{
            role: {
              code: 'tenant_admin',
              rolePermissions: [{ permission: { code: 'tenant:shop:view' } }],
            },
          }],
        });

      mockPrisma.user.update.mockResolvedValue({});

      // generateLoginResult calls findUnique for tenant
      mockPrisma.tenant.findUnique.mockResolvedValue({ subscriptionEndAt: new Date(Date.now() + 30 * 86400000), subscriptionStatus: 'trial' });

      const result = await service.bind({
        code: 'test_code',
        phone: '13800000000',
        smsCode: '123456',
        shopName: '新注册店',
        businessType: 'repair',
        employeeCount: 3,
        ip: '127.0.0.1',
      });

      expect(result).toHaveProperty('accessToken');
      expect(txMocks.tenant.create).toHaveBeenCalled();
    });

    it('should throw if new user binding without required fields', async () => {
      mockSmsCodeService.verifyCode.mockResolvedValue(true);
      // findFirst: no existing user by phone
      mockPrisma.user.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.bind({
          code: 'test_code',
          phone: '13800000000',
          smsCode: '123456',
          ip: '127.0.0.1',
        }),
      ).rejects.toThrow('新用户绑定需要提供');
    });
  });
});
