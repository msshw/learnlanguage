import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { ALICE_ID, adminClient, resetUser, seedPair, seedWord } from '../helpers/admin.js';
import { signInAlice, stubAutofill } from '../helpers/e2e.js';

// Needs `supabase start` with the seeded users and a .env with the local URL, anon key and service-role key.
const admin = adminClient();
const resetLimit = () => admin.from('profiles').update({ new_words_per_day: 10 }).eq('id', ALICE_ID);

test.beforeEach(async ({ page }) => {
  await stubAutofill(page, { status: 'ok', spent_usd: 0.5, cap_usd: 2 });
  await resetUser(admin, ALICE_ID);
  await resetLimit();
  await seedPair(admin, ALICE_ID);
  await signInAlice(page);
  await page.goto('/settings.html');
});

test.afterEach(resetLimit);

test('shows the pair and this month\'s AI usage', async ({ page }) => {
  await expect(page.getByText('German ← English')).toBeVisible();
  await expect(page.locator('#usage')).toHaveText('$0.50 of $2.00');
  await expect(page.locator('#usage-bar span')).toHaveAttribute('style', /width: 25%/);
  await expect(page.getByText('alice@test.local')).toBeVisible();
  await expect(page.getByText('not built yet')).toBeHidden();
});

test('shows "Usage unavailable" when the function fails, and the rest still works', async ({ page }) => {
  await stubAutofill(page, { status: 'error' });
  await page.reload();
  await expect(page.locator('#usage')).toHaveText('Usage unavailable');
  await page.locator('#limit').fill('4');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Saved')).toBeVisible();
});

test('the daily limit saves, persists, and rejects bad values', async ({ page }) => {
  await expect(page.locator('#limit')).toHaveValue('10');

  await page.locator('#limit').fill('3');
  await page.locator('#limit').press('Enter');
  await expect(page.getByText('Saved')).toBeVisible();
  await page.reload();
  await expect(page.locator('#limit')).toHaveValue('3');

  for (const bad of ['101', '-1', '2.5', '']) {
    await page.locator('#limit').fill(bad);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Enter a whole number from 0 to 100')).toBeVisible();
    await expect(page.getByText('Saved')).toBeHidden();
  }
  const { data } = await admin.from('profiles').select('new_words_per_day').eq('id', ALICE_ID).single();
  expect(data.new_words_per_day).toBe(3);

  await page.locator('#limit').fill('0');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Saved')).toBeVisible();
});

test('export downloads one JSON file with deleted words too', async ({ page }) => {
  const { data: pair } = await admin.from('language_pairs').select('id').eq('user_id', ALICE_ID).single();
  await seedWord(admin, ALICE_ID, pair.id, { term: 'Haus', translations: ['house'], forms: { article: 'das' } });
  const gone = await seedWord(admin, ALICE_ID, pair.id, { term: 'Baum', translations: ['tree'], forms: { article: 'der' } });
  await admin.from('words').update({ deleted_at: new Date().toISOString() }).eq('id', gone.id);

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export my data' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^vocab-export-\d{4}-\d{2}-\d{2}\.json$/);

  const out = JSON.parse(readFileSync(await file.path(), 'utf8'));
  expect(out.version).toBe(1);
  expect(out.words.map((w) => w.term).sort()).toEqual(['Baum', 'Haus']);
  expect(out.words.find((w) => w.term === 'Baum').deleted_at).not.toBeNull();
  expect(out.cards).toHaveLength(4);
  expect(out.review_logs).toEqual([]);
});

test('sign out ends the session', async ({ page }) => {
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/signin\.html/);

  await page.goto('/words.html');
  await expect(page).toHaveURL(/\/signin\.html\?returnTo=%2Fwords\.html/);
});
