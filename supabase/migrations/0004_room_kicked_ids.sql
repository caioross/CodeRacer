-- 0004_room_kicked_ids.sql
-- Issue #39 — Autoridade de expulsão durável.
--
-- O kick trafegava só por broadcast peer-to-peer, sem autoridade de servidor:
-- qualquer assinante do canal expulsava qualquer jogador (inclusive o líder).
-- A verdade da expulsão passa a viver na própria linha da sala: a rota
-- POST /api/rooms/[code] (action "kick", leader-only) acrescenta o playerId
-- removido a `kicked_ids`, e a vítima descobre a remoção pela subscription
-- postgres_changes de `rooms` que o cliente já mantém — nunca por broadcast.
--
-- Aditiva e idempotente: seguro reaplicar. Não altera a publicação realtime
-- (a subscription de `rooms` já emite a linha completa, incluindo a coluna nova).
alter table public.rooms
  add column if not exists kicked_ids text[] not null default '{}';
