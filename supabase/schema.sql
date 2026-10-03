-- Run in a dedicated Supabase project's SQL Editor.
create table if not exists public.learning_events (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  schema_version integer not null check (schema_version = 1),
  event_type text not null check (event_type in ('lesson', 'review', 'assessment')),
  occurred_at timestamptz not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists learning_events_user_time_idx
  on public.learning_events (user_id, occurred_at);

alter table public.learning_events enable row level security;
revoke all on public.learning_events from anon;
revoke all on public.learning_events from authenticated;
grant select, insert on public.learning_events to authenticated;

create policy "read own learning events"
  on public.learning_events for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "insert own learning events"
  on public.learning_events for insert to authenticated
  with check ((select auth.uid()) = user_id);
