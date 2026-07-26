"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getBrowserSupabase } from "./supabase-browser";
import {
  colorForId,
  newPlayerId,
  shouldFinishRace,
  isSpectatorJoin,
  RACE_DECISION_TICK_MS,
  type ChatMsg,
  type LivePlayer,
  type PresenceMeta,
  type ProgressMsg,
  type ResultRow,
  type RoomRow
} from "./room";

const SESSION_KEY = (code: string) => `coderacer:room:${code}`;
const NAME_KEY = "coderacer:name";
const AVATAR_KEY = "coderacer:avatar";
const PROGRESS_THROTTLE_MS = 120;

export type Phase = "need-name" | "connecting" | "ready" | "error";

interface UseRoomOpts {
  onError?: (msg: string) => void;
  onLeave?: () => void;
}

export function useRoom(code: string, opts: UseRoomOpts = {}) {
  const { onError, onLeave } = opts;

  const [phase, setPhase] = useState<Phase>("connecting");
  const [meId, setMeId] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomRow | null>(null);
  const [presence, setPresence] = useState<Record<string, PresenceMeta>>({});
  const [progress, setProgress] = useState<Record<string, ProgressMsg>>({});
  const [readyMap, setReadyMap] = useState<Record<string, boolean>>({});
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [now, setNow] = useState<number>(() => Date.now());
  const [joinName, setJoinName] = useState<string | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const connectedRef = useRef(false);
  const meIdRef = useRef<string | null>(null);
  const myFinishRef = useRef<number | null>(null);
  const myAbandonRef = useRef(false);
  const myReadyRef = useRef(false);
  const myMetaRef = useRef<PresenceMeta | null>(null);
  const finishPostedRef = useRef(false);
  // Epoch do último `progress` de cada jogador — alimenta o critério de
  // inatividade do encerramento. Ref (não state) para não re-renderizar durante
  // a corrida: só o tick do líder lê isso.
  const lastActivityRef = useRef<Record<string, number>>({});
  const playersRef = useRef<LivePlayer[]>([]);
  const claimingRef = useRef(false);
  const lastSentRef = useRef(0);
  const lastStartRef = useRef<string | null>(null);
  const onErrorRef = useRef(onError);
  const onLeaveRef = useRef(onLeave);
  onErrorRef.current = onError;
  onLeaveRef.current = onLeave;

  const fail = useCallback((msg: string) => {
    onErrorRef.current?.(msg);
  }, []);

  // POST an action to the room API.
  const postAction = useCallback(
    async (action: string, extra: Record<string, unknown> = {}) => {
      try {
        const res = await fetch(`/api/rooms/${code}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action, playerId: meIdRef.current, ...extra })
        });
        const json = await res.json().catch(() => ({}));
        if (!json?.ok) fail(json?.error || "Erro na sala");
        return json;
      } catch {
        fail("Sem conexão com o servidor");
        return { ok: false };
      }
    },
    [code, fail]
  );

  // Decide identity on mount: auto-connect if we already have a name.
  useEffect(() => {
    let savedName: string | null = null;
    try {
      const stored = sessionStorage.getItem(SESSION_KEY(code));
      const parsed = stored ? JSON.parse(stored) : null;
      savedName = parsed?.name || localStorage.getItem(NAME_KEY);
    } catch {}
    if (savedName) setJoinName(savedName);
    else setPhase("need-name");
  }, [code]);

  // Connect to the realtime channel once we have a name.
  useEffect(() => {
    if (!joinName || connectedRef.current) return;
    connectedRef.current = true;
    setPhase("connecting");

    const supabase = getBrowserSupabase();

    // Recover or mint identity.
    let id = newPlayerId();
    try {
      const stored = sessionStorage.getItem(SESSION_KEY(code));
      const parsed = stored ? JSON.parse(stored) : null;
      if (parsed?.playerId) id = parsed.playerId;
    } catch {}
    meIdRef.current = id;
    setMeId(id);
    const name = joinName.slice(0, 20) || "anon";
    const color = colorForId(id);
    let avatar: string | null = null;
    try {
      avatar = localStorage.getItem(AVATAR_KEY);
      localStorage.setItem(NAME_KEY, name);
      sessionStorage.setItem(SESSION_KEY(code), JSON.stringify({ playerId: id, name }));
    } catch {}

    let cancelled = false;

    (async () => {
      // Seed durable state.
      try {
        const res = await fetch(`/api/rooms/${code}`, { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!json?.ok) {
          fail(json?.error || "Sala não encontrada");
          onLeaveRef.current?.();
          return;
        }
        setRoom(json.room as RoomRow);
        lastStartRef.current = (json.room as RoomRow).start_at;
      } catch {
        if (cancelled) return;
        fail("Não foi possível carregar a sala");
        onLeaveRef.current?.();
        return;
      }

      const channel = supabase.channel(`coderacer:room:${code}`, {
        config: { presence: { key: id }, broadcast: { self: false } }
      });
      channelRef.current = channel;

      channel.on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresenceMeta>();
        const map: Record<string, PresenceMeta> = {};
        for (const key of Object.keys(state)) {
          const metas = state[key];
          if (metas && metas[0]) map[key] = metas[0];
        }
        setPresence(map);
      });
      channel.on("presence", { event: "join" }, ({ newPresences }) => {
        let someoneElse = false;
        for (const p of newPresences as unknown as PresenceMeta[]) {
          if (p.id !== id) {
            pushSystem(`${p.name} entrou na sala`);
            someoneElse = true;
          }
        }
        // Broadcast has no replay — re-announce my "ready" so newcomers see it.
        if (someoneElse && myReadyRef.current) {
          channel.send({ type: "broadcast", event: "ready", payload: { id, ready: true } });
        }
      });
      channel.on("presence", { event: "leave" }, ({ leftPresences }) => {
        for (const p of leftPresences as unknown as PresenceMeta[]) {
          pushSystem(`${p.name} saiu`);
        }
      });

      channel.on("broadcast", { event: "progress" }, ({ payload }) => {
        const m = payload as ProgressMsg;
        if (!m?.id || m.id === id) return;
        lastActivityRef.current[m.id] = Date.now();
        setProgress(prev => ({ ...prev, [m.id]: m }));
      });

      channel.on("broadcast", { event: "chat" }, ({ payload }) => {
        const m = payload as ChatMsg;
        if (!m?.id) return;
        setChat(prev => [...prev.slice(-80), m]);
      });

      // Ready-check rides on broadcast (reliable) instead of presence re-track.
      channel.on("broadcast", { event: "ready" }, ({ payload }) => {
        const m = payload as { id?: string; ready?: boolean };
        if (!m?.id) return;
        setReadyMap(prev => ({ ...prev, [m.id as string]: !!m.ready }));
      });

      // Leader kicked someone — if it's me, leave the room.
      channel.on("broadcast", { event: "kick" }, ({ payload }) => {
        const targetId = (payload as { id?: string })?.id;
        if (targetId && targetId === id) {
          try {
            sessionStorage.removeItem(SESSION_KEY(code));
          } catch {}
          fail("Você foi removido da sala pelo líder");
          onLeaveRef.current?.();
        }
      });

      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms", filter: `code=eq.${code}` },
        payload => {
          const next = payload.new as RoomRow;
          if (next && next.code) setRoom(next);
        }
      );

      channel.subscribe(status => {
        if (cancelled) return;
        if (status === "SUBSCRIBED") {
          const meta: PresenceMeta = { id, name, color, avatar, joinedAt: Date.now(), ready: false };
          myMetaRef.current = meta;
          channel.track(meta);
          setPhase("ready");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          fail("Conexão em tempo real falhou");
        }
      });
    })();

    function pushSystem(text: string) {
      setChat(prev => [
        ...prev.slice(-80),
        { id: newPlayerId(), playerId: "system", name: "system", text, at: Date.now(), system: true }
      ]);
    }

    return () => {
      cancelled = true;
      const ch = channelRef.current;
      channelRef.current = null;
      connectedRef.current = false;
      if (ch) supabase.removeChannel(ch);
    };
  }, [joinName, code, fail]);

  // Reset per-race local state whenever a new race starts (start_at changes).
  useEffect(() => {
    const sa = room?.start_at ?? null;
    if (sa !== lastStartRef.current) {
      lastStartRef.current = sa;
      if (room?.status === "racing") {
        myFinishRef.current = null;
        myAbandonRef.current = false;
        myReadyRef.current = false;
        finishPostedRef.current = false;
        lastActivityRef.current = {};
        setProgress({});
        setReadyMap({});
      }
    }
    if (room?.status === "lobby") {
      myFinishRef.current = null;
      myAbandonRef.current = false;
      myReadyRef.current = false;
      finishPostedRef.current = false;
      lastActivityRef.current = {};
      setProgress({});
      setReadyMap({});
    }
  }, [room?.start_at, room?.status]);

  // Tick a clock only while a countdown is pending.
  const startMs = room?.start_at ? Date.parse(room.start_at) : 0;
  useEffect(() => {
    if (room?.status !== "racing" || !startMs) return;
    if (Date.now() >= startMs) return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [room?.status, startMs]);

  // Merge presence + progress into the live roster, with finishing places.
  const roomStatus = room?.status;
  const players: LivePlayer[] = useMemo(() => {
    const list = Object.values(presence).map<LivePlayer>(meta => {
      const pr = progress[meta.id];
      return {
        id: meta.id,
        name: meta.name,
        color: meta.color,
        avatar: meta.avatar ?? null,
        progress: pr?.progress ?? 0,
        wpm: pr?.wpm ?? 0,
        accuracy: pr?.accuracy ?? 100,
        errors: pr?.errors ?? 0,
        finishedAt: pr?.finishedAt ?? null,
        place: null,
        ready: readyMap[meta.id] ?? false,
        abandoned: pr?.abandoned ?? false,
        // Entrou com a corrida já rolando → assiste esta rodada (#64).
        spectator: isSpectatorJoin(meta.joinedAt, startMs || null, roomStatus ?? "lobby")
      };
    });
    // Only players who actually completed get a place — abandons don't rank.
    const finishers = list
      .filter(p => p.finishedAt && !p.abandoned)
      .sort((a, b) => (a.finishedAt as number) - (b.finishedAt as number));
    finishers.forEach((p, i) => (p.place = i + 1));
    return list;
  }, [presence, progress, readyMap, startMs, roomStatus]);

  const isLeader = !!room && !!meId && room.leader_id === meId;
  // Sou espectador desta rodada? (entrei depois do start.)
  const isSpectator = !!meId && (players.find(p => p.id === meId)?.spectator ?? false);
  const countdownN =
    room?.status === "racing" && startMs && now < startMs
      ? Math.max(1, Math.ceil((startMs - now) / 1000))
      : null;

  const toResults = useCallback(
    (list: LivePlayer[]): ResultRow[] =>
      // Abandoners don't count for anything — keep only players who completed.
      list
        .filter(p => p.finishedAt && !p.abandoned)
        .map(p => ({
        id: p.id,
        name: p.name,
        color: p.color,
        wpm: p.wpm,
        accuracy: p.accuracy,
        errors: p.errors,
        progress: p.progress,
        place: p.place,
        finished: !!p.finishedAt,
        finishedAt: p.finishedAt
      })),
    []
  );

  // Roster mais recente para o tick do líder ler sem virar dependência dele.
  playersRef.current = players;

  // Leader finalizes the match: everyone finished, the stragglers went idle, or
  // the race blew past its time budget (`shouldFinishRace` in ./room). Espectadores
  // (entraram depois do start, #64) ficam FORA da decisão e dos results — senão um
  // retardatário sem `finishedAt` prenderia a sala em `racing`. Competem na próxima.
  const snippetLength = room?.snippet?.code.length ?? 0;
  const maybeFinish = useCallback(() => {
    if (!isLeader || room?.status !== "racing" || finishPostedRef.current || !startMs) return;
    const racers = playersRef.current.filter(p => !p.spectator);
    const decide = racers.map(p => ({
      finishedAt: p.finishedAt,
      // Quem nunca mandou `progress` conta como ativo desde o start.
      lastActivityAt: lastActivityRef.current[p.id] ?? startMs
    }));
    if (!shouldFinishRace(decide, { startMs, now: Date.now(), snippetLength })) return;
    finishPostedRef.current = true;
    postAction("finish", { results: toResults(racers) });
  }, [isLeader, room?.status, snippetLength, startMs, postAction, toResults]);

  // Caminho imediato: alguém terminou/saiu e isso fechou a corrida.
  useEffect(() => {
    maybeFinish();
  }, [players, maybeFinish]);

  // Caminho por tempo: inatividade e teto de duração não geram evento nenhum, então
  // o líder precisa reavaliar sozinho. Tick de 1s, e só do líder — lê refs e não
  // dispara re-render, para não competir com a `textarea` (HANDBOOK §2).
  useEffect(() => {
    if (!isLeader || room?.status !== "racing") return;
    const t = setInterval(maybeFinish, RACE_DECISION_TICK_MS);
    return () => clearInterval(t);
  }, [isLeader, room?.status, maybeFinish]);

  // Promote a new leader if the current one left.
  useEffect(() => {
    if (!room || !meId) return;
    const ids = Object.keys(presence);
    if (ids.length === 0 || presence[room.leader_id]) return;
    const elected = Object.values(presence).sort(
      (a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id)
    )[0];
    if (elected?.id === meId && !claimingRef.current) {
      claimingRef.current = true;
      postAction("claim-leader").finally(() => (claimingRef.current = false));
    }
  }, [presence, room, meId, postAction]);

  // ---- actions ----
  const join = useCallback(
    (name: string) => {
      const n = (name || "anon").slice(0, 20);
      try {
        localStorage.setItem(NAME_KEY, n);
      } catch {}
      setJoinName(n);
    },
    []
  );

  const broadcastProgress = useCallback(
    (p: number, wpm: number, accuracy: number, errors: number, finishing = false) => {
      const id = meIdRef.current;
      const ch = channelRef.current;
      if (!id) return;
      if (finishing) myAbandonRef.current = true;
      if (finishing && myFinishRef.current == null) myFinishRef.current = Date.now();
      if (p >= 1 && myFinishRef.current == null) myFinishRef.current = Date.now();
      const msg: ProgressMsg = {
        id,
        progress: Math.max(0, Math.min(1, p)),
        wpm: Math.round(wpm) || 0,
        accuracy: Math.round(accuracy),
        errors: Math.round(errors) || 0,
        finishedAt: myFinishRef.current,
        abandoned: myAbandonRef.current
      };
      // Optimistically update my own row.
      lastActivityRef.current[id] = Date.now();
      setProgress(prev => ({ ...prev, [id]: msg }));
      const t = Date.now();
      const done = msg.finishedAt != null;
      if (!done && t - lastSentRef.current < PROGRESS_THROTTLE_MS) return;
      lastSentRef.current = t;
      ch?.send({ type: "broadcast", event: "progress", payload: msg });
    },
    []
  );

  const sendProgress = useCallback(
    (p: number, wpm: number, accuracy: number, errors: number) =>
      broadcastProgress(p, wpm, accuracy, errors, false),
    [broadcastProgress]
  );

  const abandon = useCallback(() => {
    const me = progress[meIdRef.current || ""];
    broadcastProgress(me?.progress ?? 0, me?.wpm ?? 0, me?.accuracy ?? 100, me?.errors ?? 0, true);
  }, [broadcastProgress, progress]);

  const sendChat = useCallback((text: string) => {
    const id = meIdRef.current;
    const ch = channelRef.current;
    const clean = String(text || "").slice(0, 200).trim();
    if (!id || !ch || !clean) return;
    const meta = presence[id];
    const msg: ChatMsg = {
      id: newPlayerId(),
      playerId: id,
      name: meta?.name || "anon",
      text: clean,
      at: Date.now()
    };
    setChat(prev => [...prev.slice(-80), msg]);
    ch.send({ type: "broadcast", event: "chat", payload: msg });
  }, [presence]);

  // Toggle my "ready" via broadcast (reliable, unlike presence re-track).
  const setReady = useCallback((ready: boolean) => {
    const id = meIdRef.current;
    const ch = channelRef.current;
    if (!id || !ch) return;
    myReadyRef.current = ready;
    setReadyMap(prev => ({ ...prev, [id]: ready })); // optimistic
    ch.send({ type: "broadcast", event: "ready", payload: { id, ready } });
  }, []);

  // Leader removes a player: broadcast a kick the target obeys by leaving.
  const kick = useCallback((targetId: string) => {
    const ch = channelRef.current;
    if (!ch || !targetId) return;
    ch.send({ type: "broadcast", event: "kick", payload: { id: targetId } });
  }, []);

  const updateSettings = useCallback(
    (settings: Record<string, unknown>) => postAction("settings", { settings }),
    [postAction]
  );
  const startRace = useCallback(() => postAction("start"), [postAction]);
  const resetToLobby = useCallback(() => postAction("reset"), [postAction]);

  return {
    phase,
    meId,
    room,
    players,
    isLeader,
    isSpectator,
    chat,
    countdownN,
    join,
    actions: {
      updateSettings,
      startRace,
      resetToLobby,
      sendProgress,
      abandon,
      sendChat,
      setReady,
      kick
    }
  };
}
