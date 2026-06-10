// End-to-end test of the real server flow: connect, create a room, start the
// race, finish it, and confirm the server reports "finished". The server then
// persists the match to Supabase via recordMatch().
import { io } from "socket.io-client";

const URL = process.env.TEST_URL || "http://127.0.0.1:47830";
const NAME = process.env.TEST_NAME || "e2e_tester";

const socket = io(URL, { transports: ["websocket", "polling"], timeout: 8000 });
const emitP = (event, payload) => new Promise(res => socket.emit(event, payload, res));

let sentProgress = false;
let finished = false;
let roomCode = null;

const bail = (msg, code = 1) => {
  console.error(msg);
  socket.close();
  process.exit(code);
};

setTimeout(() => bail("TIMEOUT: match did not finish in 20s", 2), 20000);

socket.on("connect", async () => {
  console.log("connected:", socket.id);
  const created = await emitP("room:create", {
    name: NAME,
    settings: { language: "javascript", difficulty: "easy", maxPlayers: 4 }
  });
  if (!created?.ok) return bail("room:create failed: " + JSON.stringify(created));
  roomCode = created.code;
  console.log("room created:", roomCode);

  const start = await emitP("race:start", null);
  if (!start?.ok) return bail("race:start failed: " + JSON.stringify(start));
  console.log("race started, waiting for countdown → racing...");
});

socket.on("room:state", state => {
  if (state.status === "racing" && !sentProgress) {
    sentProgress = true;
    console.log("racing! sending progress=100%...");
    socket.emit("race:progress", { progress: 1, wpm: 123, accuracy: 97, errors: 2 });
  }
  if (state.status === "finished" && !finished) {
    finished = true;
    console.log("MATCH FINISHED ✓  room:", roomCode);
    // give the server's async recordMatch() a moment to write to Supabase
    setTimeout(() => {
      console.log("ROOM_CODE=" + roomCode);
      socket.close();
      process.exit(0);
    }, 2000);
  }
});

socket.on("connect_error", e => bail("connect_error: " + e.message));
