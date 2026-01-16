const http = require("http");
const WebSocket = require("ws");

const PORT = process.env.PORT || 8080;
const SECRET = process.env.WS_SECRET || "Visa1usa@@@";

const rooms = new Map(); // gameId -> Set(ws)

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
  ws.gameId = null;
}

function broadcast(gameId, payload) {
  const set = rooms.get(gameId);
  if (!set) return;
  const msg = JSON.stringify(payload);
  for (const client of set) {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  }
}

// --- HTTP server para /emit ---
const server = http.createServer((req, res) => {
  if (req.method !== "POST" || req.url !== "/emit") {
    res.writeHead(404);
    return res.end("Not found");
  }

  // Simple auth por header
  const auth = req.headers["x-ws-secret"] || "";
  if (auth !== SECRET) {
    res.writeHead(401);
    return res.end("Unauthorized");
  }

  let body = "";
  req.on("data", (chunk) => (body += chunk.toString()));
  req.on("end", () => {
    try {
      const data = JSON.parse(body || "{}");
      const gameId = String(data.game_id || "");
      const event = data.event || null;

      if (!gameId || !event) {
        res.writeHead(400);
        return res.end("Missing game_id/event");
      }

      broadcast(gameId, event);
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: true }));
    } catch (e) {
      res.writeHead(400);
      return res.end("Bad JSON");
    }
  });
});

// --- WebSocket server ---
const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (msg.type === "join_game") {
      const gameId = String(msg.game_id || "");
      if (!gameId) return;

      joinRoom(ws, gameId);
      broadcast(gameId, { type: "player_joined", game_id: gameId });
      return;
    }
  });

  ws.on("close", () => leaveRoom(ws));
});

server.listen(PORT, () => {
  console.log("HTTP+WS listening on", PORT);
});
