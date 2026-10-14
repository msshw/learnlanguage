import { expect, test } from '@playwright/test';
import { ALICE_ID, adminClient, resetUser, seedPair, seedWord } from '../helpers/admin.js';
import { AUTOFILL_ERROR, CHECK_ERROR, signInAlice, stubAutofill, stubCheckSentence } from '../helpers/e2e.js';

// Needs `supabase start` with the seeded users and a .env with the local URL, anon key and service-role key.
const admin = adminClient();
const SENTENCE = 'Ich gehe zu die Bank.';
const WITH_ISSUE = {
  status: 'ok',
  corrected: 'Ich gehe zur Bank.',
  uses_word: true,
  issues: [{ start: 9, end: 15, message: 'zu takes the dative: zu der, contracted to zur.' }],
};
const CLEAN = { status: 'ok', corrected: SENTENCE, uses_word: true, issues: [] };

let pair;

// A word whose de_en review card is in review state, so its practice card is eligible.
async function learnedWord(word) {
  const w = await seedWord(admin, ALICE_ID, pair.id, word);
  const ago = (days) => new Date(Date.now() - days * 86400e3).toISOString();
  const { error } = await admin
    .from('cards')
    .update({ state: 'review', due: ago(1), stability: 5, difficulty: 5, reps: 2, scheduled_days: 5, elapsed_days: 5, last_review: ago(6) })
    .eq('word_id', w.id)
    .eq('direction', 'de_en');
  if (error) throw error;
  return w;
}

const logs = async () => (await admin.from('sentence_logs').select('*').eq('user_id', ALICE_ID)).data;

test.beforeEach(async ({ page }) => {
  await stubAutofill(page, AUTOFILL_ERROR);
  await resetUser(admin, ALICE_ID);
  pair = await seedPair(admin, ALICE_ID);
  await learnedWord({ term: 'Bank', translations: ['bank'], hint_en: 'bank (money)', forms: { article: 'die' }, example_de: 'Die Bank ist zu.', example_en: 'The bank is closed.' });
});

test('a checked sentence shows its issue, defaults to Hard and goes through to the summary by keyboard', async ({ page }) => {
  await stubCheckSentence(page, WITH_ISSUE);
  await signInAlice(page);
  await page.goto('/practice.html');

  await expect(page.locator('#progress')).toHaveText('1 of 1');
  await expect(page.locator('#word')).toHaveText('die Bank');
  await expect(page.locator('#translations')).toHaveText('bank');
  await expect(page.locator('#hint')).toHaveText('bank (money)');
  await expect(page.locator('#sentence')).toBeFocused();

  await page.locator('#sentence').fill(SENTENCE);
  await page.keyboard.press('Enter');

  await expect(page.locator('#your-sentence mark')).toHaveText('zu die');
  await expect(page.locator('#issues')).toContainText('zu takes the dative');
  await expect(page.locator('#corrected')).toHaveText('Ich gehe zur Bank.');
  await expect(page.getByRole('button', { name: /Hard/ })).toHaveAttribute('aria-pressed', 'true');

  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Practice done' })).toBeVisible();
  await expect(page.locator('#sum-attempts')).toHaveText('1');
  await expect(page.locator('#sum-watch')).toHaveText('1');

  const rows = await logs();
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ sentence: SENTENCE, corrected: 'Ich gehe zur Bank.', check_status: 'ok', rating: 2 });
  expect(rows[0].issues).toEqual(WITH_ISSUE.issues);
  const { data: reviewLogs } = await admin.from('review_logs').select('id').eq('user_id', ALICE_ID);
  expect(reviewLogs).toEqual([]);
});

test('a correct sentence defaults to Good and the rating can be changed with 1 to 4', async ({ page }) => {
  await stubCheckSentence(page, CLEAN);
  await signInAlice(page);
  await page.goto('/practice.html');
  await page.locator('#sentence').fill(SENTENCE);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: /Good/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#corrected-block')).toBeHidden();
  await page.keyboard.press('4');
  await expect(page.getByRole('button', { name: /Easy/ })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Enter');
  await expect(page.locator('#sum-attempts')).toHaveText('1');
  expect((await logs())[0].rating).toBe(4);
});

test('markup in the sentence is shown as text', async ({ page }) => {
  await stubCheckSentence(page, { ...CLEAN, corrected: '<b>Bank</b>' });
  await signInAlice(page);
  await page.goto('/practice.html');
  await page.locator('#sentence').fill('<b>Bank</b>');
  await page.keyboard.press('Enter');
  await expect(page.locator('#your-sentence')).toHaveText('<b>Bank</b>');
  await expect(page.locator('#your-sentence b')).toHaveCount(0);
});

test('an empty sentence shows an error and sends no check', async ({ page }) => {
  let calls = 0;
  await stubCheckSentence(page, () => {
    calls += 1;
    return CLEAN;
  });
  await signInAlice(page);
  await page.goto('/practice.html');
  await page.locator('#sentence').fill('   ');
  await page.keyboard.press('Enter');
  await expect(page.locator('#sentence-error')).toBeVisible();
  await page.locator('#sentence').fill('a'.repeat(301));
  await page.keyboard.press('Enter');
  await expect(page.locator('#sentence-error')).toContainText('300');
  expect(calls).toBe(0);
});

test('check unavailable: no rating is preselected and Enter waits for one', async ({ page }) => {
  await stubCheckSentence(page, CHECK_ERROR);
  await signInAlice(page);
  await page.goto('/practice.html');
  await page.locator('#sentence').fill(SENTENCE);
  await page.keyboard.press('Enter');

  await expect(page.getByText('Check unavailable')).toBeVisible();
  await expect(page.locator('#example-de')).toHaveText('Die Bank ist zu.');
  await expect(page.locator('#your-sentence mark')).toHaveCount(0);
  await expect(page.locator('#ratings [aria-pressed="true"]')).toHaveCount(0);

  await page.keyboard.press('Enter');
  await expect(page.locator('#feedback')).toBeVisible();
  expect(await logs()).toEqual([]);

  await page.keyboard.press('3');
  await page.keyboard.press('Enter');
  await expect(page.locator('#sum-attempts')).toHaveText('1');
  const rows = await logs();
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ check_status: 'unavailable', rating: 3, corrected: null, issues: null });
});

test('Skip check goes to feedback without a check and ignores the late answer', async ({ page }) => {
  await stubCheckSentence(page, null);
  await signInAlice(page);
  await page.goto('/practice.html');
  await page.locator('#sentence').fill(SENTENCE);
  await page.keyboard.press('Enter');
  await expect(page.getByText('Checking sentence')).toBeVisible();
  await page.getByRole('button', { name: 'Skip check' }).click();
  await expect(page.getByText('Check unavailable')).toBeVisible();
});

test('a failed save shows Retry, which records the same attempt once', async ({ page }) => {
  await stubCheckSentence(page, CLEAN);
  let failures = 1;
  await page.route('**/rest/v1/rpc/record_sentence', (route) => {
    if (failures > 0) {
      failures -= 1;
      return route.abort();
    }
    return route.continue();
  });
  await signInAlice(page);
  await page.goto('/practice.html');
  await page.locator('#sentence').fill(SENTENCE);
  await page.keyboard.press('Enter');
  await expect(page.locator('#feedback')).toBeVisible();
  await page.keyboard.press('Enter');

  await expect(page.getByText('Could not save this attempt')).toBeVisible();
  expect(await logs()).toEqual([]);
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.locator('#sum-attempts')).toHaveText('1');
  expect(await logs()).toHaveLength(1);
});

test('Escape ends the session, goes Home and keeps the attempts already rated', async ({ page }) => {
  await learnedWord({ term: 'Haus', translations: ['house'], forms: { article: 'das' } });
  await stubCheckSentence(page, CLEAN);
  await signInAlice(page);
  await page.goto('/practice.html');

  await expect(page.locator('#progress')).toHaveText('1 of 2');
  await page.locator('#sentence').fill(SENTENCE);
  await page.keyboard.press('Enter');
  await expect(page.locator('#feedback')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('#progress')).toHaveText('2 of 2');
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/$/);
  expect(await logs()).toHaveLength(1);
});

test('nothing due for practice when no word is learned yet', async ({ page }) => {
  await resetUser(admin, ALICE_ID);
  pair = await seedPair(admin, ALICE_ID);
  await seedWord(admin, ALICE_ID, pair.id, { term: 'Haus', translations: ['house'] });
  await signInAlice(page);
  await page.goto('/practice.html');
  await expect(page.getByText('Nothing due for practice')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back home' })).toBeVisible();
});

test('the sidebar shows the Practice count, and Alt+P opens Practice from Words', async ({ page }) => {
  await learnedWord({ term: 'Haus', translations: ['house'], forms: { article: 'das' } });
  await signInAlice(page);
  await expect(page.locator('#nav-practice')).toHaveText('2');
  await expect(page.getByRole('link', { name: /Practice/ })).toBeVisible();

  await page.goto('/words.html');
  await page.keyboard.press('Alt+KeyP');
  await expect(page).toHaveURL(/\/practice\.html$/);
});
