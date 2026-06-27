-- ============================================================
--  NpStudio — database schema
--  Paste this whole file into Supabase → SQL Editor → Run.
--  Safe to re-run (drops & recreates policies).
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- tables ----------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text,
  email      text,
  color      text,
  created_at timestamptz default now()
);

create table if not exists public.clients (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  project    text,
  value      numeric default 0,
  status     text default 'Lead',
  next_step  text,
  owner      text,
  created_at timestamptz default now()
);

create table if not exists public.tasks (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  who        text,
  due        date,
  done       boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  sender_id   uuid,
  sender_name text,
  text        text not null,
  created_at  timestamptz default now()
);

create table if not exists public.notes (
  id         uuid primary key default gen_random_uuid(),
  title      text,
  body       text,
  tag        text,
  author     text,
  pinned     boolean default false,
  updated_at timestamptz default now()
);

create table if not exists public.events (
  id         uuid primary key default gen_random_uuid(),
  title      text,
  date       date,
  time       text,
  who        text,
  created_at timestamptz default now()
);

-- ---------- row level security ----------
alter table public.profiles enable row level security;
alter table public.clients  enable row level security;
alter table public.tasks    enable row level security;
alter table public.messages enable row level security;
alter table public.notes    enable row level security;
alter table public.events   enable row level security;

-- profiles: everyone signed-in can read; you can only write your own
drop policy if exists "profiles read"       on public.profiles;
drop policy if exists "profiles insert own" on public.profiles;
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles read"       on public.profiles for select to authenticated using (true);
create policy "profiles insert own" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles update own" on public.profiles for update to authenticated using (auth.uid() = id);

-- shared workspace tables: any signed-in user has full access
drop policy if exists "clients all"  on public.clients;
drop policy if exists "tasks all"    on public.tasks;
drop policy if exists "messages all" on public.messages;
drop policy if exists "notes all"    on public.notes;
drop policy if exists "events all"   on public.events;
create policy "clients all"  on public.clients  for all to authenticated using (true) with check (true);
create policy "tasks all"    on public.tasks    for all to authenticated using (true) with check (true);
create policy "messages all" on public.messages for all to authenticated using (true) with check (true);
create policy "notes all"    on public.notes    for all to authenticated using (true) with check (true);
create policy "events all"   on public.events   for all to authenticated using (true) with check (true);

-- ---------- realtime (live sync between the two of you) ----------
-- If any line errors with "already member of publication", that's fine — ignore it.
alter publication supabase_realtime add table public.clients;
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notes;
alter publication supabase_realtime add table public.events;

-- ============================================================
--  MIGRATION — profile pictures, groups & direct messages
--  (safe to run on an existing database; only adds things)
-- ============================================================

-- profile picture
alter table public.profiles add column if not exists avatar_url text;

-- conversations: 'team' is implicit (messages with null conversation_id);
-- 'dm' = 1:1, 'group' = named multi-person
create table if not exists public.conversations (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null default 'group',   -- 'dm' | 'group'
  name       text,
  created_by uuid,
  created_at timestamptz default now()
);

create table if not exists public.conversation_members (
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete cascade,
  created_at      timestamptz default now(),
  primary key (conversation_id, user_id)
);

-- route messages to a conversation (null = shared Team channel)
alter table public.messages add column if not exists conversation_id uuid references public.conversations(id) on delete cascade;

alter table public.conversations        enable row level security;
alter table public.conversation_members enable row level security;

-- any signed-in user can read/create conversations & membership
drop policy if exists "conversations all" on public.conversations;
drop policy if exists "members all"       on public.conversation_members;
create policy "conversations all" on public.conversations        for all to authenticated using (true) with check (true);
create policy "members all"       on public.conversation_members for all to authenticated using (true) with check (true);

alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.conversation_members;

-- ============================================================
--  STORAGE — avatars bucket (public read, signed-in write)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars public read"  on storage.objects;
drop policy if exists "avatars auth write"   on storage.objects;
drop policy if exists "avatars auth update"  on storage.objects;
create policy "avatars public read" on storage.objects for select using (bucket_id = 'avatars');
create policy "avatars auth write"  on storage.objects for insert to authenticated with check (bucket_id = 'avatars');
create policy "avatars auth update" on storage.objects for update to authenticated using (bucket_id = 'avatars');
