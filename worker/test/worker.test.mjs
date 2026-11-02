import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

const ORIGIN = 'https://store.akash.app';
const env = {
  ALLOWED_ORIGINS: `${ORIGIN},http://localhost:8080`,
  INTEGRATION_SOURCE: 'nano-motion-relay',
  VALIDATE_ONLY: 'true',
  OPENAI_PIXEL_ID: 'px_test',
  OPENAI_CONVERSIONS_API_KEY: 'sk_test',
};
const HASH = 'a'.repeat(64);

let upstreamCalls;
let upstreamStatuses;
beforeEach(() => {
  upstreamCalls = [];
  upstreamStatuses = [200];
  globalThis.fetch = async (url, init) => {
    upstreamCalls.push({ url, init, body: JSON.parse(init.body) });
    const status = upstreamStatuses.shift() ?? 200;
    return new Response('{}', { status });
  };
});

function post(body, { origin = ORIGIN, headers = {} } = {}) {
  return worker.fetch(new Request('https://relay.example/events', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.7', 'User-Agent': 'TestBrowser/1.0', ...headers },
    body: JSON.stringify(body),
  }), env);
}

const baseEvent = (overrides = {}) => ({
  type: 'items_added', id: 'evt_1', timestamp: Date.now(), currency: 'USD',
  items: [{ sku: 'RUN-JK-W', name: 'Pulse Run Jacket', quantity: 1, unit_price: 14800 }], value: 14800,
  ...overrides,
});
const baseBody = (event = baseEvent(), extra = {}) => ({
  event, page_url: 'https://store.akash.app/?utm_source=x#shop', click_id: 'opp_abc', browser_id: 'ob_123',
  consent: { advertising: true, region: 'us' }, ...extra,
});

test('CORS preflight: allowed origin gets headers, others are refused', async () => {
  const ok = await worker.fetch(new Request('https://relay.example/events', { method: 'OPTIONS', headers: { Origin: ORIGIN } }), env);
  assert.equal(ok.status, 204);
  assert.equal(ok.headers.get('Access-Control-Allow-Origin'), ORIGIN);

  const bad = await worker.fetch(new Request('https://relay.example/events', { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } }), env);
  assert.equal(bad.status, 403);
  assert.equal(bad.headers.get('Access-Control-Allow-Origin'), null);
});

test('POST from an unknown origin is rejected and nothing is forwarded', async () => {
  const response = await post(baseBody(), { origin: 'https://evil.example' });
  assert.equal(response.status, 403);
  assert.equal(upstreamCalls.length, 0);
});

test('events without advertising consent are dropped', async () => {
  const response = await post(baseBody(baseEvent(), { consent: { advertising: false } }));
  assert.equal(response.status, 202);
  assert.equal((await response.json()).forwarded, false);
  assert.equal(upstreamCalls.length, 0);
});

test('items_added is forwarded with IP, UA, obref and oppref', async () => {
  const response = await post(baseBody());
  assert.equal(response.status, 202);

  assert.equal(upstreamCalls.length, 1);
  const { url, init, body } = upstreamCalls[0];
  assert.equal(url, 'https://bzr.openai.com/v1/events?pid=px_test');
  assert.equal(init.headers.Authorization, 'Bearer sk_test');
  assert.equal(body.validate_only, true);
  assert.equal(body.integration_source, 'nano-motion-relay');

  const [event] = body.events;
  assert.equal(event.type, 'items_added');
  assert.equal(event.id, 'evt_1');
  assert.equal(event.action_source, 'web');
  assert.equal(event.source_url, 'https://store.akash.app/'); // query + fragment stripped
  assert.equal(event.oppref, 'opp_abc');                       // event level, unmodified
  assert.deepEqual(event.user, { obref: 'ob_123', ip_address: '203.0.113.7', user_agent: 'TestBrowser/1.0' });
  assert.deepEqual(event.data, {
    type: 'contents', amount: 14800, currency: 'USD',
    contents: [{ id: 'RUN-JK-W', name: 'Pulse Run Jacket', content_type: 'product', quantity: 1, amount: 14800, currency: 'USD' }],
  });
});

test('order_created carries hashed PII as lists and raw location fields', async () => {
  await post(baseBody(baseEvent({ type: 'order_created', id: 'NM-ORDER1' }), {
    user: {
      emails_sha256: [HASH], phone_numbers_sha256: [HASH], first_names_sha256: [HASH], last_names_sha256: [HASH],
      city: 'Brooklyn', region: 'New York', postal_code: '11205', country: 'us',
    },
  }));
  const [event] = upstreamCalls[0].body.events;
  assert.equal(event.type, 'order_created');
  assert.equal(event.id, 'NM-ORDER1');
  assert.deepEqual(event.user.emails_sha256, [HASH]);
  assert.deepEqual(event.user.countries, ['US']);
  assert.deepEqual(event.user.cities, ['Brooklyn']);
  assert.deepEqual(event.user.postal_codes, ['11205']);
});

test('raw (unhashed) email is rejected before anything is sent', async () => {
  const response = await post(baseBody(baseEvent({ type: 'order_created' }), { user: { emails_sha256: ['jane@example.com'] } }));
  assert.equal(response.status, 400);
  assert.equal(upstreamCalls.length, 0);
});

test('stale timestamps and unknown events are not forwarded', async () => {
  const stale = await post(baseBody(baseEvent({ timestamp: Date.now() - 8 * 24 * 3600 * 1000 })));
  assert.equal(stale.status, 400);

  const ignored = await post(baseBody(baseEvent({ type: 'currency_changed' })));
  assert.equal(ignored.status, 202);
  assert.equal((await ignored.json()).forwarded, false);
  assert.equal(upstreamCalls.length, 0);
});

test('a 5xx from the Conversions API is retried once with the same event id', async () => {
  upstreamStatuses = [503, 200];
  const response = await post(baseBody());
  assert.equal(response.status, 202);
  assert.equal(upstreamCalls.length, 2);
  assert.equal(upstreamCalls[1].body.events[0].id, upstreamCalls[0].body.events[0].id);
});

test('with two pixels, the same event goes to each pid with its own key', async () => {
  const response = await worker.fetch(new Request('https://relay.example/events', {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
    body: JSON.stringify(baseBody()),
  }), { ...env, OPENAI_PIXEL_ID_2: 'px_second', OPENAI_CONVERSIONS_API_KEY_2: 'sk_second' });

  assert.equal(response.status, 202);
  const calls = upstreamCalls.map(({ url, init, body }) => [url, init.headers.Authorization, body.events[0].id]).sort();
  assert.deepEqual(calls, [
    ['https://bzr.openai.com/v1/events?pid=px_second', 'Bearer sk_second', 'evt_1'],
    ['https://bzr.openai.com/v1/events?pid=px_test', 'Bearer sk_test', 'evt_1'],
  ]);
  assert.deepEqual((await response.json()).pixels.map((pixel) => pixel.pid).sort(), ['px_second', 'px_test']);
});

test('a second pixel without its own key uses the first key', async () => {
  await worker.fetch(new Request('https://relay.example/events', {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
    body: JSON.stringify(baseBody()),
  }), { ...env, OPENAI_PIXEL_ID_2: 'px_second' });

  const second = upstreamCalls.find(({ url }) => url.endsWith('pid=px_second'));
  assert.equal(second.init.headers.Authorization, 'Bearer sk_test');
});

test('if one pixel fails, the response says which', async () => {
  upstreamStatuses = [200, 401];
  const response = await worker.fetch(new Request('https://relay.example/events', {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
    body: JSON.stringify(baseBody()),
  }), { ...env, OPENAI_PIXEL_ID_2: 'px_second', OPENAI_CONVERSIONS_API_KEY_2: 'sk_bad' });

  assert.equal(response.status, 502);
  const result = await response.json();
  assert.equal(result.forwarded, true);
  assert.equal(result.pixels.filter((pixel) => !pixel.ok).length, 1);
});

test('a 4xx from the Conversions API is reported as 502 and not retried', async () => {
  upstreamStatuses = [400];
  const response = await post(baseBody());
  assert.equal(response.status, 502);
  assert.equal(upstreamCalls.length, 1);
});
