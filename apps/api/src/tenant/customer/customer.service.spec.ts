import { ConflictException, NotFoundException } from '@nestjs/common';
import { CustomerService } from './customer.service';

describe('CustomerService', () => {
  let service: CustomerService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      customer: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
    };
    service = new CustomerService(mockPrisma);
  });

  const jwtPayload = {
    sub: 'admin-1',
    tenantId: 'tenant-1',
    shopId: 'shop-1',
    isPlatform: false,
    roles: ['tenant_admin'],
    permissions: [],
    dataScope: 'all' as const,
  };

  describe('create', () => {
    it('should throw ConflictException when phone already exists as active in same tenant', async () => {
      mockPrisma.customer.findFirst.mockResolvedValue({ id: 'existing', phone: '13800001111', status: 'active' });

      await expect(
        service.create({ name: '张三', phone: '13800001111' }, jwtPayload),
      ).rejects.toThrow(ConflictException);
    });

    it('should create customer when phone is unique', async () => {
      mockPrisma.customer.findFirst.mockResolvedValue(null);
      const created = { id: 'c-1', name: '张三', phone: '13800001111', tenantId: 'tenant-1' };
      mockPrisma.customer.create.mockResolvedValue(created);

      const result = await service.create({ name: '张三', phone: '13800001111' }, jwtPayload);
      expect(result.id).toBe('c-1');
    });
  });

  describe('update', () => {
    const existingCustomer = {
      id: 'c-1',
      name: '张三',
      phone: '13800001111',
      tenantId: 'tenant-1',
      status: 'active',
      vehicles: [],
    };

    it('should skip duplicate check when phone is unchanged', async () => {
      mockPrisma.customer.findFirst.mockResolvedValue(existingCustomer);
      const updated = { ...existingCustomer, name: '张三三' };
      mockPrisma.customer.update.mockResolvedValue(updated);

      await service.update('c-1', { name: '张三三' }, jwtPayload);

      expect(mockPrisma.customer.findFirst).toHaveBeenCalledTimes(1);
    });

    it('should throw ConflictException when phone changed to occupied value', async () => {
      mockPrisma.customer.findFirst
        .mockResolvedValueOnce(existingCustomer)
        .mockResolvedValueOnce({ id: 'c-2', phone: '13900002222', status: 'active' });

      await expect(
        service.update('c-1', { phone: '13900002222' }, jwtPayload),
      ).rejects.toThrow(ConflictException);
    });

    it('should allow update when phone changed to a new value', async () => {
      mockPrisma.customer.findFirst
        .mockResolvedValueOnce(existingCustomer)
        .mockResolvedValueOnce(null);
      const updated = { ...existingCustomer, phone: '13900003333' };
      mockPrisma.customer.update.mockResolvedValue(updated);

      const result = await service.update('c-1', { phone: '13900003333' }, jwtPayload);
      expect(result.phone).toBe('13900003333');
    });

    it('should throw NotFoundException when customer does not exist', async () => {
      mockPrisma.customer.findFirst.mockResolvedValue(null);

      await expect(
        service.update('c-999', { name: '新名字' }, jwtPayload),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
