-- Daily Brief schema. Run once in the Supabase SQL Editor.
-- Every table is protected by Row Level Security: a signed-in user can only
-- read and write their own rows, so the public anon/publishable key is safe
-- to ship in the browser bundle.

create table if not exists public.briefs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null,
  brief_date  date,
  raw_text    text not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_key    text not null,              -- stable id of the brief item it came from
  brief_id    uuid references public.briefs (id) on delete set null,
  title       text not null,
  quadrant    text not null check (quadrant in ('do', 'schedule', 'delegate', 'later')),
  due         text not null default '',
  from_name   text,
  action      text,
  refs        text[] not null default '{}',
  score       integer not null default 0,
  done        boolean not null default false,
  done_at     timestamptz,
  created_at  timestamptz not null default now(),
  unique (user_id, item_key)
);

create table if not exists public.dismissed_items (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_key    text not null,
  title       text not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, item_key)
);

create table if not exists public.history (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  action      text not null check (action in ('taken', 'done', 'dismissed')),
  title       text not null,
  quadrant    text check (quadrant in ('do', 'schedule', 'delegate', 'later')),
  created_at  timestamptz not null default now()
);

create index if not exists briefs_user_created_idx  on public.briefs  (user_id, created_at desc);
create index if not exists history_user_created_idx on public.history (user_id, created_at desc);

alter table public.briefs          enable row level security;
alter table public.tasks           enable row level security;
alter table public.dismissed_items enable row level security;
alter table public.history         enable row level security;

drop policy if exists "own briefs" on public.briefs;
create policy "own briefs" on public.briefs
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "own tasks" on public.tasks;
create policy "own tasks" on public.tasks
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "own dismissed items" on public.dismissed_items;
create policy "own dismissed items" on public.dismissed_items
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "own history" on public.history;
create policy "own history" on public.history
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
