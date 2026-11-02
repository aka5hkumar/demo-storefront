/**
 * Pixel and relay together, against a fake SDK and relay (see fixtures.js).
 * Checks the things that matter for measurement: consent gating, matching
 * event ids across both paths, and matching details only with consent.
 */
import { createHash } from 'node:crypto';
import { test, expect, openStore, cards, PIXEL_IDS } from './fixtures.js';

test.use({ tracking: true });

const sdkCalls = (page) => page.evaluate(() => window.__sdkCalls ?? []);
const measured = async (page) => (await sdkCalls(page)).filter(([command]) => command === 'measure');

async function buyFirstProduct(page) {
  await cards(page).first().locator('.product-card__view').click();
  await page.getByRole('button', { name: 'Add to bag' }).click();
  const next = page.locator('#bag-body [data-checkout-next]');
  await next.click();
  await expect(page.locator('#checkout-email')).not.toHaveValue('');
  await next.click();
  await expect(page.locator('#checkout-address')).not.toHaveValue('');
  await next.click();
  await next.click();
  await expect(page.locator('.order-confirmation')).toBeVisible();
}

test('pixel starts with consent off, then follows the visitor\'s choice', async ({ page }) => {
  await openStore(page, { consent: null });
  await expect.poll(() => sdkCalls(page)).toContainEqual(['consent', false]);
  const [first, ...rest] = await sdkCalls(page);
  expect(first).toEqual(['consent', false]); // consent before init
  // Every pixel is initialised up front, in order.
  expect(rest.slice(0, PIXEL_IDS.length)).toEqual(PIXEL_IDS.map((pixelId) => ['init', { pixelId, debug: false }]));

  await page.locator('[data-consent-action="accept"]').click();
  await expect.poll(() => sdkCalls(page)).toContainEqual(['consent', true]);
});

test('a full purchase: same ids on both paths, matching details on the order', async ({ page, relayed, events }) => {
  await openStore(page, { path: '/?oppref=click_123' });
  await buyFirstProduct(page);

  await expect.poll(async () => (await measured(page)).map(([, type]) => type)).toEqual(
    expect.arrayContaining(['page_viewed', 'contents_viewed', 'items_added', 'checkout_started', 'order_created']),
  );
  await expect.poll(() => relayed.map((body) => body.event?.type ?? body.type)).toContain('order_created');

  const calls = await sdkCalls(page);
  const pixelIds = calls.filter(([command]) => command === 'measure').map(([, , , options]) => options.event_id);
  const [order] = await events.named('order_placed');
  expect(pixelIds).toContain(order.id); // the order number is the dedup key

  // Every relayed event was also sent by the pixel with the same id.
  for (const body of relayed) expect(pixelIds).toContain(body.event?.id ?? body.id);

  // Every user init names its pixel and carries the hashed cart/order reference as external ID.
  const orderMeasure = calls.findIndex(([command, type]) => command === 'measure' && type === 'order_created');
  const userInits = calls.map((call, index) => [call, index]).filter(([[command, options]]) => command === 'init' && options.user);
  const externalId = createHash('sha256').update(order.id).digest('hex');
  for (const [[, options]] of userInits) {
    expect(PIXEL_IDS).toContain(options.pixelId);
    expect(options.user.external_id_sha256).toBe(externalId);
  }
  // Hashed contact details only arrive with the order: one init per pixel right before order_created.
  const withEmail = userInits.filter(([[, options]]) => options.user.email_sha256);
  expect(withEmail.map(([[, options]]) => options.pixelId)).toEqual(PIXEL_IDS);
  for (const [[, options], index] of withEmail) {
    expect(index).toBeLessThan(orderMeasure);
    expect(options.user.email_sha256).toMatch(/^[0-9a-f]{64}$/);
  }
  // One measure per event: the SDK fans it out to every initialised pixel.
  expect(calls.filter(([command, type]) => command === 'measure' && type === 'order_created')).toHaveLength(1);
});

test('after a rejection: no relay calls and no matching details', async ({ page, relayed }) => {
  await openStore(page, { consent: 'reject' });
  await buyFirstProduct(page);
  await page.waitForTimeout(500);

  expect(relayed).toEqual([]);
  const calls = await sdkCalls(page);
  expect(calls.some(([command, options]) => command === 'init' && options.user)).toBe(false);
  expect(calls.filter(([command]) => command === 'consent').at(-1)).toEqual(['consent', false]);
});

test('Motion Club: trial and subscription reach the pixel and relay as plan_enrollment', async ({ page, relayed }) => {
  await openStore(page);
  await page.locator('#club-banner').click();
  await page.getByRole('button', { name: 'Start free trial' }).click();
  await expect(page.locator('#club-body')).toContainText('Your trial is on');

  await page.getByRole('button', { name: 'Back to the shop' }).click();
  await page.locator('#club-banner').click();
  await page.locator('input[value="monthly"]').check();
  await page.locator('#club-form button[type="submit"]').click();
  await expect(page.locator('#club-body')).toContainText('Welcome to the Club');

  await expect.poll(async () => (await measured(page)).map(([, type]) => type)).toEqual(
    expect.arrayContaining(['contents_viewed', 'trial_started', 'subscription_created']),
  );
  const calls = await sdkCalls(page);
  const byType = (type) => calls.find(([command, name]) => command === 'measure' && name === type);

  const [, , viewData] = byType('contents_viewed');
  expect(viewData.contents[0]).toMatchObject({ id: 'motion-club-monthly', content_type: 'plan', amount: 2900 });

  const [, , trialData, trialOptions] = byType('trial_started');
  expect(trialData).toEqual({ type: 'plan_enrollment', plan_id: 'motion-club-trial-14d' });
  expect(trialOptions.event_id).toMatch(/^NMC-/);

  const [, , subscriptionData, subscriptionOptions] = byType('subscription_created');
  expect(subscriptionData).toEqual({ type: 'plan_enrollment', plan_id: 'motion-club-monthly', amount: 2900, currency: 'USD' });

  // Each pixel gets the hashed email and the hashed member ID right before each enrollment event.
  for (const [type, options] of [['trial_started', trialOptions], ['subscription_created', subscriptionOptions]]) {
    const measureIndex = calls.findIndex(([command, name]) => command === 'measure' && name === type);
    const inits = calls.slice(measureIndex - PIXEL_IDS.length, measureIndex);
    const externalId = createHash('sha256').update(options.event_id).digest('hex');
    expect(inits.map(([command, init]) => [command, init.pixelId])).toEqual(PIXEL_IDS.map((id) => ['init', id]));
    for (const [, init] of inits) {
      expect(init.user.email_sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(init.user.external_id_sha256).toBe(externalId);
    }
  }

  // The relay sends the same events with the same ids and the plan_id.
  await expect.poll(() => relayed.map((body) => body.event?.type)).toEqual(expect.arrayContaining(['trial_started', 'subscription_created']));
  const relayedTrial = relayed.find((body) => body.event?.type === 'trial_started');
  expect(relayedTrial.event).toMatchObject({ id: trialOptions.event_id, plan_id: 'motion-club-trial-14d' });
  expect(relayedTrial.user.emails_sha256[0]).toMatch(/^[0-9a-f]{64}$/);
});

test('withdrawing consent asks the relay to clear the session, at /consent', async ({ page, relayed, withdrawals }) => {
  await openStore(page);
  await cards(page).first().locator('.product-card__add').click();
  await expect.poll(() => relayed.length).toBeGreaterThan(0);
  const sessionId = relayed.at(-1).session_id;
  expect(sessionId).toBeTruthy();

  // Turn advertising off in the cookie settings.
  await page.locator('#bag-close').click();
  await page.locator('#open-cookie-settings').click();
  await page.locator('#consent-advertising').uncheck({ force: true }); // styled switch over the checkbox
  await page.locator('#privacy-save').click();

  await expect.poll(() => withdrawals).toContainEqual({ session_id: sessionId, consent: { advertising: false } });
  expect(await page.evaluate(() => localStorage.getItem('nm-capi-session-id'))).toBeNull();
});

test('resetting cookie consent also clears the relay session', async ({ page, relayed, withdrawals }) => {
  await openStore(page);
  await cards(page).first().locator('.product-card__add').click();
  await expect.poll(() => relayed.length).toBeGreaterThan(0);
  const sessionId = relayed.at(-1).session_id;

  await page.locator('#bag-close').click();
  await page.locator('#reset-consent').click();
  await expect.poll(() => withdrawals.map((w) => w.session_id)).toContain(sessionId);
});
