import React, { useState, useEffect } from 'react';
import {
  Shield,
  Play,
  Pause,
  Square,
  RotateCcw,
  Sliders,
  Users,
  Radio,
  Activity,
  AlertTriangle,
  Plus,
  Trash2,
  Wifi,
  Sparkles,
  Zap,
  Volume2,
  Clock,
  Copy,
  Check,
  Server
} from 'lucide-react';
import { socketService } from '../services/socketService';

export default function AdminDashboard({ onSwitchToOperator }) {
  const [adminState, setAdminState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [lanIps, setLanIps] = useState([]);

  // New Team Form State
  const [newTeamName, setNewTeamName] = useState('');
  const [newChannelCode, setNewChannelCode] = useState('');
  const [newMaxMembers, setNewMaxMembers] = useState(6);
  const [createTeamError, setCreateTeamError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Filter logs
  const [logFilter, setLogFilter] = useState('ALL');

  const socket = socketService.getSocket();

  // Fetch LAN IPs for easy Wi-Fi sharing
  useEffect(() => {
    fetch('/api/status')
      .then((res) => res.json())
      .then((data) => {
        if (data.lanIps) setLanIps(data.lanIps);
      })
      .catch((err) => console.warn('Could not fetch LAN info', err));
  }, []);

  // Socket setup for Admin
  useEffect(() => {
    if (!socket) return;

    socket.emit('admin:join', {}, (response) => {
      if (response && response.state) {
        setAdminState(response.state);
        setLoading(false);
      }
    });

    const handleInitialState = (state) => {
      setAdminState(state);
      setLoading(false);
    };

    const handleRoundStatus = (round) => {
      setAdminState((prev) => (prev ? { ...prev, round } : prev));
    };

    const handleConditionsChanged = ({ preset, conditions }) => {
      setAdminState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          round: {
            ...prev.round,
            difficultyPreset: preset,
            conditions,
          },
        };
      });
    };

    const handleTeamUpdated = (updatedTeam) => {
      setAdminState((prev) => {
        if (!prev) return prev;
        const exists = prev.teams.some((t) => t.id === updatedTeam.id);
        const newTeams = exists
          ? prev.teams.map((t) => (t.id === updatedTeam.id ? updatedTeam : t))
          : [...prev.teams, updatedTeam];
        return { ...prev, teams: newTeams };
      });
    };

    const handleTeamCreated = (newTeam) => {
      setAdminState((prev) => {
        if (!prev) return prev;
        return { ...prev, teams: [...prev.teams, newTeam] };
      });
    };

    const handleTeamDeleted = (teamId) => {
      setAdminState((prev) => {
        if (!prev) return prev;
        return { ...prev, teams: prev.teams.filter((t) => t.id !== teamId) };
      });
    };

    const handleNewLog = (newLog) => {
      setAdminState((prev) => {
        if (!prev) return prev;
        return { ...prev, logs: [newLog, ...prev.logs.slice(0, 99)] };
      });
    };

    socket.on('admin:initial-state', handleInitialState);
    socket.on('round:status-changed', handleRoundStatus);
    socket.on('admin:conditions-changed', handleConditionsChanged);
    socket.on('admin:team-updated', handleTeamUpdated);
    socket.on('admin:team-created', handleTeamCreated);
    socket.on('admin:team-deleted', handleTeamDeleted);
    socket.on('log:new', handleNewLog);

    return () => {
      socket.off('admin:initial-state', handleInitialState);
      socket.off('round:status-changed', handleRoundStatus);
      socket.off('admin:conditions-changed', handleConditionsChanged);
      socket.off('admin:team-updated', handleTeamUpdated);
      socket.off('admin:team-created', handleTeamCreated);
      socket.off('admin:team-deleted', handleTeamDeleted);
      socket.off('log:new', handleNewLog);
    };
  }, [socket]);

  // Round Action Handlers
  const startRound = () => socket.emit('admin:round:start');
  const pauseRound = () => socket.emit('admin:round:pause');
  const stopRound = () => socket.emit('admin:round:stop');
  const resetRound = () => socket.emit('admin:round:reset');

  // Difficulty & Radio Conditions Handlers
  const selectPreset = (presetName) => {
    socket.emit('admin:preset:select', presetName);
  };

  const updateCondition = (key, value) => {
    if (!adminState) return;
    const current = adminState.round?.conditions || {};
    socket.emit('admin:conditions:update', {
      ...current,
      [key]: value,
    });
  };

  // Team Creation
  const handleCreateTeam = (e) => {
    e.preventDefault();
    if (!newTeamName.trim() || !newChannelCode.trim()) {
      setCreateTeamError('Team name and Channel Code are required.');
      return;
    }

    setCreateTeamError(null);
    socket.emit(
      'admin:team:create',
      {
        name: newTeamName.trim(),
        channelCode: newChannelCode.trim().toUpperCase(),
        maxMembers: parseInt(newMaxMembers) || 6,
      },
      (res) => {
        if (res && res.error) {
          setCreateTeamError(res.error);
        } else {
          setNewTeamName('');
          setNewChannelCode('');
          setShowCreateModal(false);
        }
      }
    );
  };

  const handleDeleteTeam = (teamId) => {
    if (confirm('Delete this channel? All active operators on this channel will be disconnected.')) {
      socket.emit('admin:team:delete', teamId);
    }
  };

  // Demo Simulation Actions
  const triggerDemoTransmit = (teamId) => {
    socket.emit('admin:demo:event', {
      type: 'SIMULATED_TRANSMIT',
      teamId,
      participantName: 'Ghost-01 (Sim)',
      duration: 3500,
    });
  };

  const triggerDemoInterruption = (teamId) => {
    socket.emit('admin:demo:event', {
      type: 'SIMULATED_INTERRUPTION',
      teamId,
      participantName: 'EMP-Sim',
    });
  };

  const triggerDemoConnectionDrop = (teamId) => {
    socket.emit('admin:demo:event', {
      type: 'SIMULATED_CONNECTION_DROP',
      teamId,
      participantName: 'Repeater-Offline',
    });
  };

  const copyShareLink = (url) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  if (loading || !adminState) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center font-mono text-emerald-400">
        <Radio className="w-10 h-10 animate-spin mb-3 text-emerald-500" />
        <span className="tracking-widest uppercase text-sm">AUTHENTICATING COMMAND HQ LINK...</span>
      </div>
    );
  }

  const { round, teams, logs } = adminState;
  const conditions = round.conditions || {};

  const filteredLogs = logs.filter((l) => {
    if (logFilter === 'ALL') return true;
    if (logFilter === 'TRANSMIT') return l.type === 'TRANSMIT_START' || l.type === 'TRANSMIT_END';
    if (logFilter === 'INTERRUPTION') return l.type === 'INTERRUPTION';
    return l.teamId === logFilter;
  });

  return (
    <div className="w-full max-w-7xl mx-auto p-3 sm:p-6 space-y-6">
      {/* Top Header & Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-radio-panel border border-gray-800 rounded-2xl p-4 sm:p-5 shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-amber-950/80 border border-amber-600/60 rounded-xl text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl sm:text-2xl font-black font-display tracking-widest text-gray-100 uppercase">
                COMMAND HQ // MISSION CONTROL
              </h1>
              <span className="text-xs bg-amber-950 text-amber-400 border border-amber-800 px-2 py-0.5 rounded font-mono font-bold">
                ADMIN ACCESS
              </span>
            </div>
            <p className="text-xs font-mono text-gray-400">
              Multi-Team Tactical Radio Coordination & Channel Enforcement
            </p>
          </div>
        </div>

        <button
          onClick={onSwitchToOperator}
          className="px-4 py-2 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-600/80 hover:border-emerald-500 text-emerald-300 rounded-xl text-xs font-mono font-bold tracking-wider flex items-center space-x-2 transition-all shadow-md"
        >
          <Radio className="w-4 h-4 text-emerald-400" />
          <span>JOIN AS OPERATOR (WALKIE-TALKIE)</span>
        </button>
      </div>

      {/* LAN Wi-Fi Connection Information Banner */}
      <div className="bg-black/60 border border-emerald-900/60 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
        <div className="flex items-center space-x-3">
          <Server className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <div>
            <span className="text-emerald-300 font-bold block uppercase tracking-wider">
              SAME WI-FI / LOCAL NETWORK EVENT SETUP
            </span>
            <span className="text-gray-400 text-[11px]">
              Share this URL with participants and mobile devices on the same Wi-Fi network:
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {lanIps.length > 0 ? (
            lanIps.map((net, i) => {
              const url = `http://${net.address}:4000`;
              return (
                <div
                  key={i}
                  className="flex items-center space-x-2 bg-emerald-950/60 border border-emerald-700/60 px-3 py-1.5 rounded-lg"
                >
                  <span className="text-emerald-200 font-bold select-all">{url}</span>
                  <button
                    onClick={() => copyShareLink(url)}
                    className="text-emerald-400 hover:text-emerald-200 transition-colors"
                    title="Copy Link"
                  >
                    {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              );
            })
          ) : (
            <div className="text-gray-400 bg-gray-900 px-3 py-1.5 rounded-lg border border-gray-700">
              http://localhost:4000 (Local Machine)
            </div>
          )}
        </div>
      </div>

      {/* Primary Section: Round Controls & Global Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Round Controls */}
        <div className="lg:col-span-1 bg-radio-panel border border-gray-800 rounded-2xl p-5 shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-gray-800 mb-4">
              <span className="text-xs uppercase font-extrabold tracking-wider font-mono text-gray-400">
                ROUND MANAGEMENT
              </span>
              <span className="text-xs font-mono font-bold text-emerald-400">
                ROUND #{round.roundNumber}
              </span>
            </div>

            {/* Current Round Status Display */}
            <div className="p-4 rounded-xl bg-black/60 border border-gray-800 text-center mb-5">
              <span className="text-[10px] font-mono uppercase text-gray-500 font-bold block mb-1">
                CURRENT STATUS
              </span>
              <div className="text-xl font-black font-display tracking-widest uppercase flex items-center justify-center space-x-2">
                <span
                  className={`w-3 h-3 rounded-full ${
                    round.status === 'ACTIVE'
                      ? 'bg-emerald-500 shadow-[0_0_10px_#10b981] animate-pulse'
                      : round.status === 'PAUSED'
                      ? 'bg-amber-500'
                      : 'bg-red-500'
                  }`}
                />
                <span
                  className={
                    round.status === 'ACTIVE'
                      ? 'text-emerald-400'
                      : round.status === 'PAUSED'
                      ? 'text-amber-400'
                      : 'text-gray-400'
                  }
                >
                  {round.status}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2.5 font-mono text-xs">
              <button
                onClick={startRound}
                disabled={round.status === 'ACTIVE'}
                className="py-3 bg-emerald-950/80 hover:bg-emerald-800/80 border border-emerald-600 text-emerald-300 font-bold rounded-xl flex items-center justify-center space-x-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <Play className="w-4 h-4 fill-emerald-400 text-emerald-400" />
                <span>START ROUND</span>
              </button>

              <button
                onClick={pauseRound}
                disabled={round.status !== 'ACTIVE'}
                className="py-3 bg-amber-950/80 hover:bg-amber-800/80 border border-amber-600 text-amber-300 font-bold rounded-xl flex items-center justify-center space-x-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <Pause className="w-4 h-4 fill-amber-400 text-amber-400" />
                <span>PAUSE</span>
              </button>

              <button
                onClick={stopRound}
                disabled={round.status === 'STOPPED' || round.status === 'NOT_STARTED'}
                className="py-3 bg-red-950/80 hover:bg-red-800/80 border border-red-600 text-red-300 font-bold rounded-xl flex items-center justify-center space-x-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <Square className="w-4 h-4 fill-red-400 text-red-400" />
                <span>STOP ROUND</span>
              </button>

              <button
                onClick={resetRound}
                className="py-3 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-200 font-bold rounded-xl flex items-center justify-center space-x-2 transition-all"
              >
                <RotateCcw className="w-4 h-4 text-gray-300" />
                <span>RESET</span>
              </button>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-800/80 text-[11px] font-mono text-gray-500">
            Push-to-Talk is only unlocked when Round is <strong>ACTIVE</strong>.
          </div>
        </div>

        {/* Radio Conditions & Difficulty Settings */}
        <div className="lg:col-span-2 bg-radio-panel border border-gray-800 rounded-2xl p-5 shadow-md">
          <div className="flex flex-wrap items-center justify-between pb-3 border-b border-gray-800 mb-4 gap-2">
            <div className="flex items-center space-x-2">
              <Sliders className="w-4 h-4 text-emerald-400" />
              <span className="text-xs uppercase font-extrabold tracking-wider font-mono text-gray-300">
                RADIO CONDITIONS & DIFFICULTY CONFIGURATION
              </span>
            </div>
            <span className="text-xs font-mono font-bold text-amber-400 bg-amber-950/60 border border-amber-800/80 px-2 py-0.5 rounded">
              PRESET: {round.difficultyPreset}
            </span>
          </div>

          {/* Difficulty Preset Selector */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
            {['EASY', 'MEDIUM', 'HARD', 'EXTREME'].map((p) => {
              const isActive = round.difficultyPreset === p;
              return (
                <button
                  key={p}
                  onClick={() => selectPreset(p)}
                  className={`py-2 px-3 rounded-lg font-mono text-xs font-bold transition-all border ${
                    isActive
                      ? 'bg-amber-950/90 border-amber-500 text-amber-200 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                      : 'bg-black/40 hover:bg-gray-800/60 border-gray-700 text-gray-400'
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>

          {/* Granular Sliders */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
            {/* Background Static Noise */}
            <div className="bg-black/40 p-3 rounded-xl border border-gray-800">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-gray-300 font-semibold">Background Static Level</span>
                <span className="text-emerald-400 font-bold">{conditions.staticLevel}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={conditions.staticLevel || 0}
                onChange={(e) => updateCondition('staticLevel', parseInt(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <span className="text-[10px] text-gray-500 mt-1 block">Web Audio API generated noise</span>
            </div>

            {/* Voice Distortion */}
            <div className="bg-black/40 p-3 rounded-xl border border-gray-800">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-gray-300 font-semibold">Voice Distortion / Saturation</span>
                <span className="text-emerald-400 font-bold">{conditions.voiceDistortion}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={conditions.voiceDistortion || 0}
                onChange={(e) => updateCondition('voiceDistortion', parseInt(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <span className="text-[10px] text-gray-500 mt-1 block">Band-pass filter + wave shaper</span>
            </div>

            {/* Transmission Delay */}
            <div className="bg-black/40 p-3 rounded-xl border border-gray-800">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-gray-300 font-semibold">Transmission Delay</span>
                <span className="text-emerald-400 font-bold">{conditions.transmissionDelay} ms</span>
              </div>
              <input
                type="range"
                min="0"
                max="3000"
                step="50"
                value={conditions.transmissionDelay || 0}
                onChange={(e) => updateCondition('transmissionDelay', parseInt(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <span className="text-[10px] text-gray-500 mt-1 block">Simulated latency buffer delay</span>
            </div>

            {/* Signal Interruption Probability */}
            <div className="bg-black/40 p-3 rounded-xl border border-gray-800">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-gray-300 font-semibold">Signal Interruption Prob</span>
                <span className="text-emerald-400 font-bold">{conditions.signalInterruptionProb}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={conditions.signalInterruptionProb || 0}
                onChange={(e) => updateCondition('signalInterruptionProb', parseInt(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <span className="text-[10px] text-gray-500 mt-1 block">Random atmospheric dropouts</span>
            </div>

            {/* Interruption Duration */}
            <div className="bg-black/40 p-3 rounded-xl border border-gray-800">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-gray-300 font-semibold">Interruption Duration</span>
                <span className="text-emerald-400 font-bold">{conditions.interruptionDuration} ms</span>
              </div>
              <input
                type="range"
                min="100"
                max="2000"
                step="50"
                value={conditions.interruptionDuration || 800}
                onChange={(e) => updateCondition('interruptionDuration', parseInt(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <span className="text-[10px] text-gray-500 mt-1 block">Audio dropout recovery time</span>
            </div>

            {/* Connection Failure Probability */}
            <div className="bg-black/40 p-3 rounded-xl border border-gray-800">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-gray-300 font-semibold">Connection Failure Prob</span>
                <span className="text-emerald-400 font-bold">{conditions.connectionFailureProb}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                value={conditions.connectionFailureProb || 0}
                onChange={(e) => updateCondition('connectionFailureProb', parseInt(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <span className="text-[10px] text-gray-500 mt-1 block">Temporary carrier loss simulation</span>
            </div>
          </div>
        </div>
      </div>

      {/* Demo / Test Mode Action Panel */}
      <div className="bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-purple-950/40 border border-purple-800/60 rounded-2xl p-4 sm:p-5 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <h2 className="text-sm font-bold font-mono uppercase tracking-wider text-purple-200">
              DEMO / EVALUATION SIMULATOR
            </h2>
          </div>
          <span className="text-[10px] font-mono text-purple-300 bg-purple-900/50 border border-purple-700 px-2 py-0.5 rounded">
            Allows testing all radio events with 1 device
          </span>
        </div>

        <p className="text-xs font-mono text-gray-400 mb-4">
          Trigger simulated radio events on active channels to inspect PTT locking, audio effects,
          signal dropouts, and channel isolation without requiring 5 physical devices.
        </p>

        <div className="flex flex-wrap gap-2.5 font-mono text-xs">
          <button
            onClick={() => triggerDemoTransmit(teams[0]?.id)}
            disabled={teams.length === 0}
            className="px-3.5 py-2 bg-purple-900/60 hover:bg-purple-800 border border-purple-600 text-purple-200 font-bold rounded-lg flex items-center space-x-1.5 transition-all shadow"
          >
            <Radio className="w-3.5 h-3.5 text-purple-300" />
            <span>Simulate Ghost Transmission (3s)</span>
          </button>

          <button
            onClick={() => triggerDemoInterruption(teams[0]?.id)}
            disabled={teams.length === 0}
            className="px-3.5 py-2 bg-amber-900/60 hover:bg-amber-800 border border-amber-600 text-amber-200 font-bold rounded-lg flex items-center space-x-1.5 transition-all shadow"
          >
            <Zap className="w-3.5 h-3.5 text-amber-300" />
            <span>Simulate EMP Interruption Burst</span>
          </button>

          <button
            onClick={() => triggerDemoConnectionDrop(teams[0]?.id)}
            disabled={teams.length === 0}
            className="px-3.5 py-2 bg-red-900/60 hover:bg-red-800 border border-red-600 text-red-200 font-bold rounded-lg flex items-center space-x-1.5 transition-all shadow"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-red-300" />
            <span>Simulate Carrier Dropout</span>
          </button>
        </div>
      </div>

      {/* Team Channel Monitoring & Creation */}
      <div className="bg-radio-panel border border-gray-800 rounded-2xl p-5 shadow-lg">
        <div className="flex flex-wrap items-center justify-between pb-3 border-b border-gray-800 mb-4 gap-2">
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-emerald-400" />
            <h2 className="text-xs uppercase font-extrabold tracking-wider font-mono text-gray-300">
              TEAM CHANNELS ({teams.length})
            </h2>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3 py-1.5 bg-emerald-950/90 hover:bg-emerald-800 border border-emerald-600 text-emerald-300 text-xs font-mono font-bold rounded-lg flex items-center space-x-1 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>CREATE TEAM CHANNEL</span>
          </button>
        </div>

        {/* Team Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((t) => {
            const hasSpeaker = !!t.currentTransmitter;

            return (
              <div
                key={t.id}
                className={`bg-black/50 rounded-xl p-4 border transition-all ${
                  hasSpeaker ? 'border-red-600/80 shadow-[0_0_15px_rgba(220,38,38,0.2)]' : 'border-gray-800'
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-display font-bold text-base text-gray-100 flex items-center space-x-2">
                      <span>{t.name}</span>
                    </h3>
                    <div className="text-[11px] font-mono text-gray-400 mt-0.5">
                      CH: <span className="text-emerald-400 font-bold">{t.channelCode}</span> ({t.frequency})
                    </div>
                  </div>

                  <div className="flex items-center space-x-1">
                    <span className="text-[11px] font-mono bg-gray-900 px-2 py-0.5 rounded text-gray-400 border border-gray-800">
                      {t.members?.length || 0}/{t.maxMembers}
                    </span>
                    <button
                      onClick={() => handleDeleteTeam(t.id)}
                      title="Delete Channel"
                      className="text-gray-500 hover:text-red-400 p-1 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="mb-3">
                  {hasSpeaker ? (
                    <div className="bg-red-950/80 border border-red-600/80 px-2.5 py-1 rounded text-red-200 text-xs font-mono font-bold flex items-center space-x-1.5 animate-pulse">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      <span>TRANSMITTING: {t.transmitterName || 'OPERATOR'}</span>
                    </div>
                  ) : (
                    <div className="bg-emerald-950/40 border border-emerald-900/60 px-2.5 py-1 rounded text-emerald-400 text-xs font-mono flex items-center space-x-1.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>CHANNEL IDLE</span>
                    </div>
                  )}
                </div>

                {/* Members List */}
                <div className="space-y-1 font-mono text-xs max-h-32 overflow-y-auto">
                  {t.members && t.members.length > 0 ? (
                    t.members.map((m) => (
                      <div
                        key={m.socketId}
                        className="flex items-center justify-between px-2 py-1 rounded bg-gray-900/40 border border-gray-850"
                      >
                        <span className="text-gray-300">{m.name}</span>
                        <span
                          className={`text-[10px] font-bold ${
                            m.isTransmitting ? 'text-red-400' : 'text-emerald-400'
                          }`}
                        >
                          {m.isTransmitting ? '● TX' : '● ONLINE'}
                        </span>
                      </div>
                    ))
                  ) : (
                    <span className="text-gray-500 text-[11px] italic block text-center py-2">
                      No operators connected.
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Master Communication Log Across All Teams */}
      <div className="bg-radio-panel border border-gray-800 rounded-2xl p-5 shadow-lg">
        <div className="flex flex-wrap items-center justify-between pb-3 border-b border-gray-800 mb-4 gap-2">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <h2 className="text-xs uppercase font-extrabold tracking-wider font-mono text-gray-300">
              HQ MASTER COMMUNICATIONS EVENT LOG
            </h2>
          </div>

          {/* Filter options */}
          <div className="flex flex-wrap gap-1.5 text-xs font-mono">
            {['ALL', 'TRANSMIT', 'INTERRUPTION'].map((f) => (
              <button
                key={f}
                onClick={() => setLogFilter(f)}
                className={`px-2.5 py-1 rounded border text-[11px] ${
                  logFilter === f
                    ? 'bg-emerald-950 border-emerald-500 text-emerald-300 font-bold'
                    : 'bg-black/40 border-gray-700 text-gray-400'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5 max-h-64 overflow-y-auto font-mono text-xs">
          {filteredLogs.length > 0 ? (
            filteredLogs.map((l) => {
              let badgeColor = 'text-gray-300';
              if (l.type === 'TRANSMIT_START') badgeColor = 'text-red-400 font-bold';
              else if (l.type === 'TRANSMIT_END') badgeColor = 'text-emerald-400';
              else if (l.type === 'INTERRUPTION') badgeColor = 'text-amber-400 font-bold';
              else if (l.type === 'SYSTEM') badgeColor = 'text-blue-400';

              return (
                <div
                  key={l.id}
                  className="px-3 py-1.5 rounded bg-black/40 border border-gray-850 flex items-start space-x-3"
                >
                  <span className="text-gray-500 text-[11px] flex-shrink-0 pt-0.5">
                    {l.timestamp}
                  </span>
                  <span className="text-[10px] bg-gray-800/80 text-gray-300 px-1.5 py-0.5 rounded flex-shrink-0">
                    {l.teamName || 'HQ'}
                  </span>
                  <span className={`${badgeColor} flex-1 leading-snug`}>
                    {l.message}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="text-center py-6 text-gray-500 font-mono text-xs">
              No radio traffic recorded.
            </div>
          )}
        </div>
      </div>

      {/* Modal: Create Team */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border-2 border-radio-bezel rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold font-display text-emerald-400 tracking-wider uppercase mb-4">
              CREATE NEW TEAM CHANNEL
            </h3>

            {createTeamError && (
              <div className="mb-4 bg-red-950/80 border border-red-600 text-red-200 px-3 py-2 rounded text-xs font-mono">
                {createTeamError}
              </div>
            )}

            <form onSubmit={handleCreateTeam} className="space-y-4 font-mono text-xs">
              <div>
                <label className="block text-gray-300 mb-1">Squad / Team Name</label>
                <input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="e.g. Delta Recon"
                  className="w-full bg-black/80 border border-gray-700 rounded-lg p-2.5 text-emerald-300 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-1">Unique Channel Code</label>
                <input
                  type="text"
                  value={newChannelCode}
                  onChange={(e) => setNewChannelCode(e.target.value.toUpperCase())}
                  placeholder="e.g. DELTA-04"
                  className="w-full bg-black/80 border border-gray-700 rounded-lg p-2.5 text-emerald-300 uppercase focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-1">Max Operators per Team</label>
                <input
                  type="number"
                  min="2"
                  max="30"
                  value={newMaxMembers}
                  onChange={(e) => setNewMaxMembers(e.target.value)}
                  className="w-full bg-black/80 border border-gray-700 rounded-lg p-2.5 text-emerald-300 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg"
                >
                  CREATE CHANNEL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
