-- RLS on every table. Rules:
--   * rows are visible and writable only where user_id (id for profiles) = auth.uid()
--   * a row that references a parent must reference the caller's own parent
--     (the exists() subqueries run under the caller's RLS, so another user's rows count as missing)
--   * no DELETE policy anywhere; delete grants are also revoked as a second guard
--   * review_logs: insert and select only
--   * ai_calls: select only (the edge function writes with the service role)

alter table public.profiles enable row level security;
alter table public.language_pairs enable row level security;
alter table public.words enable row level security;
alter table public.cards enable row level security;
alter table public.review_logs enable row level security;
alter table public.ai_calls enable row level security;

revoke delete on
  public.profiles, public.language_pairs, public.words,
  public.cards, public.review_logs, public.ai_calls
from anon, authenticated;

-- profiles: created by trigger, never inserted by clients
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and (
      active_pair_id is null
      or exists (
        select 1 from public.language_pairs p
        where p.id = profiles.active_pair_id and p.user_id = (select auth.uid())
      )
    )
  );

-- language_pairs
create policy language_pairs_select_own on public.language_pairs
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy language_pairs_insert_own on public.language_pairs
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy language_pairs_update_own on public.language_pairs
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- words
create policy words_select_own on public.words
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy words_insert_own on public.words
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.language_pairs p
      where p.id = words.pair_id and p.user_id = (select auth.uid())
    )
  );

create policy words_update_own on public.words
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.language_pairs p
      where p.id = words.pair_id and p.user_id = (select auth.uid())
    )
  );

-- cards
create policy cards_select_own on public.cards
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy cards_insert_own on public.cards
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.words w
      where w.id = cards.word_id and w.user_id = (select auth.uid())
    )
  );

create policy cards_update_own on public.cards
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.words w
      where w.id = cards.word_id and w.user_id = (select auth.uid())
    )
  );

-- review_logs: append-only
create policy review_logs_select_own on public.review_logs
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy review_logs_insert_own on public.review_logs
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.cards c
      where c.id = review_logs.card_id and c.user_id = (select auth.uid())
    )
  );

-- ai_calls: read-only for users
create policy ai_calls_select_own on public.ai_calls
  for select to authenticated
  using (user_id = (select auth.uid()));
