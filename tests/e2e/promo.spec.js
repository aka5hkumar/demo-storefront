import { test, expect, openStore } from './fixtures.js';

test.beforeEach(async ({ page }) => openStore(page));

test('the promo card opens Motion Club on the trial', async ({ page, events }) => {
  await page.getByRole('button', { name: 'Try 14 days free' }).click();
  await expect(page.locator('#club-modal')).toBeVisible();
  await expect(page.locator('input[value="trial"]')).toBeChecked();
  expect((await events.named('membership_viewed')).at(-1)).toMatchObject({ source: 'promo' });
});

test('"or join" opens Motion Club on the monthly plan, priced in the chosen currency', async ({ page }) => {
  await page.locator('#currency-picker').selectOption('EUR');
  const join = page.getByRole('button', { name: /or join for/ });
  await expect(join).toContainText('€');
  await join.click();
  await expect(page.locator('input[value="monthly"]')).toBeChecked();
  await expect(page.locator('#club-card')).toBeVisible();
});

test('the card shows the next ship date (the 1st of next month)', async ({ page }) => {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  await expect(page.locator('#club-card-ship')).toHaveText(`next box ships ${next}`);
});
