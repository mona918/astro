/**
 * Admin Dashboard & Control Socket Handler
 */

const state = require('../state');

function registerAdminHandlers(io, socket) {
  // Admin joins the admin room
  socket.on('admin:join', (data, callback) => {
    state.admins.add(socket.id);
    socket.join('admin_room');

    const publicState = state.getPublicState();
    if (typeof callback === 'function') {
      callback({ success: true, state: publicState });
    }
    socket.emit('admin:initial-state', publicState);
  });

  // Round Management
  socket.on('admin:round:start', () => {
    state.round.status = 'ACTIVE';
    state.round.startTime = Date.now();
    state.addLog({
      type: 'SYSTEM',
      message: `ROUND ${state.round.roundNumber} STARTED by Command HQ`
    });

    io.emit('round:status-changed', state.round);
    io.to('admin_room').emit('log:new', state.logs[0]);
  });

  socket.on('admin:round:pause', () => {
    state.round.status = 'PAUSED';
    state.addLog({
      type: 'SYSTEM',
      message: `ROUND ${state.round.roundNumber} PAUSED by Command HQ`
    });

    // If anyone was transmitting, force release
    for (const team of state.teams.values()) {
      if (team.currentTransmitter) {
        state.releasePtt(team.id, team.currentTransmitter);
        io.to(`team:${team.id}`).emit('ptt:speaker-changed', {
          teamId: team.id,
          transmitterId: null,
          transmitterName: null,
          isTransmitting: false
        });
      }
    }

    io.emit('round:status-changed', state.round);
    io.to('admin_room').emit('log:new', state.logs[0]);
  });

  socket.on('admin:round:stop', () => {
    state.round.status = 'STOPPED';
    state.addLog({
      type: 'SYSTEM',
      message: `ROUND ${state.round.roundNumber} STOPPED by Command HQ`
    });

    // Release any active transmitters
    for (const team of state.teams.values()) {
      if (team.currentTransmitter) {
        state.releasePtt(team.id, team.currentTransmitter);
        io.to(`team:${team.id}`).emit('ptt:speaker-changed', {
          teamId: team.id,
          transmitterId: null,
          transmitterName: null,
          isTransmitting: false
        });
      }
    }

    io.emit('round:status-changed', state.round);
    io.to('admin_room').emit('log:new', state.logs[0]);
  });

  socket.on('admin:round:reset', () => {
    state.round.status = 'NOT_STARTED';
    state.round.startTime = null;
    state.round.elapsedSeconds = 0;
    state.round.roundNumber += 1;

    // Release any active transmitters
    for (const team of state.teams.values()) {
      if (team.currentTransmitter) {
        state.releasePtt(team.id, team.currentTransmitter);
        io.to(`team:${team.id}`).emit('ptt:speaker-changed', {
          teamId: team.id,
          transmitterId: null,
          transmitterName: null,
          isTransmitting: false
        });
      }
    }

    state.addLog({
      type: 'SYSTEM',
      message: `ROUND RESET. Round ${state.round.roundNumber} ready.`
    });

    io.emit('round:status-changed', state.round);
    io.to('admin_room').emit('admin:initial-state', state.getPublicState());
    io.to('admin_room').emit('log:new', state.logs[0]);
  });

  // Radio Conditions & Difficulty Presets
  socket.on('admin:preset:select', (presetName) => {
    state.applyPreset(presetName);
    io.emit('conditions:updated', state.round.conditions);
    io.to('admin_room').emit('admin:conditions-changed', {
      preset: state.round.difficultyPreset,
      conditions: state.round.conditions
    });
    io.to('admin_room').emit('log:new', state.logs[0]);
  });

  socket.on('admin:conditions:update', (newConditions) => {
    state.round.conditions = {
      ...state.round.conditions,
      ...newConditions
    };
    state.round.difficultyPreset = 'CUSTOM';

    io.emit('conditions:updated', state.round.conditions);
    io.to('admin_room').emit('admin:conditions-changed', {
      preset: 'CUSTOM',
      conditions: state.round.conditions
    });
  });

  // Team Management
  socket.on('admin:team:create', (teamData, callback) => {
    const existing = state.getTeamByChannel(teamData.channelCode);
    if (existing) {
      if (typeof callback === 'function') callback({ error: 'Channel code already in use.' });
      return;
    }

    const newTeam = state.createTeam(teamData);
    if (typeof callback === 'function') callback({ success: true, team: newTeam });

    io.to('admin_room').emit('admin:team-created', state.getTeamPublicState(newTeam.id));
    io.emit('teams:list-updated', state.getPublicState().teams);
    io.to('admin_room').emit('log:new', state.logs[0]);
  });

  socket.on('admin:team:delete', (teamId, callback) => {
    const team = state.getTeam(teamId);
    if (!team) {
      if (typeof callback === 'function') callback({ error: 'Team not found' });
      return;
    }

    // Force disconnect all members from this channel
    for (const socketId of team.members.keys()) {
      io.to(socketId).emit('team:disbanded', { reason: 'Channel closed by Command HQ' });
    }

    state.deleteTeam(teamId);
    if (typeof callback === 'function') callback({ success: true });

    io.to('admin_room').emit('admin:team-deleted', teamId);
    io.emit('teams:list-updated', state.getPublicState().teams);
    io.to('admin_room').emit('log:new', state.logs[0]);
  });

  // Demo Mode: Trigger simulated radio events
  socket.on('admin:demo:event', (demoData) => {
    const { type, teamId, participantName } = demoData;
    const team = teamId ? state.getTeam(teamId) : Array.from(state.teams.values())[0];
    if (!team) return;

    if (type === 'SIMULATED_TRANSMIT') {
      const simName = participantName || 'Ghost-01 (Sim)';
      const duration = demoData.duration || 3000;

      // Log transmit start
      const startLog = state.addLog({
        teamId: team.id,
        teamName: team.name,
        participantName: simName,
        type: 'TRANSMIT_START',
        message: `[DEMO] ${simName} transmitting on ${team.channelCode}`
      });

      io.to(`team:${team.id}`).emit('ptt:speaker-changed', {
        teamId: team.id,
        transmitterId: 'simulated_ghost',
        transmitterName: simName,
        isTransmitting: true
      });
      io.to('admin_room').emit('admin:team-updated', state.getTeamPublicState(team.id));
      io.to('admin_room').emit('log:new', startLog);

      // Auto release after duration
      setTimeout(() => {
        const endLog = state.addLog({
          teamId: team.id,
          teamName: team.name,
          participantName: simName,
          type: 'TRANSMIT_END',
          message: `[DEMO] ${simName} ended transmission`
        });

        io.to(`team:${team.id}`).emit('ptt:speaker-changed', {
          teamId: team.id,
          transmitterId: null,
          transmitterName: null,
          isTransmitting: false,
          lastSpeakerName: simName
        });
        io.to('admin_room').emit('admin:team-updated', state.getTeamPublicState(team.id));
        io.to('admin_room').emit('log:new', endLog);
      }, duration);
    } else if (type === 'SIMULATED_INTERRUPTION') {
      const intLog = state.addLog({
        teamId: team.id,
        teamName: team.name,
        participantName: participantName || 'Recon-Sim',
        type: 'INTERRUPTION',
        message: `[DEMO] Atmospheric EMP signal cut out on ${team.channelCode}`
      });

      io.to(`team:${team.id}`).emit('ptt:signal-interrupted', {
        transmitterId: 'all',
        duration: 1200
      });
      io.to('admin_room').emit('log:new', intLog);
    } else if (type === 'SIMULATED_CONNECTION_DROP') {
      const dropLog = state.addLog({
        teamId: team.id,
        teamName: team.name,
        participantName: participantName || 'Tower-Beacon',
        type: 'WARNING',
        message: `[DEMO] Relay repeater carrier dropped on ${team.channelCode}`
      });

      io.to(`team:${team.id}`).emit('sim:connection-drop', {
        duration: 2500
      });
      io.to('admin_room').emit('log:new', dropLog);
    }
  });
}

module.exports = registerAdminHandlers;
