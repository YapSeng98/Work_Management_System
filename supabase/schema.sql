-- Daily Brief tables, added to the Planner app's Supabase project (rleqtargnhpsojfpegtf).
-- Run in that project's SQL Editor — safe to re-run after updates.
--
-- Only NEW tables prefixed brief_ are created here; the Planner's own tables are not
-- touched. Tasks taken from a brief are created in the Planner's public.tasks through
-- its sync_push() function (the same path the Planner app uses), and brief_task_links
-- remembers which brief item each task came from.
--
-- Every table is protected by Row Level Security: a signed-in user can only read and
-- write their own rows, so the public publishable key is safe in the browser bundle.

create table if not exists public.brief_reports (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null,
  brief_date  date,
  raw_text    text not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.brief_task_links (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_key    text not null,               -- stable id of the brief item the task came from
  task_id     uuid not null unique references public.tasks (id) on delete cascade,
  brief_id    uuid references public.brief_reports (id) on delete set null,
  quadrant    text not null check (quadrant in ('do', 'schedule', 'delegate', 'later')),
  from_name   text,
  action      text,
  refs        text[] not null default '{}',
  score       integer not null default 0,
  created_at  timestamptz not null default now(),
  primary key (user_id, item_key)
);

create table if not exists public.brief_dismissed (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_key    text not null,
  title       text not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, item_key)
);

create table if not exists public.brief_history (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  action      text not null check (action in ('taken', 'done', 'dismissed')),
  title       text not null,
  quadrant    text check (quadrant in ('do', 'schedule', 'delegate', 'later')),
  created_at  timestamptz not null default now()
);

create index if not exists brief_reports_user_created_idx on public.brief_reports (user_id, created_at desc);
create index if not exists brief_history_user_created_idx on public.brief_history (user_id, created_at desc);

alter table public.brief_reports    enable row level security;
alter table public.brief_task_links enable row level security;
alter table public.brief_dismissed  enable row level security;
alter table public.brief_history    enable row level security;

grant select, insert, update, delete on public.brief_reports, public.brief_task_links,
  public.brief_dismissed, public.brief_history to authenticated;

drop policy if exists "own rows" on public.brief_reports;
create policy "own rows" on public.brief_reports
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "own rows" on public.brief_task_links;
create policy "own rows" on public.brief_task_links
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "own rows" on public.brief_dismissed;
create policy "own rows" on public.brief_dismissed
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "own rows" on public.brief_history;
create policy "own rows" on public.brief_history
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Live updates for the brief tables. (Changes to Planner tasks already reach the app
-- through the Planner's own sync_signals table.) Safe to re-run.
do $$
declare t text;
begin
  foreach t in array array['brief_reports', 'brief_task_links', 'brief_dismissed', 'brief_history'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
