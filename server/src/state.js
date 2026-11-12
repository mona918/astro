/**
 * Central State Management for Radio Simulation Platform
 */

class SimulationState {
  constructor() {
    this.teams = new Map(); // teamId -> TeamObject
    this.sockets = new Map(); // socketId -> { teamId, memberId, name, role }
    this.admins = new Set(); // Set of socketIds that are admins

    this.round = {
      status: 'NOT_STARTED', // 'NOT_STARTED' | 'ACTIVE' | 'PAUSED' | 'STOPPED'
      roundNumber: 1,
      startTime: null,
      elapsedSeconds: 0,
      difficultyPreset: 'MEDIUM',
      conditions: {
        staticLevel: 35,             // 0 - 100 (%)
        voiceDistortion: 40,         // 0 - 100 (%)
        transmissionDelay: 250,      // 0 - 3000 (ms)
        signalInterruptionProb: 15,  // 0 - 100 (%)
        interruptionDuration: 800,   // 100 - 2000 (ms)
        connectionFailureProb: 5,    // 0 - 50 (%)
      }
    };

    this.logs = []; // array of { id, timestamp, teamId, teamName, type, message, participantName }
    this.maxLogs = 200;

    // Seed initial default teams
    this.createTeam({ name: 'Alpha Squad', channelCode: 'ALPHA-01', frequency: '142.850 MHz', maxMembers: 6 });
    this.createTeam({ name: 'Bravo Unit', channelCode: 'BRAVO-02', frequency: '148.125 MHz', maxMembers: 6 });
    this.createTeam({ name: 'Charlie Recon', channelCode: 'CHARLIE-03', frequency: '155.400 MHz', maxMembers: 6 });
  }

  createTeam({ name, channelCode, frequency, maxMembers = 6 }) {
    const id = 'team_' + Math.random().toString(36).substring(2, 9);
    const team = {
      id,
      name,
      channelCode: channelCode.toUpperCase(),
      frequency: frequency || `${(140 + Math.random() * 20).toFixed(3)} MHz`,
      maxMembers: parseInt(maxMembers) || 6,
      members: new Map(), // socketId -> memberData
      currentTransmitter: null, // socketId of active speaker
      transmitterName: null,
      transmissionStartTime: null,
      createdAt: new Date().toISOString()
    };
    this.teams.set(id, team);
    this.addLog({
      teamId: id,
      teamName: team.name,
      type: 'SYSTEM',
      message: `Channel created: ${team.channelCode} (${team.frequency})`
    });
    return team;
  }

  deleteTeam(teamId) {
    const team = this.teams.get(teamId);
    if (!team) return false;
    this.teams.delete(teamId);
    this.addLog({
      teamId,
      teamName: team.name,
      type: 'SYSTEM',
      message: `Channel deleted: ${team.channelCode}`
    });
    return true;
  }

  getTeam(teamId) {
    return this.teams.get(teamId);
  }

  getTeamByChannel(channelCode) {
    const cleanCode = (channelCode || '').trim().toUpperCase();
    for (const team of this.teams.values()) {
      if (team.channelCode === cleanCode) {
        return team;
      }
    }
    return null;
  }

  addMemberToTeam(teamId, socketId, memberData) {
    const team = this.teams.get(teamId);
    if (!team) return { error: 'Team not found' };

    // Check duplicate name in team
    for (const member of team.members.values()) {
      if (member.name.toLowerCase() === memberData.name.toLowerCase()) {
        return { error: `Callsign "${memberData.name}" already in use on this channel.` };
      }
    }

    if (team.members.size >= team.maxMembers) {
      return { error: `Channel capacity reached (${team.maxMembers} max).` };
    }

    const member = {
      socketId,
      id: memberData.id || ('usr_' + Math.random().toString(36).substring(2, 9)),
      name: memberData.name,
      role: 'OPERATOR',
      joinedAt: new Date().toISOString(),
      signalQuality: 'EXCELLENT',
      isTransmitting: false
    };

    team.members.set(socketId, member);
    this.sockets.set(socketId, { teamId, memberId: member.id, name: member.name, role: 'OPERATOR' });

    this.addLog({
      teamId,
      teamName: team.name,
      participantName: member.name,
      type: 'CONNECT',
      message: `${member.name} joined channel`
    });

    return { team, member };
  }

  removeMember(socketId) {
    const sock = this.sockets.get(socketId);
    if (!sock) return null;

    const team = this.teams.get(sock.teamId);
    this.sockets.delete(socketId);

    if (team) {
      const member = team.members.get(socketId);
      team.members.delete(socketId);

      // If this member held the PTT lock, immediately release it!
      let pttReleased = false;
      if (team.currentTransmitter === socketId) {
        team.currentTransmitter = null;
        team.transmitterName = null;
        team.transmissionStartTime = null;
        pttReleased = true;
      }

      this.addLog({
        teamId: team.id,
        teamName: team.name,
        participantName: member ? member.name : sock.name,
        type: 'DISCONNECT',
        message: `${member ? member.name : sock.name} left channel`
      });

      return { team, member, pttReleased };
    }

    return null;
  }

  requestPtt(teamId, socketId) {
    const team = this.teams.get(teamId);
    if (!team) return { granted: false, reason: 'Team channel does not exist' };

    if (this.round.status !== 'ACTIVE') {
      return { 
        granted: false, 
        reason: this.round.status === 'NOT_STARTED' 
          ? 'Round has not started yet. Stand by for command.' 
          : 'Round is currently paused or ended.' 
      };
    }

    const member = team.members.get(socketId);
    if (!member) return { granted: false, reason: 'Unauthorized: Not a member of this channel' };

    // Check half-duplex lock
    if (team.currentTransmitter && team.currentTransmitter !== socketId) {
      const currentSpeaker = team.members.get(team.currentTransmitter);
      return {
        granted: false,
        reason: 'CHANNEL_BUSY',
        currentTransmitter: currentSpeaker ? currentSpeaker.name : 'Unknown'
      };
    }

    // Grant transmission lock
    team.currentTransmitter = socketId;
    team.transmitterName = member.name;
    team.transmissionStartTime = Date.now();
    member.isTransmitting = true;

    this.addLog({
      teamId: team.id,
      teamName: team.name,
      participantName: member.name,
      type: 'TRANSMIT_START',
      message: `${member.name} started transmission`
    });

    return {
      granted: true,
      transmitterId: socketId,
      transmitterName: member.name
    };
  }

  releasePtt(teamId, socketId) {
    const team = this.teams.get(teamId);
    if (!team) return { success: false };

    if (team.currentTransmitter === socketId) {
      const member = team.members.get(socketId);
      const speakerName = member ? member.name : team.transmitterName || 'Operator';

      team.currentTransmitter = null;
      team.transmitterName = null;
      team.transmissionStartTime = null;
      if (member) member.isTransmitting = false;

      this.addLog({
        teamId: team.id,
        teamName: team.name,
        participantName: speakerName,
        type: 'TRANSMIT_END',
        message: `${speakerName} ended transmission`
      });

      return {
        success: true,
        speakerName
      };
    }

    return { success: false, reason: 'Not current transmitter' };
  }

  addLog({ teamId = null, teamName = 'HQ', participantName = 'SYSTEM', type = 'INFO', message }) {
    const logEntry = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      teamId,
      teamName,
      participantName,
      type, // 'CONNECT', 'DISCONNECT', 'TRANSMIT_START', 'TRANSMIT_END', 'INTERRUPTION', 'SYSTEM', 'WARNING'
      message
    };

    this.logs.unshift(logEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }
    return logEntry;
  }

  applyPreset(presetName) {
    const upper = (presetName || '').toUpperCase();
    this.round.difficultyPreset = upper;

    switch (upper) {
      case 'EASY':
        this.round.conditions = {
          staticLevel: 10,
          voiceDistortion: 15,
          transmissionDelay: 50,
          signalInterruptionProb: 0,
          interruptionDuration: 300,
          connectionFailureProb: 0
        };
        break;
      case 'MEDIUM':
        this.round.conditions = {
          staticLevel: 35,
          voiceDistortion: 40,
          transmissionDelay: 250,
          signalInterruptionProb: 15,
          interruptionDuration: 800,
          connectionFailureProb: 5
        };
        break;
      case 'HARD':
        this.round.conditions = {
          staticLevel: 65,
          voiceDistortion: 70,
          transmissionDelay: 750,
          signalInterruptionProb: 35,
          interruptionDuration: 1200,
          connectionFailureProb: 15
        };
        break;
      case 'EXTREME':
        this.round.conditions = {
          staticLevel: 90,
          voiceDistortion: 90,
          transmissionDelay: 1500,
          signalInterruptionProb: 55,
          interruptionDuration: 1800,
          connectionFailureProb: 30
        };
        break;
      default:
        break;
    }

    this.addLog({
      type: 'SYSTEM',
      message: `Difficulty preset changed to ${upper}`
    });
  }

  getPublicState() {
    const teamsList = [];
    for (const team of this.teams.values()) {
      const membersList = [];
      for (const m of team.members.values()) {
        membersList.push({
          socketId: m.socketId,
          id: m.id,
          name: m.name,
          role: m.role,
          joinedAt: m.joinedAt,
          isTransmitting: m.socketId === team.currentTransmitter,
          signalQuality: m.signalQuality
        });
      }

      teamsList.push({
        id: team.id,
        name: team.name,
        channelCode: team.channelCode,
        frequency: team.frequency,
        maxMembers: team.maxMembers,
        membersCount: membersList.length,
        members: membersList,
        currentTransmitter: team.currentTransmitter,
        transmitterName: team.transmitterName
      });
    }

    return {
      round: this.round,
      teams: teamsList,
      logs: this.logs.slice(0, 50)
    };
  }

  getTeamPublicState(teamId) {
    const team = this.teams.get(teamId);
    if (!team) return null;

    const membersList = [];
    for (const m of team.members.values()) {
      membersList.push({
        socketId: m.socketId,
        id: m.id,
        name: m.name,
        isTransmitting: m.socketId === team.currentTransmitter,
        signalQuality: m.signalQuality
      });
    }

    const teamLogs = this.logs
      .filter(l => l.teamId === teamId || l.type === 'SYSTEM')
      .slice(0, 30);

    return {
      id: team.id,
      name: team.name,
      channelCode: team.channelCode,
      frequency: team.frequency,
      maxMembers: team.maxMembers,
      members: membersList,
      currentTransmitter: team.currentTransmitter,
      transmitterName: team.transmitterName,
      round: this.round,
      logs: teamLogs
    };
  }
}

const state = new SimulationState();
module.exports = state;
