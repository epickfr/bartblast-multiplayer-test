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

  ws.playerId = "player_" + Date.now() + "_" + Math.floor(Math.random() * 9999);

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

  // CREATE SERVER
  if (data.type === "join_server") {

    const serverId = data.server_code; // ← FIXED (was wrong before)

    if (!servers[serverId]) {
      servers[serverId] = {
        servername: serverId,
        players: {},
        max_players: MAX_PLAYERS_PER_SERVER
      };
    }

    if (Object.keys(servers[serverId].players).length >= MAX_PLAYERS_PER_SERVER) {
      ws.send(JSON.stringify({ join_failed: "Server full" }));
      return;
    }

    servers[serverId].players[ws.playerId] = {
      name: data.name || "Player",
      pos: [0, 0],
      rot: 0,
      score: 0,
      launched: false
    };

    ws.serverId = serverId;

    ws.send(JSON.stringify({
      joined_server: true,
      server_id: serverId,
      servername: servers[serverId].servername,
      your_id: ws.playerId
    }));

    sendServerState(serverId);
  }

  else if (data.type === "update_player") {
    const serverId = ws.serverId;
    if (!serverId || !servers[serverId]) return;

    const players = servers[serverId].players;

    if (!players[ws.playerId]) return;

    players[ws.playerId] = {
      ...players[ws.playerId],
      ...data.payload
    };

    sendServerState(serverId);
  }
}

function sendServerState(serverId) {
  const s = servers[serverId];
  if (!s) return;

  const state = {
    server_state: {
      servername: s.servername,
      players_in_server: Object.keys(s.players).length,
      players: s.players
    }
  };

  wss.clients.forEach(client => {
    if (
      client.readyState === WebSocket.OPEN &&
      client.serverId === serverId
    ) {
      client.send(JSON.stringify(state));
    }
  });
}

function removePlayer(ws) {
  const serverId = ws.serverId;
  if (!serverId || !servers[serverId]) return;

  delete servers[serverId].players[ws.playerId];

  if (Object.keys(servers[serverId].players).length === 0) {
    delete servers[serverId];
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
