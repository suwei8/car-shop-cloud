import * as http from 'http';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE = 'http://localhost:3000/api';
const PHONE = '13900000001';
const PASSWORD = 'Car@Shop2026!Demo';

let token = '';

function request<T = any>(
  method: string,
  path: string,
  body?: Record<string, any>,
): Promise<{ status: number; data: T }> {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const options: http.RequestOptions = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };

    const req = http.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk: Buffer) => (raw += chunk.toString()));
      res.on('end', () => {
        try {
          const json = JSON.parse(raw);
          resolve({ status: res.statusCode ?? 0, data: json });
        } catch {
          resolve({ status: res.statusCode ?? 0, data: raw as any });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function unwrap<T>(res: { status: number; data: any }): T {
  if (res.status >= 400) {
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(res.data)}`);
  }
  const body = res.data;
  if (body && typeof body === 'object' && 'data' in body) {
    return body.data as T;
  }
  return body as T;
}

async function run() {
  try {
    console.log('=== Start New Features Integration Tests ===');

    // 1. Login
    const loginRes = await request('POST', '/auth/login', { phone: PHONE, password: PASSWORD });
    const authData = unwrap<any>(loginRes);
    token = authData.accessToken;
    const tenantId = authData.user.tenantId;
    console.log('✅ Login Succeeded');

    // 2. Prepare database entities
    // Find or create a service item
    let serviceItem = await prisma.serviceItem.findFirst({
      where: { tenantId },
    });
    if (!serviceItem) {
      serviceItem = await prisma.serviceItem.create({
        data: {
          tenantId,
          name: '测试核销服务',
          category: 'repair',
          unit: '次',
          unitPrice: 100.00,
          status: 'active',
        }
      });
      console.log('✅ Created mock service item');
    }

    // Find a shop
    const shop = await prisma.shop.findFirst({
      where: { tenantId },
    });
    if (!shop) throw new Error('No shop found in DB');

    // Find or create a technician role
    let techRole = await prisma.role.findFirst({
      where: { tenantId, code: 'technician' }
    });
    if (!techRole) {
      techRole = await prisma.role.create({
        data: {
          tenantId,
          code: 'technician',
          name: '技师',
        }
      });
    }

    // Find a user and assign technician role, or create a technician user
    let technician = await prisma.user.findFirst({
      where: { tenantId, userRoles: { some: { role: { code: 'technician' } } } },
    });
    
    if (!technician) {
      technician = await prisma.user.create({
        data: {
          tenantId,
          phone: '13911112222',
          name: '测试技师-小王',
          passwordHash: 'hashedpassword',
          status: 'active',
          userRoles: {
            create: {
              roleId: techRole.id,
            }
          }
        }
      });
      console.log('✅ Created mock technician user');
    }

    // Create a vehicle and customer
    const customer = await prisma.customer.create({
      data: {
        tenantId,
        name: 'New Feature Test Customer',
        phone: '13599998888',
        status: 'active',
      }
    });

    const vehicleMatch = await prisma.vehicle.create({
      data: {
        tenantId,
        customerId: customer.id,
        plateNo: '浙A88888',
        brand: 'Porsche',
        model: '911',
      }
    });

    const vehicleMismatch = await prisma.vehicle.create({
      data: {
        tenantId,
        customerId: customer.id,
        plateNo: '浙A99999',
        brand: 'Ferrari',
        model: '488',
      }
    });

    console.log('✅ Mock data prepared');

    // 3. Test Feature 1: Strict package card checks
    console.log('\n--- Testing Package Card Checks ---');
    // Sell a card limited to vehicleMatch and shop
    const cardNo = 'CARD_' + Date.now();
    const sellRes = await request('POST', '/package-cards', {
      cardNo,
      customerId: customer.id,
      vehicleId: vehicleMatch.id,
      shopIds: [shop.id],
      name: 'Test Strict Card',
      startAt: new Date(Date.now() - 3600000).toISOString(),
      endAt: new Date(Date.now() + 86400000 * 30).toISOString(),
      items: [
        { serviceItemId: serviceItem.id, totalQty: 5 }
      ]
    });
    const card = unwrap<any>(sellRes);
    console.log(`✅ Package Card Created: ${card.id}`);

    // Try consuming with mismatched vehicle directly (should fail)
    const consumeFailRes = await request('POST', `/package-cards/${card.id}/consume`, {
      serviceItemId: serviceItem.id,
      quantity: 1,
      relatedType: 'vehicle',
      relatedId: vehicleMismatch.id
    });
    if (consumeFailRes.status === 403) {
      console.log('✅ Mismatched vehicle check PASSED (Blocked correctly with 403)');
    } else {
      throw new Error(`Expected 403 but got ${consumeFailRes.status}: ${JSON.stringify(consumeFailRes.data)}`);
    }

    // Try consuming with mismatched shop directly (should fail)
    const consumeShopFailRes = await request('POST', `/package-cards/${card.id}/consume`, {
      serviceItemId: serviceItem.id,
      quantity: 1,
      relatedType: 'shop',
      relatedId: 'mismatched-shop-id'
    });
    if (consumeShopFailRes.status === 403) {
      console.log('✅ Mismatched shop check PASSED (Blocked correctly with 403)');
    } else {
      throw new Error(`Expected 403 but got ${consumeShopFailRes.status}`);
    }

    // Try consuming with correct vehicle directly (should pass)
    const consumePassRes = await request('POST', `/package-cards/${card.id}/consume`, {
      serviceItemId: serviceItem.id,
      quantity: 1,
      relatedType: 'vehicle',
      relatedId: vehicleMatch.id
    });
    if (consumePassRes.status === 201 || consumePassRes.status === 200) {
      console.log('✅ Correct vehicle check PASSED (Consumed successfully)');
    } else {
      throw new Error(`Expected 201/200 but got ${consumePassRes.status}: ${JSON.stringify(consumePassRes.data)}`);
    }


    // 4. Test Feature 2: Dispatch photo upload and workshop linkage
    console.log('\n--- Testing Workshop Photo Linkage ---');
    // Create a work order first
    const woRes = await request('POST', '/work-orders', {
      orderType: 'repair',
      customerId: customer.id,
      vehicleId: vehicleMatch.id,
      vehiclePlateNo: vehicleMatch.plateNo,
      advisorId: authData.user.id,
      description: 'Linkage check test',
      shopId: shop.id,
      items: [
        {
          name: serviceItem.name,
          itemType: 'service',
          serviceItemId: serviceItem.id,
          quantity: 1,
          unitPrice: 100,
          amount: 100
        }
      ]
    });
    const workOrder = unwrap<any>(woRes);
    console.log(`✅ Work order created: ${workOrder.id}, status: ${workOrder.status}`);

    // Update status to confirmed
    await request('PUT', `/work-orders/${workOrder.id}/status`, { status: 'confirmed' });
    console.log('✅ Work order confirmed');

    // Create dispatch task (will be pending)
    const dispatchRes = await request('POST', '/dispatch', {
      workOrderId: workOrder.id,
      technicianId: technician.id,
      itemIds: [workOrder.items[0].id]
    });
    const task = unwrap<any>(dispatchRes);
    console.log(`✅ Dispatch task created: ${task.id}, status: ${task.status}`);

    // Call uploadPhoto API simulating photo upload
    const uploadPhotoRes = await request('POST', `/dispatch/${task.id}/photos`, {
      fileUrl: 'https://objectstorage.ap-batam-1.oraclecloud.com/n/axl6ozaw08tj/b/batam/o/test_photo.jpg',
      originalName: 'test_photo.jpg'
    });
    unwrap(uploadPhotoRes);
    console.log('✅ Photo uploaded & linked via API');

    // Verify task state linkage (should be in_progress)
    const updatedTask = await prisma.dispatchTask.findUnique({
      where: { id: task.id }
    });
    if (updatedTask?.status === 'in_progress') {
      console.log(`✅ Task status linked to: ${updatedTask.status}`);
    } else {
      throw new Error(`Expected task status 'in_progress', but got '${updatedTask?.status}'`);
    }

    // Verify work order state linkage (should be in_progress)
    const updatedWorkOrder = await prisma.workOrder.findUnique({
      where: { id: workOrder.id }
    });
    if (updatedWorkOrder?.status === 'in_progress') {
      console.log(`✅ WorkOrder status linked to: ${updatedWorkOrder.status}`);
    } else {
      throw new Error(`Expected workorder status 'in_progress', but got '${updatedWorkOrder?.status}'`);
    }

    console.log('\n============================================================');
    console.log('🎉 ALL NEW FEATURES TESTS PASSED SUCCESSFULLY!');
    console.log('============================================================');

    // Cleanup mock data
    await prisma.packageCardItem.deleteMany({ where: { cardId: card.id } });
    await prisma.packageCardTransaction.deleteMany({ where: { cardId: card.id } });
    await prisma.packageCard.delete({ where: { id: card.id } });
    await prisma.dispatchTask.deleteMany({ where: { workOrderId: workOrder.id } });
    await prisma.workOrderItem.deleteMany({ where: { workOrderId: workOrder.id } });
    await prisma.workOrder.delete({ where: { id: workOrder.id } });
    await prisma.vehicle.delete({ where: { id: vehicleMatch.id } });
    await prisma.vehicle.delete({ where: { id: vehicleMismatch.id } });
    await prisma.customer.delete({ where: { id: customer.id } });

  } catch (error) {
    console.error('❌ Test failed with error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

run();
