-- Sentence practice: one FSRS card per word of its own, an append-only attempt log, a trigger that
-- creates the card with the word, a backfill for existing words, and an atomic, repeatable
-- record_sentence call. Word review cards and review_logs are not touched.

create table public.sentence_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  word_id uuid not null unique references public.words (id) on delete cascade,
  state text not null default 'new'
    check (state in ('new', 'learning', 'review', 'relearning')),
  due timestamptz not null default now(),
  stability double precision not null default 0,
  difficulty double precision not null default 0,
  elapsed_days int not null default 0,
  scheduled_days int not null default 0,
  learning_steps int not null default 0 check (learning_steps >= 0),
  reps int not null default 0,
  lapses int not null default 0,
  last_review timestamptz
);

create index sentence_cards_user_due_idx on public.sentence_cards (user_id, due);

create table public.sentence_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  sentence_card_id uuid not null references public.sentence_cards (id) on delete cascade,
  practiced_at timestamptz not null default now(),
  sentence text not null check (char_length(sentence) between 1 and 300),
  corrected text,
  issues jsonb,
  check_status text not null check (check_status in ('ok', 'unavailable')),
  rating smallint not null check (rating between 1 and 4),
  state_before jsonb not null,
  duration_ms int,
  unique (sentence_card_id, practiced_at)
);

alter table public.sentence_cards enable row level security;
alter table public.sentence_logs enable row level security;

revoke delete on public.sentence_cards, public.sentence_logs from anon, authenticated;

-- sentence_cards: same shape as cards
create policy sentence_cards_select_own on public.sentence_cards
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy sentence_cards_insert_own on public.sentence_cards
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.words w
      where w.id = sentence_cards.word_id and w.user_id = (select auth.uid())
    )
  );

create policy sentence_cards_update_own on public.sentence_cards
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.words w
      where w.id = sentence_cards.word_id and w.user_id = (select auth.uid())
    )
  );

-- sentence_logs: append-only (insert and select only), own parent card
create policy sentence_logs_select_own on public.sentence_logs
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy sentence_logs_insert_own on public.sentence_logs
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.sentence_cards c
      where c.id = sentence_logs.sentence_card_id and c.user_id = (select auth.uid())
    )
  );

-- Saving a word also creates its practice card. Same function and trigger as before, one insert more.
create or replace function public.create_cards_for_word()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.cards (user_id, word_id, direction, state, due)
  values
    (new.user_id, new.id, 'de_en', 'new', now()),
    (new.user_id, new.id, 'en_de', 'new', now() + interval '1 day');
  insert into public.sentence_cards (user_id, word_id, state, due)
  values (new.user_id, new.id, 'new', now());
  return new;
end;
$$;

revoke execute on function public.create_cards_for_word() from public, anon, authenticated;

-- Existing words (deleted ones too, as with review cards) get a practice card.
insert into public.sentence_cards (user_id, word_id, state, due)
select user_id, id, 'new', now() from public.words
on conflict (word_id) do nothing;

-- security invoker: the caller's RLS applies. The sentence_logs insert policy requires an owned
-- card, so recording against someone else's card raises and writes nothing; the card update is
-- filtered by RLS as well. A repeated call hits the unique key and does nothing; an attempt older
-- than the card's last review is still logged but does not move the card back.
create function public.record_sentence(p jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_card_id uuid := (p ->> 'sentence_card_id')::uuid;
  v_practiced_at timestamptz := (p ->> 'practiced_at')::timestamptz;
  n jsonb := p -> 'next';
begin
  insert into public.sentence_logs (
    user_id, sentence_card_id, practiced_at, sentence, corrected, issues,
    check_status, rating, state_before, duration_ms
  ) values (
    (select auth.uid()), v_card_id, v_practiced_at, p ->> 'sentence', p ->> 'corrected', p -> 'issues',
    p ->> 'check_status', (p ->> 'rating')::smallint, p -> 'state_before', (p ->> 'duration_ms')::int
  )
  on conflict (sentence_card_id, practiced_at) do nothing;

  if not found then
    return;
  end if;

  update public.sentence_cards set
    state = n ->> 'state',
    due = (n ->> 'due')::timestamptz,
    stability = (n ->> 'stability')::double precision,
    difficulty = (n ->> 'difficulty')::double precision,
    elapsed_days = (n ->> 'elapsed_days')::int,
    scheduled_days = (n ->> 'scheduled_days')::int,
    learning_steps = (n ->> 'learning_steps')::int,
    reps = (n ->> 'reps')::int,
    lapses = (n ->> 'lapses')::int,
    last_review = (n ->> 'last_review')::timestamptz
  where id = v_card_id
    and (last_review is null or last_review < v_practiced_at);
end;
$$;

revoke execute on function public.record_sentence(jsonb) from public, anon;
grant execute on function public.record_sentence(jsonb) to authenticated;
