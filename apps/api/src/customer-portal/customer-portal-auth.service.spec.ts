import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CustomerPortalAuthService } from './customer-portal-auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { SmsCodeService } from '../auth/sms-code.service';

describe('CustomerPortalAuthService', () => {
  let service: CustomerPortalAuthService;
  let prisma: Record<string, any>;
  let jwtService: Record<string, any>;
  let smsCodeService: Record<string, any>;

  beforeEach(async () => {
    prisma = {
      customerWxBinding: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      customer: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('mock-customer-token'),
    };

    smsCodeService = {
      generateCode: jest.fn().mockResolvedValue('123456'),
      verifyCode: jest.fn().mockResolvedValue(true),
    };

    const configService = {
      get: jest.fn((key: string, defaultVal?: string) => {
        const map: Record<string, string> = {
          JWT_SECRET: 'test-secret',
          JWT_CUSTOMER_SECRET: 'customer-secret',
        };
        return map[key] || defaultVal || '';
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerPortalAuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
        { provide: SmsCodeService, useValue: smsCodeService },
      ],
    }).compile();

    service = module.get(CustomerPortalAuthService);
  });

  describe('wxLogin', () => {
    it('未配置 WX_MINI_APPID 时使用 mock openid', async () => {
      prisma.customerWxBinding.findMany.mockResolvedValue([]);

      const result = await service.wxLogin('test-code');

      expect(result.openid).toBe('mock_openid_test-code');
      expect(result.bound).toBe(false);
    });

    it('已绑定的 openid 直接返回 token', async () => {
      prisma.customerWxBinding.findMany.mockResolvedValue([
        {
          tenantId: 't-1',
          customerId: 'c-1',
          customer: { name: '张三' },
          tenant: { name: '测试店' },
        },
      ]);
      prisma.customer.findUnique.mockResolvedValue({
        id: 'c-1', name: '张三', tenant: { name: '测试店', status: 'active' },
      });

      const result = await service.wxLogin('test-code');

      expect(result.bound).toBe(true);
      expect(result.token).toBe('mock-customer-token');
    });
  });

  describe('bindAndLogin', () => {
    it('手机号未找到客户记录：抛出 BadRequestException', async () => {
      prisma.customer.findMany.mockResolvedValue([]);

      await expect(
        service.bindAndLogin('openid1', '13900000000', '123456', '127.0.0.1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('绑定成功并返回 token', async () => {
      prisma.customer.findMany.mockResolvedValue([
        {
          id: 'c-1',
          tenantId: 't-1',
          name: '张三',
          tenant: { name: '测试店', status: 'active' },
        },
      ]);
      prisma.customerWxBinding.findFirst.mockResolvedValue(null);
      prisma.customerWxBinding.create.mockResolvedValue({});
      prisma.customer.findUnique.mockResolvedValue({
        id: 'c-1', name: '张三', tenant: { name: '测试店', status: 'active' },
      });

      const result = await service.bindAndLogin('openid1', '13900000000', '123456', '127.0.0.1');

      expect(result.token).toBe('mock-customer-token');
      expect(smsCodeService.verifyCode).toHaveBeenCalledWith('13900000000', '123456');
      expect(prisma.customerWxBinding.create).toHaveBeenCalled();
    });

    it('多租户客户：为每个租户创建绑定', async () => {
      prisma.customer.findMany.mockResolvedValue([
        { id: 'c-1', tenantId: 't-1', name: '张三', tenant: { name: '店A' } },
        { id: 'c-2', tenantId: 't-2', name: '张三', tenant: { name: '店B' } },
      ]);
      prisma.customerWxBinding.findFirst.mockResolvedValue(null);
      prisma.customerWxBinding.create.mockResolvedValue({});
      prisma.customer.findUnique.mockResolvedValue({
        id: 'c-1', name: '张三', tenant: { name: '店A', status: 'active' },
      });

      await service.bindAndLogin('openid1', '13900000000', '123456', '127.0.0.1');

      expect(prisma.customerWxBinding.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('switchShop', () => {
    it('无权限切换：抛出 UnauthorizedException', async () => {
      prisma.customerWxBinding.findFirst.mockResolvedValue(null);

      await expect(
        service.switchShop('openid1', 't-other', 'c-other'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('有权切换：返回新 token', async () => {
      prisma.customerWxBinding.findFirst.mockResolvedValue({
        tenantId: 't-2', customerId: 'c-2',
      });
      prisma.customer.findUnique.mockResolvedValue({
        id: 'c-2', name: '张三', tenant: { name: '店B', status: 'active' },
      });

      const result = await service.switchShop('openid1', 't-2', 'c-2');
      expect(result.token).toBe('mock-customer-token');
    });
  });

  describe('JWT Payload 隔离验证', () => {
    it('签发的 Token 包含 audience: customer', async () => {
      prisma.customerWxBinding.findFirst.mockResolvedValue({
        tenantId: 't-1', customerId: 'c-1',
      });
      prisma.customer.findUnique.mockResolvedValue({
        id: 'c-1', name: '张三', tenant: { name: '测试店', status: 'active' },
      });

      await service.switchShop('openid1', 't-1', 'c-1');

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          audience: 'customer',
          customerId: 'c-1',
          roles: ['customer'],
          isPlatform: false,
        }),
        expect.objectContaining({ secret: 'customer-secret' }),
      );
    });
  });
});
