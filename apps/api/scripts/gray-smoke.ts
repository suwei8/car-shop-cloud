#!/usr/bin/env node

/**
 * Gray-acceptance smoke test — lightweight API chain validation.
 *
 * Default mode: READ-ONLY (exits immediately when no API is reachable).
 * Set SMOKE_ALLOW_WRITE=1 to enable write operations (customer, vehicle, stock, work-order, settlement).
 *
 * Usage:
 *   pnpm --filter @car/api smoke:gray
 *   SMOKE_ALLOW_WRITE=1 API_BASE_URL=http://127.0.0.1:3000/api pnpm --filter @car/api smoke:gray
 *
 * Required env:
 *   API_BASE_URL  – e.g. http://127.0.0.1:3000/api
 *
 * Optional env:
 *   SMOKE_ALLOW_WRITE=1   Enable write operations
 *   SMOKE_PHONE           Login phone (default: 18800000001)
 *   SMOKE_PASSWORD        Login password (default: Test123456)
 *   SMOKE_SHOP_NAME       Shop name for lookup (default: 灰度验收门店)
 */

const API_BASE_URL = process.env.API_BASE_URL;
const ALLOW_WRITE = process.env.SMOKE_ALLOW_WRITE === '1';
const PHONE = process.env.SMOKE_PHONE || '18800000001';
const PASSWORD = process.env.SMOKE_PASSWORD || 'Test123456';
const SHOP_NAME = process.env.SMOKE_SHOP_NAME || '灰度验收门店';
const SIMPLE_MODE = process.env.SMOKE_SIMPLE_MODE !== '0';

let stepNum = 0;
let passed = 0;
let failed = 0;
let skipped = 0;
const createdIds: Record<string, string> = {};

function log(msg: string) {
  console.log(msg);
}

function stepResult(ok: boolean, label: string, detail?: string) {
  stepNum++;
  const icon = ok ? '✅' : '❌';
  if (ok) passed++; else failed++;
  log(`  ${icon} Step ${stepNum}: ${label}`);
  if (detail) log(`     ${detail}`);
}

function skip(label: string, reason: string) {
  stepNum++;
  skipped++;
  log(`  ⏭  Step ${stepNum}: ${label} (SKIPPED: ${reason})`);
}

async function api(method: string, path: string, body?: unknown, token?: string): Promise<{ status: number; data: any }> {
  const url = `${API_BASE_URL}${path}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const resp = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data: any;
  const text = await resp.text();
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: resp.status, data };
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  log('');
  log('═══════════════════════════════════════════════');
  log('  Gray Acceptance Smoke Test');
  log(`  API: ${API_BASE_URL || '(not set)'}`);
  log(`  Mode: ${ALLOW_WRITE ? 'WRITE' : 'READ-ONLY'}`);
  log(`  Work order flow: ${SIMPLE_MODE ? 'SIMPLE' : 'STANDARD'}`);
  log('═══════════════════════════════════════════════\n');

  if (process.env.SMOKE_COMPILE_ONLY === '1') {
    log('SMOKE_COMPILE_ONLY=1 — script loaded successfully; skipping API calls.');
    process.exit(0);
  }

  if (!API_BASE_URL) {
    log('ERROR: API_BASE_URL is not set.');
    log('Usage: API_BASE_URL=http://127.0.0.1:3000/api pnpm --filter @car/api smoke:gray');
    process.exit(1);
  }

  // ── Step 1: Health check ──
  try {
    const r = await api('GET', '/health');
    stepResult(r.status === 200, 'Health check', `HTTP ${r.status}`);
    if (r.status !== 200) {
      log('\n  API is not reachable or unhealthy. Aborting.\n');
      printSummary();
      process.exit(1);
    }
  } catch (e: any) {
    stepResult(false, 'Health check', `Connection failed: ${e.message}`);
    log('\n  Cannot reach API. Ensure the server is running.\n');
    printSummary();
    process.exit(1);
  }

  // ── Step 2: Login ──
  let token = '';
  try {
    const r = await api('POST', '/auth/login', { phone: PHONE, password: PASSWORD });
    const ok = r.status === 200 && r.data?.data?.accessToken;
    stepResult(ok, 'Login', `HTTP ${r.status}`);
    if (ok) {
      token = r.data.data.accessToken;
    } else {
      log(`     Response: ${JSON.stringify(r.data).slice(0, 200)}`);
    }
  } catch (e: any) {
    stepResult(false, 'Login', e.message);
  }

  if (!token) {
    log('\n  Cannot proceed without auth token. Aborting.\n');
    printSummary();
    process.exit(1);
  }

  // ── Step 3: Get current user ──
  try {
    const r = await api('POST', '/auth/me', undefined, token);
    const ok = r.status === 200 && r.data?.data?.tenantId;
    stepResult(ok, 'Get current user', `HTTP ${r.status}, tenantId=${r.data?.data?.tenantId || 'N/A'}`);
    if (ok) {
      createdIds.tenantId = r.data.data.tenantId;
      createdIds.currentUserId = r.data.data.sub || r.data.data.id;
    }
  } catch (e: any) {
    stepResult(false, 'Get current user', e.message);
  }

  if (!ALLOW_WRITE) {
    log('\n  READ-ONLY mode — skipping write operations.\n');
    skip('Create customer', 'SMOKE_ALLOW_WRITE not set');
    skip('Create vehicle', 'SMOKE_ALLOW_WRITE not set');
    skip('Create part', 'SMOKE_ALLOW_WRITE not set');
    skip('Create service item', 'SMOKE_ALLOW_WRITE not set');
    skip('Stock in', 'SMOKE_ALLOW_WRITE not set');
    skip('Create work order', 'SMOKE_ALLOW_WRITE not set');
    skip('Work order status progression', 'SMOKE_ALLOW_WRITE not set');
    skip('Stock out for work order', 'SMOKE_ALLOW_WRITE not set');
    skip('Settlement', 'SMOKE_ALLOW_WRITE not set');
    skip('Query warranty', 'SMOKE_ALLOW_WRITE not set');
    skip('Query subscription plans', 'SMOKE_ALLOW_WRITE not set');
    skip('Query subscription current', 'SMOKE_ALLOW_WRITE not set');
    printSummary();
    process.exit(0);
  }

  // ── Step 4: Find shop ──
  let shopId = '';
  try {
    const r = await api('GET', '/shops', undefined, token);
    const ok = r.status === 200;
    stepResult(ok, 'Query shops', `HTTP ${r.status}`);
    if (ok && Array.isArray(r.data?.data)) {
      const shops = r.data.data;
      const match = shops.find((s: any) => s.name === SHOP_NAME) || shops[0];
      if (match) {
        shopId = match.id;
        createdIds.shopId = shopId;
        log(`     Found shop: ${match.name} (${shopId})`);
      } else if (shops.length > 0) {
        shopId = shops[0].id;
        createdIds.shopId = shopId;
        log(`     Using first shop: ${shops[0].name} (${shopId})`);
      }
    }
  } catch (e: any) {
    stepResult(false, 'Query shops', e.message);
  }

  if (!shopId) {
    log('\n  No shop found. Ensure a tenant/shop exists. Aborting write flow.\n');
    printSummary();
    process.exit(1);
  }

  // ── Step 5: Create customer ──
  let customerId = '';
  try {
    const customerPhone = `139${String(Date.now()).slice(-8)}`;
    const r = await api('POST', '/customers', {
      name: `灰度测试客户_${Date.now()}`,
      phone: customerPhone,
      gender: 'male',
    }, token);
    const ok = r.status >= 200 && r.status < 300 && r.data?.data?.id;
    stepResult(ok, 'Create customer', `HTTP ${r.status}`);
    if (ok) {
      customerId = r.data.data.id;
      createdIds.customerId = customerId;
    } else {
      log(`     Response: ${JSON.stringify(r.data).slice(0, 200)}`);
    }
  } catch (e: any) {
    stepResult(false, 'Create customer', e.message);
  }

  // ── Step 6: Create vehicle ──
  let vehicleId = '';
  if (customerId) {
    try {
      const r = await api('POST', '/vehicles', {
        customerId,
        plateNo: `京A${String(Date.now()).slice(-5)}`,
        brand: '大众',
        model: '帕萨特',
        mileage: 50000,
      }, token);
      const ok = r.status >= 200 && r.status < 300 && r.data?.data?.id;
      stepResult(ok, 'Create vehicle', `HTTP ${r.status}`);
      if (ok) {
        vehicleId = r.data.data.id;
        createdIds.vehicleId = vehicleId;
      } else {
        log(`     Response: ${JSON.stringify(r.data).slice(0, 200)}`);
      }
    } catch (e: any) {
      stepResult(false, 'Create vehicle', e.message);
    }
  } else {
    skip('Create vehicle', 'No customerId');
  }

  // ── Step 7: Create part ──
  let partId = '';
  try {
    const ts = Date.now();
    const r = await api('POST', '/parts', {
      code: `SMOKE-${ts}`,
      name: '机油滤芯',
      category: '保养件',
      brand: '曼牌',
      unit: '个',
      costPrice: 25,
      salePrice: 45,
      minStock: 5,
      warrantyMonths: 6,
    }, token);
    const ok = r.status >= 200 && r.status < 300 && r.data?.data?.id;
    stepResult(ok, 'Create part', `HTTP ${r.status}`);
    if (ok) {
      partId = r.data.data.id;
      createdIds.partId = partId;
    } else {
      log(`     Response: ${JSON.stringify(r.data).slice(0, 200)}`);
    }
  } catch (e: any) {
    stepResult(false, 'Create part', e.message);
  }

  // ── Step 8: Create service item ──
  let serviceItemId = '';
  try {
    const r = await api('POST', '/service-items', {
      name: '常规保养',
      category: 'maintenance',
      unitPrice: 80,
    }, token);
    const ok = r.status >= 200 && r.status < 300 && r.data?.data?.id;
    stepResult(ok, 'Create service item', `HTTP ${r.status}`);
    if (ok) {
      serviceItemId = r.data.data.id;
      createdIds.serviceItemId = serviceItemId;
    } else {
      log(`     Response: ${JSON.stringify(r.data).slice(0, 200)}`);
    }
  } catch (e: any) {
    stepResult(false, 'Create service item', e.message);
  }

  // ── Step 9: Stock in ──
  if (partId && shopId) {
    try {
      const r = await api('POST', '/stock/in', {
        shopId,
        items: [{ partId, quantity: 20, unitPrice: 25 }],
      }, token);
      const ok = r.status >= 200 && r.status < 300;
      stepResult(ok, 'Stock in', `HTTP ${r.status}`);
      if (!ok) log(`     Response: ${JSON.stringify(r.data).slice(0, 200)}`);
    } catch (e: any) {
      stepResult(false, 'Stock in', e.message);
    }
  } else {
    skip('Stock in', 'Missing partId or shopId');
  }

  // ── Step 10: Query stock balances ──
  try {
    const r = await api('GET', '/stock/balances', undefined, token);
    stepResult(r.status === 200, 'Query stock balances', `HTTP ${r.status}`);
  } catch (e: any) {
    stepResult(false, 'Query stock balances', e.message);
  }

  // ── Step 11: Create work order ──
  let workOrderId = '';
  if (shopId && customerId && vehicleId) {
    try {
      const items: any[] = [];
      if (serviceItemId) {
        items.push({
          itemType: 'service',
          serviceItemId,
          name: '常规保养',
          quantity: 1,
          unitPrice: 80,
        });
      }
      if (partId) {
        items.push({ itemType: 'part', partId, name: '机油滤芯', quantity: 1, unitPrice: 45 });
      }
      const r = await api('POST', '/work-orders', {
        shopId,
        orderType: 'maintenance',
        customerId,
        vehicleId,
        description: '灰度验收常规保养',
        items,
      }, token);
      const ok = r.status >= 200 && r.status < 300 && r.data?.data?.id;
      stepResult(ok, 'Create work order', `HTTP ${r.status}`);
      if (ok) {
        workOrderId = r.data.data.id;
        createdIds.workOrderId = workOrderId;
      } else {
        log(`     Response: ${JSON.stringify(r.data).slice(0, 200)}`);
      }
    } catch (e: any) {
      stepResult(false, 'Create work order', e.message);
    }
  } else {
    skip('Create work order', 'Missing shopId/customerId/vehicleId');
  }

  // ── Step 12: Work order status progression ──
  if (workOrderId) {
    const statuses = SIMPLE_MODE
      ? ['confirmed', 'completed']
      : ['confirmed', 'in_progress', 'completed'];
    for (const status of statuses) {
      try {
        const r = await api('PUT', `/work-orders/${workOrderId}/status`, { status }, token);
        stepResult(r.status === 200, `Work order → ${status}`, `HTTP ${r.status}`);
      } catch (e: any) {
        stepResult(false, `Work order → ${status}`, e.message);
      }
    }
  } else {
    skip('Work order status progression', 'No workOrderId');
  }

  // ── Step 13: Stock out for work order ──
  if (workOrderId && SIMPLE_MODE) {
    skip('Stock out for work order', 'Simple mode deducts stock on completed status');
  } else if (workOrderId) {
    try {
      const r = await api('POST', `/stock/out/work-order/${workOrderId}`, undefined, token);
      const ok = r.status >= 200 && r.status < 300;
      stepResult(ok, 'Stock out for work order', `HTTP ${r.status}`);
      if (!ok) log(`     Response: ${JSON.stringify(r.data).slice(0, 200)}`);
    } catch (e: any) {
      stepResult(false, 'Stock out for work order', e.message);
    }
  } else {
    skip('Stock out for work order', 'No workOrderId');
  }

  // ── Step 14: Query stock movements ──
  try {
    const r = await api('GET', '/stock/movements', undefined, token);
    stepResult(r.status === 200, 'Query stock movements', `HTTP ${r.status}`);
  } catch (e: any) {
    stepResult(false, 'Query stock movements', e.message);
  }

  // ── Step 15: Settlement ──
  let settlementId = '';
  if (workOrderId) {
    try {
      const r = await api('POST', '/settlements', {
        workOrderId,
        payments: [{ payMethod: 'cash', amount: 125 }],
      }, token);
      const ok = r.status >= 200 && r.status < 300 && r.data?.data?.id;
      stepResult(ok, 'Settlement', `HTTP ${r.status}`);
      if (ok) {
        settlementId = r.data.data.id;
        createdIds.settlementId = settlementId;
      } else {
        log(`     Response: ${JSON.stringify(r.data).slice(0, 200)}`);
      }
    } catch (e: any) {
      stepResult(false, 'Settlement', e.message);
    }
  } else {
    skip('Settlement', 'No workOrderId');
  }

  // ── Step 16: Query settlement details ──
  if (settlementId) {
    try {
      const r = await api('GET', `/settlements/${settlementId}`, undefined, token);
      stepResult(r.status === 200, 'Query settlement detail', `HTTP ${r.status}`);
    } catch (e: any) {
      stepResult(false, 'Query settlement detail', e.message);
    }

    try {
      const r = await api('GET', `/settlements/${settlementId}/payment-status`, undefined, token);
      stepResult(r.status === 200, 'Query payment status', `HTTP ${r.status}`);
    } catch (e: any) {
      stepResult(false, 'Query payment status', e.message);
    }
  } else {
    skip('Query settlement detail', 'No settlementId');
    skip('Query payment status', 'No settlementId');
  }

  // ── Step 17: Query settlement payments ──
  try {
    const r = await api('GET', '/settlements/payments', undefined, token);
    stepResult(r.status === 200, 'Query payment records', `HTTP ${r.status}`);
  } catch (e: any) {
    stepResult(false, 'Query payment records', e.message);
  }

  // ── Step 18: Query warranty ──
  if (vehicleId) {
    try {
      const r = await api('GET', `/warranty/vehicle/${vehicleId}`, undefined, token);
      stepResult(r.status === 200, 'Query vehicle warranty', `HTTP ${r.status}`);
    } catch (e: any) {
      stepResult(false, 'Query vehicle warranty', e.message);
    }
  } else {
    skip('Query vehicle warranty', 'No vehicleId');
  }

  if (customerId) {
    try {
      const r = await api('GET', `/warranty/customer/${customerId}`, undefined, token);
      stepResult(r.status === 200, 'Query customer warranty', `HTTP ${r.status}`);
    } catch (e: any) {
      stepResult(false, 'Query customer warranty', e.message);
    }
  } else {
    skip('Query customer warranty', 'No customerId');
  }

  // ── Step 19: Subscription plans ──
  try {
    const r = await api('GET', '/subscription/plans', undefined, token);
    stepResult(r.status === 200, 'Query subscription plans', `HTTP ${r.status}`);
  } catch (e: any) {
    stepResult(false, 'Query subscription plans', e.message);
  }

  // ── Step 20: Current subscription ──
  try {
    const r = await api('GET', '/subscription/current', undefined, token);
    stepResult(r.status === 200, 'Query current subscription', `HTTP ${r.status}`);
  } catch (e: any) {
    stepResult(false, 'Query current subscription', e.message);
  }

  // ── Step 21: Dashboard overview ──
  try {
    const r = await api('GET', '/dashboard/overview', undefined, token);
    stepResult(r.status === 200, 'Dashboard overview', `HTTP ${r.status}`);
  } catch (e: any) {
    stepResult(false, 'Dashboard overview', e.message);
  }

  // ── Step 22: Recent orders ──
  try {
    const r = await api('GET', '/dashboard/recent-orders', undefined, token);
    stepResult(r.status === 200, 'Recent orders', `HTTP ${r.status}`);
  } catch (e: any) {
    stepResult(false, 'Recent orders', e.message);
  }

  // ── Step 23: Work order list ──
  try {
    const r = await api('GET', '/work-orders', undefined, token);
    stepResult(r.status === 200, 'Query work orders', `HTTP ${r.status}`);
  } catch (e: any) {
    stepResult(false, 'Query work orders', e.message);
  }

  printSummary();

  // Dump created IDs for reference
  if (Object.keys(createdIds).length > 0) {
    log('\n  Created IDs (for manual verification):');
    for (const [k, v] of Object.entries(createdIds)) {
      log(`    ${k}: ${v}`);
    }
  }

  log('');
  process.exit(failed > 0 ? 1 : 0);
}

function printSummary() {
  log('');
  log('═══════════════════════════════════════════════');
  log(`  Summary: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  log('═══════════════════════════════════════════════');
}

main().catch((e) => {
  log(`\n  FATAL: ${e.message}`);
  process.exit(1);
});
