import { test, expect, openStore, cards } from './fixtures.js';

const dialog = (page) => page.getByRole('dialog', { name: /.+/ }).filter({ has: page.locator('#quick-view-title') });

test.beforeEach(async ({ page }) => openStore(page));

test('opens from the card, sets the link and records a view', async ({ page, events }) => {
  const card = cards(page).first();
  const sku = await card.getAttribute('data-sku');
  const name = await card.locator('.product-card__name').textContent();

  await card.locator('.product-card__view').click();

  await expect(dialog(page)).toBeVisible();
  await expect(page.locator('#quick-view-title')).toHaveText(name);
  await expect(page).toHaveURL(new RegExp(`#p-${sku}$`));
  await expect(page.locator('#quick-view-close')).toBeFocused();
  await expect(page.locator('main')).toHaveAttribute('inert', '');
  expect(await events.named('product_viewed')).toContainEqual(expect.objectContaining({ sku }));
});

test('keeps keyboard focus inside while open', async ({ page }) => {
  await cards(page).first().locator('.product-card__name').click();
  const insideDialog = () => page.evaluate(() => document.querySelector('#quick-view').contains(document.activeElement));

  for (let i = 0; i < 25; i += 1) {
    await page.keyboard.press('Tab');
    expect(await insideDialog()).toBe(true);
  }

  // Shift+Tab from the first control wraps to the last one (Add to bag is the last button).
  await page.locator('#quick-view-close').focus();
  await page.keyboard.press('Shift+Tab');
  expect(await insideDialog()).toBe(true);
  await expect(page.locator('#quick-view-close')).not.toBeFocused();
});

test('Escape closes it and puts focus back on the card', async ({ page }) => {
  const opener = cards(page).nth(2).locator('.product-card__name');
  await opener.click();
  await page.keyboard.press('Escape');

  await expect(page.locator('#quick-view')).toBeHidden();
  await expect(opener).toBeFocused();
  await expect(page.locator('main')).not.toHaveAttribute('inert', '');
  expect(new URL(page.url()).hash).toBe('');
});

test('backdrop click closes it', async ({ page }) => {
  await cards(page).first().locator('.product-card__name').click();
  await page.locator('#quick-view').click({ position: { x: 5, y: 5 } });
  await expect(page.locator('#quick-view')).toBeHidden();
});

test('a #p-SKU link opens the product, on load or in the page', async ({ page, events }) => {
  await page.goto('/#p-RUN-JK-M'); // same page, so this is a hash change
  await expect(page.locator('#quick-view')).toBeVisible();
  await expect(page.locator('#quick-view-title')).toBeVisible();
  expect(await events.named('product_viewed')).toContainEqual(expect.objectContaining({ sku: 'RUN-JK-M', source: 'link' }));

  await page.keyboard.press('Escape');
  await page.reload();
  await page.goto('/#p-YOG-LG-W');
  await page.reload(); // fresh load with the hash
  await expect(page.locator('#quick-view-title')).toHaveText('Flow Rib Legging');
});

test('colour picked in quick view carries to bag and card', async ({ page, events }) => {
  const card = cards(page).first();
  const sku = await card.getAttribute('data-sku');
  await card.locator('.product-card__view').click();

  const swatch = page.locator('#quick-view-body .swatch').nth(1);
  const color = await swatch.getAttribute('data-color');
  await swatch.click();
  await page.getByRole('button', { name: 'Add to bag' }).click();

  await expect(page.locator('#quick-view')).toBeHidden();
  await expect(page.locator('#bag-drawer')).toHaveAttribute('aria-hidden', 'false');
  const added = (await events.named('add_to_cart')).at(-1);
  expect(added).toMatchObject({ sku, color, source: 'quick_view' });
  await expect(page.locator(`.product-card[data-sku="${sku}"] .swatch[data-color="${color}"]`)).toHaveAttribute('aria-pressed', 'true');
});
