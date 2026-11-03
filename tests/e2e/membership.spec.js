import { test, expect, openStore } from './fixtures.js';

const dialog = (page) => page.locator('#club-modal');

test.beforeEach(async ({ page }) => openStore(page));

test('the banner opens Motion Club and keeps focus inside', async ({ page, events }) => {
  const banner = page.locator('#club-banner');
  await banner.click();

  await expect(dialog(page)).toBeVisible();
  await expect(page.locator('#club-close')).toBeFocused();
  await expect(page.locator('main')).toHaveAttribute('inert', '');
  await expect(page).toHaveURL(/#club$/);
  expect(await events.named('membership_viewed')).toHaveLength(1);

  for (let i = 0; i < 15; i += 1) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.querySelector('#club-modal').contains(document.activeElement))).toBe(true);
  }

  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();
  await expect(banner).toBeFocused();
  expect(new URL(page.url()).hash).toBe('');
});

test('the free trial asks for email only and fires trial_started', async ({ page, events }) => {
  await page.locator('#club-banner').click();
  await expect(page.locator('input[value="trial"]')).toBeChecked();
  await expect(page.locator('#club-card')).toHaveCount(0);

  await page.locator('#club-email').fill('runner@example.com');
  await page.getByRole('button', { name: 'Start free trial' }).click();

  await expect(page.locator('#club-body')).toContainText('Your trial is on');
  const [trial] = await events.named('membership_trial_started');
  expect(trial).toMatchObject({ plan_id: 'motion-club-trial-14d' });
  expect(trial.id).toMatch(/^NMC-/);
  expect(trial.cart_id).toBe(trial.id);
  expect(JSON.stringify(trial)).not.toContain('runner@example.com'); // no raw email in events
});

test('membership needs a valid card and fires subscription_created with the first charge', async ({ page, events }) => {
  await page.locator('#club-banner').click();
  await page.locator('input[value="monthly"]').check();
  await expect(page.locator('#club-card')).toBeVisible();
  await expect(page.locator('#club-email')).not.toHaveValue(''); // kept when switching options

  await page.locator('#club-card').fill('4000 0000 0000 0002');
  await page.locator('#club-form button[type="submit"]').click();
  await expect(page.locator('#club-error')).toContainText('declined');

  await page.locator('#club-card').fill('4242 4242 4242 4242');
  await page.locator('#club-form button[type="submit"]').click();
  await expect(page.locator('#club-body')).toContainText('Welcome to the Club');

  const [membership] = await events.named('membership_started');
  expect(membership).toMatchObject({ plan_id: 'motion-club-monthly', amount: 2900, currency: 'USD' });
  expect((await events.named('payment_failed')).at(-1)).toMatchObject({ reason: 'declined', source: 'membership' });
});

test('a #club link opens it, from the header too', async ({ page }) => {
  await page.goto('/#club');
  await expect(dialog(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Club' }).click();
  await expect(dialog(page)).toBeVisible();
});

test('the banner shows the price in the chosen currency', async ({ page }) => {
  await page.locator('#currency-picker').selectOption('GBP');
  await expect(page.locator('#club-banner-track')).toContainText('£');
});

test('each sign-up gets a fresh demo email', async ({ page }) => {
  await page.locator('#club-banner').click();
  const email = page.locator('#club-email');
  await expect(email).not.toHaveValue('');
  const first = await email.inputValue();

  await page.getByRole('button', { name: 'Start free trial' }).click();
  await page.getByRole('button', { name: 'Back to the shop' }).click();
  await page.locator('#club-banner').click();

  await expect(email).not.toHaveValue('');
  await expect(email).not.toHaveValue(first);
});
