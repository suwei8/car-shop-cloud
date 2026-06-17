import { ConflictException, NotFoundException } from '@nestjs/common';
import { VehicleService } from './vehicle.service';

jest.mock('./data/brand-library', () => ({
  VEHICLE_BRAND_LIBRARY: [],
}));

describe('VehicleService', () => {
  let service: VehicleService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      vehicle: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
    };
    service = new VehicleService(mockPrisma);
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
    it('should throw ConflictException when plateNo already exists as active in same tenant', async () => {
      mockPrisma.vehicle.findFirst.mockResolvedValue({ id: 'v-1', plateNo: '京A12345', status: 'active' });

      await expect(
        service.create({ customerId: 'c-1', plateNo: '京A12345' }, jwtPayload),
      ).rejects.toThrow(ConflictException);
    });

    it('should create vehicle when plateNo is unique', async () => {
      mockPrisma.vehicle.findFirst.mockResolvedValue(null);
      const created = { id: 'v-1', plateNo: '京A12345', tenantId: 'tenant-1' };
      mockPrisma.vehicle.create.mockResolvedValue(created);

      const result = await service.create({ customerId: 'c-1', plateNo: '京a12345' }, jwtPayload);
      expect(result.id).toBe('v-1');
      expect(mockPrisma.vehicle.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ plateNo: '京A12345' }),
        }),
      );
    });
  });

  describe('update', () => {
    const existingVehicle = {
      id: 'v-1',
      plateNo: '京A12345',
      customerId: 'c-1',
      tenantId: 'tenant-1',
      status: 'active',
      customer: { id: 'c-1', name: '张三' },
    };

    it('should skip duplicate check when plateNo is unchanged', async () => {
      mockPrisma.vehicle.findFirst.mockResolvedValue(existingVehicle);
      const updated = { ...existingVehicle, color: '红色' };
      mockPrisma.vehicle.update.mockResolvedValue(updated);

      await service.update('v-1', { plateNo: '京A12345', color: '红色' }, jwtPayload);

      expect(mockPrisma.vehicle.findFirst).toHaveBeenCalledTimes(1);
    });

    it('should throw ConflictException when plateNo changed to occupied value', async () => {
      mockPrisma.vehicle.findFirst
        .mockResolvedValueOnce(existingVehicle)
        .mockResolvedValueOnce({ id: 'v-2', plateNo: '京B99999', status: 'active' });

      await expect(
        service.update('v-1', { plateNo: '京B99999' }, jwtPayload),
      ).rejects.toThrow(ConflictException);
    });

    it('should allow update when plateNo changed to a new value', async () => {
      mockPrisma.vehicle.findFirst
        .mockResolvedValueOnce(existingVehicle)
        .mockResolvedValueOnce(null);
      const updated = { ...existingVehicle, plateNo: '京C00001' };
      mockPrisma.vehicle.update.mockResolvedValue(updated);

      const result = await service.update('v-1', { plateNo: '京c00001' }, jwtPayload);
      expect(result.plateNo).toBe('京C00001');
      expect(mockPrisma.vehicle.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ plateNo: '京C00001' }),
        }),
      );
    });

    it('should skip duplicate check when plateNo differs only by case', async () => {
      mockPrisma.vehicle.findFirst.mockResolvedValue(existingVehicle);
      const updated = { ...existingVehicle, plateNo: '京a12345' };
      mockPrisma.vehicle.update.mockResolvedValue(updated);

      await service.update('v-1', { plateNo: '京a12345' }, jwtPayload);

      expect(mockPrisma.vehicle.findFirst).toHaveBeenCalledTimes(1);
    });

    it('should throw ConflictException when new plateNo case-normalized matches another active vehicle', async () => {
      mockPrisma.vehicle.findFirst
        .mockResolvedValueOnce(existingVehicle)
        .mockResolvedValueOnce({ id: 'v-2', plateNo: '京b99999', status: 'active' });

      await expect(
        service.update('v-1', { plateNo: '京B99999' }, jwtPayload),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException when vehicle does not exist', async () => {
      mockPrisma.vehicle.findFirst.mockResolvedValue(null);

      await expect(
        service.update('v-999', { plateNo: '京D00001' }, jwtPayload),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
