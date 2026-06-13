-- CodeRacer · realtime room state (Vercel-friendly, no custom server)
-- The room's DURABLE state lives here (settings, status, snippet, results).
-- The live roster and per-keystroke progress travel over Supabase Realtime
-- (presence + broadcast), so they never hit the database.

create table if not exists public.rooms (
  code        text primary key,
  status      text not null default 'lobby',   -- 'lobby' | 'racing' | 'finished'
  language    text not null default 'javascript',
  difficulty  text not null default 'medium',
  max_players int  not null default 6,
  leader_id   text not null,
  snippet     jsonb,              -- { title, code, language, difficulty }
  start_at    timestamptz,        -- moment typing begins (countdown ends)
  results     jsonb,              -- final standings, set when status = 'finished'
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists rooms_updated_idx on public.rooms (updated_at desc);

-- RLS: anyone may READ a room (and receive its realtime changes); all writes
-- go through server-side API routes using the service-role key.
alter table public.rooms enable row level security;

drop policy if exists "public read rooms" on public.rooms;
create policy "public read rooms" on public.rooms for select using (true);

grant select on public.rooms to anon, authenticated;

-- Keep updated_at fresh.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists rooms_touch on public.rooms;
create trigger rooms_touch before update on public.rooms
  for each row execute function public.touch_updated_at();

-- Realtime: emit full row on changes and publish the table.
alter table public.rooms replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'rooms'
  ) then
    alter publication supabase_realtime add table public.rooms;
  end if;
end $$;
