import { NotificationService } from './notification.service';

const mockPrisma = {
  notification: {
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

const mockConfig = {
  get: jest.fn((key: string, defaultValue: string) => {
    if (key === 'SMS_PROVIDER') return 'mock';
    return defaultValue;
  }),
};

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.notification.create.mockResolvedValue({
      id: 'notif-1',
      status: 'pending',
    });
    mockPrisma.notification.update.mockResolvedValue({});
    service = new NotificationService(mockPrisma as any, mockConfig as any);
  });

  it('should create notification and send successfully via mock', async () => {
    const result = await service.send({
      tenantId: 'tenant-1',
      channel: 'sms',
      scene: 'work_order_completed',
      recipient: '13800000000',
      content: '测试内容',
      relatedType: 'work_order',
      relatedId: 'wo-1',
    });

    expect(result.status).toBe('sent');
    expect(mockPrisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          scene: 'work_order_completed',
          status: 'pending',
        }),
      }),
    );
    expect(mockPrisma.notification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'sent' }),
      }),
    );
  });

  it('should handle provider failure gracefully', async () => {
    const originalSend = (service as any).smsProvider.send;
    (service as any).smsProvider.send = jest.fn().mockResolvedValue({ ok: false, error: 'Network error' });

    const result = await service.send({
      tenantId: 'tenant-1',
      channel: 'sms',
      scene: 'work_order_completed',
      recipient: '13800000000',
      content: '测试',
    });

    expect(result.status).toBe('failed');
    expect(mockPrisma.notification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'failed', failReason: 'Network error' }),
      }),
    );

    (service as any).smsProvider.send = originalSend;
  });

  it('should skip unsupported channel', async () => {
    const result = await service.send({
      tenantId: 'tenant-1',
      channel: 'unknown_channel',
      scene: 'work_order_completed',
      recipient: 'user-1',
      content: '测试',
    });

    expect(result.status).toBe('skipped');
  });

  it('should detect duplicate notifications', async () => {
    mockPrisma.notification.findFirst.mockResolvedValue({ id: 'existing' });

    const isDuplicate = await service.checkDuplicate('tenant-1', 'work_order', 'wo-1', 'work_order_completed');
    expect(isDuplicate).toBe(true);
  });

  it('should return false for no duplicate', async () => {
    mockPrisma.notification.findFirst.mockResolvedValue(null);

    const isDuplicate = await service.checkDuplicate('tenant-1', 'work_order', 'wo-1', 'work_order_completed');
    expect(isDuplicate).toBe(false);
  });

  it('should query notifications with tenant isolation', async () => {
    mockPrisma.notification.findMany.mockResolvedValue([]);
    mockPrisma.notification.count.mockResolvedValue(0);

    const result = await service.findAll('tenant-1', { page: 1, pageSize: 10 });
    expect(result).toEqual({ items: [], total: 0, page: 1, pageSize: 10 });
  });

  it('should skip notification when recipient is empty', async () => {
    const result = await service.send({
      tenantId: 'tenant-1',
      channel: 'sms',
      scene: 'work_order_completed',
      recipient: '',
      content: '',
      relatedType: 'work_order',
      relatedId: 'wo-2',
    });

    expect(result.status).toBe('skipped');
    expect(mockPrisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'skipped',
          failReason: '客户无手机号',
        }),
      }),
    );
  });

  it('should create skipped record via skip method', async () => {
    const result = await service.skip({
      tenantId: 'tenant-1',
      channel: 'sms',
      scene: 'work_order_completed',
      recipient: '',
      content: '',
      relatedType: 'work_order',
      relatedId: 'wo-3',
      failReason: '商户已关闭完工通知',
    });

    expect(result.status).toBe('skipped');
    expect(mockPrisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'skipped',
          failReason: '商户已关闭完工通知',
        }),
      }),
    );
  });
});
