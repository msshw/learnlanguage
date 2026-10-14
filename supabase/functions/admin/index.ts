// Admin actions on shared suggestions. The session is checked, then is_admin is read from the
// database with the service role on every request; nothing about the caller is taken from the body.
// Shared code (validate, fingerprint, cache key) lives in ../_shared/.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { cacheKey } from '../_shared/cache.ts';
import { fingerprint, toRejected } from '../_shared/fingerprint.ts';
import { validate } from '../_shared/validate.ts';
import { isAllowedPair, profileOf } from '../_shared/languages.ts';
import { groupRejected, groupReports, recordsToRestore } from './group.ts';
import { PAGE_SIZE, parseOffset, shapeCall, shapeSuggestion, shapeUser, trimPage } from './views.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: auth } = token ? await db.auth.getUser(token) : { data: { user: null } };
  if (!auth.user) return json({ error: 'unauthorized' }, 401);

  // Fail closed: a read error or a missing profile is not an admin.
  const { data: profile } = await db.from('profiles').select('is_admin').eq('id', auth.user.id).maybeSingle();
  if (profile?.is_admin !== true) return json({ status: 'forbidden' }, 403);

  let body: any = null;
  try {
    body = await req.json();
  } catch { /* not JSON */ }

  if (body?.action === 'list') {
    // ponytail: PostgREST returns at most 1000 rows; page this if open reports ever pass that.
    const { data, error } = await db
      .from('suggestion_reports')
      .select('suggestion_id, created_at, reason, ai_suggestions(target_lang, native_lang, corrected_key, senses, status)')
      .is('closed_at', null)
      .order('created_at');
    if (error) {
      console.error('report list failed', error.message);
      return json({ status: 'error' });
    }
    return json({ status: 'ok', entries: groupReports(data as any) });
  }

  if (body?.action === 'list_rejected') {
    // ponytail: capped at 500 rows (newest first); page this if the store ever passes that. A group
    // cut at the cap shows with fewer keys.
    const { data, error } = await db
      .from('rejected_senses')
      .select('id, target_lang, native_lang, term_key, fingerprint, part_of_speech, translations, created_at')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(500);
    if (error) {
      console.error('rejected list failed', error.message);
      return json({ status: 'error' });
    }
    return json({ status: 'ok', entries: groupRejected(data as any) });
  }

  if (body?.action === 'allow_again') {
    // Only the row ids come from the client; pair, fingerprint, keys and suggestions come from the database.
    const ids = body.ids;
    if (
      !Array.isArray(ids) || ids.length < 1 || ids.length > 20 ||
      !ids.every((n) => Number.isSafeInteger(n) && n > 0) || new Set(ids).size !== ids.length
    ) return json({ status: 'error' });

    const { data: rows, error: rowsError } = await db
      .from('rejected_senses')
      .select('target_lang, native_lang, term_key, fingerprint')
      .in('id', ids);
    if (rowsError || !rows || rows.length !== ids.length) return json({ status: 'error' });
    const first = rows[0];
    if (!rows.every((r) => r.target_lang === first.target_lang && r.native_lang === first.native_lang && r.fingerprint === first.fingerprint)) {
      return json({ status: 'error' });
    }
    const keys = [...new Set(rows.map((r) => r.term_key))];

    const found = new Map<string, any>();
    for (const column of ['term_key', 'corrected_key']) {
      const { data, error } = await db
        .from('ai_suggestions')
        .select('id, senses')
        .eq('target_lang', first.target_lang)
        .eq('native_lang', first.native_lang)
        .in(column, keys);
      if (error) return json({ status: 'error' });
      for (const r of data ?? []) found.set(r.id, r);
    }

    const records = recordsToRestore([...found.values()], first.fingerprint, fingerprint);
    const { error } = await db.rpc('allow_sense_again', { p_ids: ids, p_records: records });
    if (error) {
      console.error('allow again failed', error.message);
      return json({ status: 'error' });
    }
    return json({ status: 'ok' });
  }

  if (body?.action === 'report_count') {
    // Distinct suggestions with an open report. Nothing is read from the body.
    // ponytail: PostgREST returns at most 1000 rows; use a count RPC if open reports ever pass that.
    const { data, error } = await db.from('suggestion_reports').select('suggestion_id').is('closed_at', null);
    if (error) {
      console.error('report count failed', error.message);
      return json({ status: 'error' });
    }
    return json({ status: 'ok', count: new Set(data.map((r: any) => r.suggestion_id)).size });
  }

  // Read-only views: only `offset` comes from the body; page size, order and columns are fixed here.
  if (['list_users', 'list_ai_calls', 'list_suggestions'].includes(body?.action)) {
    const offset = parseOffset(body.offset);
    if (offset === null) return json({ status: 'error' });
    const limit = PAGE_SIZE + 1;
    let rows: any[];
    let shape: (r: any) => unknown;

    if (body.action === 'list_users') {
      // ponytail: counts scan the logs per user; add count caches if users pass a few hundred.
      const { data, error } = await db.rpc('admin_users', { p_offset: offset, p_limit: limit });
      if (error) {
        console.error('user list failed', error.message);
        return json({ status: 'error' });
      }
      rows = data;
      shape = shapeUser;
    } else if (body.action === 'list_ai_calls') {
      const { data, error } = await db.rpc('admin_ai_calls', { p_offset: offset, p_limit: limit });
      if (error) {
        console.error('ai call list failed', error.message);
        return json({ status: 'error' });
      }
      rows = data;
      shape = shapeCall;
    } else {
      const { data, error } = await db
        .from('ai_suggestions')
        .select('id, target_lang, native_lang, corrected_key, senses, status, deleted_at, created_at')
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) {
        console.error('suggestion list failed', error.message);
        return json({ status: 'error' });
      }
      const open = new Map<string, number>();
      const ids = data.slice(0, PAGE_SIZE).map((r: any) => r.id);
      if (ids.length) {
        const { data: reports, error: reportsError } = await db
          .from('suggestion_reports')
          .select('suggestion_id')
          .is('closed_at', null)
          .in('suggestion_id', ids);
        if (reportsError) {
          console.error('suggestion reports failed', reportsError.message);
          return json({ status: 'error' });
        }
        for (const r of reports) open.set(r.suggestion_id, (open.get(r.suggestion_id) ?? 0) + 1);
      }
      rows = data;
      shape = (r) => shapeSuggestion(r, open);
    }
    const page = trimPage(rows ?? []);
    return json({ status: 'ok', rows: page.rows.map(shape), has_more: page.has_more });
  }

  const action = body?.action;
  if (['approve', 'edit', 'reject', 'remove'].includes(action)) {
    const id = body.suggestion_id;
    if (typeof id !== 'string' || !UUID.test(id)) return json({ status: 'error' });
    const index = body.sense_index;
    if (action !== 'remove' && (!Number.isInteger(index) || index < 0)) return json({ status: 'error' });

    const args: Record<string, unknown> = { p_id: id, p_action: action };
    if (action !== 'remove') args.p_index = index;

    if (action === 'edit') {
      // Same validation as model output, with the profile of the suggestion's own pair (read from the
      // database; nothing language-related comes from the body). The stored sense is what validate() returns.
      const { data: rec, error: recError } = await db
        .from('ai_suggestions')
        .select('target_lang, native_lang')
        .eq('id', id)
        .maybeSingle();
      if (recError || !rec || !isAllowedPair(rec.target_lang, rec.native_lang)) return json({ status: 'error' });
      const v = validate({ is_target_word: true, senses: [body.sense] }, profileOf(rec.target_lang));
      if (!v.ok || v.status !== 'ok') return json({ status: 'invalid', error: v.ok ? 'not a sense' : v.error });
      args.p_sense = v.senses[0];
      if (index === 0) args.p_corrected_key = cacheKey(v.senses[0].term);
    }

    if (action === 'reject' || action === 'remove') {
      const { data, error } = await db.from('ai_suggestions').select('senses').eq('id', id).maybeSingle();
      if (error || !data || !Array.isArray(data.senses)) return json({ status: 'error' });
      if (action === 'reject' && index >= data.senses.length) return json({ status: 'error' });
      args.p_fingerprints = data.senses.map((s: any) => toRejected(s));
    }

    const { data, error } = await db.rpc('moderate_suggestion', args);
    if (error) {
      console.error('moderate failed', error.message);
      return json({ status: 'error' });
    }
    return json({ status: 'ok', senses: data.senses, reports_closed: data.reports_closed });
  }

  return json({ error: 'bad request' }, 400);
});
