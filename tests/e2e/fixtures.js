/**
 * Shared test setup.
 *
 * Every test:
 * - runs offline: the demo-shopper lookups are blocked (so checkout uses its
 *   local fallback) and Google Fonts gets an empty stylesheet;
 * - fails on any page error or Content Security Policy violation;
 * - can read the storefront's events through `events` (from the console logger).
 *
 * `test.use({ tracking: true })` switches the pixel and relay on against a fake
 * SDK and a fake relay, and adds their hosts to the page's CSP, the same edit a
 * real deployment needs.
 */
import { test as base, expect } from '@playwright/test';

const BLOCKED_LOOKUPS = /ipwho\.is|get\.geojs\.io|nominatim\.openstreetmap\.org|randomuser\.me/;

export const PIXEL_IDS = ['px_test_a', 'px_test_b'];
const SDK_URL = 'https://sdk.test/sdk.js';
const RELAY_URL = 'https://relay.test/events';

const TRACKING_CONFIG = `
export const PIXEL_IDS = ${JSON.stringify(PIXEL_IDS)};
export const PIXEL_SCRIPT_URL = '${SDK_URL}';
export const PIXEL_DEBUG = false;
export const CONVERSIONS_RELAY_URL = '${RELAY_URL}';
`;

/** Stands in for the ad SDK: records every command in window.__sdkCalls. */
const FAKE_SDK = `(() => {
  const queued = (window.oaiq && window.oaiq.q) || [];
  window.__sdkCalls = [];
  window.oaiq = (...args) => window.__sdkCalls.push(JSON.parse(JSON.stringify(args)));
  queued.forEach((args) => window.oaiq(...args));
})();`;

export const test = base.extend({
  tracking: [false, { option: true }],

  /** Requests the relay received, parsed. */
  relayed: async ({}, use) => use([]),

  page: async ({ page, tracking, relayed }, use) => {
    const problems = [];
    page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error' && /Content Security Policy/i.test(message.text())) {
        problems.push(`CSP: ${message.text()}`);
      }
    });

    await page.route(BLOCKED_LOOKUPS, (route) => route.abort());
    await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ contentType: 'text/css', body: '' }));

    if (tracking) {
      await page.route('**/js/config.js', (route) => route.fulfill({ contentType: 'text/javascript', body: TRACKING_CONFIG }));
      await page.route(SDK_URL, (route) => route.fulfill({ contentType: 'text/javascript', body: FAKE_SDK }));
      await page.route(RELAY_URL, async (route) => {
        if (route.request().method() === 'POST') relayed.push(JSON.parse(route.request().postData()));
        await route.fulfill({
          status: 202,
          headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'Content-Type' },
          body: '{}',
        });
      });
      // Allow the two hosts in the page's CSP, as a real deployment would.
      await page.route(/\/(index\.html)?(\?.*)?(#.*)?$/, async (route) => {
        if (route.request().resourceType() !== 'document') return route.fallback();
        const response = await route.fetch();
        const html = (await response.text())
          .replace("script-src 'self'", "script-src 'self' https://sdk.test")
          .replace("connect-src 'self'", "connect-src 'self' https://relay.test");
        await route.fulfill({ response, body: html });
      });
    }

    await use(page);
    expect(problems, 'page errors or CSP violations').toEqual([]);
  },

  /** Storefront events in order: await events.list() or events.names(). */
  events: [async ({ page }, use) => {
    const pending = [];
    page.on('console', (message) => {
      if (message.text().startsWith('[nm]')) pending.push(message.args()[2]?.jsonValue().catch(() => null)); // null if the page navigated
    });
    const list = async () => (await Promise.all(pending)).filter(Boolean);
    await use({
      list,
      names: async () => (await list()).map((event) => event.name),
      named: async (name) => (await list()).filter((event) => event.name === name),
      clear: () => { pending.length = 0; },
    });
  }, { auto: true }], // auto, so it's listening before beforeEach loads the page
});

export { expect };

/* ----- Helpers ----- */

/** Load the store and answer the cookie prompt ('accept', 'reject', or null to leave it). */
export async function openStore(page, { path = '/', consent = 'accept' } = {}) {
  await page.goto(path);
  await expect(page.locator('.product-card').first()).toBeVisible();
  if (consent) {
    const choice = page.locator(`[data-consent-action="${consent}"]`);
    await choice.click();
    await expect(page.locator('#consent-bubble')).toHaveAttribute('aria-hidden', 'true');
  }
}

export const cards = (page) => page.locator('#product-grid .product-card');

/** Integer minor units from a formatted price like "$58.00". */
export const priceValue = (text) => Number(text.replace(/[^\d]/g, ''));
