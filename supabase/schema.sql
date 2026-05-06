-- Life RPG App — Supabase Schema (v3 — no auth)
-- Safe to run multiple times. Drop-if-exists guards on all policies.
-- Profiles are identified by their own UUID; no Supabase Auth required.

create extension if not exists "uuid-ossp";

-- ─── PROFILES ────────────────────────────────────────────────────────────────
create table if not exists profiles (
  id               uuid primary key default uuid_generate_v4(),
  username         text not null default 'Adventurer',
  character_class  text not null default 'Novice',
  avatar           text not null default '⚔️',
  level            integer not null default 1,
  xp               integer not null default 0,
  xp_to_next_level integer not null default 100,
  created_at       timestamptz not null default now()
);

alter table profiles disable row level security;

-- ─── STATS ───────────────────────────────────────────────────────────────────
-- user_id here refers to profiles.id (plain UUID, no FK enforced)
create table if not exists stats (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null unique,
  health        integer not null default 25 check (health between 0 and 100),
  intellect     integer not null default 25 check (intellect between 0 and 100),
  work          integer not null default 25 check (work between 0 and 100),
  wealth        integer not null default 25 check (wealth between 0 and 100),
  relationships integer not null default 25 check (relationships between 0 and 100)
);

alter table stats disable row level security;

-- ─── QUESTS ──────────────────────────────────────────────────────────────────
create table if not exists quests (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid not null,
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

-- v4: drop category constraint to allow comma-separated multi-category
alter table quests drop constraint if exists quests_category_check;
-- v4: expand difficulty to include fun/quick
alter table quests drop constraint if exists quests_difficulty_check;
alter table quests add constraint quests_difficulty_check
  check (difficulty in ('fun','quick','easy','medium','hard','legendary'));

alter table quests disable row level security;

-- v5: parent linking (Task → Project, Project/Task → Quest)
alter table quests add column if not exists parent_quest_id uuid references quests(id) on delete set null;
alter table quests add column if not exists objective_id    uuid references objectives(id) on delete set null;

-- ─── OBJECTIVES ──────────────────────────────────────────────────────────────
create table if not exists objectives (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null,
  title       text not null,
  description text,
  category    text not null,
  progress    integer not null default 0 check (progress between 0 and 100),
  milestones  jsonb not null default '[]'::jsonb,
  completed   boolean not null default false,
  created_at  timestamptz not null default now()
);

-- v4: drop category constraint to allow multi-category
alter table objectives drop constraint if exists objectives_category_check;

alter table objectives disable row level security;

-- ─── REWARDS ─────────────────────────────────────────────────────────────────
create table if not exists rewards (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null,
  title       text not null,
  description text,
  tier        text not null check (tier in ('small','medium','large','legendary')),
  xp_cost     integer not null default 100,
  created_at  timestamptz not null default now()
);

alter table rewards disable row level security;

-- ─── REDEMPTIONS ─────────────────────────────────────────────────────────────
create table if not exists redemptions (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null,
  reward_id   uuid references rewards(id) on delete set null,
  redeemed_at timestamptz not null default now()
);

alter table redemptions disable row level security;

-- ─── REFLECTIONS ─────────────────────────────────────────────────────────────
create table if not exists reflections (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null,
  date          date not null,
  things_learnt text,
  grateful_for  text,
  proud_of      text,
  troubled_by   text,
  mood          integer check (mood between 1 and 5),
  created_at    timestamptz not null default now(),
  unique(user_id, date)
);

alter table reflections disable row level security;

-- v5: grateful_for column
alter table reflections add column if not exists grateful_for text;

-- ─── ACTIVITY LOG ────────────────────────────────────────────────────────────
create table if not exists activity_log (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null,
  entry_type  text not null,
  description text not null,
  xp_delta    integer not null default 0,
  created_at  timestamptz not null default now()
);

-- Refresh entry_type constraint to include 'reflection'
alter table activity_log drop constraint if exists activity_log_entry_type_check;
alter table activity_log add constraint activity_log_entry_type_check
  check (entry_type in ('quest_complete','reward_redeemed','level_up','stat_boost','reflection'));

alter table activity_log disable row level security;

-- ─── STATS: rename columns if upgrading from v1 (safe no-op on fresh install) ─
do $$ begin
  alter table stats rename column strength to health;
exception when undefined_column then null; end $$;

do $$ begin
  alter table stats rename column ambition to work;
exception when undefined_column then null; end $$;

alter table stats add column if not exists relationships integer not null default 25
  check (relationships between 0 and 100);

-- ─── TRANSACTIONS ────────────────────────────────────────────────────────────
create table if not exists transactions (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null,
  title       text not null,
  amount      numeric(10,2) not null check (amount > 0),
  type        text not null check (type in ('income','expense')),
  category    text not null,
  date        date not null default current_date,
  created_at  timestamptz not null default now()
);

alter table transactions disable row level security;

-- ─── INDEXES ─────────────────────────────────────────────────────────────────
create index if not exists quests_user_id_idx        on quests(user_id);
create index if not exists objectives_user_id_idx    on objectives(user_id);
create index if not exists rewards_user_id_idx       on rewards(user_id);
create index if not exists redemptions_user_id_idx   on redemptions(user_id);
create index if not exists activity_log_user_id_idx  on activity_log(user_id, created_at desc);
create index if not exists reflections_user_date_idx    on reflections(user_id, date desc);
create index if not exists transactions_user_date_idx   on transactions(user_id, date desc);

-- ─── MIGRATION: drop auth FK constraints if upgrading from v2 ─────────────────
-- Run these manually in the Supabase SQL editor if upgrading an existing database:
--
-- alter table profiles drop column if exists user_id cascade;
-- alter table stats    drop constraint if exists stats_user_id_fkey;
-- alter table quests   drop constraint if exists quests_user_id_fkey;
-- alter table objectives  drop constraint if exists objectives_user_id_fkey;
-- alter table rewards     drop constraint if exists rewards_user_id_fkey;
-- alter table redemptions drop constraint if exists redemptions_user_id_fkey;
-- alter table reflections drop constraint if exists reflections_user_id_fkey;
-- alter table activity_log   drop constraint if exists activity_log_user_id_fkey;
-- alter table transactions    drop constraint if exists transactions_user_id_fkey;
