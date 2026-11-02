/**
 * Pixel and relay together, against a fake SDK and relay (see fixtures.js).
 * Checks the things that matter for measurement: consent gating, matching
 * event ids across both paths, and matching details only with consent.
 */
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

  // Each pixel gets the hashed user init (with its pixelId) before order_created, never earlier.
  const orderMeasure = calls.findIndex(([command, type]) => command === 'measure' && type === 'order_created');
  const userInits = calls.map((call, index) => [call, index]).filter(([[command, options]]) => command === 'init' && options.user);
  expect(userInits.map(([[, options]]) => options.pixelId)).toEqual(PIXEL_IDS);
  for (const [[, options], index] of userInits) {
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
