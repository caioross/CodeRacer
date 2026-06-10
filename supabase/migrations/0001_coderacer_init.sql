-- CodeRacer · persistence schema
-- Match history + per-player scores that power the public leaderboard.
-- Idempotent: safe to run multiple times.

create extension if not exists pgcrypto;  -- gen_random_uuid()

-- One row per finished race.
create table if not exists public.matches (
  id            uuid primary key default gen_random_uuid(),
  room_code     text not null,
  language      text not null,
  difficulty    text not null,
  snippet_title text,
  player_count  int  not null default 0,
  winner_name   text,
  winner_wpm    int,
  started_at    timestamptz,
  finished_at   timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

-- One row per player per race.
create table if not exists public.scores (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references public.matches(id) on delete cascade,
  name       text not null,
  language   text not null,
  difficulty text not null,
  wpm        int  not null default 0,
  accuracy   int  not null default 0,
  errors     int  not null default 0,
  place      int,
  finished   boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists scores_wpm_idx        on public.scores (wpm desc);
create index if not exists scores_name_lower_idx on public.scores (lower(name));
create index if not exists matches_finished_idx  on public.matches (finished_at desc);

-- Personal best per player (one row per nick, highest WPM) → the leaderboard.
-- security_invoker so it honors the underlying tables' RLS.
create or replace view public.leaderboard
  with (security_invoker = on) as
  select distinct on (lower(name))
    name,
    wpm,
    accuracy,
    errors,
    language,
    difficulty,
    created_at
  from public.scores
  order by lower(name), wpm desc, created_at desc;

-- Row Level Security: leaderboard data is PUBLIC to read; only the server
-- (service_role key, which bypasses RLS) ever inserts.
alter table public.matches enable row level security;
alter table public.scores  enable row level security;

drop policy if exists "public read matches" on public.matches;
create policy "public read matches" on public.matches for select using (true);

drop policy if exists "public read scores" on public.scores;
create policy "public read scores" on public.scores for select using (true);

grant select on public.matches     to anon, authenticated;
grant select on public.scores      to anon, authenticated;
grant select on public.leaderboard to anon, authenticated;
