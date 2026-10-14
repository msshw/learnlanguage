import { expect, test } from '@playwright/test';
import { ALICE_ID, adminClient, resetUser, seedPair, seedWord } from '../helpers/admin.js';
import { AUTOFILL_ERROR, signInAs, stubAutofill } from '../helpers/e2e.js';

// Needs `supabase start` with the seeded users and a .env with the local URL, anon key and service-role key.
// The function is stubbed to fail, so Add word falls straight through to the manual form.
test.beforeEach(async ({ page }) => {
  await stubAutofill(page, AUTOFILL_ERROR);
  await resetUser(adminClient(), ALICE_ID);
});

test('first sign-in shows Setup, and Setup never shows again', async ({ page }) => {
  await page.goto('/signin.html');
  await signInAs(page, 'alice@test.local', 'password123');

  await expect(page).toHaveURL(/\/setup\.html$/);
  await page.getByRole('button', { name: 'Start learning' }).click();
  await expect(page).toHaveURL('/');
  await expect(page.getByText('No words yet')).toBeVisible();

  await page.goto('/setup.html');
  await expect(page).toHaveURL('/');
});

test('add, duplicate warning, search and delete', async ({ page }) => {
  await seedPair(adminClient(), ALICE_ID);
  await page.goto('/signin.html');
  await signInAs(page, 'alice@test.local', 'password123');
  await expect(page).toHaveURL('/');

  // add a noun: article is required
  await page.goto('/add.html');
  await page.locator('#term-input').fill('Haus');
  await page.locator('#term-input').press('Enter');
  const form = page.locator('#word-form');
  await form.locator('[name=translations]').fill('house, home');
  await form.getByRole('button', { name: 'Save word' }).click();
  await expect(form.getByText('Choose an article')).toBeVisible();

  await form.locator('[name=article]').selectOption('das');
  await form.getByRole('button', { name: 'Save word' }).click();
  await expect(page.getByText('Word saved')).toBeVisible();
  await expect(page.locator('#term-input')).toHaveValue('');

  // article typed into the term is rejected
  await page.locator('#term-input').fill('die Bank');
  await page.locator('#term-input').press('Enter');
  await form.locator('[name=translations]').fill('bank');
  await form.locator('[name=article]').selectOption('die');
  await form.getByRole('button', { name: 'Save word' }).click();
  await expect(form.getByText('Enter the article in its own field')).toBeVisible();
  await form.getByRole('button', { name: 'Cancel' }).click();

  // duplicate warning, case-insensitive
  await page.locator('#term-input').fill('  haus ');
  await page.locator('#term-input').press('Enter');
  await expect(page.getByText('This word already exists.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open word' })).toBeVisible();
  await page.getByRole('button', { name: 'Add anyway' }).click();
  await expect(form).toBeVisible();

  // Words: row, search by term and translation, no results
  await page.goto('/words.html');
  await expect(page.getByRole('cell', { name: 'das Haus', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'house, home' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Today', exact: true })).toBeVisible();

  await page.getByLabel('Search words').fill('hous');
  await expect(page.getByRole('cell', { name: 'das Haus', exact: true })).toBeVisible();
  await page.getByLabel('Search words').fill('zzz');
  await expect(page.getByText('No results')).toBeVisible();
  await page.getByLabel('Search words').fill('');

  // Home shows the count
  await page.goto('/');
  await expect(page.locator('#word-count')).toHaveText('1');
  await expect(page.getByText('No words yet')).toBeHidden();

  // delete, from the edit view, after a confirm step that can be backed out of
  await page.goto('/words.html');
  await expect(page.locator('#word-total')).toHaveText('1');
  await page.getByRole('button', { name: 'Edit das Haus' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Keep word' }).click();
  await expect(page.getByRole('button', { name: 'Delete word' })).toBeHidden();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Delete word' }).click();
  await expect(page.getByText('No words yet')).toBeVisible();
});

test('word page: open from a row, back, edit stays, not found', async ({ page }) => {
  const admin = adminClient();
  const pair = await seedPair(admin, ALICE_ID);
  const bank = await seedWord(admin, ALICE_ID, pair.id, {
    term: 'Bank',
    forms: { article: 'die' },
    hint_en: 'bank (money)',
    translations: ['bank'],
    example_de: 'Die Bank ist <b>offen</b>.',
    example_en: 'The bank is open.',
  });
  const gone = await seedWord(admin, ALICE_ID, pair.id, { term: 'Baum', translations: ['tree'] });
  await admin.from('words').update({ deleted_at: new Date().toISOString() }).eq('id', gone.id);

  await page.goto('/signin.html');
  await signInAs(page, 'alice@test.local', 'password123');
  await expect(page).toHaveURL('/');

  // click a cell that is not the link
  await page.goto('/words.html');
  await page.getByRole('cell', { name: 'bank', exact: true }).click();
  await expect(page).toHaveURL(`/word.html?id=${bank.id}`);
  await expect(page.locator('#term .v-art--die')).toHaveText('die');
  await expect(page.locator('#term')).toContainText('Bank');
  await expect(page.getByText('bank (money)')).toBeVisible();
  await expect(page.locator('#pos')).toHaveText('noun');
  await expect(page.locator('#translations')).toHaveText('bank');
  await expect(page.locator('#example-de')).toHaveText('Die Bank ist <b>offen</b>.');
  await expect(page.locator('#example-de b')).toHaveCount(0);
  await expect(page.getByText('The bank is open.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Words', exact: true })).toHaveAttribute('aria-current', 'page');

  // back with Escape and with the button
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/words\.html$/);
  await page.getByRole('link', { name: 'die Bank' }).click();
  await page.getByRole('link', { name: 'Back to words' }).click();
  await expect(page).toHaveURL(/\/words\.html$/);

  // Edit still opens the dialog, not the page
  await page.getByRole('button', { name: 'Edit die Bank' }).click();
  await expect(page.getByRole('heading', { name: 'Edit word' })).toBeVisible();
  await expect(page).toHaveURL(/\/words\.html$/);

  // deleted and malformed ids
  await page.goto(`/word.html?id=${gone.id}`);
  await expect(page.getByRole('heading', { name: 'Word not found' })).toBeVisible();
  await expect(page.getByText('Baum')).toBeHidden();
  await page.goto('/word.html?id=abc');
  await expect(page.getByRole('heading', { name: 'Word not found' })).toBeVisible();
});
