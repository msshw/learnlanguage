-- Per-sense curation. Builds on 20261013100000_suggestion_admin.sql (never edited).
-- Each element of ai_suggestions.senses gets state (candidate | confirmed | rejected) and, once an
-- admin has acted on it, judged = true. ai_suggestions.status and confirmed_at stay as a summary.

-- 1. State conversion. Deleted records: every sense rejected, status candidate (so the lookup
-- misses). Confirmed records: every sense confirmed (the old confirm never stored which sense was
-- picked). Everything else: candidate. No sense gets judged here; a rejected one counts as judged
-- by its state.
update public.ai_suggestions s
set senses = coalesce((
  select jsonb_agg(
    e.sense || jsonb_build_object(
      'state',
      case
        when s.deleted_at is not null then 'rejected'
        when s.status = 'confirmed' then 'confirmed'
        else 'candidate'
      end
    )
    order by e.ord
  )
  from jsonb_array_elements(s.senses) with ordinality as e(sense, ord)
), '[]'::jsonb);

update public.ai_suggestions set status = 'candidate' where deleted_at is not null;

-- 2. Reports: reason, wider resolution list.
alter table public.suggestion_reports add column reason text;
alter table public.suggestion_reports
  add constraint suggestion_reports_reason_check
  check (char_length(btrim(reason, E' \t\r\n')) between 50 and 2000);

alter table public.suggestion_reports drop constraint suggestion_reports_resolution_check;
alter table public.suggestion_reports
  add constraint suggestion_reports_resolution_check
  check (resolution in ('removed', 'kept', 'approved', 'edited', 'rejected'));

drop policy suggestion_reports_insert_own on public.suggestion_reports;
create policy suggestion_reports_insert_own on public.suggestion_reports
  for insert to authenticated
  with check (user_id = (select auth.uid()) and reason is not null);

-- Reopen rule. The first version closed reports on the first admin action. Under the per-sense
-- rules a report is closed only when no non-rejected sense is unjudged. Reports of the first
-- version that are closed on a suggestion with such a sense are reopened (closed_at and resolution
-- null). Legacy 'kept' reports sit on records where no sense was judged, so they reopen. Legacy
-- 'removed' reports sit on deleted records, whose senses are now all rejected (judged), so they
-- stay closed. Runs after the conversion above.
create function public.reopen_unjudged_reports()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.suggestion_reports r
  set closed_at = null, resolution = null
  where r.closed_at is not null
    and exists (
      select 1
      from public.ai_suggestions s, jsonb_array_elements(s.senses) as e(sense)
      where s.id = r.suggestion_id
        and e.sense ->> 'state' <> 'rejected'
        and coalesce((e.sense ->> 'judged')::boolean, false) = false
    );
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.reopen_unjudged_reports() from public, anon, authenticated;
grant execute on function public.reopen_unjudged_reports() to service_role;

-- A function so the integration test can run the same rule on seeded data.
select public.reopen_unjudged_reports();

-- 3. Rejected senses, remembered by fingerprint. No user_id (shared data, like ai_suggestions).
-- RLS on, no policies, no client grants: only the service role (autofill, admin) touches it.
create table public.rejected_senses (
  id bigint generated always as identity primary key,
  target_lang text not null,
  native_lang text not null,
  term_key text not null,
  fingerprint text not null,
  part_of_speech text not null,
  translations text[] not null,
  created_at timestamptz not null default now(),
  unique (target_lang, native_lang, term_key, fingerprint)
);

alter table public.rejected_senses enable row level security;
revoke all on public.rejected_senses from anon, authenticated;

-- 4. Functions. Service role only.
create function public.confirm_sense(p_id uuid, p_index int)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_senses jsonb;
begin
  select senses into v_senses from public.ai_suggestions where id = p_id for update;
  if not found then
    raise exception 'unknown suggestion' using errcode = 'P0002';
  end if;
  if p_index is null or p_index < 0 or p_index >= jsonb_array_length(v_senses) then
    raise exception 'sense index out of range' using errcode = '22023';
  end if;
  case coalesce(v_senses -> p_index ->> 'state', 'candidate')
    when 'rejected' then
      raise exception 'sense is rejected' using errcode = '22023';
    when 'candidate' then
      v_senses := jsonb_set(v_senses, array[p_index::text, 'state'], '"confirmed"');
      update public.ai_suggestions
        set senses = v_senses, status = 'confirmed', confirmed_at = now()
        where id = p_id;
    else
      null; -- already confirmed
  end case;
end;
$$;

revoke execute on function public.confirm_sense(uuid, int) from public, anon, authenticated;
grant execute on function public.confirm_sense(uuid, int) to service_role;

-- p_fingerprints: a jsonb array parallel to the senses, each {fingerprint, part_of_speech,
-- translations}, computed in code (fingerprint.ts). Needed for reject (the picked index) and
-- remove (all). p_corrected_key: the new corrected key, only for edit of index 0.
drop function public.moderate_suggestion(uuid, boolean);

create function public.moderate_suggestion(
  p_id uuid,
  p_action text,
  p_index int default null,
  p_sense jsonb default null,
  p_fingerprints jsonb default null,
  p_corrected_key text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.ai_suggestions%rowtype;
  v_senses jsonb;
  v_corrected text;
  v_idx int[];
  v_closed boolean;
  v_status text;
begin
  if p_action is null or p_action not in ('approve', 'edit', 'reject', 'remove') then
    raise exception 'unknown action' using errcode = '22023';
  end if;

  select * into v_row from public.ai_suggestions where id = p_id for update;
  if not found then
    raise exception 'unknown suggestion' using errcode = 'P0002';
  end if;
  v_senses := v_row.senses;
  v_corrected := v_row.corrected_key;

  if p_action <> 'remove'
     and (p_index is null or p_index < 0 or p_index >= jsonb_array_length(v_senses)) then
    raise exception 'sense index out of range' using errcode = '22023';
  end if;
  if p_action in ('approve', 'edit') and v_senses -> p_index ->> 'state' = 'rejected' then
    raise exception 'sense is rejected' using errcode = '22023';
  end if;

  if p_action = 'approve' then
    v_senses := jsonb_set(v_senses, array[p_index::text],
      (v_senses -> p_index) || '{"state":"confirmed","judged":true}'::jsonb);
  elsif p_action = 'edit' then
    if p_sense is null or jsonb_typeof(p_sense) <> 'object' then
      raise exception 'edit needs a sense' using errcode = '22023';
    end if;
    v_senses := jsonb_set(v_senses, array[p_index::text],
      p_sense || '{"state":"confirmed","judged":true}'::jsonb);
    if p_index = 0 and p_corrected_key is not null then
      v_corrected := p_corrected_key;
    end if;
  else
    -- reject and remove: pick the senses to reject, store their fingerprints, mark them.
    if p_action = 'reject' then
      v_idx := array[p_index];
    else
      if p_fingerprints is null or jsonb_typeof(p_fingerprints) <> 'array'
         or jsonb_array_length(p_fingerprints) <> jsonb_array_length(v_senses) then
        raise exception 'fingerprints must match the senses' using errcode = '22023';
      end if;
      select coalesce(array_agg((e.ord - 1)::int), '{}') into v_idx
      from jsonb_array_elements(v_senses) with ordinality as e(sense, ord)
      where coalesce(e.sense ->> 'state', 'candidate') <> 'rejected';
    end if;

    if p_fingerprints is null or jsonb_typeof(p_fingerprints) <> 'array' then
      raise exception 'fingerprints missing' using errcode = '22023';
    end if;

    -- Both keys; on conflict do nothing makes a repeat, or equal keys, store one row.
    insert into public.rejected_senses (target_lang, native_lang, term_key, fingerprint, part_of_speech, translations)
    select v_row.target_lang, v_row.native_lang, k,
           p_fingerprints -> i ->> 'fingerprint',
           p_fingerprints -> i ->> 'part_of_speech',
           array(select jsonb_array_elements_text(p_fingerprints -> i -> 'translations'))
    from unnest(v_idx) as i, unnest(array[v_row.term_key, v_corrected]) as k
    on conflict do nothing;

    select coalesce(jsonb_agg(
      case when e.ord - 1 = any (v_idx) then e.sense || '{"state":"rejected"}'::jsonb else e.sense end
      order by e.ord
    ), '[]'::jsonb) into v_senses
    from jsonb_array_elements(v_senses) with ordinality as e(sense, ord);
  end if;

  v_status := case
    when exists (select 1 from jsonb_array_elements(v_senses) e where e ->> 'state' = 'confirmed')
      then 'confirmed' else 'candidate' end;

  update public.ai_suggestions
    set senses = v_senses,
        corrected_key = v_corrected,
        status = v_status,
        confirmed_at = case when p_action in ('approve', 'edit') then now() else confirmed_at end
    where id = p_id;

  -- Closing check, after every action: nothing left that is both non-rejected and unjudged.
  v_closed := p_action = 'remove' or not exists (
    select 1 from jsonb_array_elements(v_senses) e
    where coalesce(e ->> 'state', 'candidate') <> 'rejected'
      and coalesce((e ->> 'judged')::boolean, false) = false
  );

  if v_closed then
    update public.suggestion_reports
      set closed_at = now(),
          resolution = case p_action
            when 'approve' then 'approved'
            when 'edit' then 'edited'
            when 'reject' then 'rejected'
            else 'removed' end
      where suggestion_id = p_id and closed_at is null;
  end if;

  return jsonb_build_object('senses', v_senses, 'reports_closed', v_closed);
end;
$$;

revoke execute on function public.moderate_suggestion(uuid, text, int, jsonb, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.moderate_suggestion(uuid, text, int, jsonb, jsonb, text) to service_role;
