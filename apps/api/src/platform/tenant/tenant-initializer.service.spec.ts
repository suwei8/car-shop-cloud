import { TenantInitializerService } from './tenant-initializer.service';

const mockPrisma = {
  permission: { findMany: jest.fn() },
  shop: { create: jest.fn() },
  warehouse: { create: jest.fn() },
  role: { create: jest.fn(), findFirst: jest.fn() },
  rolePermission: { create: jest.fn() },
  user: { create: jest.fn() },
  userRole: { create: jest.fn() },
  serviceItem: { create: jest.fn() },
  dictionary: { create: jest.fn() },
};

describe('TenantInitializerService', () => {
  let service: TenantInitializerService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.permission.findMany.mockResolvedValue([
      { id: 'perm-1', code: 'tenant:shop:view' },
      { id: 'perm-2', code: 'tenant:shop:create' },
      { id: 'perm-3', code: 'tenant:workorder:view' },
      { id: 'perm-4', code: 'tenant:workorder:create' },
      { id: 'perm-5', code: 'tenant:customer:view' },
      { id: 'perm-6', code: 'tenant:settlement:view' },
      { id: 'perm-7', code: 'tenant:inventory:view' },
      { id: 'perm-8', code: 'tenant:report:view' },
      { id: 'perm-9', code: 'tenant:vehicle:view' },
      { id: 'perm-10', code: 'tenant:shop:update' },
      { id: 'perm-11', code: 'tenant:customer:create' },
      { id: 'perm-12', code: 'tenant:customer:update' },
      { id: 'perm-13', code: 'tenant:vehicle:create' },
      { id: 'perm-14', code: 'tenant:vehicle:update' },
      { id: 'perm-15', code: 'tenant:workorder:update' },
      { id: 'perm-16', code: 'tenant:settlement:manage' },
      { id: 'perm-17', code: 'tenant:inventory:manage' },
      { id: 'perm-18', code: 'tenant:member:view' },
      { id: 'perm-19', code: 'tenant:member:manage' },
      { id: 'perm-20', code: 'tenant:role:view' },
      { id: 'perm-21', code: 'tenant:role:manage' },
      { id: 'perm-22', code: 'tenant:user:view' },
      { id: 'perm-23', code: 'tenant:user:create' },
      { id: 'perm-24', code: 'tenant:user:update' },
    ]);
    mockPrisma.shop.create.mockResolvedValue({ id: 'shop-1' });
    mockPrisma.warehouse.create.mockResolvedValue({ id: 'wh-1' });
    mockPrisma.role.create.mockResolvedValue({ id: 'role-1' });
    mockPrisma.role.findFirst.mockResolvedValue({ id: 'role-admin' });
    mockPrisma.user.create.mockResolvedValue({ id: 'user-1' });
    service = new TenantInitializerService(mockPrisma as any);
  });

  it('should create shop, warehouse, roles, user, service items, and dictionaries', async () => {
    const result = await service.initialize(
      mockPrisma as any,
      'tenant-1',
      '测试店',
      '13800000000',
      'hashed-password',
      '管理员',
    );

    expect(result.tenantId).toBe('tenant-1');
    expect(result.shopId).toBe('shop-1');
    expect(result.warehouseId).toBe('wh-1');
    expect(result.userId).toBe('user-1');
    expect(result.roleCount).toBe(5);
    expect(result.serviceItemCount).toBe(29);
    expect(result.dictionaryCount).toBe(21);

    // 验证门店创建
    expect(mockPrisma.shop.create).toHaveBeenCalledWith({
      data: { tenantId: 'tenant-1', name: '测试店（总店）', status: 'active' },
    });

    // 验证仓库创建
    expect(mockPrisma.warehouse.create).toHaveBeenCalledWith({
      data: { tenantId: 'tenant-1', shopId: 'shop-1', name: '默认仓库', isDefault: true, status: 'active' },
    });

    // 验证角色创建（5个）
    expect(mockPrisma.role.create).toHaveBeenCalledTimes(5);

    // 验证管理员账号创建
    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1',
        phone: '13800000000',
        name: '管理员',
        passwordHash: 'hashed-password',
        isPlatform: false,
        status: 'active',
      },
    });

    // 验证角色绑定
    expect(mockPrisma.userRole.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', roleId: 'role-admin' },
    });
  });

  it('should use tenant name for shop name', async () => {
    await service.initialize(mockPrisma as any, 't2', 'ABC汽修', '13900000000', 'hash', '老板');
    expect(mockPrisma.shop.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: 'ABC汽修（总店）' }) }),
    );
  });

  it('should create all 5 built-in roles', async () => {
    await service.initialize(mockPrisma as any, 't3', '店', '139', 'h', '管');
    const roleCodes = mockPrisma.role.create.mock.calls.map((c: any) => c[0].data.code);
    expect(roleCodes).toContain('tenant_admin');
    expect(roleCodes).toContain('shop_manager');
    expect(roleCodes).toContain('service_advisor');
    expect(roleCodes).toContain('technician');
    expect(roleCodes).toContain('cashier');
    expect(roleCodes).toHaveLength(5);
  });
});
