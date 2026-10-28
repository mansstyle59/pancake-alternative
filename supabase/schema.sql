-- Pipeline Pilot schema. Apply in the dedicated Supabase project only.
create extension if not exists pgcrypto;

create table if not exists public.prospects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company text not null,
  contact text,
  sector text,
  score integer not null default 50 check (score between 0 and 100),
  status text not null default 'À qualifier' check (status in ('À qualifier','À contacter','Contacté','Répondu','Client')),
  site text,
  notes text,
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  audience text,
  goal text,
  status text not null default 'Brouillon',
  created_at timestamptz not null default now()
);
create table if not exists public.message_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company text,
  subject text,
  body text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.ideal_customer_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  sector text,
  area text,
  size text,
  pain text,
  value_proposition text,
  updated_at timestamptz not null default now()
);

alter table public.prospects enable row level security;
alter table public.campaigns enable row level security;
alter table public.message_drafts enable row level security;
alter table public.ideal_customer_profiles enable row level security;

create policy "Users manage own prospects" on public.prospects for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage own campaigns" on public.campaigns for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage own drafts" on public.message_drafts for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage own ICP" on public.ideal_customer_profiles for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create index if not exists prospects_user_created_idx on public.prospects(user_id, created_at desc);
create index if not exists prospects_user_status_idx on public.prospects(user_id, status);
create index if not exists campaigns_user_created_idx on public.campaigns(user_id, created_at desc);
create index if not exists drafts_user_created_idx on public.message_drafts(user_id, created_at desc);
