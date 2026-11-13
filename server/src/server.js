const express = require('express');
const http = require('http');
const https = require('https');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const os = require('os');
const fs = require('fs');
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
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push({ interface: name, address: iface.address });
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
    if (err) next();
  });
});

// -------------------------------------------------
// Load pre-generated self-signed TLS certificate
// Generated once via: openssl req -x509 -newkey rsa:2048 ...
// Located at server/certs/key.pem + cert.pem
// Allows mobile devices to use getUserMedia() over HTTPS
// -------------------------------------------------
function loadCert() {
  try {
    const certDir = path.join(__dirname, '../certs');
    const key = fs.readFileSync(path.join(certDir, 'key.pem'), 'utf8');
    const cert = fs.readFileSync(path.join(certDir, 'cert.pem'), 'utf8');
    return { key, cert };
  } catch (err) {
    console.warn('TLS certificate files not found in server/certs/, HTTPS unavailable:', err.message);
    return null;
  }
}

const PORT_HTTP = process.env.PORT || 4000;
const PORT_HTTPS = process.env.PORT_HTTPS || 4443;

// Plain HTTP server (still usable for localhost tabs)
const httpServer = http.createServer(app);

// HTTPS server for mobile LAN access with microphone support
let httpsServer;
try {
  const certData = loadCert();
  if (certData) {
    httpsServer = https.createServer(certData, app);
  }
} catch (err) {
  console.warn('Could not create HTTPS server:', err.message);
}

// Socket.IO attaches to BOTH servers
const ioOpts = {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingInterval: 10000,
  pingTimeout: 5000
};

const io = new Server(ioOpts);
io.attach(httpServer);
if (httpsServer) io.attach(httpsServer);

// ---- Socket.IO connection logic (shared for HTTP and HTTPS) ----
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

    socket.join(`team:${team.id}`);

    const existingPeers = [];
    for (const [peerSocketId, member] of team.members.entries()) {
      if (peerSocketId !== socket.id) {
        existingPeers.push({ peerId: peerSocketId, peerName: member.name });
      }
    }

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

    socket.to(`team:${team.id}`).emit('team:member-joined', {
      member: result.member,
      peerId: socket.id,
      peerName: result.member.name
    });

    io.to('admin_room').emit('admin:team-updated', state.getTeamPublicState(team.id));
    io.to('admin_room').emit('log:new', state.logs[0]);
  });

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

  socket.on('channel:sync', (data, callback) => {
    const sock = state.sockets.get(socket.id);
    if (sock) {
      const teamState = state.getTeamPublicState(sock.teamId);
      if (typeof callback === 'function') callback(teamState);
    }
  });

  registerPttHandlers(io, socket);
  registerWebRtcHandlers(io, socket);
  registerAdminHandlers(io, socket);

  socket.on('disconnect', () => {
    if (state.admins.has(socket.id)) state.admins.delete(socket.id);

    const removal = state.removeMember(socket.id);
    if (removal) {
      const { team, member, pttReleased } = removal;

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
  });
});

// ---- Start both servers ----
httpServer.listen(PORT_HTTP, '0.0.0.0', () => {
  const lanIps = getLocalIpAddresses();
  console.log('=====================================================');
  console.log('  TACTICAL RADIO SIMULATION PLATFORM (TAC-COM)       ');
  console.log('=====================================================');
  console.log(`> HTTP  (localhost):   http://localhost:${PORT_HTTP}`);
  if (lanIps.length > 0) {
    lanIps.forEach(net => {
      console.log(`> HTTP  (LAN):         http://${net.address}:${PORT_HTTP}  [${net.interface}]`);
    });
  }
  if (httpsServer) {
    lanIps.forEach(net => {
      console.log(`> HTTPS (LAN + MIC):   https://${net.address}:${PORT_HTTPS}  ⬅ USE ON MOBILE`);
    });
    console.log(`> HTTPS (localhost):   https://localhost:${PORT_HTTPS}`);
    console.log('>');
    console.log('> NOTE: Mobile browsers will show a security warning for the');
    console.log('> self-signed certificate. Tap "Advanced" → "Proceed" to continue.');
    console.log('> This is expected and safe on a local Wi-Fi network.');
  }
  console.log('> Admin password:      TACCOM-HQ-2026  (change via ?adminpw=YOURPW)');
  console.log('=====================================================');
});

if (httpsServer) {
  httpsServer.listen(PORT_HTTPS, '0.0.0.0', () => {
    // Already printed in httpServer.listen callback above
  });
}
