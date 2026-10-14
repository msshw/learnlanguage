// One-off, run once with Node after migration 20261014100000 and before deploying the functions:
//   npm run backfill:rejected      (reads .env: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)
// Needs Node 22.18 or newer, which runs .ts files by stripping types.
// Copies the senses of records the first version removed (deleted_at not null) into rejected_senses
// under both keys. Safe to run again: existing rows are left alone. The fingerprint rule comes from
// the same file the edge functions use, so the two cannot drift.
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { fingerprint } from '../supabase/functions/_shared/fingerprint.ts';

type Record_ = {
  target_lang: string;
  native_lang: string;
  term_key: string;
  corrected_key: string;
  senses: { part_of_speech: string; translations: string[] }[];
};

// Pure: the rejected_senses rows for these records, one per sense and key, without duplicates.
export function backfillRows(records: Record_[]) {
  const rows = new Map<string, object>();
  for (const r of records) {
    for (const s of r.senses) {
      for (const key of new Set([r.term_key, r.corrected_key])) {
        const fp = fingerprint(s);
        rows.set([r.target_lang, r.native_lang, key, fp].join('\u0000'), {
          target_lang: r.target_lang,
          native_lang: r.native_lang,
          term_key: key,
          fingerprint: fp,
          part_of_speech: s.part_of_speech,
          translations: s.translations,
        });
      }
    }
  }
  return [...rows.values()];
}

async function main() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Set VITE_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY');
  const db = createClient(url, key, { auth: { persistSession: false } });

  const records: Record_[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from('ai_suggestions')
      .select('target_lang, native_lang, term_key, corrected_key, senses')
      .not('deleted_at', 'is', null)
      .order('id')
      .range(from, from + 999);
    if (error) throw error;
    records.push(...data);
    if (data.length < 1000) break;
  }

  const rows = backfillRows(records);
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db
      .from('rejected_senses')
      .upsert(rows.slice(i, i + 500), { onConflict: 'target_lang,native_lang,term_key,fingerprint', ignoreDuplicates: true });
    if (error) throw error;
  }
  console.log(`${records.length} removed records, ${rows.length} rows offered (existing rows kept)`);
}

// Run only when started directly; under Vitest the module is just imported.
if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
