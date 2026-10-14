import { expect, test } from '@playwright/test';
import { ALICE_ID, adminClient, learnWord, resetUser, seedPair, seedWord } from '../helpers/admin.js';
import { AUTOFILL_ERROR, signInAlice, signInAs, stubAutofill, stubCheckSentence } from '../helpers/e2e.js';

// Language pairs end to end. Needs `supabase start` with the seeded users and a .env with the local
// URL, anon key and service-role key. Autofill and check-sentence are always stubbed.
const admin = adminClient();

const pairsOf = async () => (await admin.from('language_pairs').select('*').eq('user_id', ALICE_ID)).data;
const activePairId = async () => (await admin.from('profiles').select('active_pair_id').eq('id', ALICE_ID).single()).data.active_pair_id;

test.beforeEach(async ({ page }) => {
  await stubAutofill(page, AUTOFILL_ERROR);
  await resetUser(admin, ALICE_ID);
});

test('setup: native Russian hides Russian from targets, changing native clears the target, fr/ru lands on French Home', async ({ page }) => {
  await page.goto('/signin.html');
  await signInAs(page, 'alice@test.local', 'password123');
  await expect(page).toHaveURL(/\/setup\.html$/);

  const native = page.locator('#native-lang');
  const target = page.locator('#target-lang');
  const start = page.locator('#start');
  await expect(start).toBeDisabled();

  // English native: Russian may be learned
  await native.selectOption('en');
  await target.selectOption('ru');
  await expect(start).toBeEnabled();

  // switching native to Russian removes Russian from targets and clears the choice
  await native.selectOption('ru');
  await expect(target.locator('option[value=ru]')).toHaveCount(0);
  await expect(target).toHaveValue('');
  await expect(start).toBeDisabled();

  await target.selectOption('fr');
  await start.click();
  await expect(page).toHaveURL('/');
  // native Russian: the interface is Russian
  await expect(page.getByText('Слов пока нет')).toBeVisible();
  await expect(page.locator('#empty-hint')).toHaveText('Добавьте первое слово (французский), чтобы начать повторение.');
  await expect(page.locator('#pair-button')).toHaveAttribute('aria-label', 'французский перевод: русский');
  const pairs = await pairsOf();
  expect(pairs).toHaveLength(1);
  expect(pairs[0]).toMatchObject({ target_lang: 'fr', native_lang: 'ru' });
});

test('second pair: separate words, no article field, switching back, counts in the menu, other pair\'s word not found', async ({ page }) => {
  const de = await seedPair(admin, ALICE_ID);
  const haus = await seedWord(admin, ALICE_ID, de.id, { term: 'Haus', translations: ['house'], forms: { article: 'das' } });
  await seedWord(admin, ALICE_ID, de.id, { term: 'Baum', translations: ['tree'], forms: { article: 'der' } });

  await signInAlice(page);
  await expect(page.locator('#due-count')).toHaveText('2');
  await expect(page.locator('#pair-button')).toHaveAttribute('aria-label', 'German from English');

  // add fr/en in Settings: it becomes active and starts empty
  await page.goto('/settings.html');
  await page.locator('#add-native').selectOption('en');
  await page.locator('#add-target').selectOption('fr');
  await page.locator('#add-language').click();
  await expect(page).toHaveURL('/');
  await expect(page.locator('#pair-button')).toHaveAttribute('aria-label', 'French from English');
  await expect(page.getByText('No words yet')).toBeVisible();
  await expect(page.locator('#empty-hint')).toHaveText('Add your first French word to start reviewing.');

  // other pair's word page: not found
  await page.goto(`/word.html?id=${haus.id}`);
  await expect(page.getByRole('heading', { name: 'Word not found' })).toBeVisible();

  // a French noun has no article field and no badge
  await page.goto('/add.html');
  await expect(page.locator('#term-label')).toHaveText('Word in French');
  await page.locator('#term-input').fill('maison');
  await page.locator('#term-input').press('Enter');
  const form = page.locator('#word-form');
  await expect(form.locator('[name=translations]')).toBeVisible();
  await expect(form.locator('[name=article]')).toBeHidden();
  await form.locator('[name=translations]').fill('house');
  await form.getByRole('button', { name: 'Save word' }).click();
  await expect(page.getByText('Word saved')).toBeVisible();

  await page.goto('/words.html');
  await expect(page.getByRole('cell', { name: 'maison', exact: true })).toBeVisible();
  await expect(page.locator('#word-total')).toHaveText('1');
  await expect(page.locator('.v-art')).toHaveCount(0);

  // the menu shows the German pair with its due count
  await page.locator('#pair-button').click();
  await expect(page.locator('#pair-menu button.pair-item')).toHaveCount(1);
  await expect(page.locator('#pair-menu button.pair-item')).toHaveAttribute('aria-label', 'German from English, 2 due');
  await page.keyboard.press('Escape');

  // review the French card
  await page.goto('/review.html');
  await expect(page.locator('#direction')).toHaveText('French → English');
  await expect(page.locator('#prompt')).toHaveText('maison');
  await page.locator('#answer').fill('house');
  await page.locator('#answer').press('Enter');
  await expect(page.locator('#result')).toHaveText('Correct');
  await page.keyboard.press('Enter');
  await expect(page.locator('#sum-reviewed')).toHaveText('1');

  // a second French word stays due; switch back through the sidebar
  const fr = (await pairsOf()).find((p) => p.target_lang === 'fr');
  await seedWord(admin, ALICE_ID, fr.id, { term: 'chat', translations: ['cat'] });
  await page.goto('/');
  await page.locator('#pair-button').click();
  await page.locator('#pair-menu button.pair-item', { hasText: 'German' }).click();
  await expect(page.locator('#pair-button')).toHaveAttribute('aria-label', 'German from English');
  await expect(page.locator('#due-count')).toHaveText('2');

  await page.goto('/words.html');
  await expect(page.locator('#word-total')).toHaveText('2');
  await expect(page.getByRole('cell', { name: 'das Haus', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'maison' })).toHaveCount(0);

  await page.locator('#pair-button').click();
  const item = page.locator('#pair-menu button.pair-item');
  await expect(item).toHaveCount(1);
  await expect(item).toHaveAttribute('aria-label', 'French from English, 1 due');
  await expect(page.locator('#pair-empty')).toBeHidden();
});

test('a single pair: the menu says there are no other languages', async ({ page }) => {
  await seedPair(admin, ALICE_ID);
  await signInAlice(page);
  await page.locator('#pair-button').click();
  await expect(page.locator('#pair-empty')).toContainText('No other languages.');
  await expect(page.locator('#pair-settings')).toHaveAttribute('href', '/settings.html');
  await expect(page.locator('#pair-menu button.pair-item')).toHaveCount(0);
});

test('settings: the limit saves on the active pair only; Add language for an existing pair switches without a duplicate', async ({ page }) => {
  const de = await seedPair(admin, ALICE_ID);
  const fr = await seedPair(admin, ALICE_ID, { target: 'fr', active: false });
  await signInAlice(page);
  await page.goto('/settings.html');
  await expect(page.locator('#pair')).toHaveText('German ← English');
  await expect(page.locator('#limit')).toHaveValue('10');

  await page.locator('#limit').fill('3');
  await page.getByRole('button', { name: 'Save limit' }).click();
  await expect(page.locator('#limit-saved')).toBeVisible();
  const limits = async () =>
    Object.fromEntries((await pairsOf()).map((p) => [p.target_lang, p.new_words_per_day]));
  expect(await limits()).toEqual({ de: 3, fr: 10 });

  // adding fr/en again makes the existing pair active
  await page.locator('#add-native').selectOption('en');
  await page.locator('#add-target').selectOption('fr');
  await page.locator('#add-language').click();
  await expect(page).toHaveURL('/');
  expect(await pairsOf()).toHaveLength(2);
  expect(await activePairId()).toBe(fr.id);

  await page.goto('/settings.html');
  await expect(page.locator('#pair')).toHaveText('French ← English');
  await expect(page.locator('#limit')).toHaveValue('10');
  expect(await limits()).toEqual({ de: 3, fr: 10 });
  expect(de.id).not.toBe(fr.id);
});

test('Russian native: stubbed Russian senses fill the form, ё typed as е is correct, practice shows a Russian issue', async ({ page }) => {
  await seedPair(admin, ALICE_ID, { target: 'de', native: 'ru' });
  const IGEL = {
    term: 'Igel',
    part_of_speech: 'noun',
    translations: ['ёжик'],
    hint_native: 'животное',
    forms: { article: 'der', plural: 'Igel' },
    example_target: 'Der Igel schläft im Laub.',
    example_native: 'Ёжик спит в листве.',
  };
  await stubAutofill(page, { status: 'ok', senses: [IGEL] });
  await signInAlice(page);

  await page.goto('/add.html');
  await expect(page.locator('#term-label')).toHaveText('Слово (немецкий)');
  await page.locator('#term-input').fill('Igel');
  await page.locator('#term-input').press('Enter');
  await expect(page.getByText('животное')).toBeVisible();
  await page.keyboard.press('Enter');
  const form = page.locator('#word-form');
  await expect(form.locator('[name=translations]')).toHaveValue('ёжик');
  await expect(form.locator('[name=hint_native]')).toHaveValue('животное');
  await expect(form.locator('[name=example_native]')).toHaveValue('Ёжик спит в листве.');
  await form.getByRole('button', { name: 'Сохранить слово' }).click();
  await expect(page.getByText('Слово сохранено')).toBeVisible();

  const { data: words } = await admin.from('words').select('id, term, translations, source, hint_native').eq('user_id', ALICE_ID);
  expect(words).toHaveLength(1);
  expect(words[0]).toMatchObject({ term: 'Igel', translations: ['ёжик'], source: 'ai_confirmed', hint_native: 'животное' });

  // forward card: German shown, Russian typed without the diaeresis
  await page.goto('/review.html');
  await expect(page.locator('#direction')).toHaveText('немецкий → русский');
  await expect(page.locator('#prompt')).toContainText('Igel');
  await page.locator('#answer').fill('ежик');
  await page.locator('#answer').press('Enter');
  await expect(page.locator('#result')).toHaveText('Верно');
  await page.keyboard.press('Enter');
  await expect
    .poll(async () => (await admin.from('review_logs').select('grader_result').eq('user_id', ALICE_ID)).data)
    .toEqual([expect.objectContaining({ grader_result: 'correct' })]);

  // practice with a stubbed Russian explanation
  await learnWord(admin, words[0].id);
  const MESSAGE = 'Здесь нужен именительный падеж.';
  await stubCheckSentence(page, {
    status: 'ok',
    corrected: 'Der Igel ist klein.',
    uses_word: true,
    issues: [{ start: 0, end: 3, message: MESSAGE }],
  });
  await page.goto('/practice.html');
  await expect(page.locator('#word')).toContainText('Igel');
  await expect(page.locator('#translations')).toHaveText('ёжик');
  await page.locator('#sentence').fill('Den Igel ist klein.');
  await page.keyboard.press('Enter');
  await expect(page.locator('#issues')).toContainText(MESSAGE);
  await expect(page.locator('#corrected')).toHaveText('Der Igel ist klein.');
});
