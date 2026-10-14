import { expect, test } from '@playwright/test';
import { ALICE_ID, adminClient, resetUser, seedPair, seedWord } from '../helpers/admin.js';
import { AUTOFILL_ERROR, signInAlice, stubAutofill } from '../helpers/e2e.js';

// Needs `supabase start` with the seeded users and a .env with the local URL, anon key and service-role key.
const admin = adminClient();

// What the Review prompt shows for each word, and the translation to type.
const ANSWERS = { 'das Haus': 'house', gehen: 'go', schnell: 'fast' };

test.beforeEach(async ({ page }) => {
  await stubAutofill(page, AUTOFILL_ERROR);
  await resetUser(admin, ALICE_ID);
  const pair = await seedPair(admin, ALICE_ID);
  await seedWord(admin, ALICE_ID, pair.id, { term: 'Haus', translations: ['house'], forms: { article: 'das' } });
  await seedWord(admin, ALICE_ID, pair.id, { term: 'gehen', part_of_speech: 'verb', translations: ['go'] });
  await seedWord(admin, ALICE_ID, pair.id, { term: 'schnell', part_of_speech: 'adjective', translations: ['fast'] });
});

test('one full review session with the keyboard, through to the summary', async ({ page }) => {
  await signInAlice(page);
  await expect(page.locator('#due-count')).toHaveText('3');
  await expect(page.getByText('cards due')).toBeVisible();
  await page.getByRole('button', { name: 'Start review' }).click();
  await expect(page).toHaveURL(/review\.html/);

  for (let i = 1; i <= 3; i++) {
    await expect(page.locator('#progress')).toHaveText(`Card ${i} of 3`);
    const prompt = await page.locator('#prompt').textContent();
    expect(ANSWERS).toHaveProperty([prompt]);
    await page.locator('#answer').fill(ANSWERS[prompt]);
    await page.locator('#answer').press('Enter');
    await expect(page.locator('#result')).toHaveText('Correct');
    await page.keyboard.press('Enter');
  }

  await expect(page.getByRole('heading', { name: 'All done for today!' })).toBeVisible();
  await expect(page.locator('#sum-reviewed')).toHaveText('3');
  await expect(page.locator('#sum-remembered')).toHaveText('3');
  await expect(page.locator('#sum-watch')).toHaveText('0');

  // every answer is saved with the card state before it
  await expect
    .poll(async () => (await admin.from('review_logs').select('id').eq('user_id', ALICE_ID)).data.length)
    .toBe(3);
  const { data: logs } = await admin.from('review_logs').select('rating, grader_result, state_before').eq('user_id', ALICE_ID);
  expect(logs.every((l) => l.rating === 3 && l.grader_result === 'correct' && l.state_before)).toBe(true);

  // Home now says the day is done
  await page.getByRole('link', { name: 'Back home' }).click();
  await expect(page.getByText('All done for today')).toBeVisible();
});

test('Esc ends the session, goes Home and keeps the answers given', async ({ page }) => {
  await signInAlice(page);
  await page.goto('/review.html');

  // The card renders after the queue loads; read the prompt only once it is on screen.
  await expect(page.locator('#progress')).toHaveText('Card 1 of 3');
  const prompt = await page.locator('#prompt').textContent();
  expect(ANSWERS).toHaveProperty([prompt]);
  await page.locator('#answer').fill(ANSWERS[prompt]);
  await page.locator('#answer').press('Enter');
  await expect(page.locator('#result')).toHaveText('Correct');
  await expect(page.getByRole('button', { name: /Good/ })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Enter');

  await expect(page.locator('#progress')).toHaveText('Card 2 of 3');
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/$/);

  const { data: logs } = await admin.from('review_logs').select('id').eq('user_id', ALICE_ID);
  expect(logs).toHaveLength(1);
});
