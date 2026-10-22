const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

// Exercise actual TS modules in memory with isolated Shopify and database dependencies.
function load(relativePath, mocks = {}) {
  const filename = path.join(root, relativePath);
  const module = { exports: {} };
  const requireFile = createRequire(filename);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  new Function('require', 'module', 'exports', source)(
    (request) => Object.hasOwn(mocks, request) ? mocks[request] : requireFile(request), module, module.exports,
  );
  return module.exports;
}
const phone = load('lib/phone.ts');
const { NextRequest, NextResponse } = require('next/server');
const next = { NextRequest, NextResponse };
const bosnian = '+387 60 12 34 567';

test('Bosnian international formats normalize consistently, including shorter mobile and landline numbers', () => {
  for (const input of [bosnian, '+387601234567', '00387 60/123-4567', '387601234567']) {
    assert.equal(phone.normalizePhone(input), '387601234567', input);
  }
  assert.equal(phone.normalizePhone('+387 61 234 567'), '38761234567');
  assert.equal(phone.normalizePhone('+387 33 123 456'), '38733123456');
});

test('Serbian international, local and missing-leading-zero formats retain their existing behavior', () => {
  for (const input of ['+381 64 123 4567', '00381641234567', '381641234567', '0641234567', '064/123-4567', '641234567']) {
    assert.equal(phone.normalizePhone(input), '381641234567', input);
  }
  assert.equal(phone.normalizePhone('0601234567'), '381601234567');
});

test('unsupported Bosnian lengths and international trunk zeros are rejected', () => {
  for (const input of ['', '123', '+387', '+387 60 12345', '+387 60 12345678', '+387 060 1234567']) {
    assert.equal(phone.normalizePhone(input), null, input);
  }
});

test('phone matching preserves the country code and rejects different or invalid numbers', () => {
  assert.equal(phone.phonesMatch(bosnian, '00387601234567'), true);
  assert.equal(phone.phonesMatch('+381641234567', '0641234567'), true);
  assert.equal(phone.phonesMatch(bosnian, '+381601234567'), false);
  assert.equal(phone.phonesMatch(bosnian, '0601234567'), false);
  assert.equal(phone.phonesMatch(bosnian, '+387601234568'), false);
  assert.equal(phone.phonesMatch('123', '123'), false);
});

function lookup(orderPhone = bosnian, shippingPhone = null) {
  const calls = [];
  const node = { id: 'gid://shopify/Order/100', name: '#1234', phone: orderPhone, email: 'test@example.com',
    shippingAddress: { firstName: 'Test', lastName: 'Kupac', phone: shippingPhone, address1: 'Test 1', city: 'Test', zip: '71000', country: 'Bosnia and Herzegovina' },
    lineItems: { edges: [{ node: { id: 'line-1', title: 'Test', quantity: 1, sku: 'TEST', originalUnitPriceSet: { shopMoney: { amount: '1000' } },
      variant: { id: 'variant-1', title: '38', selectedOptions: [{ name: 'Size', value: '38' }], image: null, product: { id: 'product-1', featuredImage: null } } } }] } };
  const orders = load('lib/shopify/orders.ts', {
    '../phone': phone, './sizeUtils': load('lib/shopify/sizeUtils.ts'),
    './client': { shopifyGraphQL: async (_query, variables) => {
      calls.push(variables); return { orders: { edges: [{ node }] } };
    } },
  });
  const route = load('app/api/orders/lookup/route.ts', {
    'next/server': next, '@/lib/shopify/orders': orders,
    '@/lib/rateLimiter': { checkRateLimit: () => ({ allowed: true }), sweepExpiredBuckets: () => {} },
    '@/lib/demo': { isDemoMode: () => false },
  });
  return { route, calls };
}
function request(body) {
  return new NextRequest('https://backend.test/api/test', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
}

test('order lookup verifies a Bosnian number from either order-level phone field', async () => {
  for (const [orderPhone, shippingPhone] of [[bosnian, null], [null, bosnian]]) {
    const { route, calls } = lookup(orderPhone, shippingPhone);
    const result = await route.POST(request({ orderNumber: '1234', phone: '00387601234567' }));
    assert.equal(result.status, 200);
    assert.equal((await result.json()).order.orderNumber, '1234');
    assert.deepEqual(calls, [{ query: 'name:#1234' }]);
  }
});

test('lookup rejects a different subscriber or country, and skips Shopify for invalid lengths', async () => {
  for (const input of ['+387601234568', '+381601234567', '+3876012345']) {
    const { route, calls } = lookup();
    const result = await route.POST(request({ orderNumber: '1234', phone: input }));
    assert.equal(result.status, 404);
    assert.match((await result.json()).error, /Porudžbina nije pronađena/);
    assert.equal(calls.length, phone.normalizePhone(input) ? 1 : 0);
  }
});

test('ticket submission accepts Bosnian and Serbian phones and preserves the supplied country code', async () => {
  const inserts = [];
  const route = load('app/api/tickets/route.ts', {
    'next/server': next, '@/lib/phone': phone,
    '@/lib/bankAccount': load('lib/bankAccount.ts'), '@/lib/constants': load('lib/constants.ts'),
    '@/lib/demo': { isDemoMode: () => false },
    '@/lib/supabase/server': { createSupabaseServiceRoleClient: () => ({ from: (table) => ({
      insert: (row) => {
        inserts.push({ table, row });
        if (table === 'tickets') return { select: () => ({ single: async () => ({ data: { id: 'test-ticket', ticket_number: 'TEST-ONLY' }, error: null }) }) };
        return Promise.resolve({ error: null });
      },
    }) }) },
  });
  const payload = { type: 'ZAMENA', orderId: 'test-order', orderNumber: '1234', customerName: 'Test', email: 'test@example.com',
    shippingAddress: { address1: 'Test 1' }, items: [{ exchangeVariantId: 'test-variant' }], imagePaths: ['test/receipt.jpg', 'test/product.jpg'] };
  for (const input of [bosnian, '00387601234567', '+38761234567', '0641234567']) {
    inserts.length = 0;
    const result = await route.POST(request({ ...payload, phone: input }));
    assert.equal(result.status, 201, input);
    assert.equal(inserts.find((entry) => entry.table === 'tickets').row.phone, input);
    assert.deepEqual(inserts.map((entry) => entry.table), ['tickets', 'ticket_items', 'ticket_images']);
  }
  inserts.length = 0;
  const result = await route.POST(request({ ...payload, phone: '+3876012345' }));
  assert.equal(result.status, 400);
  assert.equal((await result.json()).error, 'Neispravan broj telefona.');
  assert.deepEqual(inserts, []);
});
