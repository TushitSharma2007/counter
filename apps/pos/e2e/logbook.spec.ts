import { expect, test } from '@playwright/test';
import { ownerSignIn, pinIn, registerTablet, shot, startDay } from './helpers.ts';

// Needs the local stack with the demo seed: pnpm db:start (or db:reset).

test('start the day, take cash out, close short, and the owner reads it in the log book', async ({
  page,
  browser,
}, info) => {
  test.skip(
    info.project.name !== 'tablet',
    'one run: a tablet keeps the drawer, a laptop reads it',
  );
  const reason = `Milk from Sanchi ${String(Date.now()).slice(-5)}`;

  await registerTablet(page);
  await pinIn(page, 'Priya Sharma', '1357');
  await expect(page.getByRole('heading', { name: 'Start the day' })).toBeVisible();
  await page.screenshot({ path: shot('start-day', info.project.name) });
  await startDay(page, '2000');

  // One Veg Puff (₹39), paid in cash.
  await page.getByRole('button', { name: /^Veg Puff,/ }).click();
  await page
    .getByRole('complementary', { name: 'Bill' })
    .getByRole('button', { name: 'Pay ₹39' })
    .click();
  await page
    .getByRole('dialog', { name: 'Take payment' })
    .getByRole('button', { name: 'Bill paid' })
    .click();
  await page
    .getByRole('dialog', { name: 'Bill paid' })
    .getByRole('button', { name: 'New bill' })
    .click();

  // ₹450 out for milk.
  await page.getByRole('button', { name: 'Cash drawer' }).click();
  const drawer = page.getByRole('dialog', { name: 'Cash drawer' });
  await expect(drawer).toContainText('₹2,039');
  await drawer.getByRole('button', { name: 'Cash out' }).click();
  const out = page.getByRole('dialog', { name: 'Cash out' });
  await out
    .getByRole('group', { name: 'Cash out amount' })
    .getByRole('button', { name: '4' })
    .click();
  await out
    .getByRole('group', { name: 'Cash out amount' })
    .getByRole('button', { name: '5' })
    .click();
  await out
    .getByRole('group', { name: 'Cash out amount' })
    .getByRole('button', { name: '0', exact: true })
    .click();
  await out.getByLabel('Or type a reason').fill(reason);
  await out.getByRole('button', { name: 'Note cash out · ₹450' }).click();
  await expect(drawer).toContainText('₹1,589');
  await page.screenshot({ path: shot('drawer', info.project.name) });

  // Close: ₹1,580 counted, so ₹9 short.
  await drawer.getByRole('button', { name: 'Close the day' }).click();
  const closing = page.getByRole('dialog', { name: 'Close the day' });
  const pad = closing.getByRole('group', { name: 'Counted cash' });
  for (const key of ['1', '5', '8'])
    await pad.getByRole('button', { name: key, exact: true }).click();
  await pad.getByRole('button', { name: '0', exact: true }).click();
  await expect(closing).toContainText('₹9 short');
  await closing.getByLabel('Note for the owner (optional)').fill('Gave change from my pocket');
  await closing.getByRole('button', { name: 'Close the day' }).click();

  await expect(page.getByRole('heading', { name: 'Day closed' })).toBeVisible();
  await page.screenshot({ path: shot('day-closed', info.project.name) });
  await page.getByRole('button', { name: 'Done' }).click();
  // The next day offers what was counted as the opening cash.
  await expect(page.getByRole('button', { name: 'Same as last close · ₹1,580' })).toBeVisible();

  // The owner, on a laptop: today's page in the log book, once the tablet has synced.
  const laptopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const laptop = await laptopContext.newPage();
  await ownerSignIn(laptop);
  await laptop.getByRole('link', { name: /^Log book/ }).click();
  const entry = laptop.getByRole('region', { name: /^T\d+ / }).filter({ hasText: reason });
  await expect(async () => {
    await laptop.reload();
    await expect(entry).toContainText('Counted', { timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  await expect(entry).toContainText('₹9 short');
  await expect(entry).toContainText('Gave change from my pocket');
  await expect(entry).toContainText('Priya Sharma');
  await laptop.screenshot({ path: shot('logbook', 'desktop'), fullPage: true });
  await laptopContext.close();
});
