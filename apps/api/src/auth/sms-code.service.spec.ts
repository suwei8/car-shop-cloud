const mockRedis = {
  get: jest.fn(),
  setex: jest.fn(),
  incr: jest.fn(),
  del: jest.fn(),
  ttl: jest.fn(),
  expire: jest.fn(),
  on: jest.fn(),
  disconnect: jest.fn(),
};

jest.mock('ioredis', () => {
  const MockRedis = jest.fn().mockImplementation(() => mockRedis);
  return { default: MockRedis, __esModule: true };
});

import { SmsCodeService } from './sms-code.service';

describe('SmsCodeService', () => {
  let service: SmsCodeService;

  beforeEach(() => {
    mockRedis.ttl.mockReset().mockReturnValue(Promise.resolve(-2));
    mockRedis.incr.mockReset().mockReturnValue(Promise.resolve(1));
    mockRedis.setex.mockReset().mockReturnValue(Promise.resolve('OK'));
    mockRedis.del.mockReset().mockReturnValue(Promise.resolve(1));
    mockRedis.get.mockReset().mockReturnValue(Promise.resolve(null));
    mockRedis.expire.mockReset().mockReturnValue(Promise.resolve(1));

    service = new SmsCodeService({ get: () => 'redis://localhost:6379' } as any);
    (service as any).redis = mockRedis;
  });

  describe('generateCode', () => {
    it('should generate a 6-digit code', async () => {
      const code = await service.generateCode('13800000000', '127.0.0.1');
      expect(code).toMatch(/^\d{6}$/);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining('code'),
        300,
        code,
      );
    });

    it('should throw if resend interval not elapsed', async () => {
      mockRedis.ttl.mockResolvedValue(30);
      await expect(
        service.generateCode('13800000000', '127.0.0.1'),
      ).rejects.toThrow('请等待');
    });

    it('should throw if daily phone limit exceeded', async () => {
      mockRedis.ttl.mockResolvedValue(-2);
      mockRedis.incr
        .mockResolvedValueOnce(11)  // phone daily count exceeds limit (10)
        .mockResolvedValueOnce(1);  // ip daily count (won't be reached)
      await expect(
        service.generateCode('13800000000', '127.0.0.1'),
      ).rejects.toThrow('该手机号今日发送次数已达上限');
    });

    it('should throw if daily IP limit exceeded', async () => {
      mockRedis.ttl.mockResolvedValue(-2);
      mockRedis.incr
        .mockResolvedValueOnce(1)   // phone daily count (ok)
        .mockResolvedValueOnce(21); // ip daily count exceeds limit (20)
      await expect(
        service.generateCode('13800000000', '127.0.0.1'),
      ).rejects.toThrow('该IP今日发送次数已达上限');
    });
  });

  describe('verifyCode', () => {
    it('should verify correct code and delete it', async () => {
      mockRedis.get.mockResolvedValue('123456');
      mockRedis.del.mockResolvedValue(1);

      const result = await service.verifyCode('13800000000', '123456');
      expect(result).toBe(true);
      expect(mockRedis.del).toHaveBeenCalled();
    });

    it('should throw on expired code', async () => {
      mockRedis.get.mockResolvedValue(null);
      await expect(
        service.verifyCode('13800000000', '123456'),
      ).rejects.toThrow('验证码已过期');
    });

    it('should throw on wrong code', async () => {
      mockRedis.get.mockResolvedValue('654321');
      await expect(
        service.verifyCode('13800000000', '123456'),
      ).rejects.toThrow('验证码错误');
    });
  });

  describe('checkRegisterLimit', () => {
    it('should pass when under limit', async () => {
      mockRedis.incr.mockResolvedValue(3);
      await expect(
        service.checkRegisterLimit('127.0.0.1'),
      ).resolves.toBeUndefined();
    });

    it('should throw when limit exceeded', async () => {
      mockRedis.incr.mockResolvedValue(6);
      await expect(
        service.checkRegisterLimit('127.0.0.1'),
      ).rejects.toThrow('该IP今日注册次数已达上限');
    });
  });
});
