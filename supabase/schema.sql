-- Life RPG App — Supabase Schema (v2)
-- Safe to run multiple times. Drop-if-exists guards on all policies.

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
drop policy if exists "Users can view own profile"   on profiles;
drop policy if exists "Users can insert own profile" on profiles;
drop policy if exists "Users can update own profile" on profiles;
create policy "Users can view own profile"   on profiles for select using (auth.uid() = user_id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = user_id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = user_id);

-- ─── STATS ───────────────────────────────────────────────────────────────────
create table if not exists stats (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references auth.users(id) on delete cascade not null unique,
  health        integer not null default 25 check (health between 0 and 100),
  intellect     integer not null default 25 check (intellect between 0 and 100),
  work          integer not null default 25 check (work between 0 and 100),
  wealth        integer not null default 25 check (wealth between 0 and 100),
  relationships integer not null default 25 check (relationships between 0 and 100)
);

alter table stats enable row level security;
drop policy if exists "Users can view own stats"   on stats;
drop policy if exists "Users can insert own stats" on stats;
drop policy if exists "Users can update own stats" on stats;
create policy "Users can view own stats"   on stats for select using (auth.uid() = user_id);
create policy "Users can insert own stats" on stats for insert with check (auth.uid() = user_id);
create policy "Users can update own stats" on stats for update using (auth.uid() = user_id);

-- ─── QUESTS ──────────────────────────────────────────────────────────────────
create table if not exists quests (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid references auth.users(id) on delete cascade not null,
  title          text not null,
  description    text,
  category       text not null,
  difficulty     text not null check (difficulty in ('easy','medium','hard','legendary')),
  frequency      text not null default 'daily' check (frequency in ('daily','weekly')),
  xp_reward      integer not null default 25,
  is_recurring   boolean not null default true,
  deadline       date,
  streak         integer not null default 0,
  last_completed date,
  created_at     timestamptz not null default now()
);

-- Add new columns if upgrading from v1
alter table quests add column if not exists description text;
alter table quests add column if not exists deadline date;
alter table quests add column if not exists frequency text not null default 'daily' check (frequency in ('daily','weekly'));

-- Migrate v1 'career' rows to 'work' BEFORE applying the constraint
update quests set category = 'work' where category = 'career';

-- Refresh category constraint to include all v2 values
alter table quests drop constraint if exists quests_category_check;
alter table quests add constraint quests_category_check
  check (category in ('health','mind','work','finance','relationships'));

alter table quests enable row level security;
drop policy if exists "Users can view own quests"   on quests;
drop policy if exists "Users can insert own quests" on quests;
drop policy if exists "Users can update own quests" on quests;
drop policy if exists "Users can delete own quests" on quests;
create policy "Users can view own quests"   on quests for select using (auth.uid() = user_id);
create policy "Users can insert own quests" on quests for insert with check (auth.uid() = user_id);
create policy "Users can update own quests" on quests for update using (auth.uid() = user_id);
create policy "Users can delete own quests" on quests for delete using (auth.uid() = user_id);

-- ─── OBJECTIVES ──────────────────────────────────────────────────────────────
create table if not exists objectives (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  title       text not null,
  description text,
  category    text not null check (category in ('health','mind','work','finance','relationships')),
  progress    integer not null default 0 check (progress between 0 and 100),
  milestones  jsonb not null default '[]'::jsonb,
  completed   boolean not null default false,
  created_at  timestamptz not null default now()
);

alter table objectives enable row level security;
drop policy if exists "Users can view own objectives"   on objectives;
drop policy if exists "Users can insert own objectives" on objectives;
drop policy if exists "Users can update own objectives" on objectives;
drop policy if exists "Users can delete own objectives" on objectives;
create policy "Users can view own objectives"   on objectives for select using (auth.uid() = user_id);
create policy "Users can insert own objectives" on objectives for insert with check (auth.uid() = user_id);
create policy "Users can update own objectives" on objectives for update using (auth.uid() = user_id);
create policy "Users can delete own objectives" on objectives for delete using (auth.uid() = user_id);

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
drop policy if exists "Users can view own rewards"   on rewards;
drop policy if exists "Users can insert own rewards" on rewards;
drop policy if exists "Users can update own rewards" on rewards;
drop policy if exists "Users can delete own rewards" on rewards;
create policy "Users can view own rewards"   on rewards for select using (auth.uid() = user_id);
create policy "Users can insert own rewards" on rewards for insert with check (auth.uid() = user_id);
create policy "Users can update own rewards" on rewards for update using (auth.uid() = user_id);
create policy "Users can delete own rewards" on rewards for delete using (auth.uid() = user_id);

-- ─── REDEMPTIONS ─────────────────────────────────────────────────────────────
create table if not exists redemptions (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  reward_id   uuid references rewards(id) on delete set null,
  redeemed_at timestamptz not null default now()
);

alter table redemptions enable row level security;
drop policy if exists "Users can view own redemptions"   on redemptions;
drop policy if exists "Users can insert own redemptions" on redemptions;
create policy "Users can view own redemptions"   on redemptions for select using (auth.uid() = user_id);
create policy "Users can insert own redemptions" on redemptions for insert with check (auth.uid() = user_id);

-- ─── REFLECTIONS ─────────────────────────────────────────────────────────────
create table if not exists reflections (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  date          date not null,
  things_learnt text,
  proud_of      text,
  troubled_by   text,
  mood          integer check (mood between 1 and 5),
  created_at    timestamptz not null default now(),
  unique(user_id, date)
);

alter table reflections enable row level security;
drop policy if exists "Users can view own reflections"   on reflections;
drop policy if exists "Users can insert own reflections" on reflections;
drop policy if exists "Users can update own reflections" on reflections;
create policy "Users can view own reflections"   on reflections for select using (auth.uid() = user_id);
create policy "Users can insert own reflections" on reflections for insert with check (auth.uid() = user_id);
create policy "Users can update own reflections" on reflections for update using (auth.uid() = user_id);

-- ─── ACTIVITY LOG ────────────────────────────────────────────────────────────
create table if not exists activity_log (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  entry_type  text not null,
  description text not null,
  xp_delta    integer not null default 0,
  created_at  timestamptz not null default now()
);

-- Refresh entry_type constraint to include 'reflection'
alter table activity_log drop constraint if exists activity_log_entry_type_check;
alter table activity_log add constraint activity_log_entry_type_check
  check (entry_type in ('quest_complete','reward_redeemed','level_up','stat_boost','reflection'));

alter table activity_log enable row level security;
drop policy if exists "Users can view own activity"   on activity_log;
drop policy if exists "Users can insert own activity" on activity_log;
create policy "Users can view own activity"   on activity_log for select using (auth.uid() = user_id);
create policy "Users can insert own activity" on activity_log for insert with check (auth.uid() = user_id);

-- ─── STATS: rename columns if upgrading from v1 (safe no-op on fresh install) ─
do $$ begin
  alter table stats rename column strength to health;
exception when undefined_column then null; end $$;

do $$ begin
  alter table stats rename column ambition to work;
exception when undefined_column then null; end $$;

alter table stats add column if not exists relationships integer not null default 25
  check (relationships between 0 and 100);

-- ─── INDEXES ─────────────────────────────────────────────────────────────────
create index if not exists quests_user_id_idx        on quests(user_id);
create index if not exists objectives_user_id_idx    on objectives(user_id);
create index if not exists rewards_user_id_idx       on rewards(user_id);
create index if not exists redemptions_user_id_idx   on redemptions(user_id);
create index if not exists activity_log_user_id_idx  on activity_log(user_id, created_at desc);
create index if not exists reflections_user_date_idx on reflections(user_id, date desc);
