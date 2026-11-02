import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import worker, { EventBuffer } from '../src/index.js';

const ORIGIN = 'https://store.akash.app';
const HASH = 'a'.repeat(64);
const CART_HASH = 'be315c0fba6d18ada3e79416d3e07499ef49ca6a58fb0dada07ddaed7a4150ed';
const SESSION_ID = 'session_test_123';
const CART_ID = 'NM-ORDER-TEST';
const envBase = {
  ALLOWED_ORIGINS: `${ORIGIN},http://localhost:8080`,
  INTEGRATION_SOURCE: 'nano-motion-relay',
  VALIDATE_ONLY: 'true',
  OPENAI_PIXEL_ID: 'px_test',
  OPENAI_CONVERSIONS_API_KEY: 'sk_test',
};

let upstreamCalls;
let upstreamStatuses;
let queueMessages;
let buffers;
let env;
let now;
let originalDateNow;

class MemoryStorage {
  constructor() {
    this.values = new Map();
    this.alarmAt = null;
  }

  async get(key) { return this.values.get(key); }
  async put(key, value) { this.values.set(key, structuredClone(value)); }
  async delete(key) { return this.values.delete(key); }
  async deleteAll() { this.values.clear(); }
  async list({ prefix = '' } = {}) {
    return new Map([...this.values.entries()].filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => [key, structuredClone(value)]));
  }
  async setAlarm(timestamp) { this.alarmAt = timestamp; }
  async getAlarm() { return this.alarmAt; }
  async deleteAlarm() { this.alarmAt = null; }
}

function makeEnv(overrides = {}) {
  env = { ...envBase, ...overrides };
  buffers = new Map();
  queueMessages = [];
  env.CAPI_OUTBOUND = { send: async (message) => queueMessages.push(structuredClone(message)) };
  env.EVENT_BUFFER = {
    idFromName(name) { return `named:${name}`; },
    idFromString(id) { return id; },
    get(id) {
      const key = String(id);
      if (!buffers.has(key)) {
        const storage = new MemoryStorage();
        const object = new EventBuffer({ id: { toString: () => key }, storage }, env);
        buffers.set(key, { object, storage });
      }
      return {
        fetch: (request, init) => buffers.get(key).object.fetch(
          request instanceof Request ? request : new Request(request, init),
        ),
      };
    },
  };
  return env;
}

beforeEach(() => {
  originalDateNow = Date.now;
  now = 1_800_000_000_000;
  Date.now = () => now;
  upstreamCalls = [];
  upstreamStatuses = [200];
  globalThis.fetch = async (url, init) => {
    upstreamCalls.push({ url, init, body: JSON.parse(init.body) });
    const status = upstreamStatuses.shift() ?? 200;
    return new Response('{}', { status });
  };
  makeEnv();
});

afterEach(() => { Date.now = originalDateNow; });

const baseEvent = (overrides = {}) => ({
  type: 'items_added', id: 'evt_1', timestamp: now, currency: 'USD',
  items: [{ sku: 'RUN-JK-W', name: 'Pulse Run Jacket', quantity: 1, unit_price: 14800 }],
  value: 14800,
  ...overrides,
});

const baseBody = (event = baseEvent(), extra = {}) => ({
  event,
  page_url: 'https://store.akash.app/?utm_source=x#shop',
  click_id: 'opp_abc',
  browser_id: 'ob_123',
  session_id: SESSION_ID,
  cart_id: CART_ID,
  user: { external_ids_sha256: [CART_HASH] },
  consent: { advertising: true, region: 'us' },
  ...extra,
});

function post(body, { origin = ORIGIN, headers = {} } = {}) {
  return worker.fetch(new Request('https://relay.example/events', {
    method: 'POST',
    headers: {
      Origin: origin,
      'Content-Type': 'application/json',
      'CF-Connecting-IP': '203.0.113.7',
      'User-Agent': 'TestBrowser/1.0',
      ...headers,
    },
    body: JSON.stringify(body),
  }), env);
}

function sessionBuffer(sessionId = SESSION_ID) {
  return buffers.get(`named:${sessionId}`);
}

async function advanceAndEnqueue(sessionId = SESSION_ID) {
  now += 60_000;
  await sessionBuffer(sessionId).object.alarm();
  return queueMessages.splice(0);
}

async function consume(messages) {
  const outcomes = [];
  await worker.queue({ messages: messages.map((body) => ({
    body,
    ack() { outcomes.push({ action: 'ack', body }); },
    retry(options) { outcomes.push({ action: 'retry', options, body }); },
  })) }, env);
  return outcomes;
}

test('CORS preflight: allowed origin gets headers, others are refused', async () => {
  const ok = await worker.fetch(new Request('https://relay.example/events', {
    method: 'OPTIONS', headers: { Origin: ORIGIN },
  }), env);
  assert.equal(ok.status, 204);
  assert.equal(ok.headers.get('Access-Control-Allow-Origin'), ORIGIN);

  const bad = await worker.fetch(new Request('https://relay.example/events', {
    method: 'OPTIONS', headers: { Origin: 'https://evil.example' },
  }), env);
  assert.equal(bad.status, 403);
});

test('unknown origins are rejected before an event is buffered', async () => {
  const response = await post(baseBody(), { origin: 'https://evil.example' });
  assert.equal(response.status, 403);
  assert.equal(buffers.size, 0);
  assert.equal(upstreamCalls.length, 0);
});

test('events without advertising consent are dropped', async () => {
  const response = await post(baseBody(baseEvent(), { consent: { advertising: false } }));
  assert.equal(response.status, 202);
  assert.equal((await response.json()).forwarded, false);
  assert.equal(buffers.size, 0);
});

test('accepted events wait 60 seconds and preserve the original event ID', async () => {
  const response = await post(baseBody());
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), {
    queued: true,
    type: 'items_added',
    id: 'evt_1',
    cart_id: CART_ID,
    delay_ms: 60_000,
    validate_only: true,
  });
  assert.equal(upstreamCalls.length, 0);
  assert.equal(queueMessages.length, 0);
  assert.equal(sessionBuffer().storage.alarmAt, now + 60_000);
});

test('events without consent, unknown event types, and invalid hashes are not queued', async () => {
  const invalid = await post(baseBody(baseEvent({ type: 'order_created' }), {
    user: { external_ids_sha256: ['raw-external-id'] },
  }));
  assert.equal(invalid.status, 400);

  const unsupported = await post(baseBody(baseEvent({ type: 'currency_changed' })));
  assert.equal(unsupported.status, 202);
  assert.equal((await unsupported.json()).forwarded, false);
  assert.equal(queueMessages.length, 0);
});

test('old pre-cart events get the cart external ID when the content view creates a reference', async () => {
  const page = baseBody(baseEvent({ type: 'page_viewed', id: 'page_1' }), {
    cart_id: null,
    user: {},
  });
  await post(page);
  now += 5_000;
  await post(baseBody(baseEvent({ type: 'contents_viewed', id: 'view_1', timestamp: now })));

  const records = await sessionBuffer().storage.list({ prefix: 'event:' });
  const pageRecord = records.get('event:page_viewed:page_1');
  assert.equal(pageRecord.cartId, CART_ID);
  assert.equal(pageRecord.conversion.user.external_ids_sha256.length, 1);
  assert.match(pageRecord.conversion.user.external_ids_sha256[0], /^[0-9a-f]{64}$/);
});

test('purchase hashed details enrich pending prior events but preserve event-level identifiers', async () => {
  await post(baseBody(baseEvent({ type: 'items_added', id: 'add_1', timestamp: now })));
  now += 20_000;
  await post(baseBody(baseEvent({
    type: 'order_created', id: CART_ID, timestamp: now,
  }), {
    user: {
      external_ids_sha256: [CART_HASH],
      emails_sha256: [HASH],
      phone_numbers_sha256: [HASH],
      first_names_sha256: [HASH],
      last_names_sha256: [HASH],
      city: 'Brooklyn', region: 'New York', postal_code: '11205', country: 'us',
    },
  }));

  const records = await sessionBuffer().storage.list({ prefix: 'event:' });
  const add = records.get('event:items_added:add_1');
  assert.equal(add.conversion.id, 'add_1');
  assert.deepEqual(add.conversion.user.emails_sha256, [HASH]);
  assert.deepEqual(add.conversion.user.countries, ['US']);
  assert.deepEqual(add.conversion.user.cities, ['Brooklyn']);
  assert.deepEqual(add.conversion.user.postal_codes, ['11205']);
  assert.equal(add.conversion.user.ip_address, '203.0.113.7');
  assert.equal(add.conversion.oppref, 'opp_abc');
});

test('queue delivery sends the mapped event to each pixel and acknowledges success', async () => {
  await post(baseBody());
  const dueMessages = await advanceAndEnqueue();
  const outcomes = await consume(dueMessages);

  assert.deepEqual(outcomes.map(({ action }) => action), ['ack']);
  assert.equal(upstreamCalls.length, 1);
  const { url, init, body } = upstreamCalls[0];
  assert.equal(url, 'https://bzr.openai.com/v1/events?pid=px_test');
  assert.equal(init.headers.Authorization, 'Bearer sk_test');
  assert.equal(body.validate_only, true);
  assert.equal(body.integration_source, 'nano-motion-relay');

  const [event] = body.events;
  assert.equal(event.type, 'items_added');
  assert.equal(event.id, 'evt_1');
  assert.equal(event.timestamp_ms, now - 60_000);
  assert.equal(event.action_source, 'web');
  assert.equal(event.source_url, 'https://store.akash.app/');
  assert.equal(event.oppref, 'opp_abc');
  assert.deepEqual(event.user, {
    obref: 'ob_123',
    ip_address: '203.0.113.7',
    user_agent: 'TestBrowser/1.0',
    external_ids_sha256: [CART_HASH],
  });
  assert.deepEqual(event.data.contents[0], {
    id: 'RUN-JK-W', name: 'Pulse Run Jacket', content_type: 'product',
    quantity: 1, amount: 14800, currency: 'USD',
  });
  assert.equal((await sessionBuffer().storage.list({ prefix: 'event:' })).size, 0);
});

test('transient upstream failures retry through the queue with the same event ID', async () => {
  await post(baseBody());
  const dueMessages = await advanceAndEnqueue();
  upstreamStatuses = [503, 200];

  const first = await consume(dueMessages);
  assert.equal(first[0].action, 'retry');
  assert.equal(first[0].options.delaySeconds, 20);
  const second = await consume([dueMessages[0]]);
  assert.equal(second[0].action, 'ack');
  assert.equal(upstreamCalls.length, 2);
  assert.equal(upstreamCalls[0].body.events[0].id, upstreamCalls[1].body.events[0].id);
});

test('delivery tracks each pixel independently across retries', async () => {
  makeEnv({
    OPENAI_PIXEL_ID_2: 'px_second',
    OPENAI_CONVERSIONS_API_KEY_2: 'sk_second',
  });
  await post(baseBody());
  const dueMessages = await advanceAndEnqueue();
  upstreamStatuses = [200, 503, 200];

  const first = await consume(dueMessages);
  assert.equal(first[0].action, 'retry');
  const second = await consume([dueMessages[0]]);
  assert.equal(second[0].action, 'ack');
  assert.equal(upstreamCalls.length, 3); // successful first pixel was not repeated
  assert.deepEqual(upstreamCalls.map(({ url }) => new URL(url).searchParams.get('pid')),
    ['px_test', 'px_second', 'px_second']);
});

test('permanent upstream 4xx errors are recorded and not retried', async () => {
  await post(baseBody());
  const dueMessages = await advanceAndEnqueue();
  upstreamStatuses = [400];
  const outcomes = await consume(dueMessages);

  assert.equal(outcomes[0].action, 'ack');
  assert.equal(upstreamCalls.length, 1);
});

test('consent withdrawal clears buffered data and rejects in-flight events for that session', async () => {
  await post(baseBody());
  const response = await worker.fetch(new Request('https://relay.example/consent', {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: SESSION_ID, consent: { advertising: false } }),
  }), env);
  assert.equal(response.status, 202);
  assert.equal((await response.json()).revoked, true);
  assert.equal((await sessionBuffer().storage.list()).size, 1); // revocation tombstone only

  const later = await post(baseBody(baseEvent({ id: 'late_event' })));
  assert.equal(later.status, 202);
  assert.equal((await later.json()).reason, 'consent revoked');
  assert.equal(upstreamCalls.length, 0);
});

test('missing pixel credentials fail before buffering', async () => {
  makeEnv({ OPENAI_PIXEL_ID: undefined, OPENAI_CONVERSIONS_API_KEY: undefined });
  const response = await post(baseBody());
  assert.equal(response.status, 500);
  assert.equal(buffers.size, 0);
});
