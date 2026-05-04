-- Life RPG App — Supabase Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension (usually already enabled)
create extension if not exists "uuid-ossp";

-- ─── PROFILES ────────────────────────────────────────────────────────────────
create table if not exists profiles (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid references auth.users(id) on delete cascade not null unique,
  username         text not null default 'Adventurer',
  character_class  text not null default 'Novice',
  avatar           text not null default '⚔️',
  level            integer not null default 1,
  xp               integer not null default 0,
  xp_to_next_level integer not null default 100,
  created_at       timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Users can view own profile"
  on profiles for select using (auth.uid() = user_id);

create policy "Users can insert own profile"
  on profiles for insert with check (auth.uid() = user_id);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = user_id);

-- ─── STATS ───────────────────────────────────────────────────────────────────
create table if not exists stats (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid references auth.users(id) on delete cascade not null unique,
  strength   integer not null default 25 check (strength between 0 and 100),
  intellect  integer not null default 25 check (intellect between 0 and 100),
  ambition   integer not null default 25 check (ambition between 0 and 100),
  wealth     integer not null default 25 check (wealth between 0 and 100)
);

alter table stats enable row level security;

create policy "Users can view own stats"
  on stats for select using (auth.uid() = user_id);

create policy "Users can insert own stats"
  on stats for insert with check (auth.uid() = user_id);

create policy "Users can update own stats"
  on stats for update using (auth.uid() = user_id);

-- ─── QUESTS ──────────────────────────────────────────────────────────────────
create table if not exists quests (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid references auth.users(id) on delete cascade not null,
  title          text not null,
  category       text not null check (category in ('health','mind','career','finance')),
  difficulty     text not null check (difficulty in ('easy','medium','hard','legendary')),
  xp_reward      integer not null default 25,
  is_recurring   boolean not null default true,
  streak         integer not null default 0,
  last_completed date,
  created_at     timestamptz not null default now()
);

alter table quests enable row level security;

create policy "Users can view own quests"
  on quests for select using (auth.uid() = user_id);

create policy "Users can insert own quests"
  on quests for insert with check (auth.uid() = user_id);

create policy "Users can update own quests"
  on quests for update using (auth.uid() = user_id);

create policy "Users can delete own quests"
  on quests for delete using (auth.uid() = user_id);

-- ─── OBJECTIVES ──────────────────────────────────────────────────────────────
create table if not exists objectives (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  title       text not null,
  description text,
  category    text not null check (category in ('health','mind','career','finance')),
  progress    integer not null default 0 check (progress between 0 and 100),
  milestones  jsonb not null default '[]'::jsonb,
  completed   boolean not null default false,
  created_at  timestamptz not null default now()
);

alter table objectives enable row level security;

create policy "Users can view own objectives"
  on objectives for select using (auth.uid() = user_id);

create policy "Users can insert own objectives"
  on objectives for insert with check (auth.uid() = user_id);

create policy "Users can update own objectives"
  on objectives for update using (auth.uid() = user_id);

create policy "Users can delete own objectives"
  on objectives for delete using (auth.uid() = user_id);

-- ─── REWARDS ─────────────────────────────────────────────────────────────────
create table if not exists rewards (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  title       text not null,
  description text,
  tier        text not null check (tier in ('small','medium','large','legendary')),
  xp_cost     integer not null default 100,
  created_at  timestamptz not null default now()
);

alter table rewards enable row level security;

create policy "Users can view own rewards"
  on rewards for select using (auth.uid() = user_id);

create policy "Users can insert own rewards"
  on rewards for insert with check (auth.uid() = user_id);

create policy "Users can update own rewards"
  on rewards for update using (auth.uid() = user_id);

create policy "Users can delete own rewards"
  on rewards for delete using (auth.uid() = user_id);

-- ─── REDEMPTIONS ─────────────────────────────────────────────────────────────
create table if not exists redemptions (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  reward_id   uuid references rewards(id) on delete set null,
  redeemed_at timestamptz not null default now()
);

alter table redemptions enable row level security;

create policy "Users can view own redemptions"
  on redemptions for select using (auth.uid() = user_id);

create policy "Users can insert own redemptions"
  on redemptions for insert with check (auth.uid() = user_id);

-- ─── ACTIVITY LOG ────────────────────────────────────────────────────────────
create table if not exists activity_log (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  entry_type  text not null check (entry_type in ('quest_complete','reward_redeemed','level_up','stat_boost')),
  description text not null,
  xp_delta    integer not null default 0,
  created_at  timestamptz not null default now()
);

alter table activity_log enable row level security;

create policy "Users can view own activity"
  on activity_log for select using (auth.uid() = user_id);

create policy "Users can insert own activity"
  on activity_log for insert with check (auth.uid() = user_id);

-- ─── INDEXES ─────────────────────────────────────────────────────────────────
create index if not exists quests_user_id_idx       on quests(user_id);
create index if not exists objectives_user_id_idx   on objectives(user_id);
create index if not exists rewards_user_id_idx      on rewards(user_id);
create index if not exists redemptions_user_id_idx  on redemptions(user_id);
create index if not exists activity_log_user_id_idx on activity_log(user_id, created_at desc);
