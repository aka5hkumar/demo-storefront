/** Runs on desktop and on a phone-sized screen (see playwright.config.js). */
import { test, expect, openStore, cards } from './fixtures.js';

test.beforeEach(async ({ page }) => openStore(page));

const noSideways = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test('no sideways scrolling on the shop', async ({ page }) => {
  expect(await noSideways(page)).toBe(true);
});

test('quick view fits on screen', async ({ page }) => {
  await cards(page).first().locator('.product-card__name').click();
  const panel = page.locator('.quick-view__panel');
  await expect(panel).toBeVisible();
  const box = await panel.boundingBox();
  const viewport = page.viewportSize();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  await expect(page.getByRole('button', { name: 'Add to bag' })).toBeInViewport({ ratio: 0.5 }).catch(async () => {
    // On short screens the button can be below the fold: it must be reachable by scrolling the panel.
    await page.getByRole('button', { name: 'Add to bag' }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: 'Add to bag' })).toBeInViewport();
  });
});

test('search and sort fit beside the grid', async ({ page }) => {
  await expect(page.getByRole('searchbox', { name: 'Search products' })).toBeVisible();
  await expect(page.getByLabel('Sort')).toBeVisible();
  expect(await noSideways(page)).toBe(true);
});
