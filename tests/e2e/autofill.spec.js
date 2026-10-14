import { expect, test } from '@playwright/test';
import { ALICE_ID, adminClient, resetUser, seedPair } from '../helpers/admin.js';
import { signInAs, stubAutofill } from '../helpers/e2e.js';

// Needs `supabase start` with the seeded users and a .env with the local URL, anon key and service-role key.
// The autofill function is always stubbed here; the real one is checked by scripts/autofill-quality.mjs.

const BANK_MONEY = {
  term: 'Bank',
  part_of_speech: 'noun',
  translations: ['bank'],
  hint_en: 'bank (money)',
  forms: { article: 'die', plural: 'Banken' },
  example_de: 'Ich gehe heute zur Bank.',
  example_en: "I'm going to the bank today.",
};
const BANK_SEAT = {
  ...BANK_MONEY,
  translations: ['bench'],
  hint_en: 'bench (seat)',
  forms: { article: 'die', plural: 'Bänke' },
  example_de: 'Wir sitzen auf der Bank im Park.',
};
const OK_BANK = { status: 'ok', senses: [BANK_MONEY, BANK_SEAT] };

const admin = adminClient();

test.beforeEach(async ({ page }) => {
  await resetUser(admin, ALICE_ID);
  await seedPair(admin, ALICE_ID);
  await page.goto('/signin.html');
  await signInAs(page, 'alice@test.local', 'password123');
  await expect(page).toHaveURL('/');
  await page.goto('/add.html');
});

const enter = async (page, term) => {
  await page.locator('#term-input').fill(term);
  await page.locator('#term-input').press('Enter');
};

const savedWords = async () =>
  (await admin.from('words').select('term, source, translations, forms').eq('user_id', ALICE_ID)).data;

test('picking a sense fills the form and saves as ai_confirmed', async ({ page }) => {
  await stubAutofill(page, OK_BANK);
  await enter(page, 'Bank');

  await expect(page.getByText('bench (seat)')).toBeVisible();
  await page.keyboard.press('2');

  const form = page.locator('#word-form');
  await expect(form.locator('[name=translations]')).toHaveValue('bench');
  await expect(form.locator('[name=article]')).toHaveValue('die');
  await expect(form.locator('[name=plural]')).toHaveValue('Bänke');
  await expect(form.locator('[name=hint_en]')).toHaveValue('bench (seat)');
  expect(await savedWords()).toEqual([]);

  await form.getByRole('button', { name: 'Save word' }).click();
  await expect(page.getByText('Word saved')).toBeVisible();
  const [word] = await savedWords();
  expect(word).toMatchObject({ term: 'Bank', source: 'ai_confirmed', translations: ['bench'], forms: { article: 'die', plural: 'Bänke' } });
});

test('Enter picks the first sense', async ({ page }) => {
  await stubAutofill(page, OK_BANK);
  await enter(page, 'Bank');
  await expect(page.getByText('bank (money)')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('#word-form [name=translations]')).toHaveValue('bank');
});

test('not a word offers manual entry', async ({ page }) => {
  await stubAutofill(page, { status: 'not_a_word', senses: [] });
  await enter(page, 'table');
  await expect(page.getByText('Not recognized as German')).toBeVisible();
  await page.getByRole('button', { name: 'Save manually anyway' }).click();

  const form = page.locator('#word-form');
  await expect(form.locator('[name=term]')).toHaveValue('table');
  await expect(form.locator('[name=translations]')).toHaveValue('');
  await form.locator('[name=part_of_speech]').selectOption('other');
  await form.locator('[name=translations]').fill('Tisch');
  await form.getByRole('button', { name: 'Save word' }).click();
  await expect(page.getByText('Word saved')).toBeVisible();
  expect((await savedWords())[0].source).toBe('manual');
});

test('skip while pending shows the manual form and ignores the late answer', async ({ page }) => {
  await stubAutofill(page, async () => {
    await new Promise((r) => setTimeout(r, 1500));
    return OK_BANK;
  });
  await enter(page, 'Bank');
  await page.getByRole('button', { name: 'Skip suggestions' }).click();

  const form = page.locator('#word-form');
  await expect(form.locator('[name=term]')).toHaveValue('Bank');
  await page.waitForTimeout(2500);
  await expect(form).toBeVisible();
  await expect(page.locator('#senses')).toBeHidden();
  await expect(form.locator('[name=translations]')).toHaveValue('');
});

test('a corrected term that already exists shows the duplicate warning', async ({ page }) => {
  const { data: pair } = await admin.from('language_pairs').select('id').eq('user_id', ALICE_ID).single();
  const { error } = await admin.from('words').insert({
    user_id: ALICE_ID,
    pair_id: pair.id,
    term: 'Mädchen',
    part_of_speech: 'noun',
    translations: ['girl'],
    forms: { article: 'das' },
  });
  expect(error).toBeNull();

  await stubAutofill(page, {
    status: 'ok',
    senses: [{ ...BANK_MONEY, term: 'Mädchen', translations: ['girl'], hint_en: 'girl (child)', forms: { article: 'das', plural: 'Mädchen' } }],
  });
  await enter(page, 'madchen');
  await expect(page.getByText('This word already exists.')).toBeVisible();
  await page.getByRole('button', { name: 'Add anyway' }).click();
  await expect(page.getByText('girl (child)')).toBeVisible();
});

test('a request that never answers falls back to the manual form within 8 seconds', async ({ page }) => {
  await stubAutofill(page, null);
  await enter(page, 'Bank');
  await expect(page.getByText('Suggestions unavailable')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('#word-form [name=term]')).toHaveValue('Bank');
});

test('a picked sense that is cancelled does not make the next manual word ai_confirmed', async ({ page }) => {
  await stubAutofill(page, OK_BANK);
  await enter(page, 'Bank');
  await expect(page.getByText('bank (money)')).toBeVisible();
  await page.keyboard.press('1');
  await expect(page.locator('#word-form [name=translations]')).toHaveValue('bank');
  await page.locator('#word-form').getByRole('button', { name: 'Cancel' }).click();

  await stubAutofill(page, { status: 'error', senses: [] });
  await enter(page, 'Haus');
  const form = page.locator('#word-form');
  await form.locator('[name=translations]').fill('house');
  await form.locator('[name=article]').selectOption('das');
  await form.getByRole('button', { name: 'Save word' }).click();
  await expect(page.getByText('Word saved')).toBeVisible();
  const [word] = await savedWords();
  expect(word).toMatchObject({ term: 'Haus', source: 'manual' });
});

// Answers suggestion requests with `fresh` and records every confirm request.
const stubWithConfirms = async (page, fresh, confirmStatus = 200) => {
  const confirms = [];
  await page.route('**/functions/v1/autofill', async (route) => {
    const body = route.request().postDataJSON();
    const isConfirm = body?.action === 'confirm';
    if (isConfirm) confirms.push(body);
    await route.fulfill({
      status: isConfirm ? confirmStatus : 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(isConfirm ? { status: 'ok' } : fresh),
    });
  });
  return confirms;
};

// Served senses carry the stored index and state. Index 0 is rejected elsewhere, so the shown
// list starts at stored index 1: an unchanged pick must send the stored index, not the position.
const withState = (state) => [{ ...BANK_MONEY, index: 1, state }, { ...BANK_SEAT, index: 2, state }];
const CANDIDATE = {
  status: 'ok', senses: withState('candidate'), suggestion_id: '11111111-1111-4111-8111-111111111111', confirmed: false,
};

const saveForm = async (page) => {
  await page.locator('#word-form').getByRole('button', { name: 'Save word' }).click();
  await expect(page.getByText('Word saved')).toBeVisible();
};

test('an unchanged pick sends one confirm with the id and index', async ({ page }) => {
  const confirms = await stubWithConfirms(page, CANDIDATE);
  await enter(page, 'Bank');
  await expect(page.getByText('bench (seat)')).toBeVisible();
  await page.keyboard.press('2');
  await saveForm(page);
  await expect.poll(() => confirms.length).toBe(1);
  expect(confirms[0]).toEqual({ action: 'confirm', suggestion_id: CANDIDATE.suggestion_id, sense_index: 2 });
});

test('an edited pick sends no confirm', async ({ page }) => {
  const confirms = await stubWithConfirms(page, CANDIDATE);
  await enter(page, 'Bank');
  await expect(page.getByText('bank (money)')).toBeVisible();
  await page.keyboard.press('1');
  await page.locator('#word-form [name=translations]').fill('bank, lender');
  await saveForm(page);
  await page.waitForTimeout(500);
  expect(confirms).toEqual([]);
});

test('a confirmed sense sends no confirm', async ({ page }) => {
  const confirms = await stubWithConfirms(page, { ...CANDIDATE, senses: withState('confirmed'), confirmed: true });
  await enter(page, 'Bank');
  await expect(page.getByText('bank (money)')).toBeVisible();
  await page.keyboard.press('1');
  await saveForm(page);
  await page.waitForTimeout(500);
  expect(confirms).toEqual([]);
});

test('a failing confirm still saves the word', async ({ page }) => {
  const confirms = await stubWithConfirms(page, CANDIDATE, 500);
  await enter(page, 'Bank');
  await expect(page.getByText('bank (money)')).toBeVisible();
  await page.keyboard.press('1');
  await saveForm(page);
  await expect.poll(() => confirms.length).toBe(1);
  expect(await savedWords()).toHaveLength(1);
});

test('an error after two all-rejected attempts shows the manual form', async ({ page }) => {
  await stubAutofill(page, { status: 'error', senses: [] });
  await enter(page, 'Bank');
  await expect(page.getByText('Suggestions unavailable')).toBeVisible();
  await expect(page.locator('#word-form [name=term]')).toHaveValue('Bank');
});
