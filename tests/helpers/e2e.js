export async function signInAs(page, email, password) {
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

// Answers the autofill edge function from the browser. `respond` is a response body, a function
// returning one (may be async), or null to never answer.
export async function stubAutofill(page, respond) {
  await page.route('**/functions/v1/autofill', async (route) => {
    if (respond === null) return;
    const body = typeof respond === 'function' ? await respond(route) : respond;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(body),
    });
  });
}

export const AUTOFILL_ERROR = { status: 'error', senses: [] };

// Signs alice in and waits for Home. She needs a finished Setup (seedPair) first.
export async function signInAlice(page) {
  await page.goto('/signin.html');
  await signInAs(page, 'alice@test.local', 'password123');
  await page.waitForURL('/');
}

// Answers the check-sentence edge function from the browser. `respond` is a response body, a
// function of the posted JSON returning one (may be async), or null to never answer. The preflight
// is answered here too.
export async function stubCheckSentence(page, respond) {
  await page.route('**/functions/v1/check-sentence', async (route) => {
    const cors = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
      'access-control-allow-methods': 'POST, OPTIONS',
    };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (respond === null) return;
    const body = typeof respond === 'function' ? await respond(route.request().postDataJSON()) : respond;
    await route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(body) });
  });
}

export const CHECK_ERROR = { status: 'error', corrected: null, uses_word: false, issues: [] };
