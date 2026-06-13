import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Reflector } from '@nestjs/core';

describe('JwtAuthGuard（车主/员工 Token 隔离）', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn().mockReturnValue(false),
          },
        },
      ],
    }).compile();

    guard = module.get(JwtAuthGuard);
    reflector = module.get(Reflector);
  });

  function createMockContext(user: any, path = '/api/work-orders'): ExecutionContext {
    const req = { user, path, url: path };
    return {
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as any;
  }

  it('车主 Token（audience=customer）访问商户端接口：抛出 ForbiddenException', () => {
    const customerUser = {
      sub: 'wx:openid123',
      tenantId: 't-1',
      audience: 'customer',
      customerId: 'c-1',
    };
    const ctx = createMockContext(customerUser, '/api/work-orders');
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(false);

    // Mock super.canActivate to return true (JWT is valid)
    jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'canActivate')
      .mockReturnValue(true);

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('员工 Token（audience=employee）访问商户端接口：正常通过', () => {
    const employeeUser = {
      sub: 'user-1',
      tenantId: 't-1',
      audience: 'employee',
      roles: ['tenant_admin'],
    };
    const ctx = createMockContext(employeeUser, '/api/work-orders');
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(false);

    jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'canActivate')
      .mockReturnValue(true);

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('@Public() 路由：跳过 JWT 校验', () => {
    const ctx = createMockContext(null, '/api/auth/login');
    (reflector.getAllAndOverride as jest.Mock).mockImplementation((key: string) => {
      if (key === 'isPublic') return true;
      return false;
    });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('customer-portal 路由：全局 Guard 跳过，由 controller 级 Guard 处理', () => {
    const ctx = createMockContext(null, '/api/customer-portal/work-orders');
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(false);

    expect(guard.canActivate(ctx)).toBe(true);
  });
});

describe('CustomerJwtStrategy（车主 JWT 策略）', () => {
  it('audience=customer 的 payload 通过验证', async () => {
    const { CustomerJwtStrategy } = await import('./customer-jwt.strategy');
    const { ConfigService } = await import('@nestjs/config');

    const configService = { get: jest.fn().mockReturnValue('test-secret') } as any;
    const strategy = new CustomerJwtStrategy(configService);

    const payload = {
      sub: 'wx:openid123',
      tenantId: 't-1',
      customerId: 'c-1',
      audience: 'customer' as const,
      isPlatform: false,
      roles: ['customer'],
      permissions: [],
      shopId: null,
    };

    const result = await strategy.validate(payload);
    expect(result.audience).toBe('customer');
    expect(result.customerId).toBe('c-1');
  });

  it('audience=employee 的 payload 被拒绝', async () => {
    const { CustomerJwtStrategy } = await import('./customer-jwt.strategy');

    const configService = { get: jest.fn().mockReturnValue('test-secret') } as any;
    const strategy = new CustomerJwtStrategy(configService);

    const payload = {
      sub: 'user-1',
      tenantId: 't-1',
      audience: 'employee' as const,
      isPlatform: false,
      roles: ['tenant_admin'],
      permissions: [],
      shopId: null,
    };

    await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
  });

  it('缺少 customerId 的 payload 被拒绝', async () => {
    const { CustomerJwtStrategy } = await import('./customer-jwt.strategy');

    const configService = { get: jest.fn().mockReturnValue('test-secret') } as any;
    const strategy = new CustomerJwtStrategy(configService);

    const payload = {
      sub: 'wx:openid123',
      tenantId: 't-1',
      audience: 'customer' as const,
      isPlatform: false,
      roles: ['customer'],
      permissions: [],
      shopId: null,
    };

    await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
  });
});
