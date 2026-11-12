const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const os = require('os');
const state = require('./state');
const registerPttHandlers = require('./socket/pttHandler');
const registerWebRtcHandlers = require('./socket/webrtcHandler');
const registerAdminHandlers = require('./socket/adminHandler');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static frontend build when available
const publicDir = path.join(__dirname, '../public');
app.use(express.static(publicDir));

// Helper: Get local LAN IPv4 addresses
function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // IPv4 and not internal loopback
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push({
          interface: name,
          address: iface.address
        });
      }
    }
  }
  return addresses;
}

// REST API Endpoints
app.get('/api/status', (req, res) => {
  res.json({
    online: true,
    round: state.round,
    teamsCount: state.teams.size,
    lanIps: getLocalIpAddresses()
  });
});

app.get('/api/teams', (req, res) => {
  const publicTeams = state.getPublicState().teams.map(t => ({
    id: t.id,
    name: t.name,
    channelCode: t.channelCode,
    frequency: t.frequency,
    membersCount: t.membersCount,
    maxMembers: t.maxMembers
  }));
  res.json(publicTeams);
});

// Fallback to index.html for SPA client routing
app.get('*', (req, res, next) => {
  const indexPath = path.join(publicDir, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      next();
    }
  });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingInterval: 10000,
  pingTimeout: 5000
});

// Socket.IO Handlers
io.on('connection', (socket) => {
  // Join a team channel
  socket.on('team:join', ({ teamId, channelCode, name }, callback) => {
    let team = null;
    if (teamId) {
      team = state.getTeam(teamId);
    } else if (channelCode) {
      team = state.getTeamByChannel(channelCode);
    }

    if (!team) {
      const err = { error: 'Invalid channel code or team not found.' };
      if (typeof callback === 'function') callback(err);
      return;
    }

    const cleanName = (name || '').trim();
    if (!cleanName) {
      const err = { error: 'Operator callsign/name is required.' };
      if (typeof callback === 'function') callback(err);
      return;
    }

    const result = state.addMemberToTeam(team.id, socket.id, { name: cleanName });
    if (result.error) {
      if (typeof callback === 'function') callback({ error: result.error });
      return;
    }

    // Join isolated socket room
    socket.join(`team:${team.id}`);

    // Collect other existing peers in the team for WebRTC mesh
    const existingPeers = [];
    for (const [peerSocketId, member] of team.members.entries()) {
      if (peerSocketId !== socket.id) {
        existingPeers.push({
          peerId: peerSocketId,
          peerName: member.name
        });
      }
    }

    // Success response with team state & current radio conditions
    const initialData = {
      success: true,
      team: state.getTeamPublicState(team.id),
      member: result.member,
      existingPeers,
      conditions: state.round.conditions,
      round: state.round
    };

    if (typeof callback === 'function') callback(initialData);
    socket.emit('team:joined', initialData);

    // Notify other members in this team
    socket.to(`team:${team.id}`).emit('team:member-joined', {
      member: result.member,
      peerId: socket.id,
      peerName: result.member.name
    });

    // Notify admin
    io.to('admin_room').emit('admin:team-updated', state.getTeamPublicState(team.id));
    io.to('admin_room').emit('log:new', state.logs[0]);
  });

  // Leave team channel
  socket.on('team:leave', (data, callback) => {
    const removal = state.removeMember(socket.id);
    if (removal) {
      const { team, member, pttReleased } = removal;
      socket.leave(`team:${team.id}`);

      socket.to(`team:${team.id}`).emit('team:member-left', {
        socketId: socket.id,
        name: member ? member.name : 'Unknown'
      });

      if (pttReleased) {
        socket.to(`team:${team.id}`).emit('ptt:speaker-changed', {
          teamId: team.id,
          transmitterId: null,
          transmitterName: null,
          isTransmitting: false
        });
      }

      io.to('admin_room').emit('admin:team-updated', state.getTeamPublicState(team.id));
      io.to('admin_room').emit('log:new', state.logs[0]);
    }

    if (typeof callback === 'function') callback({ success: true });
  });

  // Client requests sync
  socket.on('channel:sync', (data, callback) => {
    const sock = state.sockets.get(socket.id);
    if (sock) {
      const teamState = state.getTeamPublicState(sock.teamId);
      if (typeof callback === 'function') callback(teamState);
    }
  });

  // Register feature handlers
  registerPttHandlers(io, socket);
  registerWebRtcHandlers(io, socket);
  registerAdminHandlers(io, socket);

  // Disconnection handler
  socket.on('disconnect', () => {
    if (state.admins.has(socket.id)) {
      state.admins.delete(socket.id);
    }

    const removal = state.removeMember(socket.id);
    if (removal) {
      const { team, member, pttReleased } = removal;

      // Notify team members
      socket.to(`team:${team.id}`).emit('team:member-left', {
        socketId: socket.id,
        name: member ? member.name : 'Unknown'
      });

      // Crucial: Automatic PTT lock release on disconnect
      if (pttReleased) {
        socket.to(`team:${team.id}`).emit('ptt:speaker-changed', {
          teamId: team.id,
          transmitterId: null,
          transmitterName: null,
          isTransmitting: false
        });
      }

      io.to('admin_room').emit('admin:team-updated', state.getTeamPublicState(team.id));
      io.to('admin_room').emit('log:new', state.logs[0]);
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, '0.0.0.0', () => {
  const lanIps = getLocalIpAddresses();
  console.log('=====================================================');
  console.log('  TACTICAL RADIO SIMULATION PLATFORM (TAC-COM)       ');
  console.log('=====================================================');
  console.log(`> Server running on port: ${PORT}`);
  console.log(`> Local access:        http://localhost:${PORT}`);
  if (lanIps.length > 0) {
    lanIps.forEach(net => {
      console.log(`> LAN Wi-Fi (${net.interface}): http://${net.address}:${PORT}`);
    });
  } else {
    console.log('> LAN Wi-Fi: No active external network interface found');
  }
  console.log('=====================================================');
});
