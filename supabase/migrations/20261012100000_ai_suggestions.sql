-- Shared store of AI suggestions. The one table without user_id: it holds no user data.
-- Only the autofill edge function touches it, with the service role (which bypasses RLS).
-- RLS is on with no policies, and all grants to client roles are revoked, so no session can
-- read or write it.
create table public.ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  target_lang text not null,
  native_lang text not null,
  term_key text not null,
  corrected_key text not null,
  senses jsonb not null,
  model text not null,
  status text not null check (status in ('candidate', 'confirmed')),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

-- No unique constraint: two simultaneous confirms may leave a duplicate; lookup takes the newest.
create index ai_suggestions_term_idx
  on public.ai_suggestions (target_lang, native_lang, term_key) where status = 'confirmed';
create index ai_suggestions_corrected_idx
  on public.ai_suggestions (target_lang, native_lang, corrected_key) where status = 'confirmed';

alter table public.ai_suggestions enable row level security;
revoke all on public.ai_suggestions from anon, authenticated;

-- ponytail: candidates are never cleaned up. If the table grows, delete candidates older than
-- 30 days by SQL or cron.
