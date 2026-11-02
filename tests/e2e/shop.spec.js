import { test, expect, openStore, cards, priceValue } from './fixtures.js';
import { PRODUCTS } from '../../js/catalog.js';

test.beforeEach(async ({ page }) => openStore(page));

test('shows the first page of products and a page_view', async ({ page, events }) => {
  await expect(cards(page)).toHaveCount(8);
  await expect(page.locator('#result-count')).toHaveText(`${PRODUCTS.length} items`);
  expect(await events.names()).toContain('page_view');
});

test('publishes structured data for every product', async ({ page }) => {
  const json = await page.locator('script[type="application/ld+json"]').textContent();
  const list = JSON.parse(json)['@graph'].find((node) => node['@type'] === 'ItemList');
  expect(list.itemListElement).toHaveLength(PRODUCTS.length);
  expect(list.itemListElement[0].item.offers.priceCurrency).toBe('USD');
});

test('gender filter keeps the other gender out', async ({ page, events }) => {
  await page.getByRole('button', { name: 'Men', exact: true }).click();
  const skus = await cards(page).evaluateAll((els) => els.map((el) => el.dataset.sku));
  expect(skus.every((sku) => !sku.endsWith('-W'))).toBe(true);
  expect((await events.named('filter_changed')).at(-1)).toMatchObject({ gender: 'Men' });
});

test('search matches synonyms and needs every word', async ({ page, events }) => {
  const search = page.getByRole('searchbox', { name: 'Search products' });

  await search.fill('jacket');
  await expect(page.locator('#result-count')).toContainText('for “jacket”');
  const names = await page.locator('.product-card__name').allTextContents();
  expect(names.length).toBeGreaterThan(0);
  expect(names.every((name) => /jacket|shell/i.test(name))).toBe(true);

  await search.fill('pants');
  await expect(page.locator('#result-count')).toContainText('for “pants”');
  const pants = await page.locator('.product-card__name').allTextContents();
  expect(pants.some((name) => /jogger|legging/i.test(name))).toBe(true);

  await expect.poll(() => events.named('search')).toContainEqual(expect.objectContaining({ query: 'pants' }));
});

test('no results offers a way back', async ({ page }) => {
  await page.getByRole('searchbox', { name: 'Search products' }).fill('snorkel');
  await expect(page.locator('.no-results')).toContainText('No matches for');
  await page.getByRole('button', { name: 'Clear search and filters' }).click();
  await expect(cards(page)).toHaveCount(8);
  await expect(page.getByRole('searchbox', { name: 'Search products' })).toBeFocused();
});

test('sorts by price both ways', async ({ page }) => {
  const prices = async () => (await page.locator('.product-card__price').allTextContents()).map(priceValue);

  await page.getByLabel('Sort').selectOption('price-asc');
  const ascending = await prices();
  expect(ascending).toEqual([...ascending].sort((a, b) => a - b));

  await page.getByLabel('Sort').selectOption('price-desc');
  const descending = await prices();
  expect(descending).toEqual([...descending].sort((a, b) => b - a));
  expect(descending[0]).toBeGreaterThanOrEqual(ascending.at(-1));
});

test('pager moves to the next page', async ({ page }) => {
  const firstSku = await cards(page).first().getAttribute('data-sku');
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(cards(page).first()).not.toHaveAttribute('data-sku', firstSku);
  await expect(page.locator('#pager [aria-current="page"]')).toHaveText('2');
});

test('picking a colour updates the card', async ({ page, events }) => {
  const card = cards(page).first();
  const swatch = card.locator('.swatch').nth(1);
  await swatch.click();
  await expect(swatch).toHaveAttribute('aria-pressed', 'true');
  expect(await events.names()).toContain('variant_selected');
});

test('sold-out sizes cannot be picked', async ({ page, events }) => {
  // Not every page-one product has a sold-out size, so look across pages.
  let soldOut = page.locator('[data-sold-out-size]').first();
  while (!(await soldOut.count())) {
    await page.getByRole('button', { name: 'Next page' }).click();
    soldOut = page.locator('[data-sold-out-size]').first();
  }
  await soldOut.click({ force: true }); // aria-disabled, but still clickable so it can explain why
  await expect(soldOut).not.toHaveAttribute('aria-pressed', 'true');
  expect(await events.names()).toContain('size_unavailable');
});

test('product names with quote marks stay intact in labels', async ({ page }) => {
  await page.getByRole('searchbox', { name: 'Search products' }).fill('stride');
  await expect(page.locator('#result-count')).toContainText('for “stride”');
  await expect(page.getByRole('button', { name: 'Quick view: Stride 3" Short, Women\'s' })).toHaveCount(1);
});
