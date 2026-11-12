import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Radio,
  Volume2,
  VolumeX,
  AlertTriangle,
  Users,
  Wifi,
  WifiOff,
  Activity,
  Layers,
  ShieldAlert,
  Clock,
  Antenna,
  ChevronRight,
  LogOut
} from 'lucide-react';
import { socketService } from '../services/socketService';
import { webrtcService } from '../services/webrtcService';
import { audioEngine } from '../audio/RadioAudioEngine';
import SignalMeter from './SignalMeter';
import AudioVisualizer from './AudioVisualizer';

export default function RadioWalkieTalkie({ teamData, currentMember, onLeaveChannel, onOpenAdmin }) {
  const [team, setTeam] = useState(teamData);
  const [round, setRound] = useState(teamData.round || { status: 'NOT_STARTED' });
  const [conditions, setConditions] = useState(teamData.round?.conditions || {});
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [currentSpeaker, setCurrentSpeaker] = useState(teamData.currentTransmitter ? teamData.transmitterName : null);
  const [isInterrupted, setIsInterrupted] = useState(false);
  const [isSimConnectionDropped, setIsSimConnectionDropped] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [logs, setLogs] = useState(teamData.logs || []);
  const [socketConnected, setSocketConnected] = useState(true);
  const [micError, setMicError] = useState(null);

  const isSpacePressedRef = useRef(false);
  const pttLockedRef = useRef(false);

  const socket = socketService.getSocket();

  // Initialize Microphone on mount
  useEffect(() => {
    let mounted = true;

    async function initAudio() {
      try {
        await webrtcService.initLocalMicrophone();
        if (mounted) setMicError(null);
      } catch (err) {
        if (mounted) setMicError(err.message);
      }
    }

    initAudio();

    // Hook audio engine interruption callback
    audioEngine.onInterruptionChange = (interrupted) => {
      if (mounted) setIsInterrupted(interrupted);
    };

    return () => {
      mounted = false;
      audioEngine.onInterruptionChange = null;
    };
  }, []);

  // Socket & PTT state listener setup
  useEffect(() => {
    if (!socket) return;

    // Speaker change broadcast from server
    const handleSpeakerChanged = (data) => {
      if (data.transmitterId) {
        setCurrentSpeaker(data.transmitterName);
        setIsBusy(data.transmitterId !== socket.id);
        // Turn on receiver static hiss
        if (data.transmitterId !== socket.id) {
          audioEngine.setTransmissionStatic(true);
        }
      } else {
        // Speaker released
        setCurrentSpeaker(null);
        setIsBusy(false);
        audioEngine.setTransmissionStatic(false);
        // Play authentic Roger beep for listeners!
        if (data.lastSpeakerName && !isTransmitting) {
          audioEngine.playRogerBeep();
        }
      }
    };

    // Member joins team
    const handleMemberJoined = ({ member }) => {
      setTeam((prev) => {
        if (!prev) return prev;
        const exists = prev.members.some((m) => m.socketId === member.socketId);
        const newMembers = exists ? prev.members : [...prev.members, member];
        return { ...prev, members: newMembers };
      });
    };

    // Member leaves team
    const handleMemberLeft = ({ socketId }) => {
      setTeam((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          members: prev.members.filter((m) => m.socketId !== socketId),
        };
      });
    };

    // Round state update
    const handleRoundStatus = (newRound) => {
      setRound(newRound);
      if (newRound.status !== 'ACTIVE' && isTransmitting) {
        handleReleasePtt();
      }
    };

    // Radio conditions updated by Admin
    const handleConditionsUpdated = (newConds) => {
      setConditions(newConds);
      audioEngine.updateConditions(newConds);
    };

    // Signal interruption broadcast
    const handleSignalInterrupted = (data) => {
      audioEngine.triggerInterruption(data.duration || 800);
    };

    // Simulated connection drop
    const handleSimConnectionDrop = (data) => {
      setIsSimConnectionDropped(true);
      audioEngine.playConnectionLostSound();
      setTimeout(() => {
        setIsSimConnectionDropped(false);
        audioEngine.playConnectionRestoredSound();
      }, data.duration || 2500);
    };

    // New log entry
    const handleNewLog = (logEntry) => {
      if (logEntry.teamId === team.id || logEntry.type === 'SYSTEM') {
        setLogs((prev) => [logEntry, ...prev.slice(0, 35)]);
      }
    };

    const handleDisconnect = () => {
      setSocketConnected(false);
      audioEngine.playConnectionLostSound();
    };

    const handleConnect = () => {
      setSocketConnected(true);
      audioEngine.playConnectionRestoredSound();
    };

    socket.on('ptt:speaker-changed', handleSpeakerChanged);
    socket.on('team:member-joined', handleMemberJoined);
    socket.on('team:member-left', handleMemberLeft);
    socket.on('round:status-changed', handleRoundStatus);
    socket.on('conditions:updated', handleConditionsUpdated);
    socket.on('ptt:signal-interrupted', handleSignalInterrupted);
    socket.on('sim:connection-drop', handleSimConnectionDrop);
    socket.on('log:new', handleNewLog);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect', handleConnect);

    return () => {
      socket.off('ptt:speaker-changed', handleSpeakerChanged);
      socket.off('team:member-joined', handleMemberJoined);
      socket.off('team:member-left', handleMemberLeft);
      socket.off('round:status-changed', handleRoundStatus);
      socket.off('conditions:updated', handleConditionsUpdated);
      socket.off('ptt:signal-interrupted', handleSignalInterrupted);
      socket.off('sim:connection-drop', handleSimConnectionDrop);
      socket.off('log:new', handleNewLog);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect', handleConnect);
    };
  }, [socket, team.id, isTransmitting]);

  // Periodic random interruption / failure check according to admin conditions
  useEffect(() => {
    if (!isTransmitting) return;

    const prob = conditions?.signalInterruptionProb || 0;
    if (prob <= 0) return;

    const interval = setInterval(() => {
      const roll = Math.random() * 100;
      if (roll < prob) {
        // Trigger interruption
        const duration = conditions?.interruptionDuration || 800;
        audioEngine.triggerInterruption(duration);
        socket.emit('ptt:signal-interrupted', {
          teamName: team.name,
          duration,
        });
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isTransmitting, conditions, team.name, socket]);

  // PTT Handlers (Server-Authoritative Half-Duplex Lock)
  const handleRequestPtt = useCallback(async () => {
    if (pttLockedRef.current || isTransmitting) return;
    if (isSimConnectionDropped || !socketConnected) return;

    // Check round status
    if (round.status !== 'ACTIVE') {
      audioEngine.playBusyTone();
      return;
    }

    // Try to ensure mic is open
    try {
      await webrtcService.initLocalMicrophone();
    } catch (e) {
      setMicError(e.message);
      return;
    }

    // Play tactile mechanical switch sound on click
    audioEngine.playPttPressSound();

    pttLockedRef.current = true;

    // Request PTT Lock from Server
    socket.emit('ptt:request', {}, (response) => {
      if (response && response.granted) {
        setIsTransmitting(true);
        setCurrentSpeaker(currentMember.name);
        webrtcService.setMicrophoneEnabled(true);
      } else {
        pttLockedRef.current = false;
        setIsTransmitting(false);
        setIsBusy(true);
        audioEngine.playBusyTone();
        if (response && response.currentTransmitter) {
          setCurrentSpeaker(response.currentTransmitter);
        }
      }
    });
  }, [isTransmitting, isSimConnectionDropped, socketConnected, round.status, socket, currentMember.name]);

  const handleReleasePtt = useCallback(() => {
    if (!pttLockedRef.current && !isTransmitting) return;

    pttLockedRef.current = false;
    setIsTransmitting(false);
    webrtcService.setMicrophoneEnabled(false);

    // Play roger beep for oneself
    audioEngine.playRogerBeep();

    // Release PTT lock on Server
    socket.emit('ptt:release', {}, () => {
      setCurrentSpeaker(null);
    });
  }, [isTransmitting, socket]);

  // Keyboard Spacebar PTT shortcut support
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && !e.repeat && !isSpacePressedRef.current) {
        // Prevent accidental page scroll
        const targetTag = e.target.tagName.toLowerCase();
        if (targetTag === 'input' || targetTag === 'textarea') return;

        e.preventDefault();
        isSpacePressedRef.current = true;
        handleRequestPtt();
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        const targetTag = e.target.tagName.toLowerCase();
        if (targetTag === 'input' || targetTag === 'textarea') return;

        e.preventDefault();
        isSpacePressedRef.current = false;
        handleReleasePtt();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleRequestPtt, handleReleasePtt]);

  // Handle Mute Toggle
  const toggleMute = () => {
    const muted = audioEngine.toggleMute();
    setIsMuted(muted);
  };

  // Determine Current Radio Channel State Display
  const getChannelStatus = () => {
    if (!socketConnected || isSimConnectionDropped) {
      return {
        text: 'CONNECTION LOST',
        badge: '⚫ OFFLINE',
        color: 'text-red-500',
        bg: 'bg-red-950/80 border-red-700/60',
        led: 'bg-red-600 animate-ping',
      };
    }
    if (isInterrupted) {
      return {
        text: 'SIGNAL INTERRUPTED',
        badge: '⚠️ STATIC',
        color: 'text-amber-400',
        bg: 'bg-amber-950/80 border-amber-600/60',
        led: 'bg-amber-500 animate-pulse',
      };
    }
    if (round.status !== 'ACTIVE') {
      return {
        text: round.status === 'NOT_STARTED' ? 'STANDBY // WAITING FOR HQ' : 'CHANNEL PAUSED',
        badge: '⏸ STANDBY',
        color: 'text-gray-400',
        bg: 'bg-gray-900/80 border-gray-700/60',
        led: 'bg-gray-500',
      };
    }
    if (isTransmitting) {
      return {
        text: 'TRANSMITTING',
        badge: '🔴 TX ACTIVE',
        color: 'text-red-400',
        bg: 'bg-red-950/90 border-red-600',
        led: 'bg-red-500 shadow-[0_0_12px_#ef4444] animate-pulse',
      };
    }
    if (isBusy || currentSpeaker) {
      return {
        text: `RX // ${currentSpeaker || 'OPERATOR'}`,
        badge: '🟢 RECEIVING',
        color: 'text-emerald-400',
        bg: 'bg-emerald-950/80 border-emerald-600/60',
        led: 'bg-emerald-500 shadow-[0_0_10px_#10b981] animate-pulse',
      };
    }
    return {
      text: 'CHANNEL READY',
      badge: '🟢 READY',
      color: 'text-emerald-400',
      bg: 'bg-emerald-950/40 border-emerald-700/40',
      led: 'bg-emerald-500 shadow-[0_0_6px_#10b981]',
    };
  };

  const status = getChannelStatus();
  const isListening = !!(currentSpeaker && !isTransmitting);

  return (
    <div className="w-full max-w-4xl mx-auto p-2 sm:p-4 md:p-6">
      {/* Top Notification / Microphone Warning if any */}
      {micError && (
        <div className="mb-4 bg-red-950/90 border-2 border-red-600 text-red-200 px-4 py-3 rounded-lg flex items-center justify-between font-mono text-xs sm:text-sm shadow-lg">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-red-400 animate-bounce flex-shrink-0" />
            <span><strong>MIC ERROR:</strong> {micError}</span>
          </div>
          <button
            onClick={() => webrtcService.initLocalMicrophone().then(() => setMicError(null))}
            className="px-3 py-1 bg-red-800 hover:bg-red-700 text-white rounded font-bold uppercase tracking-wider text-xs ml-2"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Walkie-Talkie Chassis Frame */}
      <div className="radio-chassis rounded-3xl p-4 sm:p-6 md:p-8 border-2 border-radio-bezel relative">
        {/* Top Radio Hardware Elements: Antenna & Volume Dial */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-800/80 mb-4">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="w-4 h-10 bg-gradient-to-r from-gray-700 via-gray-500 to-gray-800 rounded-t border-t-2 border-gray-400 shadow-md"></div>
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-6 h-2 bg-gray-900 rounded-full border border-gray-600"></div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs uppercase font-extrabold tracking-widest text-emerald-500 font-display">
                  TAC-COM // RT-8400
                </span>
                <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800/80 px-1.5 py-0.5 rounded font-mono">
                  MIL-STD-810G
                </span>
              </div>
              <p className="text-[11px] text-gray-400 font-mono">
                HALF-DUPLEX TACTICAL TRANSCEIVER
              </p>
            </div>
          </div>

          {/* Quick Hardware Controls: Mute & Channel Leave */}
          <div className="flex items-center space-x-2">
            <button
              onClick={toggleMute}
              title={isMuted ? 'Unmute Speaker' : 'Mute Speaker'}
              className={`p-2 rounded-lg border transition-all ${
                isMuted
                  ? 'bg-red-950/80 border-red-600 text-red-400'
                  : 'bg-gray-800/80 hover:bg-gray-700 border-gray-600 text-gray-300'
              }`}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onLeaveChannel}
              title="Disconnect / Change Team"
              className="px-2.5 py-1.5 bg-gray-800/80 hover:bg-red-900/60 border border-gray-700 hover:border-red-600 text-gray-300 hover:text-red-300 rounded-lg text-xs font-mono flex items-center space-x-1.5 transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">EXIT</span>
            </button>
          </div>
        </div>

        {/* Tactical LCD Display Screen */}
        <div className="crt-screen rounded-2xl p-4 sm:p-5 mb-6 text-emerald-400 font-mono">
          {/* LCD Header: Frequency, Channel, Signal RSSI */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-900/60 pb-3 mb-3">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-1.5 bg-emerald-950/80 border border-emerald-700/60 px-2.5 py-1 rounded">
                <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                <span className="text-xs sm:text-sm font-bold tracking-wider text-emerald-300">
                  {team.frequency || '142.850 MHz'}
                </span>
              </div>
              <div className="bg-black/60 px-2.5 py-1 rounded border border-emerald-900/60">
                <span className="text-xs sm:text-sm font-extrabold tracking-widest text-emerald-200">
                  CH: {team.channelCode}
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <SignalMeter
                conditions={conditions}
                isInterrupted={isInterrupted}
                isConnected={socketConnected && !isSimConnectionDropped}
              />
            </div>
          </div>

          {/* LCD Center Display: Channel Status, Speaker Identification */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center py-2">
            <div>
              <div className="text-[11px] text-emerald-600 font-semibold uppercase tracking-wider mb-0.5">
                ACTIVE CHANNEL // SQUAD
              </div>
              <h2 className="text-lg sm:text-2xl font-black font-display tracking-wide text-emerald-100 flex items-center space-x-2">
                <span>{team.name}</span>
              </h2>
              <div className="text-xs text-emerald-400/80 mt-1 flex items-center space-x-2">
                <span>OPERATOR: <strong>{currentMember.name}</strong></span>
                <span className="text-emerald-700">|</span>
                <span className="text-emerald-500">NET ID: {team.channelCode}</span>
              </div>
            </div>

            {/* Live Status Indicator Box */}
            <div className={`p-3 rounded-xl border ${status.bg} transition-all duration-300 shadow-md`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] uppercase font-bold tracking-widest text-gray-300">
                  TRANSCEIVER STATE
                </span>
                <div className="flex items-center space-x-1.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${status.led}`}></div>
                  <span className={`text-[10px] font-extrabold tracking-wider ${status.color}`}>
                    {status.badge}
                  </span>
                </div>
              </div>
              <div className={`text-base sm:text-lg font-black tracking-wider uppercase ${status.color} truncate`}>
                {status.text}
              </div>
            </div>
          </div>

          {/* Real-time Oscilloscope / Spectrum Waveform Canvas */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-[10px] text-emerald-600 mb-1">
              <span>AUDIO SPECTRUM // 300Hz - 3.2kHz</span>
              <span>{isTransmitting ? 'TX CARRIER 100%' : isListening ? 'RX MODULATING' : 'SQUELCH CLOSED'}</span>
            </div>
            <AudioVisualizer
              isActive={isTransmitting || isListening}
              isTransmitting={isTransmitting}
              isListening={isListening}
              isInterrupted={isInterrupted}
            />
          </div>
        </div>

        {/* Center Section: Massive Tactile PTT Button */}
        <div className="flex flex-col items-center justify-center my-4 sm:my-6">
          <div className="relative group select-none">
            {/* Outer tactile textured bezel */}
            <div className={`p-4 sm:p-5 rounded-3xl transition-all duration-200 ${
              isTransmitting
                ? 'bg-gradient-to-b from-red-600/30 to-red-950/60 shadow-[0_0_30px_rgba(220,38,38,0.5)] border-2 border-red-500'
                : isBusy
                ? 'bg-amber-950/30 border-2 border-amber-600/40'
                : 'bg-gradient-to-b from-gray-800/40 to-gray-900/60 border-2 border-gray-700/60'
            }`}>
              <button
                type="button"
                onMouseDown={handleRequestPtt}
                onMouseUp={handleReleasePtt}
                onMouseLeave={handleReleasePtt}
                onTouchStart={(e) => {
                  e.preventDefault();
                  handleRequestPtt();
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  handleReleasePtt();
                }}
                onTouchCancel={(e) => {
                  e.preventDefault();
                  handleReleasePtt();
                }}
                disabled={isSimConnectionDropped || !socketConnected || round.status !== 'ACTIVE'}
                className={`ptt-button-tactical w-56 h-56 sm:w-64 sm:h-64 rounded-2xl flex flex-col items-center justify-center cursor-pointer select-none border-4 transition-all duration-150 ${
                  isTransmitting
                    ? 'is-pressed bg-gradient-to-b from-red-600 to-red-800 border-red-400 shadow-[0_0_40px_rgba(220,38,38,0.9)] text-white'
                    : isBusy
                    ? 'bg-gradient-to-b from-amber-600 to-amber-800 border-amber-400 text-amber-100 shadow-[0_0_20px_rgba(217,119,6,0.6)] cursor-not-allowed'
                    : isInterrupted
                    ? 'bg-gradient-to-b from-yellow-700 to-red-800 border-yellow-500 text-yellow-200'
                    : round.status !== 'ACTIVE'
                    ? 'bg-gray-800 border-gray-600 text-gray-500 cursor-not-allowed opacity-75'
                    : 'bg-gradient-to-b from-red-700 hover:from-red-600 to-red-900 border-red-500/80 hover:border-red-400 text-white shadow-[0_12px_28px_rgba(0,0,0,0.8),inset_0_2px_4px_rgba(255,255,255,0.25)]'
                }`}
              >
                {/* Tactical Icon & Label */}
                <div className="relative mb-3">
                  {isTransmitting ? (
                    <Mic className="w-16 h-16 sm:w-20 sm:h-20 text-white animate-bounce" />
                  ) : isBusy ? (
                    <MicOff className="w-16 h-16 sm:w-20 sm:h-20 text-amber-200 animate-pulse" />
                  ) : (
                    <Mic className="w-16 h-16 sm:w-20 sm:h-20 text-white/95" />
                  )}
                  {isTransmitting && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500"></span>
                    </span>
                  )}
                </div>

                <div className="text-center px-4">
                  <div className="text-xl sm:text-2xl font-black font-display tracking-widest uppercase">
                    {isTransmitting
                      ? 'TRANSMITTING'
                      : isBusy
                      ? 'CHANNEL BUSY'
                      : isInterrupted
                      ? 'SIGNAL LOST'
                      : round.status !== 'ACTIVE'
                      ? 'STAND BY'
                      : 'PUSH TO TALK'}
                  </div>
                  <div className="text-[11px] sm:text-xs font-mono uppercase tracking-wider mt-1 opacity-80">
                    {isTransmitting
                      ? 'RELEASE TO LISTEN'
                      : isBusy
                      ? `${currentSpeaker || 'OTHER'} IS TALKING`
                      : round.status !== 'ACTIVE'
                      ? 'WAIT FOR HQ'
                      : 'HOLD TO TRANSMIT'}
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Quick Keyboard Instruction Help */}
          <div className="mt-3 text-center">
            <span className="text-[11px] font-mono text-gray-400 bg-gray-900/80 px-3 py-1 rounded-full border border-gray-700/60 inline-flex items-center space-x-1.5">
              <span>⌨️ SHORTCUT:</span>
              <kbd className="px-1.5 py-0.5 bg-gray-800 text-emerald-400 rounded font-bold border border-gray-600 text-[10px]">
                SPACEBAR
              </kbd>
              <span>(HOLD TO TALK)</span>
            </span>
          </div>
        </div>

        {/* Lower Grid: Team Roster & Communication Event Log */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-4 border-t border-gray-800/80">
          {/* Team Members Roster */}
          <div className="bg-radio-dark/90 rounded-xl p-3.5 border border-gray-800">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-800 text-xs font-mono">
              <span className="flex items-center space-x-1.5 text-gray-300 font-bold">
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                <span>TEAM OPERATORS ({team.members?.length || 0}/{team.maxMembers})</span>
              </span>
              <span className="text-[10px] text-gray-500">CHANNEL: {team.channelCode}</span>
            </div>

            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {team.members && team.members.length > 0 ? (
                team.members.map((m) => {
                  const isCurrent = m.socketId === socket.id;
                  const isTalking = m.name === currentSpeaker;

                  return (
                    <div
                      key={m.socketId}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-mono border transition-all ${
                        isTalking
                          ? 'bg-red-950/70 border-red-600/80 text-red-200'
                          : isCurrent
                          ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-200'
                          : 'bg-gray-900/60 border-gray-800 text-gray-300'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            isTalking ? 'bg-red-500 animate-ping' : 'bg-emerald-500'
                          }`}
                        />
                        <span className="font-semibold">
                          {m.name} {isCurrent && '(YOU)'}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2 text-[10px]">
                        {isTalking ? (
                          <span className="bg-red-900/90 text-red-200 px-1.5 py-0.5 rounded font-bold animate-pulse flex items-center space-x-1">
                            <Mic className="w-2.5 h-2.5" />
                            <span>TALKING</span>
                          </span>
                        ) : (
                          <span className="text-gray-500">STANDBY</span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-4 text-xs text-gray-500 font-mono">
                  No other operators connected.
                </div>
              )}
            </div>
          </div>

          {/* Team Radio Communication Log */}
          <div className="bg-radio-dark/90 rounded-xl p-3.5 border border-gray-800">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-800 text-xs font-mono">
              <span className="flex items-center space-x-1.5 text-gray-300 font-bold">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span>COMMS EVENT LOG</span>
              </span>
              <span className="text-[10px] text-gray-500">LIVE FEED</span>
            </div>

            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 font-mono text-[11px]">
              {logs && logs.length > 0 ? (
                logs.map((l) => {
                  let badgeColor = 'text-gray-400';
                  if (l.type === 'TRANSMIT_START') badgeColor = 'text-red-400';
                  else if (l.type === 'TRANSMIT_END') badgeColor = 'text-emerald-400';
                  else if (l.type === 'INTERRUPTION') badgeColor = 'text-amber-400';
                  else if (l.type === 'CONNECT') badgeColor = 'text-blue-400';

                  return (
                    <div
                      key={l.id}
                      className="px-2.5 py-1 rounded bg-black/40 border border-gray-850 flex items-start space-x-2"
                    >
                      <span className="text-gray-600 text-[10px] flex-shrink-0 pt-0.5">
                        {l.timestamp}
                      </span>
                      <span className={`text-xs ${badgeColor} flex-1 leading-snug`}>
                        {l.message}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-4 text-xs text-gray-500 font-mono">
                  Channel traffic clear.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
