/**
 * Sprint 1-3 API Integration Test
 *
 * Tests: Auth → Customer → Vehicle (Sprint 1)
 *        Parts → Stock → WorkOrder (Sprint 2)
 *        Stock Out → Settlement (Sprint 3)
 *
 * Usage: npx ts-node src/test-business.ts
 */

import * as http from 'http';
import { PrismaClient } from '@prisma/client';

const BASE = 'http://localhost:3000/api';
const PHONE = '13900000001';
const PASSWORD = 'Car@Shop2026!Demo';
const PART_CODE = 'OIL-TEST-999';

const prisma = new PrismaClient();

let token = '';
let shopId = '';
let tenantId = '';
let userId = '';

// ─── Counters ───
let passed = 0;
let failed = 0;
const failures: string[] = [];

// ─── HTTP helper ───
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

/** Unwrap the NestJS TransformInterceptor envelope { code, message, data } */
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

// ─── Logging ───
function log(msg: string) {
  console.log(`  ${msg}`);
}

function ok(label: string, detail?: string) {
  passed++;
  console.log(`  ✅ ${label}${detail ? ' — ' + detail : ''}`);
}

function fail(label: string, err: unknown) {
  failed++;
  const msg = err instanceof Error ? err.message : String(err);
  failures.push(`${label}: ${msg}`);
  console.log(`  ❌ ${label} — ${msg}`);
}

// ─── API calls ───
async function login() {
  const res = await request('POST', '/auth/login', { phone: PHONE, password: PASSWORD });
  const body = unwrap<{ accessToken: string; user: any }>(res);
  token = body.accessToken;
  shopId = body.user.shopId;
  userId = body.user.id;
  tenantId = body.user.tenantId;

  if (!shopId) {
    const shopsRes = await request('GET', '/shops');
    const shops = unwrap<any[]>(shopsRes);
    if (shops.length > 0) {
      shopId = shops[0].id;
      log(`No default shopId on user, fetched and using shopId: ${shopId}`);
    } else {
      throw new Error('No shops found for this tenant. Please create a shop first.');
    }
  }
  return body;
}

async function createCustomer(data: { name: string; phone: string }) {
  const res = await request('POST', '/customers', data);
  return unwrap<any>(res);
}

async function getCustomer(id: string) {
  const res = await request('GET', `/customers/${id}`);
  return unwrap<any>(res);
}

async function createVehicle(data: {
  customerId: string; plateNo: string; brand: string; model: string;
}) {
  const res = await request('POST', '/vehicles', data);
  return unwrap<any>(res);
}

async function getParts(keyword: string) {
  const res = await request<any>('GET', `/parts?keyword=${encodeURIComponent(keyword)}&pageSize=50`);
  return unwrap<any[]>(res);
}

async function createPart(data: Record<string, any>) {
  const res = await request('POST', '/parts', data);
  return unwrap<any>(res);
}

async function getStockBalances(partId?: string) {
  const qs = partId ? `?partId=${partId}` : '';
  const res = await request<any>('GET', `/stock/balances${qs}`);
  return unwrap<any[]>(res);
}

async function stockIn(data: {
  shopId: string; items: { partId: string; quantity: number; unitPrice: number }[];
}) {
  const res = await request('POST', '/stock/in', data);
  return unwrap<any>(res);
}

async function createWorkOrder(data: Record<string, any>) {
  const res = await request('POST', '/work-orders', data);
  return unwrap<any>(res);
}

async function getWorkOrder(id: string) {
  const res = await request('GET', `/work-orders/${id}`);
  return unwrap<any>(res);
}

async function updateWorkOrderStatus(id: string, status: string) {
  const res = await request('PUT', `/work-orders/${id}/status`, { status });
  return unwrap<any>(res);
}

async function stockOutForWorkOrder(workOrderId: string) {
  const res = await request('POST', `/stock/out/work-order/${workOrderId}`);
  return unwrap<any>(res);
}

async function settle(data: {
  workOrderId: string; payments: { payMethod: string; amount: number }[];
}) {
  const res = await request('POST', '/settlements', data);
  return unwrap<any>(res);
}

// ─── Prisma helper: ensure default warehouse ───
async function ensureDefaultWarehouse(tid: string, sid: string): Promise<string> {
  const existing = await prisma.warehouse.findFirst({
    where: { tenantId: tid, shopId: sid, isDefault: true },
  });
  if (existing) {
    log(`Default warehouse already exists: ${existing.id} (${existing.name})`);
    return existing.id;
  }
  const wh = await prisma.warehouse.create({
    data: {
      tenantId: tid,
      shopId: sid,
      name: '默认仓库',
      isDefault: true,
      status: 'active',
    },
  });
  log(`Created default warehouse: ${wh.id}`);
  return wh.id;
}

// ─── Main ───
async function main() {
  const start = Date.now();
  console.log('='.repeat(60));
  console.log('  Sprint 1-3 API Integration Test');
  console.log('='.repeat(60));

  // ────────────────────── LOGIN ──────────────────────
  console.log('\n[0] Login');
  let loginData: any;
  try {
    loginData = await login();
    ok('Login', `user=${loginData.user.name}, shopId=${shopId}`);
  } catch (e) {
    fail('Login', e);
    console.log('\n⛔ Cannot continue without authentication.');
    printSummary(start);
    return;
  }

  // ────────────────────── SPRINT 1 ──────────────────────
  console.log('\n── Sprint 1: Customer & Vehicle ──');

  const randomPhone = '138' + Math.floor(10000000 + Math.random() * 90000000).toString();
  const randomPlate = '京A' + Math.floor(10000 + Math.random() * 90000).toString();

  let customer: any;
  try {
    customer = await createCustomer({
      name: '测试客户-张三',
      phone: randomPhone,
    });
    ok('Create Customer', `id=${customer.id}, name=${customer.name}, phone=${randomPhone}`);
  } catch (e) {
    fail('Create Customer', e);
  }

  let vehicle: any;
  if (customer) {
    try {
      vehicle = await createVehicle({
        customerId: customer.id,
        plateNo: randomPlate,
        brand: '宝马',
        model: '3系/2024/325Li',
      });
      ok('Create Vehicle', `id=${vehicle.id}, plate=${vehicle.plateNo}`);
    } catch (e) {
      fail('Create Vehicle', e);
    }
  } else {
    fail('Create Vehicle', 'Skipped — no customer');
  }

  // ────────────────────── SPRINT 2 ──────────────────────
  console.log('\n── Sprint 2: Parts, Stock & Work Order ──');

  // 2a. Ensure default warehouse
  try {
    await ensureDefaultWarehouse(tenantId, shopId);
    ok('Default Warehouse', 'Ready');
  } catch (e) {
    fail('Default Warehouse', e);
  }

  // 2b. Find or create part
  let part: any;
  try {
    const parts = await getParts(PART_CODE) as any;
    const list = Array.isArray(parts) ? parts : (parts?.items ?? []);
    part = list.find((p: any) => p.code === PART_CODE);
    if (part) {
      ok('Find Part', `id=${part.id}, code=${part.code}, name=${part.name}`);
    } else {
      part = await createPart({
        code: PART_CODE,
        name: '测试机油 5W-30',
        category: '机油',
        brand: '测试品牌',
        unit: '瓶',
        costPrice: 50,
        salePrice: 120,
        minStock: 5,
      });
      ok('Create Part', `id=${part.id}, code=${part.code}`);
    }
  } catch (e) {
    fail('Find/Create Part', e);
  }

  // 2c. Check stock and stock-in if needed
  if (part) {
    try {
      const balances = await getStockBalances(part.id);
      const balList = Array.isArray(balances) ? balances : [];
      const currentQty = balList.length > 0 ? Number(balList[0].quantity ?? 0) : 0;
      log(`  Current stock for ${PART_CODE}: ${currentQty}`);

      if (currentQty <= 0) {
        await stockIn({
          shopId,
          items: [{ partId: part.id, quantity: 10, unitPrice: 50 }],
        });
        ok('Stock In (10 units)', 'Completed');
      } else {
        ok('Stock Check', `Sufficient: ${currentQty} units`);
      }
    } catch (e) {
      fail('Stock In', e);
    }
  } else {
    fail('Stock In', 'Skipped — no part');
  }

  // 2d. Create Work Order
  let workOrder: any;
  if (customer && vehicle && part) {
    try {
      workOrder = await createWorkOrder({
        shopId,
        orderType: 'repair',
        customerId: customer.id,
        vehicleId: vehicle.id,
        description: '常规保养 + 换机油',
        items: [
          {
            itemType: 'service',
            name: '常规保养工时',
            quantity: 1,
            unit: '次',
            unitPrice: 200,
          },
          {
            itemType: 'part',
            name: '测试机油 5W-30',
            serviceItemId: part.id,
            quantity: 2,
            unit: '瓶',
            unitPrice: 120,
          },
        ],
      });
      ok('Create Work Order', `id=${workOrder.id}, orderNo=${workOrder.orderNo}, total=${workOrder.totalAmount}`);
    } catch (e) {
      fail('Create Work Order', e);
    }
  } else {
    fail('Create Work Order', 'Skipped — missing customer/vehicle/part');
  }

  // 2e. Status transitions: draft → confirmed → in_progress → completed
  if (workOrder) {
    for (const status of ['confirmed', 'in_progress', 'completed']) {
      try {
        await updateWorkOrderStatus(workOrder.id, status);
        ok(`Status → ${status}`, 'Transition succeeded');
      } catch (e) {
        fail(`Status → ${status}`, e);
      }
    }
  }

  // ────────────────────── SPRINT 3 ──────────────────────
  console.log('\n── Sprint 3: Stock Out & Settlement ──');

  // 3a. Stock out for work order
  if (workOrder) {
    try {
      const stockBefore = await getStockBalances(part!.id);
      const qtyBefore = stockBefore.length > 0 ? Number(stockBefore[0].quantity ?? 0) : 0;
      log(`  Stock before out: ${qtyBefore}`);

      await stockOutForWorkOrder(workOrder.id);
      ok('Stock Out for Work Order', 'Completed');

      const stockAfter = await getStockBalances(part!.id);
      const qtyAfter = stockAfter.length > 0 ? Number(stockAfter[0].quantity ?? 0) : 0;
      log(`  Stock after out: ${qtyAfter} (deducted ${qtyBefore - qtyAfter})`);

      if (qtyBefore - qtyAfter === 2) {
        ok('Stock Deduction Verified', `2 units deducted correctly`);
      } else {
        fail('Stock Deduction Verified', `Expected deduction of 2, got ${qtyBefore - qtyAfter}`);
      }
    } catch (e) {
      fail('Stock Out for Work Order', e);
    }
  }

  // 3b. Settle the work order
  if (workOrder) {
    try {
      const total = Number(workOrder.totalAmount ?? 440);
      const settlement = await settle({
        workOrderId: workOrder.id,
        payments: [{ payMethod: 'cash', amount: total }],
      });
      ok('Settle Work Order', `settleNo=${settlement.settleNo}, paid=${settlement.paidAmount}`);

      // Verify work order is settled
      const wo = await getWorkOrder(workOrder.id);
      if (wo.status === 'settled') {
        ok('Verify Settled Status', `Work order status = ${wo.status}`);
      } else {
        fail('Verify Settled Status', `Expected 'settled', got '${wo.status}'`);
      }
    } catch (e) {
      fail('Settle Work Order', e);
    }
  }

  // ────────────────────── SUMMARY ──────────────────────
  printSummary(start);

  // Cleanup
  await prisma.$disconnect();
}

function printSummary(start: number) {
  const elapsed = ((Date.now() - start) / 1000).toFixed(2);
  console.log('\n' + '='.repeat(60));
  console.log(`  Results: ${passed} passed, ${failed} failed  (${elapsed}s)`);
  console.log('='.repeat(60));
  if (failures.length > 0) {
    console.log('\n  Failures:');
    failures.forEach((f, i) => console.log(`    ${i + 1}. ${f}`));
  }
  console.log();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  prisma.$disconnect().finally(() => process.exit(1));
});
