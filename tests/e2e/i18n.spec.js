import { expect, test } from '@playwright/test';
import { ALICE_ID, adminClient, resetUser, seedPair, seedWord } from '../helpers/admin.js';
import { AUTOFILL_ERROR, signInAlice, signInAs, stubAutofill } from '../helpers/e2e.js';

// Interface language end to end: it follows the active pair's native language. Needs `supabase start`
// with the seeded users and a .env, like the other specs.
const admin = adminClient();
const lang = (page) => page.evaluate(() => document.documentElement.lang);

test.beforeEach(async ({ page }) => {
  await stubAutofill(page, AUTOFILL_ERROR);
  await resetUser(admin, ALICE_ID);
});

test('a Russian native pair shows Russian on Home, Review, Add word and Settings', async ({ page }) => {
  const pair = await seedPair(admin, ALICE_ID, { target: 'de', native: 'ru' });
  await seedWord(admin, ALICE_ID, pair.id, { term: 'Haus', translations: ['дом'], forms: { article: 'das' } });
  await signInAlice(page);

  await expect.poll(() => lang(page)).toBe('ru');
  await expect(page).toHaveTitle('Главная - Vocab');
  await expect(page.locator('#due-label')).toHaveText('карточка к повторению'); // one due card: one form
  await expect(page.getByRole('button', { name: 'Начать повторение' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Настройки' })).toBeVisible();
  await expect(page.getByText('Слов в словаре')).toBeVisible();

  await page.goto('/review.html');
  await expect(page.locator('#direction')).toHaveText('немецкий → русский');
  await expect(page.locator('#progress')).toHaveText('Карточка 1 из 1');
  await expect(page.getByRole('button', { name: 'Проверить ответ' })).toBeVisible();
  expect(await lang(page)).toBe('ru');

  await page.goto('/add.html');
  await expect(page.locator('#term-label')).toHaveText('Слово (немецкий)');
  await expect(page.getByRole('heading', { name: 'Добавить слово' })).toBeVisible();

  await page.goto('/settings.html');
  await expect(page.getByRole('heading', { name: 'Настройки' })).toBeVisible();
  await expect(page.locator('#pair')).toHaveText('немецкий ← русский');
  await expect(page.locator('#add-native option[value=en]')).toHaveText('английский');
  await expect(page.getByRole('button', { name: 'Выйти' })).toBeVisible();
});

test('switching pairs between native English and Russian changes the language', async ({ page }) => {
  await seedPair(admin, ALICE_ID, { target: 'de', native: 'en' });
  await seedPair(admin, ALICE_ID, { target: 'fr', native: 'ru', active: false });
  await signInAlice(page);
  await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
  expect(await lang(page)).toBe('en');

  await page.locator('#pair-button').click();
  await page.locator('#pair-menu button.pair-item').click();
  await expect(page.getByRole('link', { name: 'Настройки' })).toBeVisible();
  expect(await lang(page)).toBe('ru');
  await expect(page).toHaveTitle('Главная - Vocab');

  await page.locator('#pair-button').click();
  await page.locator('#pair-menu button.pair-item').click();
  await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
  expect(await lang(page)).toBe('en');
  await expect(page).toHaveTitle('Home - Vocab');
});

test.describe('browser language ru', () => {
  test.use({ locale: 'ru-RU' });

  test('sign-in is shown in Russian', async ({ page }) => {
    await page.goto('/signin.html');
    await expect(page.getByRole('heading', { name: 'С возвращением' })).toBeVisible();
    await expect(page.getByLabel('Электронная почта')).toBeVisible();
    expect(await lang(page)).toBe('ru');
  });
});

test('setup switches to Russian live when native Russian is picked', async ({ page }) => {
  await page.goto('/signin.html');
  await signInAs(page, 'alice@test.local', 'password123');
  await expect(page).toHaveURL(/\/setup\.html$/);
  await expect(page.getByRole('heading', { name: "Let's set you up" })).toBeVisible();
  expect(await lang(page)).toBe('en');

  await page.locator('#native-lang').selectOption('ru');
  await expect(page.getByRole('heading', { name: 'Давайте настроим приложение' })).toBeVisible();
  await expect(page.locator('#start')).toHaveText('Начать учиться');
  await expect(page.locator('#target-lang option[value=de]')).toHaveText('немецкий');
  await expect(page.locator('#native-lang option[value=ru]')).toHaveText('русский');
  expect(await lang(page)).toBe('ru');

  await page.locator('#native-lang').selectOption('en');
  await expect(page.locator('#start')).toHaveText('Start learning');
  expect(await lang(page)).toBe('en');
});
