const WebSocket = require("ws");

const port = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port });

const rooms = new Map();

function joinRoom(ws, gameId) {
  if (!rooms.has(gameId)) rooms.set(gameId, new Set());
  rooms.get(gameId).add(ws);
  ws.gameId = gameId;
}

function leaveRoom(ws) {
  const gid = ws.gameId;
  if (!gid) return;
  const set = rooms.get(gid);
  if (set) {
    set.delete(ws);
    if (set.size === 0) rooms.delete(gid);
  }
}

function broadcast(gameId, data) {
  const set = rooms.get(gameId);
  if (!set) return;
  const msg = JSON.stringify(data);
  set.forEach(c => {
    if (c.readyState === WebSocket.OPEN) c.send(msg);
  });
}

wss.on("connection", ws => {
  ws.on("message", raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === "join_game") {
      joinRoom(ws, String(msg.game_id));
      broadcast(String(msg.game_id), { type: "player_joined" });
    }

    if (msg.type === "guess") {
      broadcast(String(msg.game_id), {
        type: "guess_made",
        user_id: msg.user_id,
        letter: msg.letter
      });
    }
  });

  ws.on("close", () => leaveRoom(ws));
});

console.log("WebSocket running on port", port);
