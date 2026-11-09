import { expect, test } from '@playwright/test';
import { pinIn, registerTablet, shot } from './helpers.ts';

// Needs the local stack with the demo seed: pnpm db:start (or db:reset).

test('owner registers a tablet, then staff sign in with a PIN, online and offline', async ({
  page,
  context,
}, info) => {
  // A fresh browser has no device, so it goes to owner sign-in.
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('Email').fill('owner@demo-coffee.test');
  await page.getByLabel('Password').fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('That email and password don’t match.')).toBeVisible();
  await page.screenshot({ path: shot('login', info.project.name) });

  await registerTablet(page);

  // The PIN screen lists PIN staff at this outlet only; owners never PIN in.
  await expect(page.getByRole('button', { name: /Priya Sharma/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Aditi Verma/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Imran Khan/ })).toHaveCount(0);
  await page.screenshot({ path: shot('pin-choose', info.project.name) });

  // A wrong PIN is checked on the fourth digit, with no extra tap.
  await pinIn(page, 'Priya Sharma', '9999');
  await expect(page.getByRole('alert')).toHaveText(/Wrong PIN\. \d tries left\./);
  await page.screenshot({ path: shot('pin-wrong', info.project.name) });

  await page.keyboard.type('1357');
  await expect(page.getByRole('button', { name: 'Lock' })).toBeVisible();
  await expect(page).toHaveURL(/\/counter$/);

  await page.getByRole('button', { name: 'Lock' }).click();
  await expect(page).toHaveURL(/\/pin$/);

  // Offline: the PIN is checked against the cached roster.
  await context.setOffline(true);
  await expect(page.getByRole('status').first()).toHaveText(/Offline/);
  await pinIn(page, 'Priya Sharma', '1357');
  await expect(page.getByText(/signed in on this tablet/)).toBeVisible();
  await context.setOffline(false);
});

test('a PIN starting with 0 can be typed', async ({ page }) => {
  await registerTablet(page);
  await page.getByRole('button', { name: /Priya Sharma/ }).click();
  await page.keyboard.type('02');
  // Two dots filled means the leading zero was kept (amount pads would drop it).
  await expect(page.locator('[aria-label="Enter PIN"] .bg-ink')).toHaveCount(2);
});
