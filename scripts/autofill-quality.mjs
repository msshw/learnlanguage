// Quality test set for the autofill function (SPEC §5). Run it before any prompt or model change:
//   supabase functions serve autofill --env-file supabase/functions/.env   (in another terminal)
//   npm run test:ai
// It makes real model calls as alice (about 20, well under a cent) and counts toward her monthly cap.
// Fields are checked automatically; senses and hints are printed for review by eye.
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !anonKey) {
  console.error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env');
  process.exit(2);
}

// pos: allowed parts of speech. article: allowed articles for the first noun sense.
// minSenses: at least this many senses. notAWord: expected status not_a_word.
const CASES = [
  { word: 'Bank', pos: ['noun'], article: ['die'], minSenses: 2 },
  { word: 'Leiter', pos: ['noun'], article: ['der', 'die'], minSenses: 2 },
  { word: 'Schloss', pos: ['noun'], article: ['das'], minSenses: 2 },
  { word: 'anrufen', pos: ['verb'], prefix: 'an', auxiliary: 'haben' },
  { word: 'aufstehen', pos: ['verb'], prefix: 'auf', auxiliary: 'sein' },
  { word: 'gehen', pos: ['verb'], auxiliary: 'sein' },
  { word: 'fahren', pos: ['verb'], auxiliary: 'sein' },
  { word: 'lernen', pos: ['verb'], auxiliary: 'haben' },
  { word: 'Haus', pos: ['noun'], article: ['das'], plural: 'Häuser' },
  { word: 'Mutter', pos: ['noun'], article: ['die'], plural: 'Mütter' },
  { word: 'Apfel', pos: ['noun'], article: ['der'], plural: 'Äpfel' },
  { word: 'Kind', pos: ['noun'], article: ['das'], plural: 'Kinder' },
  { word: 'madchen', term: 'Mädchen', pos: ['noun'], article: ['das'] },
  { word: 'strasse', term: 'Straße', pos: ['noun'], article: ['die'], plural: 'Straßen' },
  { word: 'schnell', pos: ['adjective'] },
  { word: 'zu Hause', pos: ['phrase', 'adverb'] },
  { word: 'table', notAWord: true },
  { word: 'hello', notAWord: true },
  { word: 'asdfgh', notAWord: true },
  { word: 'Ich gehe heute in die Schule und lerne Deutsch', notAWord: true },
];

const client = createClient(url, anonKey, { auth: { persistSession: false } });
const { data: auth, error: authError } = await client.auth.signInWithPassword({
  email: 'alice@test.local',
  password: 'password123',
});
if (authError) {
  console.error(`Sign-in as alice failed: ${authError.message}`);
  process.exit(2);
}

const startedAt = new Date().toISOString();

async function ask(word) {
  const res = await fetch(`${url}/functions/v1/autofill`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${auth.session.access_token}`,
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ term: word, target_lang: 'de', native_lang: 'en' }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function check(c, r) {
  const fails = [];
  if (c.notAWord) {
    if (r.status !== 'not_a_word') fails.push(`expected not_a_word, got ${r.status}`);
    return fails;
  }
  if (r.status !== 'ok') return [`expected ok, got ${r.status}`];
  const first = r.senses[0];
  if (c.minSenses && r.senses.length < c.minSenses) fails.push(`expected at least ${c.minSenses} senses, got ${r.senses.length}`);
  if (c.term && first.term !== c.term) fails.push(`term ${first.term}, expected ${c.term}`);
  if (c.pos && !c.pos.includes(first.part_of_speech)) fails.push(`part of speech ${first.part_of_speech}`);
  if (c.article && !r.senses.some((s) => c.article.includes(s.forms.article))) fails.push(`article ${first.forms.article}`);
  if (c.plural && !r.senses.some((s) => s.forms.plural === c.plural)) fails.push(`plural ${first.forms.plural}, expected ${c.plural}`);
  if (c.auxiliary && first.forms.auxiliary !== c.auxiliary) fails.push(`auxiliary ${first.forms.auxiliary}, expected ${c.auxiliary}`);
  if (c.prefix && first.forms.separable_prefix !== c.prefix) fails.push(`separable prefix ${first.forms.separable_prefix}, expected ${c.prefix}`);
  if (c.pos?.[0] === 'adjective' && Object.keys(first.forms).length > 0) fails.push('adjective has forms');
  return fails;
}

let failed = 0;
for (const c of CASES) {
  let r;
  try {
    r = await ask(c.word);
  } catch (err) {
    failed += 1;
    console.log(`FAIL  ${c.word}: ${err.message}`);
    continue;
  }
  const fails = check(c, r);
  if (fails.length) failed += 1;
  console.log(`${fails.length ? 'FAIL' : 'ok  '}  ${c.word} -> ${r.status}`);
  for (const f of fails) console.log(`        check failed: ${f}`);
  for (const s of r.senses) {
    console.log(`        ${s.term} (${s.part_of_speech}) = ${s.translations.join(', ')}  [${s.hint_en}]  ${JSON.stringify(s.forms)}`);
    console.log(`          ${s.example_de} / ${s.example_en}`);
  }
}

const { data: calls } = await client.from('ai_calls').select('input_tokens, output_tokens').gte('created_at', startedAt);
const sum = (key) => (calls ?? []).reduce((n, row) => n + row[key], 0);
console.log(`\n${CASES.length - failed} of ${CASES.length} words passed the automatic checks.`);
console.log(`This run: ${calls?.length ?? 0} model calls, ${sum('input_tokens')} input and ${sum('output_tokens')} output tokens.`);
process.exit(failed ? 1 : 0);
