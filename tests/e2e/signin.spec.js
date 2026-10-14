import { expect, test } from '@playwright/test';
import { ALICE_ID, adminClient, resetUser, seedPair } from '../helpers/admin.js';
import { signInAs } from '../helpers/e2e.js';

// Needs `supabase start` with the seeded users and a .env with the local URL, anon key and service-role key.
// Alice starts each test with Setup done and no words.
test.beforeEach(async () => {
  const admin = adminClient();
  await resetUser(admin, ALICE_ID);
  await seedPair(admin, ALICE_ID);
});

test('wrong password shows an inline error', async ({ page }) => {
  await page.goto('/signin.html');
  await signInAs(page, 'alice@test.local', 'wrong-password');

  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page).toHaveURL(/\/signin\.html/);
  await expect(page.getByLabel('Email')).toHaveValue('alice@test.local');
  await expect(page.getByLabel('Password')).toHaveValue('');
});

test('alice signs in and lands on the Home empty state', async ({ page }) => {
  await page.goto('/signin.html');
  await signInAs(page, 'alice@test.local', 'password123');

  await expect(page).toHaveURL('/');
  await expect(page.getByText('No words yet')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Add word' }).first()).toBeVisible();
});

test('signed-out visit to /review.html redirects to sign-in and back', async ({ page }) => {
  await page.goto('/review.html');
  await expect(page).toHaveURL(/\/signin\.html\?returnTo=%2Freview\.html/);

  await signInAs(page, 'alice@test.local', 'password123');
  await expect(page).toHaveURL(/\/review\.html$/);
  // Review has no page heading of its own: a card word or the empty/summary title.
  await expect(page.locator('h1#prompt:visible, h2.page-title:visible').first()).toBeVisible();
});
