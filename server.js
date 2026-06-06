// CodeRacer custom server: Next.js + Socket.io
// All rooms live in memory. No database. Restart server = rooms gone.

const { createServer } = require("http");
const next = require("next");
const { Server } = require("socket.io");
const { customAlphabet } = require("nanoid");
const { pickSnippet } = require("./src/lib/snippets-server.js");

const port = parseInt(process.env.PORT || "3000", 10);
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

// Short, friendly room codes (uppercase, no confusing chars)
const newRoomCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);
const newPlayerId = customAlphabet("abcdefghjkmnpqrstuvwxyz23456789", 10);

/**
 * Room shape:
 * {
 *   code, leaderId, status: 'lobby'|'countdown'|'racing'|'finished',
 *   settings: { language, difficulty, maxPlayers },
 *   snippet: { code, language, difficulty, title } | null,
 *   players: Map<id, { id, name, color, progress, wpm, accuracy, errors, finishedAt, place }>,
 *   chat: [{ id, playerId, name, text, at }],
 *   startedAt, finishedAt
 * }
 */
const rooms = new Map();

const PLAYER_COLORS = [
  "#00ff88",
  "#00e5ff",
  "#a855f7",
  "#fbbf24",
  "#ff3860",
  "#f472b6",
  "#34d399",
  "#60a5fa"
];

function pickColor(room) {
  const used = new Set([...room.players.values()].map(p => p.color));
  return PLAYER_COLORS.find(c => !used.has(c)) || PLAYER_COLORS[0];
}

function publicRoom(room) {
  return {
    code: room.code,
    leaderId: room.leaderId,
    status: room.status,
    settings: room.settings,
    snippet: room.snippet,
    players: [...room.players.values()],
    chat: room.chat.slice(-50),
    startedAt: room.startedAt || null,
    finishedAt: room.finishedAt || null
  };
}

function broadcast(io, room) {
  io.to(room.code).emit("room:state", publicRoom(room));
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => handle(req, res));
  const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] }
  });

  io.on("connection", socket => {
    let currentRoom = null;
    let playerId = null;

    socket.on("room:create", ({ name, settings }, ack) => {
      const code = newRoomCode();
      playerId = newPlayerId();
      const room = {
        code,
        leaderId: playerId,
        status: "lobby",
        settings: {
          language: settings?.language || "javascript",
          difficulty: settings?.difficulty || "medium",
          maxPlayers: Math.min(Math.max(settings?.maxPlayers || 6, 2), 12)
        },
        snippet: null,
        players: new Map(),
        chat: [],
        startedAt: null,
        finishedAt: null
      };
      const player = {
        id: playerId,
        name: (name || "anon").slice(0, 20),
        color: PLAYER_COLORS[0],
        progress: 0,
        wpm: 0,
        accuracy: 100,
        errors: 0,
        finishedAt: null,
        place: null,
        ready: true
      };
      room.players.set(playerId, player);
      rooms.set(code, room);
      currentRoom = room;
      socket.join(code);
      ack?.({ ok: true, code, playerId, room: publicRoom(room) });
    });

    socket.on("room:join", ({ code, name }, ack) => {
      const room = rooms.get((code || "").toUpperCase());
      if (!room) return ack?.({ ok: false, error: "Sala não encontrada" });
      if (room.players.size >= room.settings.maxPlayers)
        return ack?.({ ok: false, error: "Sala cheia" });
      if (room.status === "racing")
        return ack?.({ ok: false, error: "Partida em andamento, aguarda terminar" });

      playerId = newPlayerId();
      const player = {
        id: playerId,
        name: (name || "anon").slice(0, 20),
        color: pickColor(room),
        progress: 0,
        wpm: 0,
        accuracy: 100,
        errors: 0,
        finishedAt: null,
        place: null,
        ready: true
      };
      room.players.set(playerId, player);
      currentRoom = room;
      socket.join(room.code);
      ack?.({ ok: true, code: room.code, playerId, room: publicRoom(room) });
      broadcast(io, room);
      pushSystemMsg(room, `${player.name} entrou na sala`);
      broadcast(io, room);
    });

    socket.on("room:updateSettings", ({ settings }, ack) => {
      if (!currentRoom || currentRoom.leaderId !== playerId)
        return ack?.({ ok: false, error: "Só o líder pode mudar configs" });
      if (currentRoom.status !== "lobby")
        return ack?.({ ok: false, error: "Partida já começou" });
      currentRoom.settings = {
        language: settings.language || currentRoom.settings.language,
        difficulty: settings.difficulty || currentRoom.settings.difficulty,
        maxPlayers: Math.min(
          Math.max(settings.maxPlayers || currentRoom.settings.maxPlayers, 2),
          12
        )
      };
      ack?.({ ok: true });
      broadcast(io, currentRoom);
    });

    socket.on("chat:send", ({ text }) => {
      if (!currentRoom || !playerId) return;
      const player = currentRoom.players.get(playerId);
      if (!player) return;
      const clean = String(text || "").slice(0, 200);
      if (!clean.trim()) return;
      currentRoom.chat.push({
        id: newPlayerId(),
        playerId,
        name: player.name,
        text: clean,
        at: Date.now()
      });
      broadcast(io, currentRoom);
    });

    socket.on("race:start", (_, ack) => {
      if (!currentRoom || currentRoom.leaderId !== playerId)
        return ack?.({ ok: false, error: "Só o líder pode iniciar" });
      if (currentRoom.players.size < 1)
        return ack?.({ ok: false, error: "Precisa de ao menos 1 jogador" });
      currentRoom.snippet = pickSnippet(
        currentRoom.settings.language,
        currentRoom.settings.difficulty
      );
      currentRoom.status = "countdown";
      currentRoom.startedAt = null;
      currentRoom.finishedAt = null;
      for (const p of currentRoom.players.values()) {
        p.progress = 0;
        p.wpm = 0;
        p.accuracy = 100;
        p.errors = 0;
        p.finishedAt = null;
        p.place = null;
      }
      ack?.({ ok: true });
      broadcast(io, currentRoom);

      // Countdown of 4s, then race begins
      let n = 3;
      const tick = () => {
        io.to(currentRoom.code).emit("race:countdown", n);
        n--;
        if (n < 0) {
          currentRoom.status = "racing";
          currentRoom.startedAt = Date.now();
          broadcast(io, currentRoom);
        } else {
          setTimeout(tick, 1000);
        }
      };
      tick();
    });

    socket.on("race:progress", payload => {
      if (!currentRoom || !playerId) return;
      if (currentRoom.status !== "racing") return;
      const player = currentRoom.players.get(playerId);
      if (!player || player.finishedAt) return;
      const prog = Math.max(0, Math.min(1, Number(payload?.progress) || 0));
      player.progress = prog;
      player.wpm = Math.max(0, Math.round(Number(payload?.wpm) || 0));
      player.accuracy = Math.max(0, Math.min(100, Number(payload?.accuracy) || 100));
      player.errors = Math.max(0, Math.round(Number(payload?.errors) || 0));

      if (prog >= 1 && !player.finishedAt) {
        player.finishedAt = Date.now();
        const finished = [...currentRoom.players.values()]
          .filter(p => p.finishedAt)
          .sort((a, b) => a.finishedAt - b.finishedAt);
        player.place = finished.length;
        pushSystemMsg(
          currentRoom,
          `🏁 ${player.name} terminou em ${ordinal(player.place)}!`
        );
      }
      // Throttle broadcasts: every progress event triggers state, ok for small rooms
      broadcast(io, currentRoom);

      // Auto end when everyone finished
      const allDone = [...currentRoom.players.values()].every(p => p.finishedAt);
      if (allDone && currentRoom.status === "racing") {
        currentRoom.status = "finished";
        currentRoom.finishedAt = Date.now();
        broadcast(io, currentRoom);
      }
    });

    socket.on("race:abandon", () => {
      // Player gives up mid-race: mark progress as is, set finishedAt last
      if (!currentRoom || !playerId) return;
      const player = currentRoom.players.get(playerId);
      if (!player || player.finishedAt) return;
      if (currentRoom.status !== "racing") return;
      player.finishedAt = Date.now();
      const finished = [...currentRoom.players.values()].filter(p => p.finishedAt);
      player.place = finished.length;
      pushSystemMsg(currentRoom, `🚫 ${player.name} desistiu`);
      broadcast(io, currentRoom);
      const allDone = [...currentRoom.players.values()].every(p => p.finishedAt);
      if (allDone) {
        currentRoom.status = "finished";
        currentRoom.finishedAt = Date.now();
        broadcast(io, currentRoom);
      }
    });

    socket.on("race:reset", (_, ack) => {
      if (!currentRoom || currentRoom.leaderId !== playerId)
        return ack?.({ ok: false, error: "Só o líder" });
      currentRoom.status = "lobby";
      currentRoom.snippet = null;
      currentRoom.startedAt = null;
      currentRoom.finishedAt = null;
      for (const p of currentRoom.players.values()) {
        p.progress = 0;
        p.wpm = 0;
        p.accuracy = 100;
        p.errors = 0;
        p.finishedAt = null;
        p.place = null;
      }
      ack?.({ ok: true });
      broadcast(io, currentRoom);
    });

    socket.on("disconnect", () => {
      if (!currentRoom || !playerId) return;
      const player = currentRoom.players.get(playerId);
      if (!player) return;
      currentRoom.players.delete(playerId);
      pushSystemMsg(currentRoom, `${player.name} saiu`);
      if (currentRoom.players.size === 0) {
        rooms.delete(currentRoom.code);
        return;
      }
      // transfer leadership if needed
      if (currentRoom.leaderId === playerId) {
        const next = currentRoom.players.values().next().value;
        if (next) {
          currentRoom.leaderId = next.id;
          pushSystemMsg(currentRoom, `${next.name} é o novo líder`);
        }
      }
      // if racing and everyone left has finished, end
      if (currentRoom.status === "racing") {
        const allDone = [...currentRoom.players.values()].every(p => p.finishedAt);
        if (allDone) {
          currentRoom.status = "finished";
          currentRoom.finishedAt = Date.now();
        }
      }
      broadcast(io, currentRoom);
    });
  });

  function pushSystemMsg(room, text) {
    room.chat.push({
      id: newPlayerId(),
      playerId: "system",
      name: "system",
      text,
      at: Date.now(),
      system: true
    });
  }

  function ordinal(n) {
    if (n === 1) return "1º (🥇 ouro)";
    if (n === 2) return "2º (🥈 prata)";
    if (n === 3) return "3º (🥉 bronze)";
    return `${n}º`;
  }

  httpServer.listen(port, () => {
    console.log(`\n  CodeRacer rodando em http://localhost:${port}\n`);
  });
});
