import { expect, test } from '@playwright/test';
import { ALICE_ID, adminClient, resetUser, seedPair, seedWord } from '../helpers/admin.js';
import { AUTOFILL_ERROR, signInAlice, stubAutofill } from '../helpers/e2e.js';

// Needs `supabase start` with the seeded users and a .env with the local URL, anon key and service-role key.
const admin = adminClient();
const BAR = 'Something went wrong. Reload the page if it keeps happening.';

test.beforeEach(async ({ page }) => {
  await stubAutofill(page, AUTOFILL_ERROR);
  await resetUser(admin, ALICE_ID);
  const pair = await seedPair(admin, ALICE_ID);
  await seedWord(admin, ALICE_ID, pair.id, { term: 'Haus', translations: ['house'], forms: { article: 'das' } });
});

test.describe('error bar', () => {
  test('shows once for an uncaught error and can be dismissed', async ({ page }) => {
    await signInAlice(page);
    await expect(page.getByText(BAR)).toBeHidden();

    await page.evaluate(() => setTimeout(() => { throw new Error('boom'); }, 0));
    await expect(page.getByText(BAR)).toBeVisible();

    await page.evaluate(() => setTimeout(() => { throw new Error('boom again'); }, 0));
    await page.waitForTimeout(200);
    await expect(page.getByText(BAR)).toHaveCount(1);

    await page.getByRole('button', { name: 'Dismiss' }).click();
    await expect(page.getByText(BAR)).toBeHidden();

    await page.evaluate(() => setTimeout(() => Promise.reject(new Error('nobody caught this')), 0));
    await expect(page.getByText(BAR)).toBeVisible();
  });

  test('also shows on the sign-in page', async ({ page }) => {
    await page.goto('/signin.html');
    await page.evaluate(() => setTimeout(() => { throw new Error('boom'); }, 0));
    await expect(page.getByText(BAR)).toBeVisible();
  });
});

test.describe('Alt+A', () => {
  test('opens Add word from Home', async ({ page }) => {
    await signInAlice(page);
    await page.keyboard.press('Alt+KeyA');
    await expect(page).toHaveURL(/\/add\.html$/);
  });

  test('does nothing on Add word, and not on the sign-in page', async ({ page }) => {
    await signInAlice(page);
    await page.goto('/add.html');
    await page.locator('#term-input').fill('Ha');
    await page.keyboard.press('Alt+KeyA');
    await expect(page).toHaveURL(/\/add\.html$/);
    await expect(page.locator('#term-input')).toHaveValue('Ha');

    await page.goto('/signin.html');
    await page.keyboard.press('Alt+KeyA');
    await expect(page).toHaveURL(/\/signin\.html$/);
  });
});

test('no page scrolls sideways on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signInAlice(page);
  for (const path of ['/', '/review.html', '/add.html', '/words.html', '/settings.html']) {
    await page.goto(path);
    await expect(page.locator('h1')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${path} overflows by ${overflow}px`).toBeLessThanOrEqual(0);
  }
});

test.describe('navigation shortcuts', () => {
  test('Alt+W opens Words from Home', async ({ page }) => {
    await signInAlice(page);
    await page.keyboard.press('Alt+KeyW');
    await expect(page).toHaveURL(/\/words\.html$/);
  });

  test('Alt+H works with the Words search focused and types nothing', async ({ page }) => {
    await signInAlice(page);
    await page.goto('/words.html');
    await page.locator('#search').focus();
    await page.keyboard.press('Alt+KeyH');
    await expect(page).toHaveURL(/\/$/);
    await page.goBack();
    await expect(page.locator('#search')).toHaveValue('');
  });

  test('N opens Add word from Home', async ({ page }) => {
    await signInAlice(page);
    await page.keyboard.press('KeyN');
    await expect(page).toHaveURL(/\/add\.html$/);
  });
});

test.describe('sidebar', () => {
  test('collapse is remembered on the next page, then expands', async ({ page }) => {
    await signInAlice(page);
    await page.getByRole('button', { name: 'Collapse sidebar' }).click();
    await expect(page.locator('.v-sidebar')).toHaveClass(/is-collapsed/);
    await page.goto('/words.html');
    await expect(page.locator('.v-sidebar')).toHaveClass(/is-collapsed/);
    await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
    await page.getByRole('button', { name: 'Expand sidebar' }).click();
    await expect(page.locator('.v-sidebar')).not.toHaveClass(/is-collapsed/);
    await expect(page.locator('.v-sidebar .v-key').first()).toBeHidden();
  });

  test('shortcut chip shows as a right-side tooltip on hover, with the label when collapsed', async ({ page }) => {
    await signInAlice(page);
    const link = page.getByRole('link', { name: 'Words' });
    const chip = link.locator('.v-key');
    await expect(chip).toBeHidden();
    await link.hover();
    await expect(chip).toBeVisible();
    await expect(chip).toHaveText('Alt+W');
    const [l, s] = await page.evaluate(() => [
      document.querySelector('a[href="/words.html"] .v-key').getBoundingClientRect().left,
      document.querySelector('.v-sidebar').getBoundingClientRect().right,
    ]);
    expect(l).toBeGreaterThanOrEqual(s);
    await page.mouse.move(600, 400);
    await expect(chip).toBeHidden();
    await page.getByRole('button', { name: 'Collapse sidebar' }).click();
    await link.hover();
    await expect(chip).toBeVisible();
    expect(await chip.evaluate((e) => getComputedStyle(e, '::before').content)).toBe('"Words"');
  });

  test('reaches the bottom of a tall window and after scrolling Words', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1400 });
    await signInAlice(page);
    // The body stays hidden until the session check finishes, so wait before measuring.
    const bottom = async () => {
      await expect(page.locator('.v-sidebar')).toBeVisible();
      return page.evaluate(() => [document.querySelector('.v-sidebar').getBoundingClientRect().bottom, innerHeight]);
    };
    const [home, height] = await bottom();
    expect(home).toBe(height);

    const pair = (await admin.from('language_pairs').select('id').eq('user_id', ALICE_ID).single()).data;
    for (let i = 0; i < 40; i += 1) await seedWord(admin, ALICE_ID, pair.id, { term: `Wort${i}`, translations: ['word'] });
    await page.setViewportSize({ width: 1280, height: 500 });
    await page.goto('/words.html');
    await expect(page.locator('h1')).toBeVisible();
    await page.mouse.wheel(0, 2000);
    const [scrolled, h] = await bottom();
    expect(scrolled).toBe(h);
  });

  test('Review footer sits at the bottom of the window', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1200 });
    await signInAlice(page);
    await page.goto('/review.html');
    await expect(page.locator('#focus-foot')).toBeVisible();
    const gap = await page.evaluate(() => innerHeight - document.querySelector('#focus-foot').getBoundingClientRect().bottom);
    expect(gap).toBeLessThanOrEqual(1);
  });
});

test.describe('Add word focus', () => {
  test('input is focused after load and after Alt+A', async ({ page }) => {
    await signInAlice(page);
    await page.goto('/add.html');
    await expect(page.locator('#term-input')).toBeFocused();
    await page.goto('/words.html');
    await page.keyboard.press('Alt+KeyA');
    await expect(page).toHaveURL(/\/add\.html$/);
    await expect(page.locator('#term-input')).toBeFocused();
  });
});
