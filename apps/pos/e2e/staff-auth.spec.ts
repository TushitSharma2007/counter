import { expect, test } from '@playwright/test';

// Needs the local stack with the demo seed: pnpm db:start (or db:reset).
const shot = (name: string, project: string) => `screenshots/${name}-${project}.png`;

test('owner registers a tablet, then staff sign in with a PIN, online and offline', async ({
  page,
  context,
}, info) => {
  // A fresh browser has no device, so it goes to owner sign-in.
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await page.screenshot({ path: shot('login', info.project.name) });

  await page.getByLabel('Email').fill('owner@demo-coffee.test');
  await page.getByLabel('Password').fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('That email and password don\u2019t match.')).toBeVisible();

  await page.getByLabel('Password').fill('demo-owner-2026');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/device\/setup$/);
  await page.getByRole('radio', { name: /Arera Colony/ }).check();
  await page.screenshot({ path: shot('device-setup', info.project.name) });
  await page.getByRole('button', { name: 'Register device' }).click();

  // The owner is signed out; the PIN screen lists PIN staff at this outlet only.
  await expect(page).toHaveURL(/\/pin$/);
  await expect(page.getByRole('button', { name: /Priya Sharma/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Aditi Verma/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Imran Khan/ })).toHaveCount(0);

  await page.getByRole('button', { name: /Priya Sharma/ }).click();
  await page.keyboard.type('9999');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alert')).toHaveText(/Wrong PIN\. \d tries left\./);
  await page.screenshot({ path: shot('pin', info.project.name) });

  await page.keyboard.type('1357');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Lock' })).toBeVisible();
  await expect(page.getByRole('main').getByText('Priya Sharma')).toBeVisible();

  await page.getByRole('button', { name: 'Lock' }).click();
  await expect(page).toHaveURL(/\/pin$/);

  // Offline: the PIN is checked against the cached roster.
  await context.setOffline(true);
  await expect(page.getByRole('status')).toHaveText(/Offline/);
  await page.getByRole('button', { name: /Priya Sharma/ }).click();
  await page.keyboard.type('1357');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/counter$/);
  await expect(page.getByText('Signed in offline')).toBeVisible();
  await page.screenshot({ path: shot('counter-offline', info.project.name) });
  await context.setOffline(false);
});
