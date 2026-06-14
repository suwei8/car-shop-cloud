import { FeatureFlagService } from './feature-flag.service';

const mockPrisma = {
  featureFlag: { findMany: jest.fn(), create: jest.fn(), findUnique: jest.fn() },
  tenantFeatureFlag: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    upsert: jest.fn(),
  },
};

const mockConfig = {
  get: jest.fn().mockReturnValue('redis://localhost:6379'),
};

const mockRedisInstance = {
  connect: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
  get: jest.fn(),
  setex: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  scan: jest.fn().mockResolvedValue(['0', []]),
};

jest.mock('ioredis', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => mockRedisInstance),
  };
});

function createService() {
  return new FeatureFlagService(mockPrisma as any, mockConfig as any);
}

beforeEach(() => {
  jest.clearAllMocks();
  // Reset redis instance mocks
  mockRedisInstance.get.mockReset();
  mockRedisInstance.setex.mockReset();
  mockRedisInstance.del.mockReset();
  mockRedisInstance.scan.mockReset();
  mockRedisInstance.scan.mockResolvedValue(['0', []]);
});

describe('FeatureFlagService', () => {
  describe('isFlagEnabled', () => {
    it('should query DB and cache result on cache miss', async () => {
      const service = createService();
      mockRedisInstance.get.mockResolvedValue(null);
      mockPrisma.tenantFeatureFlag.findFirst.mockResolvedValue({
        enabled: true,
      });

      const result = await service.isFlagEnabled('tenant-1', 'dark_mode');

      expect(result).toBe(true);
      expect(mockPrisma.tenantFeatureFlag.findFirst).toHaveBeenCalledTimes(1);
    });

    it('should return cached value on cache hit', async () => {
      const service = createService();
      mockRedisInstance.get.mockResolvedValue('1');

      const result = await service.isFlagEnabled('tenant-1', 'dark_mode');

      expect(result).toBe(true);
      expect(mockPrisma.tenantFeatureFlag.findFirst).not.toHaveBeenCalled();
    });

    it('should fall back to DB when Redis get fails', async () => {
      const service = createService();
      mockRedisInstance.get.mockRejectedValue(new Error('Connection lost'));
      mockPrisma.tenantFeatureFlag.findFirst.mockResolvedValue({ enabled: false });

      const result = await service.isFlagEnabled('tenant-1', 'dark_mode');

      expect(result).toBe(false);
      expect(mockPrisma.tenantFeatureFlag.findFirst).toHaveBeenCalledTimes(1);
    });

    it('should use TTL of 60 seconds when caching', async () => {
      const service = createService();
      mockRedisInstance.get.mockResolvedValue(null);
      mockPrisma.tenantFeatureFlag.findFirst.mockResolvedValue({ enabled: true });

      await service.isFlagEnabled('tenant-1', 'dark_mode');

      expect(mockRedisInstance.setex).toHaveBeenCalledWith(
        'ff:tenant-1:dark_mode',
        60,
        '1',
      );
    });
  });

  describe('getTenantFlagsAsMap', () => {
    it('should return cached map on cache hit', async () => {
      const service = createService();
      const cachedMap = { dark_mode: true, beta_feature: false };
      mockRedisInstance.get.mockResolvedValue(JSON.stringify(cachedMap));

      const result = await service.getTenantFlagsAsMap('tenant-1');

      expect(result).toEqual(cachedMap);
      expect(mockPrisma.tenantFeatureFlag.findMany).not.toHaveBeenCalled();
    });

    it('should query DB and cache on cache miss', async () => {
      const service = createService();
      mockRedisInstance.get.mockResolvedValue(null);
      mockPrisma.tenantFeatureFlag.findMany.mockResolvedValue([
        { featureFlag: { code: 'dark_mode' }, enabled: true },
        { featureFlag: { code: 'beta' }, enabled: false },
      ]);

      const result = await service.getTenantFlagsAsMap('tenant-1');

      expect(result).toEqual({ dark_mode: true, beta: false });
      expect(mockRedisInstance.setex).toHaveBeenCalledWith(
        'ff:map:tenant-1',
        60,
        JSON.stringify({ dark_mode: true, beta: false }),
      );
    });
  });

  describe('setTenantFlag', () => {
    it('should invalidate cache after setting flag', async () => {
      const service = createService();
      mockPrisma.tenantFeatureFlag.upsert.mockResolvedValue({});
      mockPrisma.featureFlag.findUnique.mockResolvedValue({ code: 'dark_mode' });
      mockRedisInstance.del.mockResolvedValue(1);

      await service.setTenantFlag('tenant-1', 'flag-1', true);

      expect(mockRedisInstance.del).toHaveBeenCalledWith('ff:map:tenant-1');
      expect(mockRedisInstance.del).toHaveBeenCalledWith('ff:tenant-1:dark_mode');
    });
  });

  describe('invalidateCache', () => {
    it('should do nothing when Redis is not available', async () => {
      const service = createService();
      (service as any).redis = null;

      await service.invalidateCache('tenant-1');
    });

    it('should scan and delete all flag keys when no flagCode specified', async () => {
      const service = createService();
      mockRedisInstance.scan
        .mockResolvedValueOnce(['123', ['ff:tenant-1:flag1', 'ff:tenant-1:flag2']])
        .mockResolvedValueOnce(['0', []]);

      await service.invalidateCache('tenant-1');

      expect(mockRedisInstance.del).toHaveBeenCalledWith('ff:map:tenant-1');
      expect(mockRedisInstance.del).toHaveBeenCalledWith('ff:tenant-1:flag1', 'ff:tenant-1:flag2');
    });
  });
});
