import { expect, test } from '@playwright/test';

// Screenshots for design review (CLAUDE.md §9). Written to screenshots/, which is not committed.
const shot = (name: string, project: string) => `screenshots/${name}-${project}.png`;

test.beforeEach(async ({ page }) => {
  await page.goto('/playground');
  await expect(page.getByRole('heading', { name: 'Price tag' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
});

test('light and night themes', async ({ page }, info) => {
  await page.screenshot({ path: shot('playground-light', info.project.name), fullPage: true });
  await page.getByRole('button', { name: 'Night' }).click();
  await page.screenshot({ path: shot('playground-night', info.project.name), fullPage: true });
});

test('cart sheet and void dialog', async ({ page }, info) => {
  await page.getByRole('button', { name: 'Open cart' }).click();
  await expect(page.getByRole('dialog', { name: 'Bill' })).toBeVisible();
  await page.waitForTimeout(250); // let the sheet finish sliding in
  await page.screenshot({ path: shot('sheet', info.project.name) });
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Void bill' }).last().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.waitForTimeout(250);
  await page.screenshot({ path: shot('dialog', info.project.name) });
});

test('prices use tabular figures', async ({ page }) => {
  const variants = await page
    .locator('.num')
    .evaluateAll((nodes) => [...new Set(nodes.map((n) => getComputedStyle(n).fontVariantNumeric))]);
  expect(variants).toEqual(['tabular-nums']);
});

test('the number pad works from the keyboard', async ({ page }) => {
  const pad = page.getByRole('group', { name: 'Cash received' });
  await pad.getByRole('button', { name: 'Delete' }).click();
  await pad.getByRole('button', { name: 'Delete' }).click();
  await pad.getByRole('button', { name: 'Delete' }).click();
  await page.keyboard.type('400');
  await expect(page.getByText('Change to return')).toBeVisible();
});
