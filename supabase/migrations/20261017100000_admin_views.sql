-- Read-only joins for the admin Users and AI calls views. They read auth.users, which PostgREST
-- cannot join. Service role only (the admin edge function). Counts and metadata only: no word
-- text, sentences, review content or ai_calls.error. Cost is priced in the function, not here.

create function public.admin_users(p_offset int, p_limit int)
returns table (
  id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  is_admin boolean,
  word_count bigint,
  review_count bigint,
  sentence_count bigint,
  ai_calls_month bigint,
  input_tokens_month bigint,
  output_tokens_month bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    u.id,
    u.email::text,
    u.created_at,
    u.last_sign_in_at,
    coalesce(p.is_admin, false),
    (select count(*) from public.words w where w.user_id = u.id and w.deleted_at is null),
    (select count(*) from public.review_logs r where r.user_id = u.id),
    (select count(*) from public.sentence_logs s where s.user_id = u.id),
    (select count(*) from public.ai_calls a where a.user_id = u.id and a.created_at >= m.start),
    (select coalesce(sum(a.input_tokens), 0)::bigint from public.ai_calls a where a.user_id = u.id and a.created_at >= m.start),
    (select coalesce(sum(a.output_tokens), 0)::bigint from public.ai_calls a where a.user_id = u.id and a.created_at >= m.start)
  from auth.users u
  cross join (select date_trunc('month', now() at time zone 'utc') at time zone 'utc' as start) m
  left join public.profiles p on p.id = u.id
  order by u.created_at desc, u.id
  offset p_offset limit p_limit;
$$;

create function public.admin_ai_calls(p_offset int, p_limit int)
returns table (
  id bigint,
  email text,
  kind text,
  model text,
  input_tokens int,
  output_tokens int,
  latency_ms int,
  ok boolean,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, u.email::text, a.kind, a.model, a.input_tokens, a.output_tokens, a.latency_ms, a.ok, a.created_at
  from public.ai_calls a
  join auth.users u on u.id = a.user_id
  order by a.created_at desc, a.id desc
  offset p_offset limit p_limit;
$$;

revoke execute on function public.admin_users(int, int) from public, anon, authenticated;
grant execute on function public.admin_users(int, int) to service_role;
revoke execute on function public.admin_ai_calls(int, int) from public, anon, authenticated;
grant execute on function public.admin_ai_calls(int, int) to service_role;
