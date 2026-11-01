import { test, expect, openStore, cards } from './fixtures.js';

const consentCookie = async (page) => {
  const cookie = (await page.context().cookies()).find((c) => c.name === 'nm_consent');
  return cookie && JSON.parse(decodeURIComponent(cookie.value));
};

test.describe('EU visitor (GDPR)', () => {
  test('asks first, and remembers a rejection', async ({ page }) => {
    await openStore(page, { consent: null });
    await expect(page.locator('[data-consent-action="reject"]')).toBeVisible();
    await expect(page.locator('[data-consent-action="accept"]')).toBeVisible();

    await page.locator('[data-consent-action="reject"]').click();
    expect(await consentCookie(page)).toMatchObject({ region: 'gdpr', advertising: false, analytics: false });

    await page.reload();
    await expect(page.locator('.product-card').first()).toBeVisible();
    await page.waitForTimeout(1200); // past the prompt delay
    await expect(page.locator('#consent-bubble')).toHaveAttribute('aria-hidden', 'true');
  });

  test('the bag never re-asks someone who declined', async ({ page }) => {
    await openStore(page, { consent: 'reject' });
    await cards(page).first().locator('.product-card__add').click();
    await expect(page.locator('#bag-body')).toBeVisible();
    await expect(page.locator('.checkout-consent')).toHaveCount(0);
  });

  test('reset clears the choice', async ({ page }) => {
    await openStore(page, { consent: 'accept' });
    await page.locator('#reset-consent').click();
    await page.waitForLoadState('load');
    await expect(page.locator('[data-consent-action="accept"]')).toBeVisible();
    expect(await consentCookie(page)).toBeUndefined();
  });
});

test.describe('California visitor with Global Privacy Control', () => {
  test.use({ timezoneId: 'America/Los_Angeles' });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'globalPrivacyControl', { get: () => true }));
  });

  test('is opted out of sharing even after "Got it"', async ({ page }) => {
    await openStore(page, { consent: null });
    await expect(page.locator('#consent-gpc-note')).toBeVisible();
    await page.locator('[data-consent-action="accept"]').click();
    expect(await consentCookie(page)).toMatchObject({ region: 'ccpa', advertising: false, gpc: true });
  });

  test('is not asked in the bag', async ({ page }) => {
    await openStore(page, { consent: null });
    await cards(page).first().locator('.product-card__add').click();
    await expect(page.locator('#bag-body')).toBeVisible();
    await expect(page.locator('.checkout-consent')).toHaveCount(0);
  });
});
