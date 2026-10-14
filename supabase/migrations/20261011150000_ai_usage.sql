-- Token totals of one user's ai_calls since a point in time. The autofill edge function prices
-- them against the monthly cap. Service role only: PostgREST aggregates are off and responses
-- are capped at 1000 rows, so the sum has to happen in the database.
create function public.ai_usage_since(p_user uuid, p_from timestamptz)
returns table (input_tokens bigint, output_tokens bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(sum(input_tokens), 0)::bigint, coalesce(sum(output_tokens), 0)::bigint
  from public.ai_calls
  where user_id = p_user and created_at >= p_from;
$$;

revoke execute on function public.ai_usage_since(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.ai_usage_since(uuid, timestamptz) to service_role;
