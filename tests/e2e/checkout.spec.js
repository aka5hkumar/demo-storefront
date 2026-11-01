import { test, expect, openStore, cards } from './fixtures.js';

const bag = (page) => page.locator('#bag-drawer');
const next = (page) => page.locator('#bag-body [data-checkout-next]');

async function addFirstProduct(page) {
  await cards(page).first().locator('.product-card__add').click();
  await expect(bag(page)).toHaveAttribute('aria-hidden', 'false');
}

/** From the bag step to the payment step, waiting for the demo shopper to fill the forms. */
async function goToPayment(page) {
  await next(page).click();
  await expect(page.locator('#checkout-email')).not.toHaveValue('');
  await next(page).click();
  await expect(page.locator('#checkout-address')).not.toHaveValue('');
  await next(page).click();
  await expect(page.locator('#checkout-card')).toBeVisible();
}

test.describe('with cookies accepted', () => {
  test.beforeEach(async ({ page }) => openStore(page));

  test('places an order, then empties the bag', async ({ page, events }) => {
    await addFirstProduct(page);
    await expect(page.locator('.checkout-consent')).toHaveCount(0); // already answered
    await expect(page.locator('#bag-count')).toHaveText('1');

    await goToPayment(page);
    await next(page).click();

    await expect(page.locator('.order-confirmation')).toContainText('Order placed');
    await expect(page.locator('#bag-count')).toHaveText('0');

    const [order] = await events.named('order_placed');
    expect(order.id).toMatch(/^NM-/);
    expect(order.items).toHaveLength(1);
    expect((await events.named('checkout_step')).map((event) => event.step)).toEqual(['contact', 'shipping', 'payment']);

    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('nm-bag')));
    expect(saved.lines).toEqual([]);
  });

  test('checks the card before placing the order', async ({ page, events }) => {
    await addFirstProduct(page);
    await goToPayment(page);

    await page.locator('#checkout-card').fill('4242 4242 4242 4241');
    await next(page).click();
    await expect(page.locator('#payment-error')).toBeVisible();

    await page.locator('#checkout-card').fill('4000 0000 0000 0002'); // the declined test card
    await next(page).click();
    await expect(page.locator('#payment-error')).toBeVisible();
    expect((await events.named('payment_failed')).length).toBe(2);
    expect(await events.names()).not.toContain('order_placed');

    await page.locator('#checkout-card').fill('4242 4242 4242 4242');
    await next(page).click();
    await expect(page.locator('.order-confirmation')).toBeVisible();
  });

  test('the bag survives a reload without a second add_to_cart', async ({ page, events }) => {
    await addFirstProduct(page);
    await page.locator('#bag-body [data-increase]').click();
    await expect(page.locator('#bag-count')).toHaveText('2');

    events.clear();
    await page.reload();
    await expect(page.locator('#bag-count')).toHaveText('2');
    await page.waitForTimeout(300);
    expect(await events.names()).not.toContain('add_to_cart');
  });

  test('Continue shopping closes the bag and keeps it', async ({ page }) => {
    await addFirstProduct(page);
    await page.locator('#bag-body [data-continue-shopping]').click();
    await expect(bag(page)).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('#bag-count')).toHaveText('1');
  });
});

test('a bag older than 30 days is not restored', async ({ page }) => {
  await page.addInitScript(() => {
    const old = Date.now() - 31 * 24 * 60 * 60 * 1000;
    localStorage.setItem('nm-bag', JSON.stringify({ savedAt: old, lines: [{ sku: 'RUN-JK-M', color: 'espresso', size: 'M', quantity: 1 }] }));
  });
  await openStore(page);
  await expect(page.locator('#bag-count')).toHaveText('0');
});

test('a saved line for an unknown product is dropped', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('nm-bag', JSON.stringify({ savedAt: Date.now(), lines: [{ sku: 'NOPE', color: 'espresso', size: 'M', quantity: 3 }] }));
  });
  await openStore(page);
  await expect(page.locator('#bag-count')).toHaveText('0');
});

test.describe('without a cookie choice', () => {
  test('the bag asks once, and the answer is saved', async ({ page, events }) => {
    await openStore(page, { consent: null });
    await addFirstProduct(page);

    await expect(page.locator('.checkout-consent')).toBeVisible();
    await page.locator('[data-checkout-consent="allow"]').click();
    await expect(page.locator('.checkout-consent')).toHaveCount(0);

    expect((await events.named('consent_changed')).at(-1)).toMatchObject({ advertising: true, method: 'checkout_allow' });
    expect(await page.evaluate(() => window.nmConsent().advertising)).toBe(true);
  });
});
