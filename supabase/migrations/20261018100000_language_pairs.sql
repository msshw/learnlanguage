-- Language pairs: per-pair daily limit, pair hardening, neutral column and direction names, and the
-- same rename inside ai_suggestions.senses. One transaction (the migration runner's).

-- 1. Per-pair limit. Each user's profile value is copied to all of their pairs, then dropped.
alter table public.language_pairs
  add column new_words_per_day int not null default 10 check (new_words_per_day >= 0);

update public.language_pairs lp
set new_words_per_day = p.new_words_per_day
from public.profiles p
where p.id = lp.user_id;

alter table public.profiles drop column new_words_per_day;

alter table public.language_pairs
  add constraint language_pairs_languages_differ check (target_lang <> native_lang);

-- A pair's languages never change under its words: clients may update only the limit.
revoke update on public.language_pairs from anon, authenticated;
grant update (new_words_per_day) on public.language_pairs to authenticated;

-- 2. Word columns
alter table public.words rename column hint_en to hint_native;
alter table public.words rename column example_de to example_target;
alter table public.words rename column example_en to example_native;

-- 3. Card directions: de_en -> forward (target shown), en_de -> reverse (native shown)
alter table public.cards drop constraint cards_direction_check;
update public.cards
set direction = case direction when 'de_en' then 'forward' when 'en_de' then 'reverse' end;
alter table public.cards
  add constraint cards_direction_check check (direction in ('forward', 'reverse'));

-- 4. Same trigger function as 20261016100000, new direction names
create or replace function public.create_cards_for_word()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.cards (user_id, word_id, direction, state, due)
  values
    (new.user_id, new.id, 'forward', 'new', now()),
    (new.user_id, new.id, 'reverse', 'new', now() + interval '1 day');
  insert into public.sentence_cards (user_id, word_id, state, due)
  values (new.user_id, new.id, 'new', now());
  return new;
end;
$$;

revoke execute on function public.create_cards_for_word() from public, anon, authenticated;

-- 5. Rename the sense keys. Renames only the keys that are present (a JSON null value is kept),
-- leaves every other key (state, judged, forms, ...) and the element order alone.
create function public.rename_sense_keys(p jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(p) <> 'array' then p
    else coalesce(
      (select jsonb_agg(
         case
           when jsonb_typeof(e.v) <> 'object' then e.v
           else (e.v - 'hint_en' - 'example_de' - 'example_en')
             || case when e.v ? 'hint_en' then jsonb_build_object('hint_native', e.v -> 'hint_en') else '{}'::jsonb end
             || case when e.v ? 'example_de' then jsonb_build_object('example_target', e.v -> 'example_de') else '{}'::jsonb end
             || case when e.v ? 'example_en' then jsonb_build_object('example_native', e.v -> 'example_en') else '{}'::jsonb end
         end
         order by e.i)
       from jsonb_array_elements(p) with ordinality as e(v, i)),
      '[]'::jsonb)
  end
$$;

revoke execute on function public.rename_sense_keys(jsonb) from public, anon, authenticated;
grant execute on function public.rename_sense_keys(jsonb) to service_role;

update public.ai_suggestions set senses = public.rename_sense_keys(senses);

do $$
declare
  n int;
begin
  select count(*) into n
  from public.ai_suggestions s, jsonb_array_elements(s.senses) e
  where jsonb_typeof(e) = 'object' and (e ? 'hint_en' or e ? 'example_de' or e ? 'example_en');
  if n > 0 then
    raise exception 'rename_sense_keys left % sense(s) with an old key', n;
  end if;
end;
$$;
