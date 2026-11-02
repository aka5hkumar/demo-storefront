import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toConversionEvent, InvalidEventError } from '../src/map-event.js';

const request = new Request('https://relay.example/events', { headers: { 'User-Agent': 'TestBrowser/1.0' } });
const HASH = 'b'.repeat(64);
const body = (event, extra = {}) => ({
  event: { id: 'NMC-1', timestamp: Date.now(), currency: 'USD', ...event },
  page_url: 'https://store.akash.app/#club',
  ...extra,
});

test('trial_started maps to plan_enrollment with plan_id and no amount', () => {
  const conversion = toConversionEvent(body({ type: 'trial_started', plan_id: 'motion-club-trial-14d' }), request);
  assert.equal(conversion.type, 'trial_started');
  assert.equal(conversion.id, 'NMC-1');
  assert.deepEqual(conversion.data, { type: 'plan_enrollment', plan_id: 'motion-club-trial-14d' });
});

test('subscription_created carries the first charge and currency', () => {
  const conversion = toConversionEvent(body(
    { type: 'subscription_created', plan_id: 'motion-club-monthly', value: 2900 },
    { user: { emails_sha256: [HASH], external_ids_sha256: [HASH] } },
  ), request);
  assert.deepEqual(conversion.data, { type: 'plan_enrollment', plan_id: 'motion-club-monthly', amount: 2900, currency: 'USD' });
  assert.deepEqual(conversion.user.emails_sha256, [HASH]);
  assert.deepEqual(conversion.user.external_ids_sha256, [HASH]);
});

test('an enrollment event without a valid plan_id is rejected', () => {
  assert.throws(() => toConversionEvent(body({ type: 'trial_started' }), request), InvalidEventError);
  assert.throws(() => toConversionEvent(body({ type: 'trial_started', plan_id: 'has spaces' }), request), InvalidEventError);
});

test('viewing the plan is contents_viewed with content_type plan', () => {
  const conversion = toConversionEvent(body({
    type: 'contents_viewed',
    items: [{ sku: 'motion-club-monthly', name: 'Motion Club', content_type: 'plan', quantity: 1, unit_price: 2900 }],
  }), request);
  assert.equal(conversion.data.type, 'contents');
  assert.equal(conversion.data.contents[0].content_type, 'plan');
});

test('product items stay content_type product; unknown content types fall back to product', () => {
  const conversion = toConversionEvent(body({
    type: 'items_added',
    items: [{ sku: 'RUN-JK-M', quantity: 1, unit_price: 14800, content_type: 'weird' }],
    value: 14800,
  }), request);
  assert.equal(conversion.data.contents[0].content_type, 'product');
});
