/**
 * Push-To-Talk (Half-Duplex) Socket Handler
 */

const state = require('../state');

function registerPttHandlers(io, socket) {
  // PTT Request
  socket.on('ptt:request', (data, callback) => {
    const userSock = state.sockets.get(socket.id);
    if (!userSock) {
      const err = { granted: false, reason: 'You are not connected to any team channel.' };
      if (typeof callback === 'function') callback(err);
      socket.emit('ptt:response', err);
      return;
    }

    const result = state.requestPtt(userSock.teamId, socket.id);

    if (result.granted) {
      const team = state.getTeam(userSock.teamId);
      // Acknowledge to requester
      if (typeof callback === 'function') callback({ granted: true });
      socket.emit('ptt:granted', {
        teamId: userSock.teamId,
        transmitterId: socket.id,
        transmitterName: result.transmitterName
      });

      // Broadcast to other team members in channel
      socket.to(`team:${userSock.teamId}`).emit('ptt:speaker-changed', {
        teamId: userSock.teamId,
        transmitterId: socket.id,
        transmitterName: result.transmitterName,
        isTransmitting: true
      });

      // Notify admins
      io.to('admin_room').emit('admin:team-updated', state.getTeamPublicState(userSock.teamId));
      io.to('admin_room').emit('log:new', state.logs[0]);
    } else {
      if (typeof callback === 'function') callback(result);
      socket.emit('ptt:busy', result);
    }
  });

  // PTT Release
  socket.on('ptt:release', (data, callback) => {
    const userSock = state.sockets.get(socket.id);
    if (!userSock) return;

    const result = state.releasePtt(userSock.teamId, socket.id);

    if (result.success) {
      if (typeof callback === 'function') callback({ success: true });
      socket.emit('ptt:released', { teamId: userSock.teamId });

      // Notify team members
      socket.to(`team:${userSock.teamId}`).emit('ptt:speaker-changed', {
        teamId: userSock.teamId,
        transmitterId: null,
        transmitterName: null,
        isTransmitting: false,
        lastSpeakerName: result.speakerName
      });

      // Notify admins
      io.to('admin_room').emit('admin:team-updated', state.getTeamPublicState(userSock.teamId));
      io.to('admin_room').emit('log:new', state.logs[0]);
    } else {
      if (typeof callback === 'function') callback(result);
    }
  });

  // Signal Interruption Simulation Trigger (from client side simulated effects)
  socket.on('ptt:signal-interrupted', (data) => {
    const userSock = state.sockets.get(socket.id);
    if (!userSock) return;

    state.addLog({
      teamId: userSock.teamId,
      teamName: data.teamName || 'Team',
      participantName: userSock.name,
      type: 'INTERRUPTION',
      message: `Signal interruption detected for ${userSock.name}`
    });

    socket.to(`team:${userSock.teamId}`).emit('ptt:signal-interrupted', {
      transmitterId: socket.id,
      duration: data.duration || 800
    });

    io.to('admin_room').emit('log:new', state.logs[0]);
  });
}

module.exports = registerPttHandlers;
