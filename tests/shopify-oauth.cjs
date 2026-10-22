const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

// Compile the actual TS modules in memory. Every HTTP/database/admin dependency is isolated.
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  return originalResolve.call(this, request.startsWith('@/') ? path.join(root, request.slice(2)) : request, ...args);
};
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
}).outputText, filename);
require.extensions['.tsx'] = require.extensions['.ts'];

let admin, allowed, failDatabase, httpHandler;
const rows = new Map();
let calls = [];
const identity = row => `${row.shop}:${row.client_id}`;
class Query {
  constructor() { this.operation = 'select'; this.conditions = []; }
  select() { return this; }
  match(values) { this.conditions.push(row => Object.entries(values).every(([key, value]) => row[key] === value)); return this; }
  eq(key, value) { return this.match({ [key]: value }); }
  or(expression) {
    const cutoff = expression.split('.lt.')[1];
    this.conditions.push(row => row.refresh_lock_until == null || row.refresh_lock_until < cutoff);
    return this;
  }
  update(values) { this.operation = 'update'; this.values = values; return this; }
  upsert(values) { this.operation = 'upsert'; this.values = values; return this; }
  execute() {
    if (failDatabase) return { data: null, error: { code: '42501' } };
    if (this.operation === 'upsert') {
      const record = { ...rows.get(identity(this.values)), ...structuredClone(this.values) };
      rows.set(identity(record), record);
      return { data: structuredClone(record), error: null };
    }
    const matched = Array.from(rows.values()).filter(row => this.conditions.every(predicate => predicate(row)));
    if (this.operation === 'update') matched.forEach(row => Object.assign(row, structuredClone(this.values)));
    return { data: matched.length ? structuredClone(matched[0]) : null, error: null };
  }
  maybeSingle() { return Promise.resolve(this.execute()); }
  single() { return this.maybeSingle(); }
  then(resolve, reject) { return Promise.resolve(this.execute()).then(resolve, reject); }
}
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  const resolved = Module._resolveFilename(request, parent, isMain);
  if (resolved === path.join(root, 'lib/supabase/server.ts')) return { createSupabaseServiceRoleClient: () => ({ from: name => {
    assert.equal(name, 'shopify_oauth_connections'); return new Query();
  } }) };
  if (resolved === path.join(root, 'lib/supabase/requireUser.ts')) return { getAuthenticatedAdmin: async () => admin };
  if (resolved === path.join(root, 'lib/adminPanel.ts')) return { isPanelAdmin: async () => allowed };
  return originalLoad.call(this, request, parent, isMain);
};
global.fetch = async (url, options) => {
  calls.push({ url: String(url), options });
  if (!httpHandler) throw new Error('Unexpected HTTP request: network disabled in tests');
  return httpHandler(String(url), options);
};

const { Session, HttpResponseError } = require('@shopify/shopify-api');
const { NextRequest } = require('next/server');
const shops = require('../lib/shopify/shops.ts');
const oauth = require('../lib/shopify/oauth.ts');
const encryption = require('../lib/shopify/oauth-crypto.ts');
const { createOAuthConnectionStore } = require('../lib/shopify/oauth-storage.ts');
const { resolveOAuthAccess, getOAuthAccess, ShopifyReconnectRequired } = require('../lib/shopify/oauth-tokens.ts');
const startRoute = require('../app/api/shopify/auth/route.ts');
const callbackRoute = require('../app/api/shopify/auth/callback/route.ts');
const { shopifyGraphQLForShop } = require('../lib/shopify/client.ts');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36';
const appOrigin = 'https://backend.example.com';
const shop = { id: 'test.myshopify.com', domain: 'test.myshopify.com', name: 'Test', clientId: 'test-client', clientSecret: 'test-secret', authMode: 'oauth' };
const otherShop = { ...shop, id: 'other.myshopify.com', domain: 'other.myshopify.com' };
const store = createOAuthConnectionStore();

function session(token = 'access-test-only', expiresIn = 3600) {
  return new Session({ id: `offline_${shop.domain}`, shop: shop.domain, state: '', isOnline: false,
    scope: oauth.SHOPIFY_SCOPES.join(','), accessToken: token, refreshToken: `refresh-${token}`,
    expires: new Date(Date.now() + expiresIn * 1000), refreshTokenExpires: new Date(Date.now() + 90 * 86400000) });
}
async function seed(expiringSession = session()) {
  await store.save(shop, expiringSession);
  return rows.get(identity({ shop: shop.domain, client_id: shop.clientId }));
}
function cookies(response) {
  return response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
}
async function begin(domain = shop.domain, origin = appOrigin) {
  return startRoute.POST(new NextRequest(`${appOrigin}/api/shopify/auth`, {
    method: 'POST', headers: { origin, 'user-agent': UA }, body: new URLSearchParams({ shop: domain }),
  }));
}
function callbackRequest(start, overrides = {}) {
  const state = new URL(start.headers.get('location')).searchParams.get('state');
  const query = { code: 'single-use-code', shop: shop.domain, state, timestamp: String(Math.floor(Date.now() / 1000)), ...overrides };
  const encoded = new URLSearchParams(Object.entries(query).sort(([a], [b]) => a.localeCompare(b))).toString().replace(/\+/g, '%20');
  query.hmac = crypto.createHmac('sha256', shop.clientSecret).update(encoded).digest('hex');
  return new NextRequest(`${appOrigin}${oauth.OAUTH_CALLBACK_PATH}?${new URLSearchParams(query)}`, {
    headers: { cookie: cookies(start), 'user-agent': UA },
  });
}
function tokenResponse(token = 'new-access-test-only') {
  return Response.json({ access_token: token, refresh_token: `refresh-${token}`, expires_in: 3600,
    refresh_token_expires_in: 90 * 86400, scope: oauth.SHOPIFY_SCOPES.join(',') });
}

test.beforeEach(() => {
  rows.clear(); calls = []; failDatabase = false; httpHandler = undefined;
  admin = { id: 'authorized-admin-id', email: 'admin@example.com' }; allowed = true;
  process.env.SHOPIFY_STORE_DOMAIN = shop.domain;
  process.env.SHOPIFY_CLIENT_ID = shop.clientId;
  process.env.SHOPIFY_CLIENT_SECRET = shop.clientSecret;
  process.env.SHOPIFY_AUTH_MODE = 'oauth';
  process.env.SHOPIFY_APP_URL = appOrigin;
  process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
  for (const key of ['SHOPIFY_STORE_DOMAIN_2', 'SHOPIFY_AUTH_MODE_2', 'SHOPIFY_ADMIN_TOKEN']) delete process.env[key];
});

test('only Shopify root domains and configured OAuth shops are accepted', () => {
  assert.equal(shops.normalizeShopDomain(' https://TEST.myshopify.com/ '), shop.domain);
  for (const value of ['evil.example', 'test.myshopify.com/anything', 'http://test.myshopify.com', 'https://user@test.myshopify.com', 'test.myshopify.com:9999']) {
    assert.throws(() => shops.normalizeShopDomain(value));
  }
  assert.throws(() => oauth.configuredOAuthShop(otherShop.domain));
  process.env.SHOPIFY_AUTH_MODE = 'client_credentials';
  assert.throws(() => oauth.configuredOAuthShop(shop.domain));
});

test('tokens are encrypted with random IVs and bound to both shop and app', () => {
  const original = session();
  const encrypted = encryption.encryptOAuthSession(original, shop);
  assert.notEqual(encrypted, encryption.encryptOAuthSession(original, shop));
  assert.ok(!encrypted.includes(original.accessToken));
  assert.ok(!encrypted.includes(original.refreshToken));
  assert.equal(encryption.decryptOAuthSession(encrypted, shop).accessToken, original.accessToken);
  assert.throws(() => encryption.decryptOAuthSession(encrypted, otherShop));
  assert.throws(() => encryption.decryptOAuthSession(encrypted, { ...shop, clientId: 'another-app' }));
  const parts = encrypted.split('.'); parts[3] = (parts[3][0] === 'A' ? 'B' : 'A') + parts[3].slice(1);
  assert.throws(() => encryption.decryptOAuthSession(parts.join('.'), shop));
  process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 8).toString('base64');
  assert.throws(() => encryption.decryptOAuthSession(encrypted, shop));
});

test('authorization requires an allowlisted administrator, canonical origin and available storage', async () => {
  admin = null; assert.equal((await begin()).status, 403);
  admin = { id: 'staff' }; allowed = false; assert.equal((await begin()).status, 403);
  allowed = true; assert.equal((await begin(shop.domain, 'https://evil.example')).status, 403);
  assert.equal((await begin(otherShop.domain)).status, 400);
  failDatabase = true; assert.equal((await begin()).status, 400);
  assert.equal(calls.length, 0);
});

test('SDK creates an offline authorization redirect and secure signed/bound cookies', async () => {
  const response = await begin(); assert.equal(response.status, 302);
  const location = new URL(response.headers.get('location'));
  assert.equal(location.origin, `https://${shop.domain}`);
  assert.equal(location.pathname, '/admin/oauth/authorize');
  assert.equal(location.searchParams.get('client_id'), shop.clientId);
  assert.equal(location.searchParams.get('redirect_uri'), appOrigin + oauth.OAUTH_CALLBACK_PATH);
  assert.equal(location.searchParams.get('grant_options[]'), '');
  assert.ok(!location.toString().includes(shop.clientSecret));
  for (const name of ['shopify_app_state=', 'shopify_app_state.sig=', `${oauth.OAUTH_BINDING_COOKIE}=`]) {
    const cookie = response.headers.getSetCookie().find(value => value.startsWith(name));
    assert.ok(cookie, name); assert.match(cookie, /secure/i); assert.match(cookie, /httponly/i); assert.match(cookie, /samesite=lax/i);
  }
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('valid callback exchanges the one-use code for expiring tokens and persists encrypted data', async () => {
  const start = await begin();
  httpHandler = (url, options) => {
    assert.equal(url, `https://${shop.domain}/admin/oauth/access_token`);
    const body = JSON.parse(options.body);
    assert.equal(body.code, 'single-use-code'); assert.equal(body.expiring, '1');
    assert.equal(body.client_secret, shop.clientSecret);
    return tokenResponse();
  };
  const response = await callbackRoute.GET(callbackRequest(start));
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), appOrigin + '/admin/shopify?connection=connected');
  const connection = await store.load(shop);
  assert.ok(connection); assert.ok(!JSON.stringify(connection).includes('new-access-test-only'));
  assert.equal(encryption.decryptOAuthSession(connection.encrypted_session, shop).accessToken, 'new-access-test-only');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.ok(![...response.headers.values()].join('').includes('new-access-test-only'));
});

test('callback rejects tampered HMAC, state, duplicate parameters and changed administrator before token exchange', async () => {
  const start = await begin();
  let request = callbackRequest(start); let url = new URL(request.url); url.searchParams.set('hmac', 'bad');
  assert.match((await callbackRoute.GET(new NextRequest(url, { headers: request.headers }))).headers.get('location'), /connection=failed/);
  assert.match((await callbackRoute.GET(callbackRequest(start, { state: 'wrong' }))).headers.get('location'), /connection=failed/);
  request = callbackRequest(start); url = new URL(request.url); url.searchParams.append('shop', otherShop.domain);
  assert.match((await callbackRoute.GET(new NextRequest(url, { headers: request.headers }))).headers.get('location'), /connection=failed/);
  admin = { ...admin, id: 'different-admin' };
  assert.match((await callbackRoute.GET(callbackRequest(start))).headers.get('location'), /connection=failed/);
  assert.equal(calls.length, 0); assert.equal(rows.size, 0);
});

test('callback rejects unsigned SDK state cookie and stale signed timestamp', async () => {
  const start = await begin(); const request = callbackRequest(start);
  const headers = new Headers(request.headers);
  headers.set('cookie', headers.get('cookie').split('; ').filter(value => !value.startsWith('shopify_app_state.sig=')).join('; '));
  assert.match((await callbackRoute.GET(new NextRequest(request.url, { headers }))).headers.get('location'), /connection=failed/);
  assert.match((await callbackRoute.GET(callbackRequest(start, { timestamp: '1' }))).headers.get('location'), /connection=failed/);
  assert.equal(calls.length, 0);
});

test('binding cookies expire and cannot move between administrators, shops or states', () => {
  const binding = oauth.createOAuthBinding(shop, admin.id, 'state');
  assert.equal(oauth.verifyOAuthBinding(binding, shop, admin.id, 'state'), true);
  assert.equal(oauth.verifyOAuthBinding(binding, shop, 'other-admin', 'state'), false);
  assert.equal(oauth.verifyOAuthBinding(binding, otherShop, admin.id, 'state'), false);
  assert.equal(oauth.verifyOAuthBinding(binding, shop, admin.id, 'wrong-state'), false);
  const realNow = Date.now; Date.now = () => realNow() + 61000;
  try { assert.equal(oauth.verifyOAuthBinding(binding, shop, admin.id, 'state'), false); }
  finally { Date.now = realNow; }
});

test('valid stored tokens are reused without an HTTP call or an in-memory-only dependency', async () => {
  await seed();
  assert.equal((await getOAuthAccess(shop)).token, 'access-test-only');
  assert.equal((await resolveOAuthAccess(shop, createOAuthConnectionStore(), () => assert.fail('refresh called'))).token, 'access-test-only');
  assert.equal(calls.length, 0);
  await assert.rejects(getOAuthAccess(otherShop), ShopifyReconnectRequired);
});

test('expired tokens rotate once across simultaneous requests and persist the new refresh token', async () => {
  await seed(session('expiring', 30)); let refreshes = 0;
  const refresh = async token => { refreshes++; assert.equal(token, 'refresh-expiring'); return session('rotated'); };
  const results = await Promise.all(Array.from({ length: 6 }, () => resolveOAuthAccess(shop, store, refresh)));
  assert.equal(refreshes, 1); assert.ok(results.every(value => value.token === 'rotated'));
  const row = await store.load(shop);
  assert.equal(encryption.decryptOAuthSession(row.encrypted_session, shop).refreshToken, 'refresh-rotated');
});

test('new merchant authorization wins over an in-flight refresh and stale 401 invalidation', async () => {
  const old = await seed(session('old', 30));
  const access = await resolveOAuthAccess(shop, store, async () => {
    await store.save(shop, session('reauthorized'));
    return session('superseded-refresh');
  });
  assert.equal(access.token, 'reauthorized');
  await store.invalidate(shop, old.revision);
  assert.equal((await store.load(shop)).reauthorization_required, false);
});

test('revoked refresh requires reconnection while transient failure preserves the connection', async () => {
  await seed(session('old', 30));
  await assert.rejects(resolveOAuthAccess(shop, store, async () => { throw new Error('temporary network error'); }), /trenutno ne može/);
  assert.equal((await store.load(shop)).reauthorization_required, false);
  await assert.rejects(resolveOAuthAccess(shop, store, async () => {
    throw new HttpResponseError({ code: 400, statusText: 'Bad Request', message: 'invalid_grant', body: { secret: 'never-log-this' } });
  }), ShopifyReconnectRequired);
  assert.equal((await store.load(shop)).reauthorization_required, true);
});

test('Shopify client uses OAuth and marks a revoked access token for reconnection', async () => {
  await seed();
  httpHandler = (_url, options) => {
    assert.equal(options.headers['X-Shopify-Access-Token'], 'access-test-only');
    return Response.json({ data: { products: [] } });
  };
  assert.deepEqual(await shopifyGraphQLForShop(shop, '{ products { id } }'), { products: [] });
  httpHandler = () => new Response('', { status: 401 });
  await assert.rejects(shopifyGraphQLForShop(shop, '{ products { id } }'), /401/);
  assert.equal((await store.load(shop)).reauthorization_required, true);
});

test('existing static and client-credentials modes work without OAuth storage/configuration', async () => {
  delete process.env.SHOPIFY_APP_URL; delete process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY; failDatabase = true;
  const legacy = { ...shop, authMode: 'client_credentials', adminToken: 'legacy-token' };
  httpHandler = (_url, options) => {
    assert.equal(options.headers['X-Shopify-Access-Token'], 'legacy-token'); return Response.json({ data: { ok: true } });
  };
  await shopifyGraphQLForShop(legacy, '{ shop { id } }');
  const owned = { ...otherShop, authMode: 'client_credentials', clientId: 'owned-app' };
  httpHandler = (url, options) => {
    if (url.endsWith('/access_token')) {
      assert.equal(options.body.get('grant_type'), 'client_credentials');
      return Response.json({ access_token: 'owned-token', expires_in: 86399 });
    }
    assert.equal(options.headers['X-Shopify-Access-Token'], 'owned-token'); return Response.json({ data: { ok: true } });
  };
  await shopifyGraphQLForShop(owned, '{ shop { id } }');
  await shopifyGraphQLForShop(owned, '{ shop { id } }');
  assert.equal(calls.filter(call => call.url.endsWith('/access_token')).length, 1);
});

test('migration is additive and excludes browser roles from connection tokens', () => {
  const sql = fs.readFileSync(path.join(root, 'supabase/migrations/0005_shopify_oauth.sql'), 'utf8');
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /revoke all[^;]+from public, anon, authenticated/i);
  assert.match(sql, /grant select, insert, update[^;]+to service_role/i);
  assert.doesNotMatch(sql, /drop\s|truncate\s|alter table public\.tickets/i);
});

test('SDK refresh grant renews and stores both tokens without merchant interaction', async () => {
  await seed(session('expiring-sdk', 30));
  httpHandler = (url, options) => {
    assert.equal(url, `https://${shop.domain}/admin/oauth/access_token`);
    const body = JSON.parse(options.body);
    assert.equal(body.grant_type, 'refresh_token');
    assert.equal(body.refresh_token, 'refresh-expiring-sdk');
    assert.equal(body.client_id, shop.clientId);
    return tokenResponse('sdk-rotated');
  };
  assert.equal((await getOAuthAccess(shop)).token, 'sdk-rotated');
  assert.equal(calls.length, 1);
  assert.equal(encryption.decryptOAuthSession((await store.load(shop)).encrypted_session, shop).refreshToken, 'refresh-sdk-rotated');
});

test('missing required scopes or expired refresh token requires reconnection', async () => {
  const incomplete = await seed();
  const withoutScopes = session(); withoutScopes.scope = 'read_products';
  incomplete.encrypted_session = encryption.encryptOAuthSession(withoutScopes, shop);
  await assert.rejects(getOAuthAccess(shop), ShopifyReconnectRequired);
  const expired = await seed();
  const stale = session('expired-refresh'); stale.expires = new Date(0); stale.refreshTokenExpires = new Date(0);
  expired.encrypted_session = encryption.encryptOAuthSession(stale, shop);
  await assert.rejects(getOAuthAccess(shop), ShopifyReconnectRequired);
  assert.equal(calls.length, 0);
});

test('callback cannot save incomplete token responses or report success after a database failure', async () => {
  const start = await begin();
  httpHandler = () => Response.json({ access_token: 'incomplete-access', scope: 'read_products' });
  assert.match((await callbackRoute.GET(callbackRequest(start))).headers.get('location'), /connection=failed/);
  assert.equal(rows.size, 0);
  httpHandler = () => tokenResponse(); failDatabase = true;
  assert.match((await callbackRoute.GET(callbackRequest(start))).headers.get('location'), /connection=failed/);
  assert.equal(rows.size, 0);
});

test('callback requires the initiating administrator and does not expose SDK error bodies', async () => {
  const start = await begin();
  admin = null;
  assert.equal((await callbackRoute.GET(callbackRequest(start))).status, 403);
  assert.equal(calls.length, 0);
  admin = { id: 'authorized-admin-id' }; allowed = false;
  assert.equal((await callbackRoute.GET(callbackRequest(start))).status, 403);
  allowed = true;
  httpHandler = () => Response.json({ error: 'invalid_grant', error_description: 'secret-test-only' }, { status: 400 });
  const captured = []; const originalError = console.error;
  console.error = (...args) => captured.push(args.join(' '));
  try {
    const response = await callbackRoute.GET(callbackRequest(start));
    assert.match(response.headers.get('location'), /connection=failed/);
    assert.ok(!JSON.stringify(captured).includes('secret-test-only'));
    assert.ok(!JSON.stringify(captured).includes(shop.clientSecret));
    assert.equal(await response.text(), '');
  } finally { console.error = originalError; }
});

test('stale refresh leases recover and active leases time out without overwriting a connection', async () => {
  const expired = await seed(session('recover', 30));
  expired.refresh_lock_id = 'abandoned'; expired.refresh_lock_until = new Date(0).toISOString();
  assert.equal((await resolveOAuthAccess(shop, store, async () => session('recovered'))).token, 'recovered');
  const busy = await seed(session('busy', 30));
  busy.refresh_lock_id = 'another-instance'; busy.refresh_lock_until = new Date(Date.now() + 60000).toISOString();
  await assert.rejects(resolveOAuthAccess(shop, store, () => assert.fail('parallel refresh'), async () => {}), /trenutno obnavlja/);
  assert.equal(rows.get(identity(busy)).refresh_lock_id, 'another-instance');
});

test('connection screen renders only safe status and gives an actionable storage/configuration failure', async () => {
  const page = require('../app/admin/shopify/page.tsx').default;
  const { renderToStaticMarkup } = require('react-dom/server');
  await seed();
  const html = renderToStaticMarkup(await page({ searchParams: { connection: 'connected' } }));
  assert.match(html, /Shopify veza je sačuvana/); assert.match(html, /Povezano/);
  assert.match(html, /action="\/api\/shopify\/auth"/);
  for (const value of ['access-test-only', 'refresh-access-test-only', shop.clientSecret, 'encrypted_session']) assert.ok(!html.includes(value));
  failDatabase = true; delete process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY;
  const failed = renderToStaticMarkup(await page({ searchParams: {} }));
  assert.match(failed, /migraciju 0005/); assert.match(failed, /SHOPIFY_TOKEN_ENCRYPTION_KEY/);
  assert.match(failed, /button[^>]+disabled/);
});

test('connection screen cannot be opened by a support user outside the allowlist', async () => {
  const page = require('../app/admin/shopify/page.tsx').default;
  allowed = false;
  await assert.rejects(page({ searchParams: {} }), error => error.digest?.includes('/admin/tiketi'));
});

test('OAuth with missing credentials fails closed and cannot fall back to legacy credentials', async () => {
  await seed();
  await assert.rejects(getOAuthAccess({ ...shop, clientId: undefined }), /Client ID/);
  await assert.rejects(getOAuthAccess({ ...shop, clientSecret: undefined }), /Client Secret/);
  await assert.rejects(store.load({ ...shop, clientId: undefined }), /Client ID/);
  await assert.rejects(shopifyGraphQLForShop({ ...shop, clientSecret: undefined, adminToken: 'legacy' }, '{ shop { id } }'), /Client Secret/);
  assert.equal(calls.length, 0);
});
