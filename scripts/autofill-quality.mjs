// Quality test sets for the autofill function (SPEC §5), one set per language pair. Run before any prompt or model change:
//   supabase functions serve autofill --env-file supabase/functions/.env   (in another terminal)
//   node --env-file=.env scripts/autofill-quality.mjs                 all sets
//   node --env-file=.env scripts/autofill-quality.mjs --pair de-ru    one set (repeat --pair for several)
//   node scripts/autofill-quality.mjs --list                          print sets and cases, no network, no model calls
// Real model calls as alice (about 6 to 20 per set, well under a cent per set); they count toward her monthly cap.
// Needs VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY (to upsert alice's pairs) in .env.
// Fields are checked automatically; senses and hints are printed for review by eye.
import { createClient } from '@supabase/supabase-js';
import { LANGUAGES, profileOf } from '../src/js/lib/languages.js';

// pos: allowed parts of speech. article: allowed articles for any noun sense. minSenses: at least this many senses.
// notAWord: expected status not_a_word. term: expected corrected term.
const nw = (word) => ({ word, notAWord: true });
const generic = (t) => [
  { word: t.noun, pos: ['noun'] },
  { word: t.verb, pos: ['verb'] },
  { word: t.ambiguous, minSenses: 2 },
  { word: t.typo, term: t.fixed },
  nw(t.other),
  nw('asdfgh'),
  { word: t.phrase, pos: ['phrase', 'adverb', 'other'] },
];

const DE_EN = [
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
  nw('table'),
  nw('hello'),
  nw('asdfgh'),
  nw('Ich gehe heute in die Schule und lerne Deutsch'),
];

const DE_RU = [
  { word: 'Haus', pos: ['noun'], article: ['das'], plural: 'Häuser' },
  { word: 'anrufen', pos: ['verb'], prefix: 'an', auxiliary: 'haben' },
  { word: 'Bank', pos: ['noun'], article: ['die'], minSenses: 2 },
  { word: 'madchen', term: 'Mädchen', pos: ['noun'], article: ['das'] },
  nw('table'),
  nw('asdfgh'),
  { word: 'zu Hause', pos: ['phrase', 'adverb'] },
];

// Each set: target and native language, and its cases. Add a target to languages.js only with a set here.
const SETS = [
  { target: 'de', native: 'en', cases: DE_EN },
  { target: 'de', native: 'ru', cases: DE_RU },
  {
    target: 'en',
    native: 'ru',
    cases: generic({ noun: 'house', verb: 'run', ambiguous: 'bank', typo: 'recieve', fixed: 'receive', other: 'Haus', phrase: 'look forward to' }),
  },
  {
    target: 'fr',
    native: 'en',
    cases: generic({ noun: 'maison', verb: 'manger', ambiguous: 'avocat', typo: 'maisson', fixed: 'maison', other: 'Haus', phrase: 'tout à fait' }),
  },
  {
    target: 'ru',
    native: 'en',
    cases: generic({ noun: 'дом', verb: 'читать', ambiguous: 'ключ', typo: 'библеотека', fixed: 'библиотека', other: 'Haus', phrase: 'по крайней мере' }),
  },
  {
    target: 'es',
    native: 'en',
    cases: generic({ noun: 'casa', verb: 'comer', ambiguous: 'banco', typo: 'bibliotea', fixed: 'biblioteca', other: 'Haus', phrase: 'de nada' }),
  },
  {
    target: 'it',
    native: 'en',
    cases: generic({ noun: 'casa', verb: 'mangiare', ambiguous: 'pesca', typo: 'bibloteca', fixed: 'biblioteca', other: 'Haus', phrase: 'per favore' }),
  },
  {
    target: 'pt',
    native: 'en',
    cases: generic({ noun: 'casa', verb: 'comer', ambiguous: 'manga', typo: 'obrigdo', fixed: 'obrigado', other: 'Haus', phrase: 'de nada' }),
  },
  {
    target: 'nl',
    native: 'en',
    cases: generic({ noun: 'huis', verb: 'lopen', ambiguous: 'bank', typo: 'gezelig', fixed: 'gezellig', other: 'Haus', phrase: 'graag gedaan' }),
  },
  {
    target: 'pl',
    native: 'en',
    cases: generic({ noun: 'dom', verb: 'czytać', ambiguous: 'zamek', typo: 'przyjacel', fixed: 'przyjaciel', other: 'Haus', phrase: 'dzień dobry' }),
  },
  {
    target: 'cs',
    native: 'en',
    cases: generic({ noun: 'dům', verb: 'číst', ambiguous: 'zámek', typo: 'pritel', fixed: 'přítel', other: 'Haus', phrase: 'dobrý den' }),
  },
  {
    target: 'uk',
    native: 'en',
    // 'сейчас' is Russian; Ukrainian says 'зараз'. Whether not_a_word separates the two is part of what this set shows.
    cases: generic({ noun: 'будинок', verb: 'читати', ambiguous: 'коса', typo: 'бібліотка', fixed: 'бібліотека', other: 'сейчас', phrase: 'добрий день' }),
  },
];

const id = (s) => `${s.target}-${s.native}`;

// Task 7.2: every target in the supported list needs a set. Pure.
const targetsWithoutSet = () =>
  Object.entries(LANGUAGES)
    .filter(([code, l]) => l.target && !SETS.some((s) => s.target === code))
    .map(([code]) => code);

const args = process.argv.slice(2);
const wanted = args.flatMap((a, i) => (args[i - 1] === '--pair' ? [a] : []));
const unknown = wanted.filter((w) => !SETS.some((s) => id(s) === w));
if (unknown.length) {
  console.error(`No set for: ${unknown.join(', ')}. Sets: ${SETS.map(id).join(', ')}`);
  process.exit(2);
}
const sets = wanted.length ? SETS.filter((s) => wanted.includes(id(s))) : SETS;

if (args.includes('--list')) {
  for (const s of sets) {
    console.log(`${id(s)}  ${LANGUAGES[s.target].name} for ${LANGUAGES[s.native].name} speakers  (${s.cases.length} cases)`);
    for (const c of s.cases) {
      const expect = c.notAWord ? 'not_a_word' : c.term ? `ok, term ${c.term}` : 'ok';
      console.log(`    ${c.word}  [${expect}]`);
    }
  }
  console.log(`\n${sets.length} sets, ${sets.reduce((n, s) => n + s.cases.length, 0)} cases.`);
  const missing = targetsWithoutSet();
  console.log(missing.length ? `Targets in languages.js without a set: ${missing.join(', ')}` : 'Every target in languages.js has a set.');
  process.exit(missing.length ? 1 : 0);
}

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey) {
  console.error('Set VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(2);
}

const client = createClient(url, anonKey, { auth: { persistSession: false } });
const { data: auth, error: authError } = await client.auth.signInWithPassword({
  email: 'alice@test.local',
  password: 'password123',
});
if (authError) {
  console.error(`Sign-in as alice failed: ${authError.message}`);
  process.exit(2);
}
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

// Upserts alice's pair and returns its id.
async function pairId(s) {
  const { data, error } = await admin
    .from('language_pairs')
    .upsert({ user_id: auth.user.id, target_lang: s.target, native_lang: s.native }, { onConflict: 'user_id,target_lang,native_lang' })
    .select('id')
    .single();
  if (error) throw new Error(`pair ${id(s)}: ${error.message}`);
  return data.id;
}

const startedAt = new Date().toISOString();

async function ask(term, pair_id) {
  const res = await fetch(`${url}/functions/v1/autofill`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${auth.session.access_token}`,
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ term, pair_id }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const LATIN = /\p{Script=Latin}/u;
const CYRILLIC = /\p{Script=Cyrillic}/u;

// Checks that hold for every sense of a pair: forms of the target's profile, translations in the native script.
function checkSense(s, sense) {
  const fails = [];
  const profile = profileOf(s.target);
  const forms = sense.forms ?? {};
  const allowed = profile.forms[sense.part_of_speech] ?? [];
  const extra = Object.keys(forms).filter((k) => !allowed.includes(k));
  if (extra.length) fails.push(`${sense.term}: unexpected forms ${extra.join(', ')}`);
  if (forms.article && !profile.articles.includes(forms.article)) fails.push(`${sense.term}: article ${forms.article}`);
  if (forms.auxiliary && !profile.auxiliaries.includes(forms.auxiliary)) fails.push(`${sense.term}: auxiliary ${forms.auxiliary}`);
  for (const t of sense.translations) {
    if (s.native === 'ru' ? !CYRILLIC.test(t) || LATIN.test(t) : CYRILLIC.test(t)) {
      fails.push(`${sense.term}: translation "${t}" is not in the script of ${s.native}`);
    }
  }
  return fails;
}

function check(s, c, r) {
  const fails = [];
  if (c.notAWord) {
    if (r.status !== 'not_a_word') fails.push(`expected not_a_word, got ${r.status}`);
    return fails;
  }
  if (r.status !== 'ok') return [`expected ok, got ${r.status}`];
  const first = r.senses[0];
  for (const sense of r.senses) fails.push(...checkSense(s, sense));
  if (c.minSenses && r.senses.length < c.minSenses) fails.push(`expected at least ${c.minSenses} senses, got ${r.senses.length}`);
  if (c.term && first.term !== c.term) fails.push(`term ${first.term}, expected ${c.term}`);
  if (c.pos && !c.pos.includes(first.part_of_speech)) fails.push(`part of speech ${first.part_of_speech}`);
  if (c.article && !r.senses.some((x) => c.article.includes(x.forms.article))) fails.push(`article ${first.forms.article}`);
  if (c.plural && !r.senses.some((x) => x.forms.plural === c.plural)) fails.push(`plural ${first.forms.plural}, expected ${c.plural}`);
  if (c.auxiliary && first.forms.auxiliary !== c.auxiliary) fails.push(`auxiliary ${first.forms.auxiliary}, expected ${c.auxiliary}`);
  if (c.prefix && first.forms.separable_prefix !== c.prefix) fails.push(`separable prefix ${first.forms.separable_prefix}, expected ${c.prefix}`);
  if (c.pos?.[0] === 'adjective' && Object.keys(first.forms).length > 0) fails.push('adjective has forms');
  return fails;
}

const summary = [];
for (const s of sets) {
  console.log(`\n== ${id(s)} (${LANGUAGES[s.target].name} for ${LANGUAGES[s.native].name} speakers)`);
  let failed = 0;
  let pair;
  try {
    pair = await pairId(s);
  } catch (err) {
    console.log(`FAIL  ${err.message}`);
    summary.push({ set: id(s), failed: s.cases.length, total: s.cases.length });
    continue;
  }
  for (const c of s.cases) {
    let r;
    try {
      r = await ask(c.word, pair);
    } catch (err) {
      failed += 1;
      console.log(`FAIL  [${id(s)}] ${c.word}: ${err.message}`);
      continue;
    }
    const fails = check(s, c, r);
    if (fails.length) failed += 1;
    console.log(`${fails.length ? 'FAIL' : 'ok  '}  [${id(s)}] ${c.word} -> ${r.status}`);
    for (const f of fails) console.log(`        check failed: ${f}`);
    for (const x of r.senses ?? []) {
      console.log(`        ${x.term} (${x.part_of_speech}) = ${x.translations.join(', ')}  [${x.hint_native}]  ${JSON.stringify(x.forms)}`);
      console.log(`          ${x.example_target} / ${x.example_native}`);
    }
  }
  summary.push({ set: id(s), failed, total: s.cases.length });
}

const { data: calls } = await client.from('ai_calls').select('input_tokens, output_tokens').gte('created_at', startedAt);
const sum = (key) => (calls ?? []).reduce((n, row) => n + row[key], 0);
console.log('\nSummary per pair');
for (const r of summary) console.log(`${r.failed ? 'FAIL' : 'ok  '}  ${r.set.padEnd(6)} ${r.total - r.failed} of ${r.total} passed`);
console.log(`This run: ${calls?.length ?? 0} model calls, ${sum('input_tokens')} input and ${sum('output_tokens')} output tokens.`);
process.exit(summary.some((r) => r.failed) ? 1 : 0);
