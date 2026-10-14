import { expect, test } from '@playwright/test';
import { ALICE_ID, BOB_ID, adminClient, resetUser, seedPair } from '../helpers/admin.js';
import { signInAs, stubAutofill } from '../helpers/e2e.js';

// Needs `supabase start` with the seeded users and a .env with the local URL, anon key and service-role key.
// Autofill and the admin function are stubbed in the browser. The admin function's own checks
// are covered by the integration tests and a manual curl.

const SENSE = {
  term: 'Bank',
  part_of_speech: 'noun',
  translations: ['bank'],
  hint_native: 'bank (money)',
  forms: { article: 'die', plural: 'Banken' },
  example_target: 'Ich gehe heute zur Bank.',
  example_native: "I'm going to the bank today.",
};

const admin = adminClient();
let suggestionId;

test.beforeEach(async () => {
  await resetUser(admin, ALICE_ID);
  await seedPair(admin, ALICE_ID);
  await admin.from('profiles').update({ is_admin: false }).in('id', [ALICE_ID, BOB_ID]);
  await admin.from('suggestion_reports').delete().eq('user_id', ALICE_ID);
  await admin.from('ai_suggestions').delete().eq('term_key', 'admin-e2e');
  const { data } = await admin
    .from('ai_suggestions')
    .insert({
      target_lang: 'de', native_lang: 'en', term_key: 'admin-e2e', corrected_key: 'admin-e2e',
      senses: [{ ...SENSE, state: 'confirmed' }], model: 'test', status: 'confirmed',
    })
    .select()
    .single();
  suggestionId = data.id;
});

test.afterEach(async () => {
  await admin.from('profiles').update({ is_admin: false }).in('id', [ALICE_ID, BOB_ID]);
  await admin.from('suggestion_reports').delete().eq('suggestion_id', suggestionId);
  await admin.from('ai_suggestions').delete().eq('id', suggestionId);
});

const signIn = async (page, email) => {
  await page.goto('/signin.html');
  await signInAs(page, email, 'password123');
  await page.waitForURL((url) => !url.pathname.includes('signin'));
};

const stubAdmin = (page, respond, status = 200) =>
  page.route('**/functions/v1/admin', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      return route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-headers': '*',
          'access-control-allow-methods': 'POST, OPTIONS',
        },
      });
    }
    const body = await respond(route.request().postDataJSON());
    await route.fulfill({
      status,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(body),
    });
  });

const reportsFor = async () =>
  (await admin.from('suggestion_reports').select('user_id, closed_at').eq('suggestion_id', suggestionId)).data;

const suggestWith = (page) =>
  stubAutofill(page, {
    status: 'ok', senses: [{ ...SENSE, index: 0, state: 'confirmed' }], suggestion_id: suggestionId, confirmed: true,
  });

const reasonOf = (n) => 'x'.repeat(n);

const lookup = async (page) => {
  await page.goto('/add.html');
  await page.locator('#term-input').fill('Bank');
  await page.locator('#term-input').press('Enter');
  await expect(page.getByText('bank (money)')).toBeVisible();
};

test('report from the sense list with a reason of 50 characters', async ({ page }) => {
  await signIn(page, 'alice@test.local');
  await suggestWith(page);
  await lookup(page);

  await page.getByRole('button', { name: 'Report suggestion' }).click();
  const send = page.getByRole('button', { name: 'Send report' });
  await page.locator('#report-reason').fill(reasonOf(49));
  await expect(send).toBeDisabled();
  await page.locator('#report-reason').fill(reasonOf(50));
  await expect(send).toBeEnabled();
  await send.click();
  await expect(page.getByText('Suggestion reported')).toBeVisible();
  const rows = await reportsFor();
  expect(rows).toEqual([{ user_id: ALICE_ID, closed_at: null }]);
  expect((await admin.from('suggestion_reports').select('reason').eq('suggestion_id', suggestionId)).data).toEqual([
    { reason: reasonOf(50) },
  ]);
});

test('digits typed in the reason pick no sense', async ({ page }) => {
  await signIn(page, 'alice@test.local');
  await suggestWith(page);
  await lookup(page);
  await page.getByRole('button', { name: 'Report suggestion' }).click();
  await page.locator('#report-reason').fill('1');
  await expect(page.locator('#report-reason')).toHaveValue('1');
  await expect(page.locator('#word-form')).toBeHidden();
});

test('a failed report shows the message and keeps the form', async ({ page }) => {
  await signIn(page, 'alice@test.local');
  await suggestWith(page);
  await lookup(page);
  await page.route('**/rest/v1/suggestion_reports*', (route) => route.abort());

  await page.getByRole('button', { name: 'Report suggestion' }).click();
  await page.locator('#report-reason').fill(reasonOf(60));
  await page.getByRole('button', { name: 'Send report' }).click();
  await expect(page.getByText('Could not report the suggestion')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send report' })).toBeEnabled();
});

test('no report button without a suggestion id', async ({ page }) => {
  await signIn(page, 'alice@test.local');
  await stubAutofill(page, { status: 'ok', senses: [SENSE] });
  await lookup(page);
  await expect(page.getByRole('button', { name: 'Report suggestion' })).toBeHidden();
});

test('the Admin link shows for an admin only', async ({ page }) => {
  await signIn(page, 'alice@test.local');
  await expect(page.getByRole('link', { name: 'Admin' })).toBeHidden();
  await admin.from('profiles').update({ is_admin: true }).eq('id', ALICE_ID);
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Admin' })).toBeVisible();
});

test('Alt+M opens the admin page for an admin', async ({ page }) => {
  await admin.from('profiles').update({ is_admin: true }).eq('id', ALICE_ID);
  await signIn(page, 'alice@test.local');
  await stubAdmin(page, () => ({ status: 'ok', entries: [] }));
  await page.goto('/words.html');
  await expect(page.getByRole('link', { name: 'Admin' })).toBeVisible();
  await page.keyboard.press('Alt+KeyM');
  await expect(page).toHaveURL(/\/admin\.html$/);
});

const S1 = { ...SENSE, state: 'candidate' };
const S2 = {
  ...SENSE, translations: ['bench'], hint_native: 'bench (seat)', forms: { article: 'die', plural: 'Bänke' }, state: 'candidate',
};
const ENTRY = (senses, extra = {}) => ({
  suggestion_id: suggestionId,
  term: 'Bank',
  target_lang: 'de',
  native_lang: 'en',
  status: 'candidate',
  senses,
  report_count: 1,
  first_reported_at: '2026-10-01T10:00:00Z',
  reasons: ['<b>x</b> this suggestion mixes up two meanings of the word'],
  ...extra,
});

// Opens an admin page as alice (an admin). `report_count` is answered here (default 0); `seen` holds the
// other requests and `seen.all` every request.
const openAdmin = async (page, handler, { path = '/admin.html', count = 0 } = {}) => {
  await admin.from('profiles').update({ is_admin: true }).eq('id', ALICE_ID);
  await signIn(page, 'alice@test.local');
  const seen = [];
  seen.all = [];
  await stubAdmin(page, (body) => {
    seen.all.push(body);
    if (body.action === 'report_count') return { status: 'ok', count };
    seen.push(body);
    return handler(body);
  });
  await page.goto(path);
  return seen;
};

test('admin sees the reason as text, the states and the judged labels', async ({ page }) => {
  await openAdmin(page, () => ({
    status: 'ok',
    entries: [ENTRY([{ ...S1, state: 'confirmed' }, { ...S2, state: 'rejected' }])],
  }));
  await expect(page.getByRole('heading', { name: 'Bank' })).toBeVisible();
  await expect(page.getByText('1 open report')).toBeVisible();
  await expect(page.getByText('<b>x</b> this suggestion mixes up')).toBeVisible();
  await expect(page.locator('.entry-reasons b')).toHaveCount(0);
  await expect(page.getByText('Confirmed · Not judged')).toBeVisible();
  await expect(page.locator('.sense-state', { hasText: 'Rejected' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reject' })).toHaveCount(1);
});

test('the entry stays after the first of two sense actions and closes after the last', async ({ page }) => {
  const seen = await openAdmin(page, (body) => {
    if (body.action === 'list') return { status: 'ok', entries: [ENTRY([S1, S2])] };
    if (body.action === 'reject') {
      return { status: 'ok', reports_closed: false, senses: [S1, { ...S2, state: 'rejected' }] };
    }
    return {
      status: 'ok', reports_closed: true,
      senses: [{ ...S1, state: 'confirmed', judged: true }, { ...S2, state: 'rejected' }],
    };
  });
  await expect(page.getByText('Candidate · Not judged')).toHaveCount(2);

  await page.getByRole('button', { name: 'Reject' }).nth(1).click();
  await expect(page.locator('.sense-state', { hasText: 'Rejected' })).toBeVisible();
  await expect(page.getByText('Reports closed')).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Bank' })).toBeVisible();
  expect(seen.at(-1)).toEqual({ action: 'reject', suggestion_id: suggestionId, sense_index: 1 });

  await page.getByRole('button', { name: 'Approve as is' }).click();
  await expect(page.getByText('Reports closed')).toBeVisible();
  await expect(page.getByText('Confirmed · Judged')).toBeVisible();
  expect(seen.at(-1)).toEqual({ action: 'approve', suggestion_id: suggestionId, sense_index: 0 });
});

test('edit and approve sends the edited sense; an invalid edit shows an error', async ({ page }) => {
  let invalid = true;
  const seen = await openAdmin(page, (body) => {
    if (body.action === 'list') return { status: 'ok', entries: [ENTRY([S1])] };
    if (invalid) return { status: 'invalid', error: 'noun needs article der, die or das' };
    return {
      status: 'ok', reports_closed: true,
      senses: [{ ...body.sense, state: 'confirmed', judged: true }],
    };
  });
  await page.getByRole('button', { name: 'Edit and approve' }).click();
  await expect(page.locator('.edit-form [name=notes]')).toHaveCount(0);
  await expect(page.locator('.edit-form [name=tags]')).toHaveCount(0);
  await page.locator('.edit-form [name=plural]').fill('Bänke');
  await page.getByRole('button', { name: 'Save sense' }).click();
  await expect(page.getByText('The sense is not valid')).toBeVisible();
  await expect(page.locator('.edit-form')).toBeVisible();

  invalid = false;
  await page.getByRole('button', { name: 'Save sense' }).click();
  await expect(page.getByText('Reports closed')).toBeVisible();
  expect(seen.at(-1)).toMatchObject({
    action: 'edit', suggestion_id: suggestionId, sense_index: 0,
    sense: { term: 'Bank', forms: { article: 'die', plural: 'Bänke' } },
  });
  expect(seen.at(-1).sense).not.toHaveProperty('notes');
});

test('"Remove suggestion" sends remove and shows Reports closed', async ({ page }) => {
  const seen = await openAdmin(page, (body) => {
    if (body.action === 'list') return { status: 'ok', entries: [ENTRY([S1, S2])] };
    return { status: 'ok', reports_closed: true, senses: [S1, S2].map((s) => ({ ...s, state: 'rejected' })) };
  });
  await page.getByRole('button', { name: 'Remove suggestion' }).click();
  await expect(page.getByText('Reports closed')).toBeVisible();
  expect(seen.at(-1)).toEqual({ action: 'remove', suggestion_id: suggestionId });
});

test('a failed action shows a message and changes nothing', async ({ page }) => {
  await openAdmin(page, (body) => (body.action === 'list' ? { status: 'ok', entries: [ENTRY([S1])] } : { status: 'error' }));
  await page.getByRole('button', { name: 'Reject' }).click();
  await expect(page.getByText('Could not reject the sense')).toBeVisible();
  await expect(page.getByText('Candidate · Not judged')).toBeVisible();
});

test('no open reports', async ({ page }) => {
  await openAdmin(page, () => ({ status: 'ok', entries: [] }));
  await expect(page.getByText('No open reports')).toBeVisible();
});

const SUB_NAV = ['Reports', 'Rejected', 'Suggestions', 'AI calls', 'Users'];
const SUB_PAGES = ['/admin.html', '/admin-rejected.html', '/admin-suggestions.html', '/admin-ai-calls.html', '/admin-users.html'];
const ROWS_OR_ENTRIES = (body) => (body.action === 'list' || body.action === 'list_rejected'
  ? { status: 'ok', entries: [] }
  : { status: 'ok', rows: [], has_more: false });

test('bob sees Not available and no sub-navigation on every admin page', async ({ page }) => {
  await signIn(page, 'bob@test.local');
  const seen = [];
  await stubAdmin(page, (body) => {
    seen.push(body.action);
    return { status: 'forbidden' };
  }, 403);
  for (const path of SUB_PAGES) {
    await page.goto(path);
    await expect(page.getByText('Not available')).toBeVisible();
    await expect(page.getByText('Bank')).toBeHidden();
    await expect(page.getByRole('navigation', { name: 'Admin' })).toBeHidden();
    await expect(page.getByRole('link', { name: 'Admin' })).toBeHidden();
  }
  expect(seen).toContain('list_users');
});

const REJECTED = (over = {}) => ({
  ids: [11, 12],
  term: 'bank / bänke',
  keys: ['bank', 'bänke'],
  target_lang: 'de',
  native_lang: 'en',
  part_of_speech: 'noun',
  translations: ['bank', 'financial institution'],
  rejected_at: '2026-10-05T10:00:00Z',
  ...over,
});
const openRejected = (page, handler) => openAdmin(page, handler, { path: '/admin-rejected.html' });

test('five sub-navigation links in order; the current one has aria-current; the main Admin link is current', async ({ page }) => {
  await openAdmin(page, ROWS_OR_ENTRIES, { path: '/admin-users.html' });
  const nav = page.getByRole('navigation', { name: 'Admin' });
  await expect(nav.getByRole('link')).toHaveText(SUB_NAV);
  await expect(nav.getByRole('link', { name: 'Users' })).toHaveAttribute('aria-current', 'page');
  await expect(nav.locator('[aria-current]')).toHaveCount(1);
  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Admin' })).toHaveAttribute('aria-current', 'page');
});

test('every admin page marks its link and the main Admin link as current', async ({ page }) => {
  await openAdmin(page, ROWS_OR_ENTRIES);
  for (const [i, path] of SUB_PAGES.entries()) {
    await page.goto(path);
    const nav = page.getByRole('navigation', { name: 'Admin' });
    await expect(nav.getByRole('link', { name: SUB_NAV[i], exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Admin' })).toHaveAttribute('aria-current', 'page');
  }
});

test('selecting a link opens its own page and requests only its action plus report_count', async ({ page }) => {
  const seen = await openAdmin(page, ROWS_OR_ENTRIES);
  await expect(page.getByText('No open reports')).toBeVisible();
  expect(seen.all.map((b) => b.action).sort()).toEqual(['list', 'report_count']);

  const nav = page.getByRole('navigation', { name: 'Admin' });
  const wanted = [['Rejected', 'list_rejected'], ['Suggestions', 'list_suggestions'], ['AI calls', 'list_ai_calls'], ['Users', 'list_users']];
  for (const [name, action] of wanted) {
    seen.all.length = 0;
    await nav.getByRole('link', { name }).click();
    await expect(page).toHaveURL(new RegExp(`/admin-${name.toLowerCase().replace(' ', '-')}\\.html$`));
    await expect(nav.getByRole('link', { name })).toHaveAttribute('aria-current', 'page');
    await expect.poll(() => seen.all.map((b) => b.action).sort()).toEqual([action, 'report_count'].sort());
  }
});

test('the Reports pill shows the open count', async ({ page }) => {
  await openAdmin(page, ROWS_OR_ENTRIES, { path: '/admin-users.html', count: 3 });
  await expect(page.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: 'Reports' })).toContainText('3');
});

test('the Reports pill is hidden at 0', async ({ page }) => {
  await openAdmin(page, ROWS_OR_ENTRIES, { path: '/admin-users.html', count: 0 });
  await expect(page.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: 'Reports' })).toHaveText('Reports');
  await expect(page.locator('#nav-reports')).toBeHidden();
});

test('a failed report_count hides the pill and the page still works', async ({ page }) => {
  await admin.from('profiles').update({ is_admin: true }).eq('id', ALICE_ID);
  await signIn(page, 'alice@test.local');
  await stubAdmin(page, (body) => (body.action === 'report_count' ? { status: 'error' } : { status: 'ok', rows: [USER()], has_more: false }));
  await page.goto('/admin-users.html');
  await expect(page.getByText('alice@test.local')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Admin' })).toBeVisible();
  await expect(page.locator('#nav-reports')).toBeHidden();
});

test('Rejected loads on its own page, not on Reports', async ({ page }) => {
  const seen = await openAdmin(page, (body) =>
    body.action === 'list' ? { status: 'ok', entries: [] } : { status: 'ok', entries: [REJECTED()] });
  await expect(page.getByText('No open reports')).toBeVisible();
  expect(seen.map((b) => b.action)).toEqual(['list']);

  await page.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: 'Rejected' }).click();
  await expect(page).toHaveURL(/\/admin-rejected\.html$/);
  await expect(page.getByRole('heading', { name: 'bank / bänke' })).toBeVisible();
  await expect(page.getByText('de to en · noun · rejected')).toBeVisible();
  await expect(page.getByText('bank, financial institution')).toBeVisible();
  await expect(page.getByText('No open reports')).toBeHidden();
  expect(seen.map((b) => b.action)).toEqual(['list', 'list_rejected']);
});

test('the sub-navigation works from the keyboard', async ({ page }) => {
  await openAdmin(page, ROWS_OR_ENTRIES);
  const link = page.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: 'Rejected' });
  await link.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/admin-rejected\.html$/);
  await expect(page.getByText('No rejected senses')).toBeVisible();
});

test('Allow again sends only the ids and removes the entry', async ({ page }) => {
  const seen = await openRejected(page, (body) => {
    if (body.action === 'list_rejected') return { status: 'ok', entries: [REJECTED(), REJECTED({ ids: [13], term: 'haus', keys: ['haus'] })] };
    return { status: 'ok' };
  });
  await page.getByRole('button', { name: 'Allow again' }).first().click();
  await expect(page.getByRole('heading', { name: 'bank / bänke' })).toBeHidden();
  await expect(page.getByRole('heading', { name: 'haus' })).toBeVisible();
  expect(seen.at(-1)).toEqual({ action: 'allow_again', ids: [11, 12] });
});

test('the last Allow again shows the empty state', async ({ page }) => {
  await openRejected(page, (body) => (body.action === 'list_rejected' ? { status: 'ok', entries: [REJECTED()] } : { status: 'ok' }));
  await page.getByRole('button', { name: 'Allow again' }).click();
  await expect(page.getByText('No rejected senses')).toBeVisible();
});

test('a failed Allow again keeps the entry and shows a message', async ({ page }) => {
  await openRejected(page, (body) => (body.action === 'list_rejected' ? { status: 'ok', entries: [REJECTED()] } : { status: 'error' }));
  await page.getByRole('button', { name: 'Allow again' }).click();
  await expect(page.getByText('Could not allow the sense again')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'bank / bänke' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Allow again' })).toBeEnabled();
});

test('the Rejected list shows a load error with Retry', async ({ page }) => {
  let fail = true;
  await openRejected(page, () => (fail ? { status: 'error' } : { status: 'ok', entries: [REJECTED()] }));
  await expect(page.getByText('Could not load the rejected senses.')).toBeVisible();
  fail = false;
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByRole('heading', { name: 'bank / bänke' })).toBeVisible();
});

test('rejected text is inserted as text', async ({ page }) => {
  await openRejected(page, () => ({ status: 'ok', entries: [REJECTED({ term: '<b>x</b>', translations: ['<i>y</i>'] })] }));
  await expect(page.getByText('<b>x</b>')).toBeVisible();
  await expect(page.locator('#rejected-entries b, #rejected-entries i')).toHaveCount(0);
});

const USER = (over = {}) => ({
  email: 'alice@test.local', created_at: '2026-09-01T10:00:00Z', last_sign_in_at: null, is_admin: false,
  words: 2, reviews: 5, practice_attempts: 2, ai_calls_month: 4, cost_month_usd: 0.0123, ...over,
});
const CALL = (n, over = {}) => ({
  created_at: '2026-10-05T10:00:00Z', email: `u${n}@test.local`, kind: 'sentence_check', model: 'm',
  input_tokens: 800, output_tokens: 120, cost_usd: 0.002, latency_ms: 350, ok: true, ...over,
});

test('Users shows counts, Never, Admin and an email with markup as text', async ({ page }) => {
  await openAdmin(page, () => ({
    status: 'ok', has_more: false,
    rows: [USER(), USER({ email: '<b>x</b>@test.local', is_admin: true, last_sign_in_at: '2026-10-06T10:00:00Z' })],
  }), { path: '/admin-users.html' });
  const row = page.getByRole('row', { name: /alice@test\.local/ });
  await expect(row).toContainText('Never');
  await expect(row).toContainText('$0.0123');
  await expect(page.getByText('<b>x</b>@test.local')).toBeVisible();
  await expect(page.locator('#table b')).toHaveCount(0);
  await expect(page.getByRole('row', { name: /<b>x<\/b>/ })).toContainText('Admin');
});

test('AI calls shows rows and pages 50 at a time', async ({ page }) => {
  const seen = await openAdmin(page, (body) => {
    const n = body.offset === 0 ? 50 : 10;
    return {
      status: 'ok', has_more: body.offset === 0,
      rows: Array.from({ length: n }, (_, i) => CALL(body.offset + i, i === 0 && body.offset === 0 ? { ok: false } : {})),
    };
  }, { path: '/admin-ai-calls.html' });
  await expect(page.locator('#table tbody tr')).toHaveCount(50);
  await expect(page.getByRole('row', { name: /u0@test\.local/ })).toContainText('Failed');
  await expect(page.getByRole('button', { name: 'Previous' })).toBeDisabled();

  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.locator('#table tbody tr')).toHaveCount(10);
  await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();
  expect(seen.at(-1)).toEqual({ action: 'list_ai_calls', offset: 50 });

  await page.getByRole('button', { name: 'Previous' }).click();
  await expect(page.locator('#table tbody tr')).toHaveCount(50);
});

test('a failed page shows an inline message and Retry', async ({ page }) => {
  let fail = true;
  await openAdmin(page, () => (fail ? { status: 'error' } : { status: 'ok', has_more: false, rows: [USER()] }), { path: '/admin-users.html' });
  await expect(page.getByText('Could not load this section.')).toBeVisible();
  fail = false;
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByText('alice@test.local')).toBeVisible();
});

test('empty Users, AI calls and Suggestions pages show their empty text', async ({ page }) => {
  await openAdmin(page, () => ({ status: 'ok', rows: [], has_more: false }), { path: '/admin-users.html' });
  await expect(page.getByText('No users')).toBeVisible();
  await page.goto('/admin-ai-calls.html');
  await expect(page.getByText('No AI calls')).toBeVisible();
  await page.goto('/admin-suggestions.html');
  await expect(page.getByText('No suggestions')).toBeVisible();
});

test('Suggestions shows sense counts and Removed', async ({ page }) => {
  await openAdmin(page, () => ({
    status: 'ok', has_more: false,
    rows: [{
      term: 'Bank', target_lang: 'de', native_lang: 'en', status: 'removed',
      senses: { candidate: 0, confirmed: 2, rejected: 1 }, open_reports: 1, created_at: '2026-10-01T10:00:00Z',
    }],
  }), { path: '/admin-suggestions.html' });
  const row = page.getByRole('row', { name: /Bank/ });
  await expect(row).toContainText('Removed');
  await expect(row).toContainText('de to en');
});
