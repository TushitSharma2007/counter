import { expect, type Page } from '@playwright/test';

export const shot = (name: string, project: string) => `screenshots/${name}-${project}.png`;

/** Owner signs in on their own phone and lands on My outlets. */
export async function ownerSignIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('owner@demo-coffee.test');
  await page.getByLabel('Password').fill('demo-owner-2026');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/home$/);
}

/** Owner signs in and registers this browser as a shared counter tablet at Arera Colony. */
export async function registerTablet(page: Page) {
  await ownerSignIn(page);
  await page.getByRole('link', { name: 'Set up this device as a shared counter' }).click();
  await expect(page).toHaveURL(/\/device\/setup$/);
  await page.getByRole('radio', { name: /Arera Colony/ }).check();
  await page.getByRole('button', { name: 'Register device' }).click();
  await expect(page).toHaveURL(/\/pin$/);
}

/** Taps a staff member and types their PIN; the pad signs in on the fourth digit. */
export async function pinIn(page: Page, name: string, pin: string) {
  await page.getByRole('button', { name: new RegExp(name) }).click();
  // The pad listens for keys once it is on screen.
  await expect(page.getByRole('group', { name: `PIN for ${name}` })).toBeVisible();
  await page.keyboard.type(pin);
}

/** A counter tablet starts the day by counting the cash in the drawer. */
export async function startDay(page: Page, rupees = '2000') {
  await expect(page.getByRole('heading', { name: 'Start the day' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Opening cash' })).toBeVisible();
  await page.keyboard.type(rupees);
  await page.getByRole('button', { name: /^Start the day with/ }).click();
  await expect(page.getByRole('region', { name: 'All items' })).toBeVisible();
}
