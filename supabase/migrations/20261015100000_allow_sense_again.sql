-- Allow a rejected sense again. Builds on 20261014100000_suggestion_senses.sql (never edited).
-- p_ids: the rejected_senses rows of one entry (one rejection: same pair, fingerprint, time).
-- p_records: [{id, fingerprints}] for the suggestions to restore; fingerprints is parallel to the
-- record's senses and computed in code (fingerprint.ts), so the rule lives in one place.
-- One transaction: delete the rows, set the matching rejected senses back to candidate (judged
-- removed), recompute status. deleted_at, confirmed_at and reports are left alone.
create function public.allow_sense_again(p_ids bigint[], p_records jsonb default '[]'::jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_expected int;
  v_found int;
  v_groups int;
  v_target text;
  v_native text;
  v_fp text;
  v_keys text[];
  v_rec jsonb;
  v_row public.ai_suggestions%rowtype;
  v_senses jsonb;
  v_deleted int;
begin
  if p_ids is null or cardinality(p_ids) = 0 or jsonb_typeof(coalesce(p_records, '[]'::jsonb)) <> 'array' then
    raise exception 'ids needed' using errcode = '22023';
  end if;
  select count(distinct x) into v_expected from unnest(p_ids) as x;

  perform 1 from public.rejected_senses where id = any (p_ids) for update;
  select count(*),
         count(distinct target_lang || '|' || native_lang || '|' || fingerprint),
         min(target_lang), min(native_lang), min(fingerprint), array_agg(term_key)
    into v_found, v_groups, v_target, v_native, v_fp, v_keys
    from public.rejected_senses where id = any (p_ids);
  if v_found <> v_expected then
    raise exception 'unknown rejected sense' using errcode = 'P0002';
  end if;
  if v_groups <> 1 then
    raise exception 'rows are not one sense' using errcode = '22023';
  end if;

  delete from public.rejected_senses where id = any (p_ids);
  get diagnostics v_deleted = row_count;

  for v_rec in select * from jsonb_array_elements(coalesce(p_records, '[]'::jsonb)) loop
    select * into v_row from public.ai_suggestions where id = (v_rec ->> 'id')::uuid for update;
    if not found
       or v_row.target_lang <> v_target or v_row.native_lang <> v_native
       or not (v_row.term_key = any (v_keys) or v_row.corrected_key = any (v_keys)) then
      raise exception 'suggestion does not match' using errcode = '22023';
    end if;
    if jsonb_typeof(v_rec -> 'fingerprints') <> 'array'
       or jsonb_array_length(v_rec -> 'fingerprints') <> jsonb_array_length(v_row.senses) then
      raise exception 'fingerprints must match the senses' using errcode = '22023';
    end if;

    select coalesce(jsonb_agg(
      case when e.sense ->> 'state' = 'rejected' and (v_rec -> 'fingerprints') ->> ((e.ord - 1)::int) = v_fp
        then (e.sense - 'judged') || '{"state":"candidate"}'::jsonb
        else e.sense end
      order by e.ord
    ), '[]'::jsonb) into v_senses
    from jsonb_array_elements(v_row.senses) with ordinality as e(sense, ord);

    update public.ai_suggestions
      set senses = v_senses,
          status = case
            when exists (select 1 from jsonb_array_elements(v_senses) x where x ->> 'state' = 'confirmed')
              then 'confirmed' else 'candidate' end
      where id = v_row.id;
  end loop;

  return v_deleted;
end;
$$;

revoke execute on function public.allow_sense_again(bigint[], jsonb) from public, anon, authenticated;
grant execute on function public.allow_sense_again(bigint[], jsonb) to service_role;
