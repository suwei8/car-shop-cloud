import { ReminderTaskService } from './reminder-task.service';

function daysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function daysFromNow(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

const mockPrisma = {
  tenant: { findMany: jest.fn() },
  systemParameter: { findMany: jest.fn() },
  vehicle: { findMany: jest.fn() },
  packageCard: { findMany: jest.fn() },
  storedValueCard: { findMany: jest.fn() },
  customer: { findMany: jest.fn() },
  reminder: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
};

describe('ReminderTaskService', () => {
  let service: ReminderTaskService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReminderTaskService(mockPrisma as any);
    mockPrisma.systemParameter.findMany.mockResolvedValue([]);
    mockPrisma.reminder.findFirst.mockResolvedValue(null);
    mockPrisma.reminder.create.mockResolvedValue({});
    mockPrisma.reminder.update.mockResolvedValue({});
    mockPrisma.vehicle.findMany.mockResolvedValue([]);
    mockPrisma.packageCard.findMany.mockResolvedValue([]);
    mockPrisma.storedValueCard.findMany.mockResolvedValue([]);
    mockPrisma.customer.findMany.mockResolvedValue([]);
  });

  function getCreatedReminders(type?: string) {
    return mockPrisma.reminder.create.mock.calls
      .map((c: any) => c[0].data)
      .filter((d: any) => !type || d.type === type);
  }

  describe('maintenance_due rule', () => {
    it('should generate reminder when last maintenance was 160 days ago', async () => {
      mockPrisma.vehicle.findMany.mockResolvedValue([
        {
          id: 'v1',
          customerId: 'c1',
          plateNo: '京A12345',
          workOrders: [{ updatedAt: daysAgo(160), vehicleMileage: 50000 }],
          customer: { name: '张三' },
        },
      ]);

      await service.generateForTenant('t1');

      const reminders = getCreatedReminders('maintenance_due');
      expect(reminders).toHaveLength(1);
      expect(reminders[0].customerId).toBe('c1');
      expect(reminders[0].vehicleId).toBe('v1');
    });

    it('should NOT generate reminder when last maintenance was 149 days ago', async () => {
      mockPrisma.vehicle.findMany.mockResolvedValue([
        {
          id: 'v1',
          customerId: 'c1',
          plateNo: '京A12345',
          workOrders: [{ updatedAt: daysAgo(149), vehicleMileage: 50000 }],
          customer: { name: '张三' },
        },
      ]);

      await service.generateForTenant('t1');
      expect(getCreatedReminders('maintenance_due')).toHaveLength(0);
    });

    it('should NOT generate when no maintenance work order exists', async () => {
      mockPrisma.vehicle.findMany.mockResolvedValue([
        {
          id: 'v1',
          customerId: 'c1',
          plateNo: '京A12345',
          workOrders: [],
          customer: { name: '张三' },
        },
      ]);

      await service.generateForTenant('t1');
      expect(getCreatedReminders('maintenance_due')).toHaveLength(0);
    });
  });

  describe('card_expiring rule', () => {
    it('should generate reminder when package card expires within 14 days with remaining qty', async () => {
      mockPrisma.packageCard.findMany.mockResolvedValue([
        {
          id: 'pc1',
          customerId: 'c1',
          name: '洗车卡',
          endAt: daysFromNow(7),
          items: [{ remainQty: 3 }],
        },
      ]);
      mockPrisma.customer.findMany.mockResolvedValue([{ id: 'c1', name: '李四' }]);

      await service.generateForTenant('t1');

      const reminders = getCreatedReminders('card_expiring');
      expect(reminders).toHaveLength(1);
      expect(reminders[0].customerId).toBe('c1');
      expect(reminders[0].relatedId).toBe('pc1');
    });

    it('should NOT generate when remaining qty is 0', async () => {
      mockPrisma.packageCard.findMany.mockResolvedValue([
        {
          id: 'pc1',
          customerId: 'c1',
          name: '洗车卡',
          endAt: daysFromNow(7),
          items: [{ remainQty: 0 }],
        },
      ]);

      await service.generateForTenant('t1');
      expect(getCreatedReminders('card_expiring')).toHaveLength(0);
    });

    it('should NOT generate when card is outside the 14-day window (mock returns empty)', async () => {
      // In production, Prisma WHERE clause filters out cards > 14 days.
      // Mock simulates that by returning empty array.
      mockPrisma.packageCard.findMany.mockResolvedValue([]);

      await service.generateForTenant('t1');
      expect(getCreatedReminders('card_expiring')).toHaveLength(0);
    });
  });

  describe('card_low_balance rule', () => {
    it('should generate reminder when balance < 100', async () => {
      mockPrisma.storedValueCard.findMany.mockResolvedValue([
        { id: 'sv1', cardNo: 'SV001', customerId: 'c1', balance: 50 },
      ]);
      mockPrisma.customer.findMany.mockResolvedValue([{ id: 'c1', name: '王五' }]);

      await service.generateForTenant('t1');

      const reminders = getCreatedReminders('card_low_balance');
      expect(reminders).toHaveLength(1);
      expect(reminders[0].customerId).toBe('c1');
      expect(reminders[0].relatedId).toBe('sv1');
    });

    it('should NOT generate when no cards match low balance criteria', async () => {
      await service.generateForTenant('t1');
      expect(getCreatedReminders('card_low_balance')).toHaveLength(0);
    });
  });

  describe('customer_churn rule', () => {
    it('should generate reminder when last settled order was 100 days ago', async () => {
      mockPrisma.customer.findMany.mockResolvedValue([
        {
          id: 'c1',
          name: '赵六',
          workOrders: [{ updatedAt: daysAgo(100) }],
        },
      ]);

      await service.generateForTenant('t1');

      const reminders = getCreatedReminders('customer_churn');
      expect(reminders).toHaveLength(1);
      expect(reminders[0].customerId).toBe('c1');
    });

    it('should NOT generate when last order was 89 days ago', async () => {
      mockPrisma.customer.findMany.mockResolvedValue([
        {
          id: 'c1',
          name: '赵六',
          workOrders: [{ updatedAt: daysAgo(89) }],
        },
      ]);

      await service.generateForTenant('t1');
      expect(getCreatedReminders('customer_churn')).toHaveLength(0);
    });

    it('should NOT generate when customer has no work orders', async () => {
      mockPrisma.customer.findMany.mockResolvedValue([
        { id: 'c1', name: '赵六', workOrders: [] },
      ]);

      await service.generateForTenant('t1');
      expect(getCreatedReminders('customer_churn')).toHaveLength(0);
    });
  });

  describe('idempotency', () => {
    it('should not create duplicate reminder when one already exists', async () => {
      mockPrisma.vehicle.findMany.mockResolvedValue([
        {
          id: 'v1',
          customerId: 'c1',
          plateNo: '京A12345',
          workOrders: [{ updatedAt: daysAgo(160), vehicleMileage: 50000 }],
          customer: { name: '张三' },
        },
      ]);
      mockPrisma.reminder.findFirst.mockResolvedValue({ id: 'existing-id' });

      await service.generateForTenant('t1');

      expect(getCreatedReminders('maintenance_due')).toHaveLength(0);
      expect(mockPrisma.reminder.update).toHaveBeenCalled();
    });
  });

  describe('tenant isolation', () => {
    it('should continue processing other tenants when one fails', async () => {
      mockPrisma.tenant.findMany.mockResolvedValue([{ id: 't1' }, { id: 't2' }]);
      mockPrisma.systemParameter.findMany
        .mockRejectedValueOnce(new Error('DB error'))
        .mockResolvedValue([]);

      await expect(service.generateAll()).resolves.not.toThrow();
    });
  });
});
