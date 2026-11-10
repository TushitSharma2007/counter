import { expect, test } from '@playwright/test';
import { ownerSignIn, shot } from './helpers.ts';

// Needs the local stack with the demo seed: pnpm db:start (or db:reset).
// Each run adds its own item (unique code), so it can run again and again.

test('the owner adds an item, prices it per outlet and marks it sold out', async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== 'desktop',
    'menu management is a PC-first screen; one run is enough',
  );
  const code = `K${Date.now().toString(36).slice(-4).toUpperCase()}`;
  const name = `Filter Kaapi ${code}`;

  await ownerSignIn(page);
  await page.getByRole('link', { name: /^Menu/ }).click();
  await expect(page.getByText(/\d+ items · 6 categories/)).toBeVisible();
  await page.screenshot({ path: shot('menu', info.project.name), fullPage: true });

  // Add the item.
  await page.getByRole('button', { name: 'Add item' }).click();
  const editor = page.getByRole('dialog', { name: 'Add an item' });
  await editor.getByLabel('Name').fill(name);
  await editor.getByLabel('Code').fill(code);
  await editor.getByLabel('Category').selectOption({ label: 'Tea' });
  await editor.getByLabel('Price', { exact: true }).fill('59');
  await editor.getByLabel('Arera Colony price').fill('65');
  await page.screenshot({ path: shot('menu-editor', info.project.name) });
  await editor.getByRole('button', { name: 'Add to menu' }).click();
  await expect(page.getByText('Item added', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Tea' }).getByText(name)).toBeVisible();

  // Sold out at MP Nagar.
  await page.getByLabel('Prices and availability at').selectOption({ label: 'At MP Nagar' });
  await page.getByRole('switch', { name: `${name} available at MP Nagar` }).click();
  await expect(page.getByRole('switch', { name: `${name} available at MP Nagar` })).toHaveAttribute(
    'aria-checked',
    'false',
  );

  // Billing at Arera Colony: found by code, at the outlet's own price.
  await page.getByRole('link', { name: 'My outlets' }).click();
  await page.getByRole('link', { name: /Arera Colony/ }).click();
  await expect(page.getByRole('region', { name: 'All items' })).toBeVisible(); // menu loaded
  await page.keyboard.press('/');
  await page.keyboard.type(code);
  await expect(page.getByRole('region', { name: `Results for “${code}”` })).toBeVisible();
  await expect(page.getByRole('button', { name: new RegExp(`^${name}, ₹65`) })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('complementary', { name: 'Bill' }).getByRole('button', { name: 'Pay ₹65' }),
  ).toBeVisible();

  // Billing at MP Nagar: menu price, and sold out, so it can't be added.
  await page.getByRole('button', { name: 'Outlets' }).click();
  await page.getByRole('link', { name: /MP Nagar/ }).click();
  await expect(page.getByRole('region', { name: 'All items' })).toBeVisible();
  await page.keyboard.press('/');
  await page.keyboard.type(code);
  const tile = page.getByRole('button', { name: new RegExp(`^${name}, sold out`) });
  await expect(tile).toBeDisabled();
  await page.screenshot({ path: shot('billing-sold-out', info.project.name) });
});
