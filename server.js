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
  if (data.type === "create_server") {
    const serverId = "server" + Date.now();

    servers[serverId] = {
      servername: data.servername || "New Bart Crash Server",
      players: {},
      max_players: MAX_PLAYERS_PER_SERVER
    };

    ws.serverId = serverId;

    ws.send(JSON.stringify({
      joined_server: true,
      server_id: serverId,
      servername: servers[serverId].servername
    }));

    broadcastServerList();
  }

  else if (data.type === "join_server") {
    const serverId = data.server_id;

    if (!servers[serverId]) {
      ws.send(JSON.stringify({ join_failed: "Server not found" }));
      return;
    }

    if (Object.keys(servers[serverId].players).length >= MAX_PLAYERS_PER_SERVER) {
      ws.send(JSON.stringify({ join_failed: "Server full" }));
      return;
    }

    servers[serverId].players[ws._socket.remoteAddress + Date.now()] = {
      name: "Player",
      pos: [0, 0],
      rot: 0,
      score: 0,
      launched: false
    };

    ws.serverId = serverId;

    ws.send(JSON.stringify({
      joined_server: true,
      server_id: serverId,
      servername: servers[serverId].servername
    }));

    sendServerState(serverId);
    broadcastServerList();
  }

  else if (data.type === "update_player") {
    const serverId = ws.serverId;
    if (!serverId || !servers[serverId]) return;

    const players = servers[serverId].players;
    const playerId = Object.keys(players)[0];

    players[playerId] = { ...players[playerId], ...data.payload };

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
    if (client.readyState === WebSocket.OPEN && client.serverId === serverId) {
      client.send(JSON.stringify(state));
    }
  });
}

function broadcastServerList() {
  const list = Object.entries(servers).map(([id, s]) => ({
    id,
    servername: s.servername,
    players_in_server: Object.keys(s.players).length,
    max_players: s.max_players
  }));

  const msg = JSON.stringify({ server_list: list });

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

function removePlayer(ws) {
  const serverId = ws.serverId;
  if (!serverId || !servers[serverId]) return;

  delete servers[serverId].players[
    Object.keys(servers[serverId].players)[0]
  ];

  if (Object.keys(servers[serverId].players).length === 0) {
    delete servers[serverId];
  }

  broadcastServerList();
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
