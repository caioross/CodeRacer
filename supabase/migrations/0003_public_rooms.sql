-- CodeRacer · public/discoverable rooms
-- Adds an opt-in "public" flag so rooms can be browsed and joined from the home
-- screen. Idempotent: safe to run multiple times.

alter table public.rooms
  add column if not exists is_public boolean not null default false;

-- Fast lookup of open public rooms for the lobby browser.
create index if not exists rooms_public_idx
  on public.rooms (is_public, status, created_at desc);
