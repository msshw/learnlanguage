-- Admin flag, soft delete of shared suggestions, user reports about suggestions.

-- profiles.is_admin: readable by its owner like any column, changeable only by database owner
-- rights or the service role. The owner update policy lets a user change any column, so a trigger
-- guards this one. It fails closed: any role that is not on the list is rejected, including
-- authenticated and anon, and it is a security invoker function so current_user is the caller.
alter table public.profiles add column is_admin boolean not null default false;

create function public.guard_is_admin()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.is_admin is distinct from old.is_admin
     and current_user not in ('postgres', 'supabase_admin', 'service_role') then
    raise exception 'profiles.is_admin cannot be changed by this role' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_is_admin() from public, anon, authenticated;

create trigger profiles_guard_is_admin
  before update on public.profiles
  for each row execute function public.guard_is_admin();

-- Removed suggestions are kept but never served or confirmed.
alter table public.ai_suggestions add column deleted_at timestamptz;

-- Complaints: one per user per suggestion, insert-only for users. No select policy and no grants
-- other than insert, so a client can neither read nor close a report. The foreign key is checked
-- with owner rights, so a user can report a suggestion they cannot read. The admin function reads
-- and closes reports with the service role.
create table public.suggestion_reports (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  suggestion_id uuid not null references public.ai_suggestions (id),
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  resolution text check (resolution in ('removed', 'kept')),
  unique (user_id, suggestion_id),
  check ((closed_at is null) = (resolution is null))
);

create index suggestion_reports_open_idx on public.suggestion_reports (suggestion_id) where closed_at is null;

alter table public.suggestion_reports enable row level security;
revoke all on public.suggestion_reports from anon, authenticated;
grant insert on public.suggestion_reports to authenticated;

create policy suggestion_reports_insert_own on public.suggestion_reports
  for insert to authenticated
  with check (user_id = (select auth.uid()));

-- One transaction: optionally soft-delete the suggestion, then close its open reports.
create function public.moderate_suggestion(p_id uuid, p_remove boolean)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_remove then
    update public.ai_suggestions set deleted_at = now() where id = p_id and deleted_at is null;
  end if;
  update public.suggestion_reports
    set closed_at = now(), resolution = case when p_remove then 'removed' else 'kept' end
    where suggestion_id = p_id and closed_at is null;
end;
$$;

revoke execute on function public.moderate_suggestion(uuid, boolean) from public, anon, authenticated;
grant execute on function public.moderate_suggestion(uuid, boolean) to service_role;
