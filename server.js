const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const MAX_PLAYERS_PER_SERVER = 4;
let servers = {};

app.get("/", (req, res) => {
  res.send("Bart Multiplayer WebSocket Server Running");
});

wss.on("connection", (ws) => {
  console.log("Player connected");

  ws.id = generateId();

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());
      handleMessage(ws, data);
    } catch (e) {
      console.log("Invalid JSON:", message.toString());
    }
  });

  ws.on("close", () => {
    removePlayer(ws);
    console.log("Player disconnected");
  });
});

function handleMessage(ws, data) {

  // 🔥 JOIN OR CREATE SERVER BY CODE
  if (data.type === "join_server") {

    const code = data.server_code?.toUpperCase();
    if (!code) return;

    // Create server if it doesn't exist
    if (!servers[code]) {
      servers[code] = {
        servername: code,
        players: {},
        max_players: MAX_PLAYERS_PER_SERVER
      };
      console.log("Created new server:", code);
    }

    // Check if full
    if (Object.keys(servers[code].players).length >= MAX_PLAYERS_PER_SERVER) {
      ws.send(JSON.stringify({ join_failed: "Server full" }));
      return;
    }

    // Add player
    servers[code].players[ws.id] = {
      id: ws.id,
      name: data.name || "Player",
      pos: [0, 0],
      rot: 0,
      score: 0,
      launched: false
    };

    ws.serverCode = code;

    ws.send(JSON.stringify({
      joined_server: true,
      server_id: code,
      servername: code
    }));

    sendServerState(code);
  }

  // 🔥 PLAYER UPDATE
  else if (data.type === "update_player") {
    const code = ws.serverCode;
    if (!code || !servers[code]) return;

    const player = servers[code].players[ws.id];
    if (!player) return;

    servers[code].players[ws.id] = {
      ...player,
      ...data.payload
    };

    sendServerState(code);
  }
}

function sendServerState(code) {
  const s = servers[code];
  if (!s) return;

  const state = {
    server_state: {
      players_in_server: Object.keys(s.players).length,
      ...s.players
    }
  };

  wss.clients.forEach(client => {
    if (
      client.readyState === WebSocket.OPEN &&
      client.serverCode === code
    ) {
      client.send(JSON.stringify(state));
    }
  });
}

function removePlayer(ws) {
  const code = ws.serverCode;
  if (!code || !servers[code]) return;

  delete servers[code].players[ws.id];

  if (Object.keys(servers[code].players).length === 0) {
    delete servers[code];
    console.log("Deleted empty server:", code);
  } else {
    sendServerState(code);
  }
}

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
