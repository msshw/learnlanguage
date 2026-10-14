-- Review recording: FSRS learning step, one log row per card and answer time,
-- and an atomic, repeatable record_review call.

alter table public.cards
  add column learning_steps int not null default 0 check (learning_steps >= 0);

create unique index review_logs_card_id_reviewed_at_key
  on public.review_logs (card_id, reviewed_at);

-- security invoker: the caller's RLS applies. The review_logs insert policy requires an owned
-- card, so recording against someone else's card raises and writes nothing.
-- A repeated call hits the unique key and does nothing; an answer older than the card's
-- last review is still logged but does not move the card back.
create function public.record_review(p jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_card_id uuid := (p ->> 'card_id')::uuid;
  v_reviewed_at timestamptz := (p ->> 'reviewed_at')::timestamptz;
  n jsonb := p -> 'next';
begin
  insert into public.review_logs (
    user_id, card_id, reviewed_at, typed_answer, grader_result,
    rating, overridden, state_before, duration_ms
  ) values (
    (select auth.uid()), v_card_id, v_reviewed_at, p ->> 'typed_answer', p ->> 'grader_result',
    (p ->> 'rating')::smallint, (p ->> 'overridden')::boolean, p -> 'state_before',
    (p ->> 'duration_ms')::int
  )
  on conflict (card_id, reviewed_at) do nothing;

  if not found then
    return;
  end if;

  update public.cards set
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
    and (last_review is null or last_review < v_reviewed_at);
end;
$$;

revoke execute on function public.record_review(jsonb) from public, anon;
grant execute on function public.record_review(jsonb) to authenticated;
