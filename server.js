const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "https://bartblast-multiplayer-test.onrender.com",
    methods: ["GET", "POST"]
  }
});

const MAX_PLAYERS_PER_SERVER = 4;
let servers = {};

app.get('/', (req, res) => {
  res.send('Bart Multiplayer Server is running! Connect from Godot.');
});

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  socket.on('create_server', (serverName) => {
    const serverId = 'server' + Date.now();
    servers[serverId] = {
      servername: serverName || "New Bart Crash Server",
      players: {},
      max_players: MAX_PLAYERS_PER_SERVER
    };
    socket.join(serverId);
    socket.emit('joined_server', { server_id: serverId, servername: servers[serverId].servername });
    broadcastServerList();
  });

  socket.on('join_server', (serverId) => {
    if (!servers[serverId]) {
      socket.emit('join_failed', 'Server not found');
      return;
    }
    if (Object.keys(servers[serverId].players).length >= MAX_PLAYERS_PER_SERVER) {
      socket.emit('join_failed', 'Server full');
      return;
    }

    servers[serverId].players[socket.id] = {
      name: `Player${Object.keys(servers[serverId].players).length + 1}`,
      pos: [0, 0],
      rot: 0,
      score: 0,
      launched: false
    };

    socket.join(serverId);
    socket.emit('joined_server', { server_id: serverId, servername: servers[serverId].servername });
    io.to(serverId).emit('player_joined', socket.id);
    broadcastServerList();
  });

  socket.on('update_player', (data) => {
    for (let sid in servers) {
      if (servers[sid].players[socket.id]) {
        servers[sid].players[socket.id] = { ...servers[sid].players[socket.id], ...data };
        io.to(sid).emit('server_state', getServerState(sid));
        break;
      }
    }
  });

  socket.on('disconnect', () => {
    for (let sid in servers) {
      if (servers[sid].players[socket.id]) {
        delete servers[sid].players[socket.id];
        io.to(sid).emit('player_left', socket.id);
        if (Object.keys(servers[sid].players).length === 0) {
          delete servers[sid];
        }
        broadcastServerList();
        break;
      }
    }
    console.log('Player disconnected:', socket.id);
  });
});

function broadcastServerList() {
  const list = Object.entries(servers).map(([id, s]) => ({
    id,
    servername: s.servername,
    players_in_server: Object.keys(s.players).length,
    max_players: s.max_players
  }));
  io.emit('server_list', { servers: list });
}

function getServerState(serverId) {
  const s = servers[serverId];
  if (!s) return {};
  const playerData = {};
  Object.entries(s.players).forEach(([pid, data], index) => {
    playerData[`player${index + 1}`] = { ...data, id: pid };
  });
  return {
    servername: s.servername,
    players_in_server: Object.keys(s.players).length,
    ...playerData
  };
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
